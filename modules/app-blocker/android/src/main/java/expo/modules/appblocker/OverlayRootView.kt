package expo.modules.appblocker

import android.content.Context
import android.util.AttributeSet
import android.view.KeyEvent
import android.widget.FrameLayout

/** Root of the popup. Catches the Android back button so it can mean "take a break". */
class OverlayRootView @JvmOverloads constructor(
  context: Context,
  attrs: AttributeSet? = null,
) : FrameLayout(context, attrs) {

  var onBack: (() -> Unit)? = null

  override fun dispatchKeyEvent(event: KeyEvent): Boolean {
    if (event.keyCode == KeyEvent.KEYCODE_BACK) {
      if (event.action == KeyEvent.ACTION_UP) onBack?.invoke()
      return true
    }
    return super.dispatchKeyEvent(event)
  }
}
