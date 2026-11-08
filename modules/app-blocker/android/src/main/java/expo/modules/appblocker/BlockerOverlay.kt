package expo.modules.appblocker

import android.accessibilityservice.AccessibilityService
import android.content.Context
import android.graphics.PixelFormat
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.os.Build
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
 * - the back button counts as "take a break".
 */
class BlockerOverlay(
  private val service: AccessibilityService,
  private val onPayToll: (pkg: String) -> Unit,
  private val onTakeBreak: (pkg: String) -> Unit,
) {
  private val windowManager = service.getSystemService(Context.WINDOW_SERVICE) as WindowManager
  private val audioManager = service.getSystemService(Context.AUDIO_SERVICE) as AudioManager
  private var focusRequest: AudioFocusRequest? = null

  private var root: OverlayRootView? = null

  /** Package of the app the popup is currently covering, or null when hidden. */
  var shownFor: String? = null
    private set

  val isShowing: Boolean
    get() = root != null

  fun show(pkg: String) {
    if (root != null) {
      if (shownFor == pkg) return
      hide()
    }

    val view = LayoutInflater.from(service).inflate(R.layout.mms_blocker_overlay, null) as OverlayRootView
    val appName = appLabel(pkg)
    val used = BlockerLines.formatDuration(BlockerStore.usedMillis(service, pkg))
    val limit = BlockerStore.limitMinutes(service, pkg)

    view.findViewById<TextView>(R.id.mms_overlay_time).text = "$used on $appName"
    view.findViewById<TextView>(R.id.mms_overlay_sub).text =
      if (limit != null) "today · your limit was $limit min" else "today"
    view.findViewById<TextView>(R.id.mms_overlay_line).text = BlockerLines.pick(appName, used)

    view.findViewById<View>(R.id.mms_overlay_pay).setOnClickListener {
      hide()
      onPayToll(pkg)
    }
    view.findViewById<View>(R.id.mms_overlay_break).setOnClickListener {
      hide()
      onTakeBreak(pkg)
    }
    view.onBack = {
      hide()
      onTakeBreak(pkg)
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
      return
    }
    root = view
    shownFor = pkg
    pausePlayback()
    animateIn(view)
  }

  fun hide() {
    val view = root ?: return
    root = null
    shownFor = null
    try {
      windowManager.removeView(view)
    } catch (_: Exception) {
    }
    releasePlayback()
  }

  private fun animateIn(view: OverlayRootView) {
    val card = view.findViewById<View>(R.id.mms_overlay_card)
    view.alpha = 0f
    view.animate().alpha(1f).setDuration(180).start()
    card.post {
      card.translationY = card.height.toFloat()
      card.animate().translationY(0f).setDuration(320).setInterpolator(DecelerateInterpolator(2f)).start()
    }
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
}
