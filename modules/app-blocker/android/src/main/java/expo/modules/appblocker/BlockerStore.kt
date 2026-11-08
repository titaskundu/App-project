package expo.modules.appblocker

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * The blocker's memory, saved on the phone (SharedPreferences) so it survives app restarts
 * and phone reboots. Both the watcher service and the JS module read and write here.
 *
 * - targets: which apps are blocked and their daily limit in minutes
 * - usage:   milliseconds used today per blocked app
 * - extra:   extra milliseconds earned today per app by paying tolls
 * - tolls:   how many tolls were paid today per app (later: makes the next toll harder)
 *
 * Daily numbers reset automatically when the date changes.
 */
object BlockerStore {
  private const val PREFS = "mms_app_blocker"
  private const val KEY_TARGETS = "targets"
  private const val KEY_DAY = "day"
  private const val KEY_USAGE = "usage"
  private const val KEY_EXTRA = "extra"
  private const val KEY_TOLLS = "tolls"

  private fun prefs(ctx: Context): SharedPreferences =
    ctx.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  private fun today(): String = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())

  private fun readJson(p: SharedPreferences, key: String): JSONObject =
    try { JSONObject(p.getString(key, "{}") ?: "{}") } catch (_: Exception) { JSONObject() }

  /** Clears the daily counters if the date has changed since they were last written. */
  @Synchronized
  private fun ensureToday(ctx: Context): SharedPreferences {
    val p = prefs(ctx)
    val day = today()
    if (p.getString(KEY_DAY, null) != day) {
      p.edit()
        .putString(KEY_DAY, day)
        .putString(KEY_USAGE, "{}")
        .putString(KEY_EXTRA, "{}")
        .putString(KEY_TOLLS, "{}")
        .apply()
    }
    return p
  }

  // ---- targets -------------------------------------------------------------

  /** JSON object: { "com.instagram.android": 20, ... } (minutes) */
  fun getTargetsJson(ctx: Context): String = readJson(prefs(ctx), KEY_TARGETS).toString()

  fun setTargetsJson(ctx: Context, json: String) {
    val clean = JSONObject()
    val input = JSONObject(json)
    input.keys().forEach { pkg ->
      val minutes = input.optInt(pkg, 0)
      if (minutes > 0) clean.put(pkg, minutes)
    }
    prefs(ctx).edit().putString(KEY_TARGETS, clean.toString()).apply()
  }

  fun limitMinutes(ctx: Context, pkg: String): Int? {
    val targets = readJson(prefs(ctx), KEY_TARGETS)
    return if (targets.has(pkg)) targets.optInt(pkg) else null
  }

  // ---- daily usage ---------------------------------------------------------

  @Synchronized
  fun addUsage(ctx: Context, pkg: String, millis: Long) {
    if (millis <= 0) return
    val p = ensureToday(ctx)
    val usage = readJson(p, KEY_USAGE)
    usage.put(pkg, usage.optLong(pkg, 0L) + millis)
    p.edit().putString(KEY_USAGE, usage.toString()).apply()
  }

  fun usedMillis(ctx: Context, pkg: String): Long = readJson(ensureToday(ctx), KEY_USAGE).optLong(pkg, 0L)

  /** True when the app is blocked and today's use has reached its limit plus earned extra time. */
  fun isOverLimit(ctx: Context, pkg: String): Boolean {
    val limit = limitMinutes(ctx, pkg) ?: return false
    val p = ensureToday(ctx)
    val used = readJson(p, KEY_USAGE).optLong(pkg, 0L)
    val extra = readJson(p, KEY_EXTRA).optLong(pkg, 0L)
    return used >= limit * 60_000L + extra
  }

  /** Adds earned minutes to an app's allowance for today and counts the toll. */
  @Synchronized
  fun grant(ctx: Context, pkg: String, minutes: Int) {
    val p = ensureToday(ctx)
    val extra = readJson(p, KEY_EXTRA)
    extra.put(pkg, extra.optLong(pkg, 0L) + minutes * 60_000L)
    val tolls = readJson(p, KEY_TOLLS)
    tolls.put(pkg, tolls.optInt(pkg, 0) + 1)
    p.edit()
      .putString(KEY_EXTRA, extra.toString())
      .putString(KEY_TOLLS, tolls.toString())
      .apply()
  }

  /** { "usage": {pkg: ms}, "extra": {pkg: ms}, "tolls": {pkg: n}, "day": "yyyy-MM-dd" } */
  fun todayJson(ctx: Context): String {
    val p = ensureToday(ctx)
    return JSONObject()
      .put("day", p.getString(KEY_DAY, today()))
      .put("usage", readJson(p, KEY_USAGE))
      .put("extra", readJson(p, KEY_EXTRA))
      .put("tolls", readJson(p, KEY_TOLLS))
      .toString()
  }
}
