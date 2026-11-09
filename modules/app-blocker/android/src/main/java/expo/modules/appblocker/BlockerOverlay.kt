package expo.modules.appblocker

import android.accessibilityservice.AccessibilityService
import android.content.Context
import android.graphics.PixelFormat
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.view.LayoutInflater
import android.view.View
import android.view.WindowManager
import android.view.animation.DecelerateInterpolator
import android.widget.TextView

/**
 * The popup drawn on top of a blocked app.
 *
 * It uses TYPE_ACCESSIBILITY_OVERLAY, a window type only Accessibility services may create,
 * so no extra "draw over other apps" permission is needed. While it's showing:
 * - it covers the whole screen and swallows taps, so the app behind can't be used;
 * - it takes audio focus, which makes video apps pause;
 * - the back button counts as "take a break" (or "leave Reels" for a Reels limit).
 *
 * Threads: the blocker's logic runs on its own background thread, but Android views must be
 * created and removed on the main thread. [show] and [hide] can be called from any thread;
 * they update [isShowing]/[shownFor] immediately and do the view work on the main thread.
 */
class BlockerOverlay(
  private val service: AccessibilityService,
  private val onPayToll: (pkg: String, scope: String) -> Unit,
  private val onTakeBreak: (pkg: String, leaveWithBack: Boolean) -> Unit,
) {
  private val windowManager = service.getSystemService(Context.WINDOW_SERVICE) as WindowManager
  private val audioManager = service.getSystemService(Context.AUDIO_SERVICE) as AudioManager
  private var focusRequest: AudioFocusRequest? = null

  private val main = Handler(Looper.getMainLooper())

  /** The popup's view while it's on screen. Main thread only. */
  private var root: OverlayRootView? = null

  /** Package of the app the popup is covering (or about to cover), or null when hidden. */
  @Volatile
  var shownFor: String? = null
    private set

  @Volatile
  private var showing = false

  val isShowing: Boolean
    get() = showing

  /** Shows the popup for [request]. Safe to call from any thread. */
  fun show(request: BlockRequest) {
    if (showing && shownFor == request.pkg) return
    showing = true
    shownFor = request.pkg
    main.post { showNow(request) }
  }

  /** Removes the popup. Safe to call from any thread. */
  fun hide() {
    if (!showing) return
    showing = false
    shownFor = null
    main.post { hideNow() }
  }

  private fun showNow(request: BlockRequest) {
    val pkg = request.pkg
    if (!showing || shownFor != pkg) return // hidden again before we got here
    if (root != null) hideNow()

    val view = LayoutInflater.from(service).inflate(R.layout.mms_blocker_overlay, null) as OverlayRootView
    val rule = ShortFormRules.forPkg(pkg)
    val isShort = request.scope != pkg && rule != null
    // "Instagram" or "Instagram Reels"
    val appName = if (isShort) "${appLabel(pkg)} ${rule!!.feedName}" else appLabel(pkg)
    val used = BlockerLines.formatDuration(BlockerStore.usedMillis(service, request.scope))
    val limit = BlockerStore.limitMinutes(service, request.scope)
    val limitText = if (limit != null) "your limit was $limit min" else null

    view.findViewById<TextView>(R.id.mms_overlay_time).text = "$used on $appName"
    view.findViewById<TextView>(R.id.mms_overlay_sub).text = if (isShort) {
      val n = BlockerStore.count(service, request.scope)
      listOfNotNull(BlockerLines.countLabel(n, rule!!.feedName) + " today", limitText).joinToString(" · ")
    } else {
      listOfNotNull("today", limitText).joinToString(" · ")
    }
    view.findViewById<TextView>(R.id.mms_overlay_line).text = BlockerLines.pick(appName, used)

    val breakButton = view.findViewById<TextView>(R.id.mms_overlay_break)
    if (request.leaveWithBack && rule != null) {
      breakButton.text = service.getString(R.string.mms_overlay_leave, rule.feedName.uppercase())
    }

    view.findViewById<View>(R.id.mms_overlay_pay).setOnClickListener {
      hide()
      onPayToll(pkg, request.scope)
    }
    breakButton.setOnClickListener {
      hide()
      onTakeBreak(pkg, request.leaveWithBack)
    }
    view.onBack = {
      hide()
      onTakeBreak(pkg, request.leaveWithBack)
    }

    val params = WindowManager.LayoutParams(
      WindowManager.LayoutParams.MATCH_PARENT,
      WindowManager.LayoutParams.MATCH_PARENT,
      WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
      WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
      PixelFormat.TRANSLUCENT
    )

    try {
      windowManager.addView(view, params)
    } catch (_: Exception) {
      showing = false
      shownFor = null
      return
    }
    root = view
    pausePlayback()
    animateIn(view)
  }

  private fun hideNow() {
    val view = root ?: return
    root = null
    try {
      windowManager.removeView(view)
    } catch (_: Exception) {
    }
    releasePlayback()
  }

  /**
   * Slides the card up. Samsung phones pause animations for apps that aren't in front ("stop
   * animation in background states"), and while the popup covers another app ours counts as in
   * the background. So the popup never depends on the animation: it starts fully visible (no
   * fade from transparent), and a timer snaps the card into place if the slide didn't run.
   */
  private fun animateIn(view: OverlayRootView) {
    val card = view.findViewById<View>(R.id.mms_overlay_card)
    view.alpha = 1f
    card.post {
      card.translationY = card.height * 0.25f
      card.animate().translationY(0f).setDuration(260).setInterpolator(DecelerateInterpolator(2f)).start()
    }
    main.postDelayed({
      card.animate().cancel()
      card.translationY = 0f
    }, ANIMATION_FALLBACK_MS)
  }

  private fun appLabel(pkg: String): String = try {
    val pm = service.packageManager
    pm.getApplicationLabel(pm.getApplicationInfo(pkg, 0)).toString()
  } catch (_: Exception) {
    pkg
  }

  /** Ask for audio focus so video/music in the blocked app pauses. */
  private fun pausePlayback() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val req = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
        .setAudioAttributes(
          AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ASSISTANCE_SONIFICATION)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build()
        )
        .setOnAudioFocusChangeListener { }
        .build()
      audioManager.requestAudioFocus(req)
      focusRequest = req
    } else {
      @Suppress("DEPRECATION")
      audioManager.requestAudioFocus(null, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
    }
  }

  private fun releasePlayback() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      focusRequest?.let { audioManager.abandonAudioFocusRequest(it) }
      focusRequest = null
    } else {
      @Suppress("DEPRECATION")
      audioManager.abandonAudioFocus(null)
    }
  }

  private companion object {
    const val ANIMATION_FALLBACK_MS = 600L
  }
}
