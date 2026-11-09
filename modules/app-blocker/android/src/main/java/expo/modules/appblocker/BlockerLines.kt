package expo.modules.appblocker

/**
 * Playful one-liners for the popup. {time} and {app} are filled in.
 * Tone: teasing but kind — never shaming.
 */
object BlockerLines {
  private val lines = listOf(
    "Your thumb just ran a marathon. Let it rest. 🏃",
    "The algorithm says thanks for the {time}. Your future self? Less thrilled.",
    "Scroll detected. Gains not detected. 💪",
    "Plot twist: the best content is outside {app}.",
    "{time} gone. They're not coming back, but the next ones can be yours.",
    "Even the panda takes breaks, and it doesn't even have a phone. 🐼",
    "Your feed will still be here. Your focus might not.",
    "{app}: 1, You: 0. Fancy a comeback?",
    "Fun fact: {time} is enough for a LOT of squats.",
    "Your brain called. It wants a snack that isn't a reel. 🧠",
    "Breaking news: local human discovers world outside {app}.",
    "That's {time}. Your eyes have filed a complaint. 👀",
  )

  private var last = -1

  fun pick(app: String, time: String): String {
    var i = lines.indices.random()
    if (i == last && lines.size > 1) i = (i + 1) % lines.size
    last = i
    return lines[i].replace("{time}", time).replace("{app}", app)
  }

  /** "1 reel", "47 reels", "3 shorts" (feedName is "Reels" or "Shorts"). */
  fun countLabel(n: Int, feedName: String): String {
    val plural = feedName.lowercase()
    return if (n == 1) "1 ${plural.removeSuffix("s")}" else "$n $plural"
  }

  /** "45 sec", "12 min", "1h 05m" */
  fun formatDuration(ms: Long): String {
    val totalSec = (ms / 1000).coerceAtLeast(0)
    if (totalSec < 60) return "$totalSec sec"
    val totalMin = totalSec / 60
    if (totalMin < 60) return "$totalMin min"
    return "${totalMin / 60}h ${(totalMin % 60).toString().padStart(2, '0')}m"
  }
}
