package expo.modules.appblocker

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.net.Uri
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream

/**
 * The bridge between JavaScript and the blocker. Complex values are passed as JSON strings
 * (parsed by modules/app-blocker/index.ts) to keep the bridge simple and predictable.
 */
class AppBlockerModule : Module() {

  private val context: Context
    get() = requireNotNull(appContext.reactContext) { "React context is not available" }

  override fun definition() = ModuleDefinition {
    Name("AppBlocker")

    /** Is our watcher switched on in Android's Accessibility settings? */
    Function("isAccessibilityEnabled") {
      val expected = ComponentName(context, BlockerService::class.java)
      val enabled = Settings.Secure.getString(
        context.contentResolver,
        Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
      ) ?: ""
      enabled.split(':').any { ComponentName.unflattenFromString(it) == expected }
    }

    Function("openAccessibilitySettings") {
      context.startActivity(
        Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      )
    }

    /** JSON array of launchable apps: [{ "packageName": "...", "label": "..." }], sorted by name. */
    AsyncFunction("getInstalledAppsAsync") {
      val pm = context.packageManager
      val launcher = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
      val apps = pm.queryIntentActivities(launcher, 0)
        .map { it.activityInfo.packageName to it.loadLabel(pm).toString() }
        .filter { (pkg, _) -> pkg != context.packageName }
        .distinctBy { it.first }
        .sortedBy { it.second.lowercase() }
      val out = JSONArray()
      apps.forEach { (pkg, label) -> out.put(JSONObject().put("packageName", pkg).put("label", label)) }
      out.toString()
    }

    /**
     * App icons for the given packages (JSON array in, JSON object out: { pkg: "file://…png" }).
     * Each icon is drawn once into a small PNG in the app's cache folder. The file name includes
     * the app's last update time, so a new icon after an app update gets a new file.
     * Apps that aren't installed (or are hidden from us) are left out.
     */
    AsyncFunction("getAppIconsAsync") { json: String ->
      val pm = context.packageManager
      val dir = File(context.cacheDir, "app-icons").apply { mkdirs() }
      val pkgs = JSONArray(json)
      val out = JSONObject()
      for (i in 0 until pkgs.length()) {
        val pkg = pkgs.getString(i)
        try {
          val updated = pm.getPackageInfo(pkg, 0).lastUpdateTime
          val file = File(dir, "${pkg}_$updated.png")
          if (!file.exists()) {
            val size = ICON_PX
            val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
            val icon = pm.getApplicationIcon(pkg)
            icon.setBounds(0, 0, size, size)
            icon.draw(Canvas(bitmap))
            FileOutputStream(file).use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
            bitmap.recycle()
          }
          out.put(pkg, Uri.fromFile(file).toString())
        } catch (e: Exception) {
          // Not installed or not visible to us: the app shows a letter instead.
        }
      }
      out.toString()
    }

    Function("getTargets") { BlockerStore.getTargetsJson(context) }

    Function("setTargets") { json: String -> BlockerStore.setTargetsJson(context, json) }

    Function("getToday") { BlockerStore.todayJson(context) }

    /** scope is a package ("com.instagram.android") or a Reels scope ("com.instagram.android:short"). */
    Function("grantMinutes") { scope: String, minutes: Int, countToll: Boolean ->
      BlockerStore.grant(context, scope, minutes, countToll)
    }

    /** JSON object of apps whose Reels/Shorts can be limited separately: { pkg: "Reels" | "Shorts" }. */
    Function("getShortFormApps") { JSONObject(ShortFormRules.feedNames()).toString() }

    /** Opens another app (used after a toll to go back to the app that was blocked). */
    Function("openApp") { pkg: String ->
      val intent = context.packageManager.getLaunchIntentForPackage(pkg)
      if (intent != null) {
        context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        true
      } else {
        false
      }
    }

    /** Sends the user to the Android home screen. */
    Function("goHome") {
      context.startActivity(
        Intent(Intent.ACTION_MAIN)
          .addCategory(Intent.CATEGORY_HOME)
          .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      )
    }
  }

  private companion object {
    /** Icon size in pixels: sharp at up to ~48dp on a 3x screen. */
    const val ICON_PX = 144
  }
}
