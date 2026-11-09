package expo.modules.appblocker

import android.accessibilityservice.AccessibilityService
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.PowerManager
import android.os.SystemClock
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import android.view.inputmethod.InputMethodManager

/**
 * The watcher. Android tells it each time a different app's window comes to the front, and
 * when something scrolls. Window content is only inspected for the short-video apps in
 * [ShortFormRules], and only for layout IDs and tab labels (never text).
 *
 * Every TICK_MS it:
 *  1. adds the elapsed time to today's totals for the app on screen (whole app, and its
 *     Reels/Shorts scope if the viewer was open), plus a tracked app playing in a floating
 *     (picture-in-picture) window;
 *  2. re-checks whether the Reels/Shorts viewer is open;
 *  3. shows the popup if a limit has been reached.
 *
 * Popup modes:
 *  - whole-app limit → popup anywhere in the app; "Take a break" goes to the home screen.
 *  - Reels limit     → popup only inside the viewer; "Leave Reels" taps the app's Home tab or
 *                      presses Back, so the rest of the app stays usable.
 *
 * Threads: Android calls us on the app's main thread, which our own screens also use. Asking
 * other apps about their screens can take a moment, so all of the work runs on a background
 * thread ([bg]); the main thread only copies each event across. Fields below are touched only
 * on [bg].
 *
 * Android restarts this service by itself after a reboot, as long as the user left it
 * turned on in Accessibility settings.
 */
class BlockerService : AccessibilityService() {

  private lateinit var worker: HandlerThread
  private lateinit var bg: Handler
  private lateinit var overlay: BlockerOverlay

  private var currentPkg: String? = null
  private var lastTick = 0L
  private var lastShown = 0L
  private var breakPkg: String? = null
  private var breakAt = 0L

  /** Is the short-video viewer of [currentPkg] on screen (as of the last check)? */
  private var inShort = false
  /** Was it recognised by layout ID (true) or by tab label (false)? */
  private var matchedById = false
  private var lastScrollAt = 0L
  /** The reel/short container seen at the last check, for apps counted by page change. */
  private var lastPage: AccessibilityNodeInfo? = null

  /** A tracked app shown in a floating window while another app is in front, if any. */
  private var pipPkg: String? = null
  /** Is that floating window showing Reels/Shorts? */
  private var pipInShort = false
  /** The app we last left while its Reels/Shorts viewer was open (floating windows keep playing it). */
  private var leftInShortPkg: String? = null
  private var lastPipExpand = 0L

  /**
   * "Pay toll" was tapped for this app at [tollAt]. Our Toll screen can take a few seconds to
   * open, and until it does the blocked app is still in front; without this grace period the next
   * tick would show the popup again, on top of the Toll screen. Ends when our app is in front.
   */
  private var tollPkg: String? = null
  private var tollAt = 0L

  /** Windows from these packages don't count as "switching apps" (status bar, keyboards). */
  private val ignored = mutableSetOf("com.android.systemui")

  private val ticker = object : Runnable {
    override fun run() {
      syncForegroundApp()
      flush()
      checkFloatingWindow()
      currentPkg?.let {
        if (!overlay.isShowing) detect(it)
        enforce(it)
      }
      enforceFloatingWindow()
      bg.postDelayed(this, TICK_MS)
    }
  }

  override fun onServiceConnected() {
    super.onServiceConnected()
    running = true
    worker = HandlerThread("MmsBlocker").apply { start() }
    bg = Handler(worker.looper)
    // Popup buttons are tapped on the main thread; hand the work to the blocker's thread.
    overlay = BlockerOverlay(
      this,
      onPayToll = { pkg, scope -> bg.post { tollPkg = pkg; tollAt = SystemClock.elapsedRealtime(); openToll(pkg, scope) } },
      onTakeBreak = { pkg, leaveWithBack -> bg.post { takeBreak(pkg, leaveWithBack) } },
    )
    bg.post {
      val imm = getSystemService(Context.INPUT_METHOD_SERVICE) as? InputMethodManager
      imm?.enabledInputMethodList?.forEach { ignored.add(it.packageName) }
      lastTick = SystemClock.elapsedRealtime()
      syncForegroundApp()
      bg.removeCallbacks(ticker)
      bg.postDelayed(ticker, TICK_MS)
    }
  }

