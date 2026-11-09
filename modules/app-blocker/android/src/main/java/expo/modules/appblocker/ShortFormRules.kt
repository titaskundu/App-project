package expo.modules.appblocker

import android.view.accessibility.AccessibilityNodeInfo

/**
 * How to recognise a short-video viewer (Instagram Reels, YouTube Shorts, Facebook Reels).
 *
 * Privacy: we only look at layout IDs (internal names like "reel_recycler") and accessibility
 * labels of tabs ("Reels"). Never on-screen text, messages, captions or images.
 *
 * Apps rename their internal IDs when they update, so each rule has two signals:
 *  1. viewIds:           direct find-by-ID lookups (fast, most reliable).
 *  2. selectedTabLabels: fallback. A tab with this label that is currently selected.
 * Phase 4 will let us update this list remotely (Supabase) without shipping a new app.
 *
 * Labels match exactly or as a prefix before a comma, because apps add details:
 * Facebook's tab is "Reels, tab 2 of 6, 1 new".
 */
data class ShortFormRule(
  val pkg: String,
  /** What the app calls its short-video feed: "Reels" or "Shorts". */
  val feedName: String,
  /** Full resource names, e.g. "com.instagram.android:id/clips_viewer_view_pager". */
  val viewIds: List<String>,
  val selectedTabLabels: List<String>,
  /**
   * The app's Home tab, tapped by "Leave Reels" (the Reels *tab* often ignores Back, and Back on
   * a first screen would close the app). Found by resource name, or by label for apps without
   * IDs (Facebook). Null/empty: just press Back.
   */
  val exitTabId: String? = null,
  val exitTabLabels: List<String> = emptyList(),
  /**
   * The container each reel/short sits in. When set, swipes are counted by noticing that a
   * different container is on screen (checked every tick) instead of from scroll events.
   * Needed for YouTube, whose swipes don't send scroll events to services like ours.
   */
  val pageId: String? = null,
)

object ShortFormRules {
  private val rules = listOf(
    // All IDs and labels below verified on a Galaxy S23 (Android 16), 2026-11-08/09.
    ShortFormRule(
      pkg = "com.instagram.android",
      feedName = "Reels",
      viewIds = listOf("com.instagram.android:id/clips_viewer_view_pager"),
      selectedTabLabels = listOf("Reels"),
      exitTabId = "com.instagram.android:id/feed_tab",
      exitTabLabels = listOf("Home"),
    ),
    ShortFormRule(
      pkg = "com.google.android.youtube",
      feedName = "Shorts",
      viewIds = listOf(
        "com.google.android.youtube:id/reel_recycler",
        "com.google.android.youtube:id/reel_player_page_container",
        "com.google.android.youtube:id/reel_watch_player",
      ),
      selectedTabLabels = listOf("Shorts"),
      pageId = "com.google.android.youtube:id/reel_player_page_container",
    ),
    ShortFormRule(
      pkg = "com.facebook.katana",
      feedName = "Reels",
      // Facebook hides its IDs ("name removed"), so it's recognised by its selected tab:
      // "Reels, tab 2 of 6". Its Home tab is "Home, tab 1 of 6".
      viewIds = emptyList(),
      selectedTabLabels = listOf("Reels"),
      exitTabLabels = listOf("Home"),
    ),
  ).associateBy { it.pkg }

  fun forPkg(pkg: String): ShortFormRule? = rules[pkg]

  /** pkg → feed name, for the JS side ("Reels" / "Shorts"). */
  fun feedNames(): Map<String, String> = rules.mapValues { it.value.feedName }

  enum class Match { NONE, BY_ID, BY_LABEL }

  /** "Reels" matches "Reels" and "Reels, tab 2 of 6", but not "Reels tab details". */
  fun labelMatches(label: String, wanted: String): Boolean =
    label.equals(wanted, ignoreCase = true) || label.startsWith("$wanted,", ignoreCase = true)

  /** Is the short-video viewer showing in this window? */
  fun match(rule: ShortFormRule, root: AccessibilityNodeInfo): Match {
    // Some apps (Instagram) don't announce every screen change, so Android's cached copy of the
    // screen can be out of date. refresh() asks the app for the current state.
    root.refresh()
    for (id in rule.viewIds) {
      val nodes = try { root.findAccessibilityNodeInfosByViewId(id) } catch (_: Exception) { emptyList() }
      if (nodes.any { it.refresh() && it.isVisibleToUser }) return Match.BY_ID
    }
    if (rule.selectedTabLabels.isNotEmpty() && findLabeled(root, rule.selectedTabLabels, selected = true) != null) {
      return Match.BY_LABEL
    }
    return Match.NONE
  }

  /**
   * Walks the window looking for a visible node whose accessibility label matches one of
   * [labels] (and is selected, if [selected]). Bounded (MAX_NODES) so a huge screen can't slow
   * the phone down.
   */
  private fun findLabeled(root: AccessibilityNodeInfo, labels: List<String>, selected: Boolean): AccessibilityNodeInfo? {
    val queue = ArrayDeque<AccessibilityNodeInfo>()
    queue.add(root)
    var visited = 0
    while (queue.isNotEmpty() && visited < MAX_NODES) {
      val node = queue.removeFirst()
      visited++
      if (!selected || node.isSelected) {
        val label = node.contentDescription?.toString()?.trim()
        if (label != null && labels.any { labelMatches(label, it) }) {
          // The walk can use a cached copy; confirm this node with the app before trusting it.
          if (node.refresh() && (!selected || node.isSelected) && node.isVisibleToUser) return node
        }
      }
      for (i in 0 until node.childCount) {
        node.getChild(i)?.let { queue.add(it) }
      }
    }
    return null
  }

  /** The reel/short container currently on screen (see [ShortFormRule.pageId]), or null. */
  fun visiblePage(rule: ShortFormRule, root: AccessibilityNodeInfo): AccessibilityNodeInfo? {
    val id = rule.pageId ?: return null
    return try { root.findAccessibilityNodeInfosByViewId(id) } catch (_: Exception) { emptyList() }
      .firstOrNull { it.refresh() && it.isVisibleToUser }
  }

  /** Taps the rule's Home tab. Returns false if it isn't on screen or can't be tapped. */
  fun clickExitTab(rule: ShortFormRule, root: AccessibilityNodeInfo): Boolean {
    root.refresh()
    val byId = rule.exitTabId?.let { id ->
      try { root.findAccessibilityNodeInfosByViewId(id) } catch (_: Exception) { emptyList() }
        .firstOrNull { it.refresh() && it.isVisibleToUser }
    }
    val tab = byId
      ?: (if (rule.exitTabLabels.isNotEmpty()) findLabeled(root, rule.exitTabLabels, selected = false) else null)
      ?: return false
    // Tap the tab itself, or the nearest parent that accepts taps.
    var node: AccessibilityNodeInfo? = tab
    var depth = 0
    while (node != null && depth < 4) {
      if (node.isClickable) return node.performAction(AccessibilityNodeInfo.ACTION_CLICK)
      node = node.parent
      depth++
    }
    return tab.performAction(AccessibilityNodeInfo.ACTION_CLICK)
  }

  private const val MAX_NODES = 600
}
