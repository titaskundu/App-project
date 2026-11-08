package expo.modules.appblocker

import android.accessibilityservice.AccessibilityService
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.os.SystemClock
import android.view.accessibility.AccessibilityEvent
import android.view.inputmethod.InputMethodManager

/**
 * The watcher. Android tells it each time a different app's window comes to the front
 * (we only subscribe to window-change events and never read screen content).
 *
 * Every TICK_MS it adds the elapsed time to today's total for the app on screen, if that
 * app is on the blocked list and the screen is on. When an app passes its limit, it shows
 * the popup (BlockerOverlay) right on top of that app:
 *  - "Pay toll"     → opens our Toll screen (mindmusclesync://toll?pkg=...)
 *  - "Take a break" → goes to the Android home screen
 *
 * Android restarts this service by itself after a reboot, as long as the user left it
 * turned on in Accessibility settings.
 */
class BlockerService : AccessibilityService() {

  private val handler = Handler(Looper.getMainLooper())
  private var currentPkg: String? = null
  private var lastTick = 0L
  private var lastShown = 0L
  private var breakPkg: String? = null
  private var breakAt = 0L
  private lateinit var overlay: BlockerOverlay

  /** Windows from these packages don't count as "switching apps" (status bar, keyboards). */
  private val ignored = mutableSetOf("com.android.systemui")

  private val ticker = object : Runnable {
    override fun run() {
      flush()
      currentPkg?.let { enforce(it) }
      handler.postDelayed(this, TICK_MS)
    }
  }

  override fun onServiceConnected() {
    super.onServiceConnected()
    running = true
    overlay = BlockerOverlay(this, onPayToll = ::openToll, onTakeBreak = { pkg ->
      breakPkg = pkg
      breakAt = SystemClock.elapsedRealtime()
      takeBreak()
    })
    val imm = getSystemService(Context.INPUT_METHOD_SERVICE) as? InputMethodManager
    imm?.enabledInputMethodList?.forEach { ignored.add(it.packageName) }
    lastTick = SystemClock.elapsedRealtime()
    handler.removeCallbacks(ticker)
    handler.postDelayed(ticker, TICK_MS)
  }

  override fun onAccessibilityEvent(event: AccessibilityEvent?) {
    if (event?.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return
    val pkg = event.packageName?.toString() ?: return
    if (pkg in ignored) return
    // Our own popup also fires window events; they don't mean the user switched apps.
    if (pkg == packageName && overlay.isShowing) return

    flush() // credit time to the app we're leaving
    currentPkg = pkg

    // The user left the blocked app (home, another app, our app): take the popup down.
    if (overlay.isShowing && overlay.shownFor != pkg) overlay.hide()

    enforce(pkg)
  }

  /** Adds the time since the last tick to the current app, if it's blocked, visible and the screen is on. */
  private fun flush() {
    val now = SystemClock.elapsedRealtime()
    val pkg = currentPkg
    val counting = pkg != null &&
      pkg != packageName &&
      !overlay.isShowing &&
      isScreenOn() &&
      BlockerStore.limitMinutes(this, pkg) != null
    if (counting) BlockerStore.addUsage(this, pkg!!, now - lastTick)
    lastTick = now
  }

  private fun enforce(pkg: String) {
    if (pkg == packageName) return
    if (overlay.isShowing) return
    if (!BlockerStore.isOverLimit(this, pkg)) return
    val now = SystemClock.elapsedRealtime()
    if (now - lastShown < RESHOW_GAP_MS) return
    // Apps can send a late "window opened" event right after the user chose "Take a break";
    // don't let that pop the overlay straight back up.
    if (pkg == breakPkg && now - breakAt < BREAK_COOLDOWN_MS) return
    lastShown = now
    overlay.show(pkg)
  }

  private fun openToll(pkg: String) {
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse("$DEEP_LINK_SCHEME://toll?pkg=${Uri.encode(pkg)}"))
      .setPackage(packageName)
      .addFlags(
        Intent.FLAG_ACTIVITY_NEW_TASK or
          Intent.FLAG_ACTIVITY_SINGLE_TOP or
          Intent.FLAG_ACTIVITY_CLEAR_TOP
      )
    try {
      startActivity(intent)
    } catch (_: Exception) {
      takeBreak()
    }
  }

  private fun takeBreak() {
    performGlobalAction(GLOBAL_ACTION_HOME)
  }

  private fun isScreenOn(): Boolean =
    (getSystemService(Context.POWER_SERVICE) as? PowerManager)?.isInteractive ?: true

  override fun onInterrupt() {}

  override fun onUnbind(intent: Intent?): Boolean {
    if (::overlay.isInitialized) overlay.hide()
    return super.onUnbind(intent)
  }

  override fun onDestroy() {
    handler.removeCallbacks(ticker)
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

    @Volatile
    var running = false
  }
}