  /** Runs on the main thread: copy what we need and hand it to the blocker's thread. */
  override fun onAccessibilityEvent(event: AccessibilityEvent?) {
    event ?: return
    if (!::bg.isInitialized) return
    val pkg = event.packageName?.toString() ?: return
    when (event.eventType) {
      AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED -> bg.post { onWindowChanged(pkg) }
      AccessibilityEvent.TYPE_VIEW_SCROLLED -> {
        if (ShortFormRules.forPkg(pkg) == null) return
        // Android reuses the event object after we return, so keep a copy for the other thread.
        val copy = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
          AccessibilityEvent(event)
        } else {
          @Suppress("DEPRECATION") AccessibilityEvent.obtain(event)
        }
        bg.post { onScrolled(pkg, copy) }
      }
    }
  }

  /**
   * We normally learn which app is open from "window changed" events, but some switches don't
   * send one (e.g. going Home with a gesture on Samsung phones), and right after the service
   * starts (reboot, app update) none has arrived yet. So every tick we also ask Android which
   * app owns the active window and treat a difference as a switch.
   */
  private fun syncForegroundApp() {
    val pkg = activePkg() ?: return
    if (pkg == currentPkg || pkg in ignored) return
    if (pkg == packageName && overlay.isShowing) return // that's our popup, not a switch
    Log.d(TAG, "foreground app: $pkg (was $currentPkg)")
    onWindowChanged(pkg)
  }

  /** Package of the app that owns the active window, or null if Android can't tell us. */
  private fun activePkg(): String? =
    try { rootInActiveWindow?.packageName?.toString() } catch (_: Exception) { null }

  private fun onWindowChanged(pkg: String) {
    if (pkg in ignored) return
    // Our own popup also fires window events; they don't mean the user switched apps.
    if (pkg == packageName && overlay.isShowing) return
    // Some apps send window events from windows that aren't in front (Samsung's Google Discover
    // panel, Samsung Pay hints). Only switch if that app really owns the active window; if Android
    // is just slow to update, the re-check shortly after catches the real switch.
    if (pkg != packageName && pkg != currentPkg) {
      val active = activePkg()
      if (active != null && active != pkg) {
        bg.postDelayed({ syncForegroundApp() }, WINDOW_SETTLE_MS)
        return
      }
    }

    flush() // credit time to the app (and viewer state) we're leaving
    if (pkg == packageName) tollPkg = null // our Toll screen opened; the grace period is over
    if (pkg != currentPkg) {
      // Remember an app left while its Reels/Shorts viewer was open: it may keep playing in a
      // floating window. Only that same app leaving normally clears it (Samsung briefly reports
      // other windows, like Google Discover, while going Home).
      currentPkg?.let { if (inShort) leftInShortPkg = it else if (it == leftInShortPkg) leftInShortPkg = null }
      currentPkg = pkg
      inShort = false
      matchedById = false
      lastPage = null
    }

    // The user left the blocked app (home, another app, our app): take the popup down.
    if (overlay.isShowing && overlay.shownFor != pkg) overlay.hide()

    if (!overlay.isShowing) detect(pkg)
    enforce(pkg)
  }

  /**
   * Counts reels/shorts: each swipe in the viewer fires a burst of scroll events, so a burst
   * (events closer together than SWIPE_GAP_MS) counts as one.
   */
  private fun onScrolled(pkg: String, event: AccessibilityEvent) {
    if (pkg != currentPkg || !inShort || overlay.isShowing) return
    // "Leave Reels" taps the Home tab, which itself scrolls; that isn't a reel watched.
    if (pkg == breakPkg && SystemClock.elapsedRealtime() - breakAt < BREAK_COOLDOWN_MS) return
    val rule = ShortFormRules.forPkg(pkg) ?: return
    if (rule.pageId != null) {
      // Counted by page change: check which reel is on screen once the swipe has settled.
      bg.removeCallbacks(pageCheck)
      bg.postDelayed(pageCheck, PAGE_SETTLE_MS)
      return
    }
    if (!BlockerStore.isTracked(this, pkg)) return

    // When the viewer was found by ID, only count scrolls of that viewer (not e.g. a comments sheet).
    if (matchedById && rule.viewIds.isNotEmpty()) {
      val sourceId = try { event.source?.viewIdResourceName } catch (_: Exception) { null }
      if (sourceId != null && sourceId !in rule.viewIds) return
    }

    val now = SystemClock.elapsedRealtime()
    val newSwipe = now - lastScrollAt > SWIPE_GAP_MS
    lastScrollAt = now
    if (newSwipe) {
      BlockerStore.addCount(this, BlockerStore.shortScope(pkg))
      Log.d(TAG, "$pkg ${rule.feedName}: swipe counted")
    }
  }

  private val pageCheck = Runnable {
    currentPkg?.let { if (inShort && !overlay.isShowing) detect(it) }
  }

  private fun takeBreak(pkg: String, leaveWithBack: Boolean) {
    breakPkg = pkg
    breakAt = SystemClock.elapsedRealtime()
    if (leaveWithBack) leaveShortViewer(pkg) else performGlobalAction(GLOBAL_ACTION_HOME)
  }

  /**
   * "Leave Reels": get out of the viewer but stay in the app. Escalates step by step, checking
   * after each one whether the viewer is gone:
   *   1. tap the app's Home tab if it's on screen (never leaves the app; Instagram's Reels *tab*
   *      ignores Back, and Back on a first screen would close the app), otherwise press Back
   *      (works when a reel was opened full-screen from the feed or a chat);
   *   2. press Back;
   *   3. give up and go to the phone's home screen, so the user is never stuck.
   */
  private fun leaveShortViewer(pkg: String) {
    // The popup was only just removed; give Android a moment to make the app's window active
    // again, otherwise rootInActiveWindow still points at our popup and the Home tab isn't found.
    bg.postDelayed({ leaveShortViewerNow(pkg) }, WINDOW_SETTLE_MS)
  }

  private fun leaveShortViewerNow(pkg: String) {
    val rule = ShortFormRules.forPkg(pkg)
    val root = try { rootInActiveWindow } catch (_: Exception) { null }
      ?.takeIf { it.packageName?.toString() == pkg }
    val tapped = rule != null && root != null && ShortFormRules.clickExitTab(rule, root)
    if (!tapped) performGlobalAction(GLOBAL_ACTION_BACK)
    Log.d(TAG, "$pkg: leaving ${rule?.feedName} by ${if (tapped) "tapping Home tab" else "Back"}")
    bg.postDelayed({ escapeStep(pkg, 1) }, ESCAPE_CHECK_MS)
  }

  private fun escapeStep(pkg: String, step: Int) {
    if (currentPkg != pkg || overlay.isShowing) return
    detect(pkg)
    if (!inShort) return
    breakAt = SystemClock.elapsedRealtime() // keep the popup from coming back mid-escape
    val rule = ShortFormRules.forPkg(pkg) ?: return
    if (step == 1) {
      Log.d(TAG, "$pkg: still in ${rule.feedName}; pressing Back")
      performGlobalAction(GLOBAL_ACTION_BACK)
      bg.postDelayed({ escapeStep(pkg, 2) }, ESCAPE_CHECK_MS)
    } else {
      Log.d(TAG, "$pkg: still in ${rule.feedName}; going to the home screen")
      performGlobalAction(GLOBAL_ACTION_HOME)
    }
  }

  /** Re-checks whether the short-video viewer is on screen, for supported apps only. */
  private fun detect(pkg: String) {
    val rule = ShortFormRules.forPkg(pkg)
    if (rule == null || !BlockerStore.isTracked(this, pkg)) {
      inShort = false
      return
    }
    val root = try { rootInActiveWindow } catch (_: Exception) { null } ?: return
    // The active window can briefly belong to something else (a system dialog); keep the old state.
    if (root.packageName?.toString() != pkg) return

    val match = ShortFormRules.match(rule, root)
    val wasInShort = inShort
    inShort = match != ShortFormRules.Match.NONE
    matchedById = match == ShortFormRules.Match.BY_ID
    if (inShort != wasInShort) Log.d(TAG, "$pkg ${rule.feedName}: ${if (inShort) "entered ($match)" else "left"}")
    if (!inShort) {
      lastPage = null
      return
    }
    BlockerStore.noteRuleMatch(this, pkg)
    // Entering the viewer means one reel is already playing; later swipes add the rest.
    if (!wasInShort) {
      BlockerStore.addCount(this, BlockerStore.shortScope(pkg))
      lastScrollAt = SystemClock.elapsedRealtime()
    }
    if (rule.pageId != null) {
      val page = ShortFormRules.visiblePage(rule, root) ?: return
      val previous = lastPage
      lastPage = page
      // A different container on screen than at the last check means the user swiped.
      if (wasInShort && previous != null && page != previous) {
        BlockerStore.addCount(this, BlockerStore.shortScope(pkg))
        Log.d(TAG, "$pkg ${rule.feedName}: new page counted")
      }
    }
  }

  /**
   * Looks for a tracked app in a floating (picture-in-picture) window, e.g. YouTube keeps
   * playing a Short in a small window after the user goes Home or opens our Toll screen.
   */
  private fun checkFloatingWindow() {
    pipPkg = null
    pipInShort = false
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val list = try { windows } catch (_: Exception) { return }
    for (w in list) {
      if (!w.isInPictureInPictureMode) continue
      val root = try { w.root } catch (_: Exception) { null } ?: continue
      val pkg = root.packageName?.toString() ?: continue
      if (pkg == currentPkg || pkg == packageName || !BlockerStore.isTracked(this, pkg)) continue
      pipPkg = pkg
      val rule = ShortFormRules.forPkg(pkg)
      pipInShort = rule != null &&
        (leftInShortPkg == pkg || ShortFormRules.match(rule, root) != ShortFormRules.Match.NONE)
      return
    }
  }

  /**
   * Is the app in front our own app or another limited app? Android only tells us that *some*
   * sound is playing, not which app makes it, so while such an app is in front (Facebook Reels
   * playing, our Toll screen) a paused floating window would look like it's playing. In that case
   * the floating window is neither counted nor reopened. Exact per-app playback would need the
   * "Notification access" permission (possible later).
   */
  private fun frontAppIsWatched(): Boolean {
    val cur = currentPkg ?: return false
    return cur == packageName || BlockerStore.isTracked(this, cur)
  }

  /** A floating window only uses up time while it's actually playing (sound is on). */
  private fun floatingIsPlaying(): Boolean =
    (getSystemService(Context.AUDIO_SERVICE) as? AudioManager)?.isMusicActive == true

  /**
   * Adds the time since the last tick to the app on screen (if it's tracked, visible and the
   * screen is on) and to a tracked app playing in a floating window.
   */
  private fun flush() {
    val now = SystemClock.elapsedRealtime()
    val ms = now - lastTick
    lastTick = now
    if (!isScreenOn()) return

    val pkg = currentPkg
    if (pkg != null && pkg != packageName && !overlay.isShowing && BlockerStore.isTracked(this, pkg)) {
      BlockerStore.addUsage(this, pkg, ms) // whole-app time always includes Reels time
      val short = BlockerStore.shortScope(pkg)
      if (ShortFormRules.forPkg(pkg) != null && BlockerStore.limitMinutes(this, short) != null) {
        if (inShort) {
          BlockerStore.addUsage(this, short, ms)
        } else {
          BlockerStore.addRuleMiss(this, pkg, ms)
          // Safety net: detection looks broken, so count the whole app against the Reels limit.
          if (BlockerStore.isRulesStale(this, pkg)) BlockerStore.addUsage(this, short, ms)
        }
      }
    }

    val pip = pipPkg
    if (pip != null && floatingIsPlaying() && !frontAppIsWatched()) {
      BlockerStore.addUsage(this, pip, ms)
      if (pipInShort) BlockerStore.addUsage(this, BlockerStore.shortScope(pip), ms)
    }
  }

  private fun enforce(pkg: String) {
    if (pkg == packageName) return
    if (overlay.isShowing) return
    val short = BlockerStore.shortScope(pkg)
    val request = when {
      BlockerStore.isOverLimit(this, pkg) -> BlockRequest(pkg, pkg, leaveWithBack = false)
      inShort && BlockerStore.isOverLimit(this, short) -> BlockRequest(pkg, short, leaveWithBack = true)
      // Safety net: we can't see the viewer, so block the whole app but charge the Reels scope.
      BlockerStore.isRulesStale(this, pkg) && BlockerStore.isOverLimit(this, short) ->
        BlockRequest(pkg, short, leaveWithBack = false)
      else -> return
    }
    val now = SystemClock.elapsedRealtime()
    if (now - lastShown < RESHOW_GAP_MS) return
    if (pkg == tollPkg && now - tollAt < TOLL_OPEN_GRACE_MS) return // Toll screen is opening
    // Apps can send a late "window opened" event right after the user chose "Take a break";
    // don't let that pop the overlay straight back up.
    if (pkg == breakPkg && now - breakAt < BREAK_COOLDOWN_MS) return
    lastShown = now
    overlay.show(request)
  }

  /**
   * A floating window over its limit and still playing: bring the app back to full screen, where
   * the normal popup takes over. At most once every PIP_EXPAND_GAP_MS so it can't loop.
   */
  private fun enforceFloatingWindow() {
    val pip = pipPkg ?: return
    if (overlay.isShowing || !floatingIsPlaying()) return
    // Never pull the user away from our own screens (paying a toll) or from another limited app.
    if (frontAppIsWatched()) return
    val now0 = SystemClock.elapsedRealtime()
    if (pip == tollPkg && now0 - tollAt < TOLL_OPEN_GRACE_MS) return
    // The user just chose "Take a break" / "Leave Reels" and the app shrank into a floating
    // window by itself (YouTube does this when you leave it). Reopening it would trap them in a
    // loop, so pause the video instead; if they press play again later, the normal rule applies.
    if (pip == breakPkg && now0 - breakAt < PIP_AFTER_BREAK_MS) {
      Log.d(TAG, "$pip: floating window right after a break; pausing it")
      pauseMedia()
      return
    }
    val over = BlockerStore.isOverLimit(this, pip) ||
      (pipInShort && BlockerStore.isOverLimit(this, BlockerStore.shortScope(pip)))
    if (!over) return
    val now = SystemClock.elapsedRealtime()
    if (now - lastPipExpand < PIP_EXPAND_GAP_MS) return
    lastPipExpand = now
    Log.d(TAG, "$pip: floating window over its limit; reopening full screen")
    val intent = packageManager.getLaunchIntentForPackage(pip)?.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK) ?: return
    try {
      startActivity(intent)
    } catch (_: Exception) {
    }
  }

  /**
   * Pauses whatever video/music is playing: taking full audio focus tells media apps to stop,
   * and they don't resume when we hand it back a moment later.
   */
  private fun pauseMedia() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val am = getSystemService(Context.AUDIO_SERVICE) as? AudioManager ?: return
    val req = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
      .setAudioAttributes(
        AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_MEDIA)
          .setContentType(AudioAttributes.CONTENT_TYPE_MOVIE)
          .build()
      )
      .setOnAudioFocusChangeListener { }
      .build()
    am.requestAudioFocus(req)
    bg.postDelayed({ am.abandonAudioFocusRequest(req) }, 500)
  }

  private fun openToll(pkg: String, scope: String) {
    val uri = "$DEEP_LINK_SCHEME://toll?pkg=${Uri.encode(pkg)}&scope=${Uri.encode(scope)}"
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(uri))
      .setPackage(packageName)
      .addFlags(
        Intent.FLAG_ACTIVITY_NEW_TASK or
          Intent.FLAG_ACTIVITY_SINGLE_TOP or
          Intent.FLAG_ACTIVITY_CLEAR_TOP
      )
    try {
      startActivity(intent)
    } catch (_: Exception) {
      performGlobalAction(GLOBAL_ACTION_HOME)
    }
  }

  private fun isScreenOn(): Boolean =
    (getSystemService(Context.POWER_SERVICE) as? PowerManager)?.isInteractive ?: true

  override fun onInterrupt() {}

  override fun onUnbind(intent: Intent?): Boolean {
    if (::overlay.isInitialized) overlay.hide()
    return super.onUnbind(intent)
  }

  override fun onDestroy() {
    if (::bg.isInitialized) {
      bg.removeCallbacksAndMessages(null)
      worker.quitSafely()
    }
    if (::overlay.isInitialized) overlay.hide()
    running = false
    super.onDestroy()
  }

  companion object {
    /** Must match "scheme" in app.json. */
    const val DEEP_LINK_SCHEME = "mindmusclesync"
    const val TICK_MS = 2_000L
    const val RESHOW_GAP_MS = 800L
    const val BREAK_COOLDOWN_MS = 1_500L
    const val SWIPE_GAP_MS = 700L
    const val ESCAPE_CHECK_MS = 700L
    const val WINDOW_SETTLE_MS = 250L
    const val PAGE_SETTLE_MS = 800L
    const val TOLL_OPEN_GRACE_MS = 10_000L
    const val PIP_AFTER_BREAK_MS = 30_000L
    const val PIP_EXPAND_GAP_MS = 10_000L
    /** Filter logs with: adb logcat -s MmsBlocker */
    const val TAG = "MmsBlocker"

    @Volatile
    var running = false
  }
}

/**
 * What the popup should block.
 * @param scope the limit that was reached: the app's package, or "<pkg>:short" for Reels/Shorts.
 * @param leaveWithBack true for a Reels limit: "Leave Reels" taps Home/presses Back instead of
 *   going to the phone's home screen.
 */
data class BlockRequest(val pkg: String, val scope: String, val leaveWithBack: Boolean)
