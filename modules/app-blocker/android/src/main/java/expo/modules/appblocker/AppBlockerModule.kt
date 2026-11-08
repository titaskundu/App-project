package expo.modules.appblocker

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONArray
import org.json.JSONObject

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

    Function("getTargets") { BlockerStore.getTargetsJson(context) }

    Function("setTargets") { json: String -> BlockerStore.setTargetsJson(context, json) }

    Function("getToday") { BlockerStore.todayJson(context) }

    Function("grantMinutes") { pkg: String, minutes: Int -> BlockerStore.grant(context, pkg, minutes) }

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
}
