package expo.modules.appblocker

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * The blocker's memory, saved on the phone (SharedPreferences) so it survives app restarts
 * and phone reboots. Both the watcher service and the JS module read and write here.
 *
 * Everything is keyed by *scope*:
 *  - "com.instagram.android"        → the whole app
 *  - "com.instagram.android:short"  → only its Reels / Shorts viewer
 *
 * - targets: daily limit in minutes per scope (an app can have either or both)
 * - usage:   milliseconds used today per scope (whole-app usage includes Reels time)
 * - extra:   extra milliseconds earned today per scope by paying tolls
 * - tolls:   tolls paid today per scope (later: makes the next toll harder)
 * - counts:  reels/shorts watched today per short scope
 * - health:  per app, how long it was used since its Reels viewer was last recognised
 *            (not daily; used by the safety net in [isRulesStale])
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
  private const val KEY_COUNTS = "counts"
  private const val KEY_HEALTH = "health"

  private const val SHORT_SUFFIX = ":short"

  /**
   * Safety net: if an app with a Reels limit is used this long without its Reels viewer ever
   * being recognised, an app update has probably changed its layout. We then count the whole
   * app against the Reels limit and show a warning in Settings.
   */
  const val STALE_AFTER_MS = 3 * 60 * 60_000L

  fun shortScope(pkg: String) = pkg + SHORT_SUFFIX

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
        .putString(KEY_COUNTS, "{}")
        .apply()
    }
    return p
  }

  // ---- targets -------------------------------------------------------------

  /** JSON object: { "com.instagram.android:short": 15, "com.android.chrome": 30, ... } (minutes) */
  fun getTargetsJson(ctx: Context): String = readJson(prefs(ctx), KEY_TARGETS).toString()

  fun setTargetsJson(ctx: Context, json: String) {
    val clean = JSONObject()
    val input = JSONObject(json)
    input.keys().forEach { scope ->
      val minutes = input.optInt(scope, 0)
      if (minutes > 0) clean.put(scope, minutes)
    }
    prefs(ctx).edit().putString(KEY_TARGETS, clean.toString()).apply()
  }

  fun limitMinutes(ctx: Context, scope: String): Int? {
    val targets = readJson(prefs(ctx), KEY_TARGETS)
    return if (targets.has(scope)) targets.optInt(scope) else null
  }

  /** True if the app has any limit (whole app, Reels, or both). */
  fun isTracked(ctx: Context, pkg: String): Boolean {
    val targets = readJson(prefs(ctx), KEY_TARGETS)
    return targets.has(pkg) || targets.has(shortScope(pkg))
  }

  // ---- daily usage ---------------------------------------------------------

  @Synchronized
  fun addUsage(ctx: Context, scope: String, millis: Long) {
    if (millis <= 0) return
    val p = ensureToday(ctx)
    val usage = readJson(p, KEY_USAGE)
    usage.put(scope, usage.optLong(scope, 0L) + millis)
    p.edit().putString(KEY_USAGE, usage.toString()).apply()
  }

  fun usedMillis(ctx: Context, scope: String): Long = readJson(ensureToday(ctx), KEY_USAGE).optLong(scope, 0L)

  /** One more reel/short watched. */
  @Synchronized
  fun addCount(ctx: Context, scope: String) {
    val p = ensureToday(ctx)
    val counts = readJson(p, KEY_COUNTS)
    counts.put(scope, counts.optInt(scope, 0) + 1)
    p.edit().putString(KEY_COUNTS, counts.toString()).apply()
  }

  fun count(ctx: Context, scope: String): Int = readJson(ensureToday(ctx), KEY_COUNTS).optInt(scope, 0)

  /** True when the scope has a limit and today's use has reached it plus earned extra time. */
  fun isOverLimit(ctx: Context, scope: String): Boolean {
    val limit = limitMinutes(ctx, scope) ?: return false
    val p = ensureToday(ctx)
    val used = readJson(p, KEY_USAGE).optLong(scope, 0L)
    val extra = readJson(p, KEY_EXTRA).optLong(scope, 0L)
    return used >= limit * 60_000L + extra
  }

  /**
   * Adds earned minutes to a scope's allowance for today. [countToll] = a toll was paid (makes
   * the next toll longer); false for banked practice minutes.
   */
  @Synchronized
  fun grant(ctx: Context, scope: String, minutes: Int, countToll: Boolean = true) {
    val p = ensureToday(ctx)
    val extra = readJson(p, KEY_EXTRA)
    extra.put(scope, extra.optLong(scope, 0L) + minutes * 60_000L)
    val edit = p.edit().putString(KEY_EXTRA, extra.toString())
    if (countToll) {
      val tolls = readJson(p, KEY_TOLLS)
      tolls.put(scope, tolls.optInt(scope, 0) + 1)
      edit.putString(KEY_TOLLS, tolls.toString())
    }
    edit.apply()
  }

  // ---- rule health (safety net) -------------------------------------------

  /** The Reels viewer was recognised: detection works for this app. */
  @Synchronized
  fun noteRuleMatch(ctx: Context, pkg: String) {
    val p = prefs(ctx)
    val health = readJson(p, KEY_HEALTH)
    if (health.optLong(pkg, 0L) == 0L) return
    health.put(pkg, 0L)
    p.edit().putString(KEY_HEALTH, health.toString()).apply()
  }

  /** The app was used for [millis] without the Reels viewer being recognised. */
  @Synchronized
  fun addRuleMiss(ctx: Context, pkg: String, millis: Long) {
    if (millis <= 0) return
    val p = prefs(ctx)
    val health = readJson(p, KEY_HEALTH)
    val before = health.optLong(pkg, 0L)
    if (before >= STALE_AFTER_MS) return // already flagged; no need to keep writing
    health.put(pkg, before + millis)
    p.edit().putString(KEY_HEALTH, health.toString()).apply()
  }

  fun isRulesStale(ctx: Context, pkg: String): Boolean =
    readJson(prefs(ctx), KEY_HEALTH).optLong(pkg, 0L) >= STALE_AFTER_MS

  /**
   * { "day", "usage": {scope: ms}, "extra": {scope: ms}, "tolls": {scope: n},
   *   "counts": {scope: n}, "stale": [pkg, ...] }
   */
  fun todayJson(ctx: Context): String {
    val p = ensureToday(ctx)
    val stale = JSONArray()
    val health = readJson(p, KEY_HEALTH)
    health.keys().forEach { pkg -> if (health.optLong(pkg, 0L) >= STALE_AFTER_MS) stale.put(pkg) }
    return JSONObject()
      .put("day", p.getString(KEY_DAY, today()))
      .put("usage", readJson(p, KEY_USAGE))
      .put("extra", readJson(p, KEY_EXTRA))
      .put("tolls", readJson(p, KEY_TOLLS))
      .put("counts", readJson(p, KEY_COUNTS))
      .put("stale", stale)
      .toString()
  }
}
