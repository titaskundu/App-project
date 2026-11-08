# Phase 1 — Code Walkthrough (sections 3–6 in detail)

This file is the detailed companion to `docs/PHASE-1-BLOCKER.md`. It walks
through sections 3, 4, 5 and 6 of that document. For each one it shows the
actual files and the important lines, then explains what they do. Kotlin and
Android parts are explained in React/JS terms.

Line numbers match commit `c9e1655`. Code excerpts are trimmed with `…` where
lines don't matter.

**File shortcuts used below**

| Short name | Full path |
|---|---|
| `KT/` | `modules/app-blocker/android/src/main/java/expo/modules/appblocker/` |
| `RES/` | `modules/app-blocker/android/src/main/res/` |
| `MAN` | `modules/app-blocker/android/src/main/AndroidManifest.xml` |

**A few Kotlin basics** that make the excerpts easier to read:

| Kotlin | JS/TS equivalent |
|---|---|
| `val x = 1` / `var x = 1` | `const x = 1` / `let x = 1` |
| `fun name(a: String): Int { … }` | `function name(a: string): number { … }` |
| `String?` | `string \| null` |
| `x ?: y` | `x ?? y` |
| `x?.foo()` | `x?.foo()` (same) |
| `x!!` | `x!` (non-null assertion, crashes if null) |
| `object Foo { … }` | a module with singleton functions (`export const Foo = { … }`) |
| `class A : B()` | `class A extends B` |
| `companion object { const val X = 1 }` | `static readonly X = 1` |
| `"$a on ${b.c}"` | `` `${a} on ${b.c}` `` |
| `{ pkg -> … }` | `(pkg) => { … }` |
| `override fun onX()` | a lifecycle method Android calls, like `componentDidMount` |

---

## Section 3 — How it flows, step by step

### Stage 1 — Setup

**Files:** `src/features/blocker/components/AccessibilityCard.tsx`,
`src/app/(tabs)/settings.tsx`, `src/app/pick-apps.tsx`,
`src/features/blocker/store.ts`, `modules/app-blocker/index.ts`,
`KT/AppBlockerModule.kt`, `KT/BlockerStore.kt`

#### 1a. The disclosure card and "Open settings"

`AccessibilityCard.tsx`

```tsx
14  export function AccessibilityCard({ enabled }: { enabled: boolean }) {
15    if (enabled) {
      …                      // green "Blocking is on · ACTIVE" card
31    }
33    return (
34      <Card tint={colors.muscleSoft}>
      …
42          Mind-Muscle Sync uses Android's Accessibility service only to see{' '}
43          <AppText style={styles.strong}>which app is open</AppText>, so it can pause …
      …
53        <ChunkyButton
54          label="Open settings"
55          tone="muscle"
56          onPress={() => AppBlocker.openAccessibilitySettings()}
```

- Line 14: `enabled` comes from the store's `accessibilityOn`, which settings
  passes in (`settings.tsx` line 24: `<AccessibilityCard enabled={accessibilityOn} />`).
- Lines 42–49: the explanation. Google Play requires it to be on screen
  **before** the app sends you to the system page. Reviewers check this.
- Line 56: calls into native code. That lands here:

`KT/AppBlockerModule.kt`

```kotlin
34  Function("openAccessibilitySettings") {
35    context.startActivity(
36      Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
37    )
38  }
```

- An **Intent** is Android's way of saying "open this screen". It's a bit like
  `Linking.openURL()`, but for system screens. `ACTION_ACCESSIBILITY_SETTINGS`
  is the built-in Accessibility page.
- `FLAG_ACTIVITY_NEW_TASK` is required when you start a screen from
  somewhere other than a visible screen (the module only has an app context).

#### 1b. How the app knows blocking is on

`KT/AppBlockerModule.kt`

```kotlin
25  Function("isAccessibilityEnabled") {
26    val expected = ComponentName(context, BlockerService::class.java)
27    val enabled = Settings.Secure.getString(
28      context.contentResolver,
29      Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
30    ) ?: ""
31    enabled.split(':').any { ComponentName.unflattenFromString(it) == expected }
32  }
```

- Android stores the list of switched-on Accessibility services as one text
  setting, for example
  `com.other.app/.Service:com.mindmusclesync.app/expo.modules.appblocker.BlockerService`.
- Line 26 builds our service's ID. Line 31 splits the list on `:` and checks
  whether ours is in it. In JS terms:
  `enabled.split(':').some(s => s === ourId)`.

The screens re-check this every few seconds (see Stage "Meanwhile" below), so
the card flips to "Blocking is on" shortly after you come back from settings.

#### 1c. Picking apps

`src/app/pick-apps.tsx`

```tsx
15  const { apps, appsLoaded, loadApps, targets, setTargetSet } = useBlocker();
16  const [selected, setSelected] = useState<Set<string>>(() => new Set(Object.keys(targets)));
…
19  useEffect(() => {
20    loadApps().catch(() => {});
21  }, [loadApps]);
…
28    const rank = (pkg: string) => {
29      const i = SUGGESTED_PACKAGES.indexOf(pkg);
30      return i === -1 ? SUGGESTED_PACKAGES.length : i;
31    };
32    return [...filtered].sort((a, b) => rank(a.packageName) - rank(b.packageName));
…
43  const save = () => {
44    setTargetSet([...selected]);
45    router.back();
46  };
```

- Line 16: the checkboxes start from what's already blocked.
- Lines 28–32: suggested apps (Instagram, YouTube, TikTok…) get rank 0–8 and
  every other app gets rank 9, so suggested apps float to the top. JS sort is
  stable, so the rest stay alphabetical.
- Line 44: Save replaces the whole blocked set in one go.

Where the app list comes from, `KT/AppBlockerModule.kt`:

```kotlin
41  AsyncFunction("getInstalledAppsAsync") {
42    val pm = context.packageManager
43    val launcher = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
44    val apps = pm.queryIntentActivities(launcher, 0)
45      .map { it.activityInfo.packageName to it.loadLabel(pm).toString() }
46      .filter { (pkg, _) -> pkg != context.packageName }
47      .distinctBy { it.first }
48      .sortedBy { it.second.lowercase() }
49    val out = JSONArray()
50    apps.forEach { (pkg, label) -> out.put(JSONObject().put("packageName", pkg).put("label", label)) }
51    out.toString()
52  }
```

- Line 43 asks: "which apps have an icon in the app drawer?" (MAIN + LAUNCHER
  is the launcher icon's signature).
- Lines 44–48 read like a JS array chain: `.map(...)` to `[pkg, label]` pairs,
  `.filter` out our own app, de-duplicate, and sort by name.
- `AsyncFunction` means JS gets a Promise, so a slow scan doesn't freeze
  the UI.
- Lines 49–51 return a JSON **string**. The JS side parses it (see 1d).

#### 1d. Saving limits (JS → native)

`src/features/blocker/store.ts`

```ts
57  setTargetSet: (pkgs) => {
58    const current = get().targets;
59    const targets: Targets = {};
60    pkgs.forEach((p) => {
61      targets[p] = current[p] ?? DEFAULT_LIMIT;
62    });
63    AppBlocker.setTargets(targets);
64    set({ targets });
65  },
…
67  setLimit: (pkg, minutes) => {
68    const targets = { ...get().targets, [pkg]: minutes };
69    AppBlocker.setTargets(targets);
70    set({ targets });
71  },
```

- Line 61: apps you already had keep their limit. New ones start at 15 min.
- Line 63 writes to native **first**, then line 64 updates React state. This
  is the "write-through" rule: native storage is the truth, because the
  background service reads from there, not from JS.
- `setLimit` (from the − / + stepper in Settings, `settings.tsx` line 53)
  works the same way.

`modules/app-blocker/index.ts`

```ts
16  const Native = requireNativeModule<NativeAppBlocker>('AppBlocker');
…
38  setTargets: (targets: Targets) => Native.setTargets(JSON.stringify(targets)),
```

- Line 16 finds the Kotlin module by the name it registered (`Name("AppBlocker")`
  in `AppBlockerModule.kt` line 22).
- Line 38 turns the object into JSON text, for example `{"com.instagram.android":15}`.

`KT/BlockerStore.kt`

```kotlin
58  fun setTargetsJson(ctx: Context, json: String) {
59    val clean = JSONObject()
60    val input = JSONObject(json)
61    input.keys().forEach { pkg ->
62      val minutes = input.optInt(pkg, 0)
63      if (minutes > 0) clean.put(pkg, minutes)
64    }
65    prefs(ctx).edit().putString(KEY_TARGETS, clean.toString()).apply()
66  }
```

- Lines 61–64 keep only entries with a positive limit, so bad data can't
  sneak in.
- Line 65 saves it to the phone (details in Section 6). `.apply()` saves in
  the background, like a fire-and-forget `AsyncStorage.setItem`.

---

### Stage 2 — Watching and counting

**Files:** `KT/BlockerService.kt`, `KT/BlockerStore.kt`,
`RES/xml/app_blocker_accessibility.xml`, `MAN`

#### 2a. The service starts

`KT/BlockerService.kt`

```kotlin
27  class BlockerService : AccessibilityService() {
29    private val handler = Handler(Looper.getMainLooper())
30    private var currentPkg: String? = null
31    private var lastTick = 0L
…
38    private val ignored = mutableSetOf("com.android.systemui")
…
48    override fun onServiceConnected() {
49      super.onServiceConnected()
50      running = true
51      overlay = BlockerOverlay(this, onPayToll = ::openToll, onTakeBreak = { pkg ->
52        breakPkg = pkg
53        breakAt = SystemClock.elapsedRealtime()
54        takeBreak()
55      })
56      val imm = getSystemService(Context.INPUT_METHOD_SERVICE) as? InputMethodManager
57      imm?.enabledInputMethodList?.forEach { ignored.add(it.packageName) }
58      lastTick = SystemClock.elapsedRealtime()
59      handler.removeCallbacks(ticker)
60      handler.postDelayed(ticker, TICK_MS)
61    }
```

- Line 27: our class **extends** Android's `AccessibilityService`. Android
  creates it and calls its methods. We never call `new BlockerService()`.
- `onServiceConnected` (line 48) runs when you switch the service on, and
  again after every reboot. Think of it as `componentDidMount`.
- Line 51 creates the popup helper and passes it two callbacks, like React
  props: what to do on Pay toll and on Take a break.
- Lines 56–57 add every installed keyboard to the `ignored` set. A keyboard
  opens its own window, and we don't want that to look like an app switch.
- Line 29: a `Handler` on the main thread is Android's `setTimeout`.
  Lines 59–60 start the 2-second loop:

```kotlin
40  private val ticker = object : Runnable {
41    override fun run() {
42      flush()
43      currentPkg?.let { enforce(it) }
44      handler.postDelayed(this, TICK_MS)
45    }
46  }
```

This is the same as:

```js
function tick() { flush(); if (currentPkg) enforce(currentPkg); setTimeout(tick, 2000); }
```

- `SystemClock.elapsedRealtime()` is a clock that only moves forward (time
  since boot). It's used instead of the wall clock, so changing the phone's
  time doesn't mess up counting.

#### 2b. Android tells us when the app changes

`RES/xml/app_blocker_accessibility.xml`

```xml
4      android:accessibilityEventTypes="typeWindowStateChanged"
6      android:canRetrieveWindowContent="false"
7      android:description="@string/app_blocker_service_description"
8      android:isAccessibilityTool="false"
9      android:notificationTimeout="100" />
```

- Line 4: subscribe **only** to "a new window came to the front". We don't
  receive scrolls, clicks or text changes.
- Line 6: we can't read on-screen text even if we wanted to. This is the
  core of the privacy promise, and it helps with Google's review.
- Line 8: honest labelling. We aren't an assistive tool for disabled users.
  Google asks apps to declare this.
- Line 9: Android batches events at most every 100 ms.

`MAN` (the module's manifest, merged into the app's manifest at build time)

```xml
13  <service
14      android:name="expo.modules.appblocker.BlockerService"
15      android:exported="true"
16      android:label="@string/app_blocker_service_label"
17      android:permission="android.permission.BIND_ACCESSIBILITY_SERVICE">
18      <intent-filter>
19          <action android:name="android.accessibilityservice.AccessibilityService" />
20      </intent-filter>
21      <meta-data
22          android:name="android.accessibilityservice"
23          android:resource="@xml/app_blocker_accessibility" />
24  </service>
```

- The manifest is the app's declaration to Android: "here are my parts".
  This block says "I have an Accessibility service called BlockerService".
- Line 16 is the name shown in Android's Accessibility settings
  ("Mind-Muscle Sync blocker", from `strings.xml`).
- Line 17: only the Android system holds `BIND_ACCESSIBILITY_SERVICE`, so
  no other app can connect to our service.
- Lines 21–23 point to the config file above.

Now the event handler, `KT/BlockerService.kt`:

```kotlin
63  override fun onAccessibilityEvent(event: AccessibilityEvent?) {
64    if (event?.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return
65    val pkg = event.packageName?.toString() ?: return
66    if (pkg in ignored) return
67    // Our own popup also fires window events; they don't mean the user switched apps.
68    if (pkg == packageName && overlay.isShowing) return
69
70    flush() // credit time to the app we're leaving
71    currentPkg = pkg
72
73    // The user left the blocked app (home, another app, our app): take the popup down.
74    if (overlay.isShowing && overlay.shownFor != pkg) overlay.hide()
75
76    enforce(pkg)
77  }
```

- Line 65: the only thing we read from the event is the **package name**, the
  app's ID (for example `com.google.android.youtube`).
- Line 66 skips the status bar and keyboards.
- Line 68: when our popup appears, Android reports a window event from
  *our* package. Without this line, the service would think you'd switched to
  our app and stop blocking.
- Line 70 is important. Before switching, it credits the time since the last
  tick to the app you're **leaving**, so the seconds between ticks aren't lost.
- Line 74: you went to another app or the home screen, so the popup no longer
  belongs on screen.
- Line 76: check whether the new app is already over its limit. If it is,
  the popup appears instantly on re-entry.

#### 2c. Counting time

```kotlin
80  private fun flush() {
81    val now = SystemClock.elapsedRealtime()
82    val pkg = currentPkg
83    val counting = pkg != null &&
84      pkg != packageName &&
85      !overlay.isShowing &&
86      isScreenOn() &&
87      BlockerStore.limitMinutes(this, pkg) != null
88    if (counting) BlockerStore.addUsage(this, pkg!!, now - lastTick)
89    lastTick = now
90  }
…
124  private fun isScreenOn(): Boolean =
125    (getSystemService(Context.POWER_SERVICE) as? PowerManager)?.isInteractive ?: true
```

Time is added only if **all** of these are true (lines 83–87):

| Condition | Why |
|---|---|
| there is a current app | nothing to count before the first event |
| it isn't our app | time in Mind-Muscle Sync shouldn't count |
| the popup isn't showing | you can't use the app while it's covered |
| the screen is on | a phone left on YouTube in your pocket with the screen off shouldn't count |
| the app is on the blocked list | we only track apps you picked |

- Line 88 adds `now - lastTick` (about 2000 ms on a normal tick, or less
  if an app switch happened in between).
- Line 89 always moves `lastTick` forward, even when not counting. Otherwise
  time spent elsewhere would be credited all at once later.

`KT/BlockerStore.kt`

```kotlin
75  @Synchronized
76  fun addUsage(ctx: Context, pkg: String, millis: Long) {
77    if (millis <= 0) return
78    val p = ensureToday(ctx)
79    val usage = readJson(p, KEY_USAGE)
80    usage.put(pkg, usage.optLong(pkg, 0L) + millis)
81    p.edit().putString(KEY_USAGE, usage.toString()).apply()
82  }
```

- `@Synchronized` means only one caller at a time. The service and the JS
  bridge can both touch the store, and this stops two writes from overlapping.
- Line 78 makes sure the counters belong to today (Section 6).
- Lines 79–81: read the JSON map, add the milliseconds, write it back.
  JS equivalent: `usage[pkg] = (usage[pkg] ?? 0) + millis`.

#### 2d. Deciding to block

`KT/BlockerService.kt`

```kotlin
92   private fun enforce(pkg: String) {
93     if (pkg == packageName) return
94     if (overlay.isShowing) return
95     if (!BlockerStore.isOverLimit(this, pkg)) return
96     val now = SystemClock.elapsedRealtime()
97     if (now - lastShown < RESHOW_GAP_MS) return
98     // Apps can send a late "window opened" event right after the user chose "Take a break";
99     // don't let that pop the overlay straight back up.
100    if (pkg == breakPkg && now - breakAt < BREAK_COOLDOWN_MS) return
101    lastShown = now
102    overlay.show(pkg)
103  }
```

A series of "early return" guards, in order:
1. Never block our own app (line 93).
2. Already showing, so do nothing (line 94).
3. Not over the limit, so do nothing (line 95; formula in Section 6).
4. Shown less than 0.8 s ago, so wait (line 97). This stops flicker when
   several window events arrive in a burst.
5. You pressed Take a break for this app less than 1.5 s ago, so wait
   (line 100). Explained in Stage 4b.

`enforce` is called from two places: on every app switch (line 76) and on
every tick (line 43). So a popup appears **the moment you open** an
over-limit app, or **within 2 seconds** of crossing the limit while you're
already inside it.

---

### Stage 3 — The popup appears

Covered line by line in **Section 4** below.

---

### Stage 4a — Pay toll

**Files:** `KT/BlockerOverlay.kt`, `KT/BlockerService.kt`, `app.json`,
`src/app/_layout.tsx`, `src/app/toll.tsx`, `KT/BlockerStore.kt`

#### 4a-1. Button → deep link

`KT/BlockerOverlay.kt`

```kotlin
59  view.findViewById<View>(R.id.mms_overlay_pay).setOnClickListener {
60    hide()
61    onPayToll(pkg)
62  }
```

- `findViewById(R.id.mms_overlay_pay)` is like
  `document.getElementById('mms_overlay_pay')`. The ID is set in the XML
  layout.
- It hides the popup first, then calls the callback passed in from the
  service (`onPayToll = ::openToll`, `BlockerService.kt` line 51).

`KT/BlockerService.kt`

```kotlin
105  private fun openToll(pkg: String) {
106    val intent = Intent(Intent.ACTION_VIEW, Uri.parse("$DEEP_LINK_SCHEME://toll?pkg=${Uri.encode(pkg)}"))
107      .setPackage(packageName)
108      .addFlags(
109        Intent.FLAG_ACTIVITY_NEW_TASK or
110          Intent.FLAG_ACTIVITY_SINGLE_TOP or
111          Intent.FLAG_ACTIVITY_CLEAR_TOP
112      )
113    try {
114      startActivity(intent)
115    } catch (_: Exception) {
116      takeBreak()
117    }
118  }
…
143  const val DEEP_LINK_SCHEME = "mindmusclesync"
```

- Line 106 builds `mindmusclesync://toll?pkg=com.google.android.youtube` and
  asks Android to "view" it, like opening a URL.
- Line 107 says it must open **our** app, never another app that claims the
  same scheme.
- Lines 109–111, the flags:
  - `NEW_TASK`: required when starting a screen from a service.
  - `SINGLE_TOP` + `CLEAR_TOP`: if our app is already open, reuse it rather
    than stacking a second copy.
- Lines 115–116: if anything fails, fall back to sending you home, so you're
  never left stuck on the blocked app.
- Line 143 **must match** `app.json` line 8 (`"scheme": "mindmusclesync"`).
  Prebuild turns that into an intent filter in the generated
  `android/app/src/main/AndroidManifest.xml` (lines ~25–28: `VIEW`,
  `BROWSABLE`, `scheme="mindmusclesync"`), which is what lets Android route
  the link to us.

#### 4a-2. Link → Toll screen

Expo Router maps URLs to files automatically: `mindmusclesync://toll?pkg=…`
→ `src/app/toll.tsx`, with `pkg` available as a search param.

`src/app/_layout.tsx`

```tsx
39  <Stack.Screen name="toll" options={{ presentation: 'fullScreenModal', gestureEnabled: false, animation: 'fade' }} />
```

- Full-screen, fades in, and swiping it away is turned off.

`src/app/toll.tsx`

```tsx
20  const { pkg = '' } = useLocalSearchParams<{ pkg?: string }>();
21  const { apps, loadApps, refresh, today, targets } = useBlocker();
22  const name = appLabel(apps, pkg);
23  const used = today?.usage[pkg] ?? 0;
…
26  useEffect(() => {
27    refresh();
28    loadApps().catch(() => {});
29  }, [refresh, loadApps, pkg]);
```

- Line 20 reads `?pkg=…` from the link.
- Line 27 pulls fresh numbers from native, so "You've used 6 min of Chrome"
  is current.

#### 4a-3. Paying the (test) toll

```tsx
48  const payTestToll = () => {
49    AppBlocker.grantMinutes(pkg, TOLL_MINUTES);
50    refresh();
51    AppBlocker.openApp(pkg);
52    if (router.canGoBack()) router.back();
53    else router.replace('/');
54  };
```

- Line 49 → `BlockerStore.grant` (below). `TOLL_MINUTES` is 5
  (`limits.ts` line 9).
- Line 51 → `AppBlockerModule.kt` lines 63–71: gets the app's launch intent
  (the same thing tapping its icon does) and starts it.
- Lines 52–53 close the Toll screen behind it, so our app is back on its
  normal screen next time.

`KT/BlockerStore.kt`

```kotlin
96   @Synchronized
97   fun grant(ctx: Context, pkg: String, minutes: Int) {
98     val p = ensureToday(ctx)
99     val extra = readJson(p, KEY_EXTRA)
100    extra.put(pkg, extra.optLong(pkg, 0L) + minutes * 60_000L)
101    val tolls = readJson(p, KEY_TOLLS)
102    tolls.put(pkg, tolls.optInt(pkg, 0) + 1)
103    p.edit()
104      .putString(KEY_EXTRA, extra.toString())
105      .putString(KEY_TOLLS, tolls.toString())
106      .apply()
107  }
```

- Line 100 adds 5 × 60 000 ms to today's **extra** for that app. Usage isn't
  reset. Instead the allowance grows, so `isOverLimit` turns false until you
  use those 5 minutes.
- Line 102 counts the toll. Phase 2 uses this to make repeat tolls harder.

When YouTube comes back to the front, the service gets a window event,
`enforce` runs, `isOverLimit` is now false, and no popup appears.

---

### Stage 4b — Take a break

**Files:** `KT/BlockerOverlay.kt`, `KT/OverlayRootView.kt`, `KT/BlockerService.kt`

```kotlin
// BlockerOverlay.kt
63  view.findViewById<View>(R.id.mms_overlay_break).setOnClickListener {
64    hide()
65    onTakeBreak(pkg)
66  }
67  view.onBack = {
68    hide()
69    onTakeBreak(pkg)
70  }
```

- The button (line 63) and the Back key (line 67) do exactly the same thing.

```kotlin
// BlockerService.kt
51  overlay = BlockerOverlay(this, onPayToll = ::openToll, onTakeBreak = { pkg ->
52    breakPkg = pkg
53    breakAt = SystemClock.elapsedRealtime()
54    takeBreak()
55  })
…
120  private fun takeBreak() {
121    performGlobalAction(GLOBAL_ACTION_HOME)
122  }
```

- Line 121: Accessibility services can press system buttons on the user's
  behalf. This one presses **Home**.
- Lines 52–53 note *which* app and *when*. Here's why: after you press Home,
  some apps send one last "my window is showing" event a few hundred
  milliseconds later. Without the note, `enforce` would see that event and
  pop the popup straight back up. The 1.5-second cooldown
  (`enforce`, line 100) ignores it. This bug showed up in testing; after the
  fix, the test passed 3 out of 3 times.

---

### Meanwhile — the screens stay live

**Files:** `src/features/blocker/useLiveBlocker.ts`, `store.ts`,
`components/TodayAppsCard.tsx`, `components/UsageBar.tsx`

`useLiveBlocker.ts`

```ts
11  export function useLiveBlocker(intervalMs = 3000) {
…
15    useFocusEffect(
16      useCallback(() => {
17        refresh();
18        loadApps().catch(() => {});
19        const timer = setInterval(refresh, intervalMs);
20        const sub = AppState.addEventListener('change', (state) => {
21          if (state === 'active') refresh();
22        });
23        return () => {
24          clearInterval(timer);
25          sub.remove();
26        };
```

- `useFocusEffect` (line 15) is like `useEffect`, but it runs only while the
  screen is the visible tab, and cleans up when you leave it. Polling stops
  when nobody is looking.
- Line 19: re-read every 3 s on Home (`index.tsx` line 17,
  `useLiveBlocker()`) and every 4 s on Settings (`settings.tsx` line 16,
  `useLiveBlocker(4000)`).
- Lines 20–21: refresh immediately when you return to the app, for example
  after switching on Accessibility.

`store.ts`, the refresh itself:

```ts
39  refresh: () => {
40    set({
41      targets: AppBlocker.getTargets(),
42      today: AppBlocker.getToday(),
43      accessibilityOn: AppBlocker.isAccessibilityEnabled(),
44    });
45  },
```

These are synchronous native calls. Reading a small SharedPreferences file
is fast enough not to need a Promise.

`TodayAppsCard.tsx` → `UsageBar.tsx`

```tsx
// TodayAppsCard.tsx
40  <UsageBar
41    key={pkg}
42    label={appLabel(apps, pkg)}
43    usedMs={today?.usage[pkg] ?? 0}
44    allowanceMs={allowanceMs(targets[pkg], today?.extra[pkg] ?? 0)}
45  />

// UsageBar.tsx
12  const ratio = allowanceMs > 0 ? Math.min(usedMs / allowanceMs, 1) : 1;
13  const fill = ratio >= 1 ? colors.danger : ratio >= 0.8 ? colors.muscle : colors.primary;
…
22  {ratio >= 1 ? 'Toll due' : `${formatDuration(usedMs)} / ${formatDuration(allowanceMs)}`}
```

- `allowanceMs` (`limits.ts` line 33) is `limit × 60 000 + extra`, the same
  formula as native `isOverLimit`. So the bar turns red at exactly the moment
  the popup would appear.
- Line 13: indigo below 80%, coral from 80%, red at 100%.

---

## Section 4 — The popup, piece by piece

**Files:** `KT/BlockerOverlay.kt`, `KT/OverlayRootView.kt`, `KT/BlockerLines.kt`,
`RES/layout/mms_blocker_overlay.xml`, `RES/drawable/*.xml`, `RES/font/*.ttf`,
`RES/values/strings.xml`

### 4.1 Why it's native views, not React Native

React Native only runs inside our app's own screen. When you're in YouTube,
our JavaScript isn't drawing anything. So the popup is built the classic
Android way: an **XML layout** (like JSX, but a static file) plus Kotlin code
that fills in the text and handles taps.

### 4.2 The layout file — `RES/layout/mms_blocker_overlay.xml`

Think of it as JSX. `FrameLayout` is roughly a `View` with
`position: relative`, `LinearLayout vertical` is a `View` with
`flexDirection: 'column'`, and `TextView` is `<Text>`.

```xml
6   <expo.modules.appblocker.OverlayRootView …
8       android:layout_width="match_parent"
9       android:layout_height="match_parent"
10      android:background="#B31F2340"
11      android:clickable="true"
12      android:focusable="true">
```

**(1) Dim layer.** The root fills the whole screen (lines 8–9).
- `#B31F2340` is ARGB: `B3` = 70% opacity, `1F2340` = the app's navy ink.
- `clickable="true"` (line 11) makes it *eat* every tap, so nothing reaches
  the app behind. It's like a full-screen `<Pressable>` with no `onPress`.
- `focusable` (line 12) lets it receive the Back key.
- The tag name is our own class `OverlayRootView` (4.4), not a plain
  `FrameLayout`.

```xml
14  <LinearLayout
15      android:id="@+id/mms_overlay_card"
18      android:layout_gravity="bottom"
19      android:background="@drawable/mms_overlay_card"
20      android:clickable="true"
22      android:orientation="vertical"
26      android:paddingBottom="48dp">
```

- The card sits at the bottom (line 18). Its shape comes from a drawable
  (line 19). It's also clickable so taps on the card's empty space are
  absorbed too.
- `dp` = density-independent pixels, the same unit React Native uses.

```xml
28  <TextView
29      android:layout_width="88dp"
30      android:layout_height="88dp"
31      android:background="@drawable/mms_mascot_circle"
33      android:importantForAccessibility="no"
34      android:text="🐼"
35      android:textSize="40sp" />
```

**(2) Mascot circle.** An emoji placeholder until the Phase 6 art. Line 33
hides the decorative emoji from screen readers.

```xml
37  <TextView android:id="@+id/mms_overlay_time"   … fontFamily="@font/nunito_black"     textSize="28sp" />
47  <TextView android:id="@+id/mms_overlay_sub"    … fontFamily="@font/nunito_semibold"  textColor="#6B6F86" />
57  <TextView android:id="@+id/mms_overlay_line"   … background="@drawable/mms_bubble" fontFamily="@font/nunito_extrabold" />
```

**(3) Time + sub line, (4) funny line.** These have IDs but no text. Kotlin
fills them in. `sp` is like `dp` but also scales with the user's font-size
setting.

```xml
70  <TextView android:id="@+id/mms_overlay_pay"
73      android:layout_height="69dp"
75      android:background="@drawable/mms_btn_primary"
78      android:letterSpacing="0.08"
79      android:paddingBottom="5dp"
80      android:text="@string/mms_overlay_pay"
…
93  <TextView android:id="@+id/mms_overlay_break"
96      android:layout_height="61dp"
98      android:background="@drawable/mms_btn_neutral"
104     android:textColor="#4F46E5"
```

**(5) Pay toll, (6) Take a break.**
- The heights (69dp / 61dp) include the 4–5dp "edge" at the bottom, so the
  tappable face stays above the 52dp minimum touch size.
- `paddingBottom="5dp"` (line 79) centres the label on the face, not on
  face + edge.
- Labels come from `strings.xml` ("PAY TOLL", "TAKE A BREAK").
  `letterSpacing` matches the app's uppercase label style.

### 4.3 The chunky button — `RES/drawable/mms_btn_primary.xml`

```xml
2   <selector …>
3       <item android:state_pressed="true">
4           <layer-list>
5               <item android:top="4dp"><shape><solid android:color="#3730A3" /><corners android:radius="28dp" /></shape></item>
6               <item android:top="4dp" android:bottom="1dp"><shape><solid android:color="#4F46E5" /> … </shape></item>
7           </layer-list>
8       </item>
9       <item>
10          <layer-list>
11              <item android:top="4dp"><shape><solid android:color="#3730A3" /> … </shape></item>
12              <item android:bottom="5dp"><shape><solid android:color="#4F46E5" /> … </shape></item>
13          </layer-list>
14      </item>
15  </selector>
```

- A `selector` picks a look by state, like `style={pressed ? a : b}`.
- A `layer-list` stacks shapes, the first one at the bottom:
  - **Normal** (lines 10–13): a dark indigo `#3730A3` layer shifted down
    4dp (the "edge"), and the indigo face lifted 5dp above the bottom. The
    dark strip that shows underneath is the 3D edge.
  - **Pressed** (lines 4–7): the face also moves down 4dp, so it "drops into"
    the edge, the same as `ChunkyButton` in the app.
- `mms_btn_neutral.xml` is the same idea with a white face, a cream-grey
  edge `#D6CEC1` and a 2dp border `#E7E1D7`.
- `mms_overlay_card.xml`, `mms_bubble.xml` and `mms_mascot_circle.xml` are
  simple rounded shapes with solid colors.

### 4.4 Catching the Back key — `KT/OverlayRootView.kt`

```kotlin
9   class OverlayRootView @JvmOverloads constructor(
10    context: Context,
11    attrs: AttributeSet? = null,
12  ) : FrameLayout(context, attrs) {
14    var onBack: (() -> Unit)? = null
16    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
17      if (event.keyCode == KeyEvent.KEYCODE_BACK) {
18        if (event.action == KeyEvent.ACTION_UP) onBack?.invoke()
19        return true
20      }
21      return super.dispatchKeyEvent(event)
22    }
```

- A `FrameLayout` with one extra feature. Every key press passes through
  `dispatchKeyEvent`.
- Line 17: if it's Back, line 18 fires `onBack` once, when the key is
  *released* (`ACTION_UP`), so it doesn't fire twice.
- Line 19: `return true` means "handled", so Back never reaches the app
  behind. Similar to `return true` in React Native's `BackHandler`.
- `@JvmOverloads` + `attrs` are needed so Android can create this class from
  the XML file.

### 4.5 Showing it — `KT/BlockerOverlay.kt`

```kotlin
43  fun show(pkg: String) {
44    if (root != null) {
45      if (shownFor == pkg) return
46      hide()
47    }
49    val view = LayoutInflater.from(service).inflate(R.layout.mms_blocker_overlay, null) as OverlayRootView
50    val appName = appLabel(pkg)
51    val used = BlockerLines.formatDuration(BlockerStore.usedMillis(service, pkg))
52    val limit = BlockerStore.limitMinutes(service, pkg)
54    view.findViewById<TextView>(R.id.mms_overlay_time).text = "$used on $appName"
55    view.findViewById<TextView>(R.id.mms_overlay_sub).text =
56      if (limit != null) "today · your limit was $limit min" else "today"
57    view.findViewById<TextView>(R.id.mms_overlay_line).text = BlockerLines.pick(appName, used)
```

- Lines 44–47: never show two popups at once.
- Line 49: **inflate** means turning the XML file into real view objects,
  like rendering JSX once into a tree.
- Lines 50–52 gather the data, and lines 54–57 fill the empty TextViews.

```kotlin
112  private fun appLabel(pkg: String): String = try {
113    val pm = service.packageManager
114    pm.getApplicationLabel(pm.getApplicationInfo(pkg, 0)).toString()
115  } catch (_: Exception) {
116    pkg
117  }
```

- Turns `com.android.chrome` into "Chrome". Falls back to the raw ID if the
  lookup fails.

```kotlin
72  val params = WindowManager.LayoutParams(
73    WindowManager.LayoutParams.MATCH_PARENT,
74    WindowManager.LayoutParams.MATCH_PARENT,
75    WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
76    WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
77    PixelFormat.TRANSLUCENT
78  )
80  try {
81    windowManager.addView(view, params)
82  } catch (_: Exception) {
83    return
84  }
85  root = view
86  shownFor = pkg
87  pausePlayback()
88  animateIn(view)
```

This is the key part that puts our view **on top of another app**:
- Lines 73–74: full screen.
- Line 75: `TYPE_ACCESSIBILITY_OVERLAY`, the special window type (Section 5).
- Line 76: lay out across the whole screen, including behind the status bar.
- Line 77: allow transparency (the dim layer is see-through).
- No `FLAG_NOT_FOCUSABLE` is set, so the window takes focus. That's why it
  receives the Back key.
- Line 81: `WindowManager` is Android's window system. `addView` puts our
  window on screen, over whatever app is open.
- Line 85: `root != null` is what `isShowing` checks (line 40–41).

```kotlin
102  private fun animateIn(view: OverlayRootView) {
103    val card = view.findViewById<View>(R.id.mms_overlay_card)
104    view.alpha = 0f
105    view.animate().alpha(1f).setDuration(180).start()
106    card.post {
107      card.translationY = card.height.toFloat()
108      card.animate().translationY(0f).setDuration(320).setInterpolator(DecelerateInterpolator(2f)).start()
109    }
110  }
```

- The dim layer fades in over 180 ms (line 105). The card slides up from below
  over 320 ms with an ease-out (lines 107–108).
- `card.post { … }` (line 106) waits one frame so the card's height is known,
  like reading layout in `onLayout` before animating.

### 4.6 Hiding it

```kotlin
91  fun hide() {
92    val view = root ?: return
93    root = null
94    shownFor = null
95    try {
96      windowManager.removeView(view)
97    } catch (_: Exception) {
98    }
99    releasePlayback()
100 }
```

- Line 92: if nothing is showing, do nothing. That makes it safe to call
  `hide()` at any time.
- Line 96 removes the window, and line 99 gives audio focus back.

### 4.7 Pausing video — audio focus

```kotlin
120  private fun pausePlayback() {
121    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
122      val req = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
123        .setAudioAttributes(
124          AudioAttributes.Builder()
125            .setUsage(AudioAttributes.USAGE_ASSISTANCE_SONIFICATION)
126            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
127            .build()
128        )
129        .setOnAudioFocusChangeListener { }
130        .build()
131      audioManager.requestAudioFocus(req)
132      focusRequest = req
133    } else { … older-Android version of the same call … }
134  }
```

- Android has one "audio focus" token. When an app takes it, well-behaved
  media apps (YouTube, Instagram, Spotify) pause.
- Line 122: `GAIN_TRANSIENT` means "I need audio briefly". Apps pause rather
  than fully stop, and may resume when we give the token back (`hide()` →
  `releasePlayback`).
- Line 121: Android 8+ uses the newer `AudioFocusRequest` API. The `else`
  branch covers older phones.
- This depends on the other app respecting audio focus. It still needs to be
  checked on a real phone.

### 4.8 The funny lines — `KT/BlockerLines.kt`

```kotlin
8   private val lines = listOf(
9     "Your thumb just ran a marathon. Let it rest. 🏃",
10    "The algorithm says thanks for the {time}. Your future self? Less thrilled.",
…
20    "That's {time}. Your eyes have filed a complaint. 👀",
21  )
23  private var last = -1
25  fun pick(app: String, time: String): String {
26    var i = lines.indices.random()
27    if (i == last && lines.size > 1) i = (i + 1) % lines.size
28    last = i
29    return lines[i].replace("{time}", time).replace("{app}", app)
30  }
33  fun formatDuration(ms: Long): String {
34    val totalSec = (ms / 1000).coerceAtLeast(0)
35    if (totalSec < 60) return "$totalSec sec"
36    val totalMin = totalSec / 60
37    if (totalMin < 60) return "$totalMin min"
38    return "${totalMin / 60}h ${(totalMin % 60).toString().padStart(2, '0')}m"
39  }
```

- Line 26: pick a random index. Line 27: if it's the same as last time, take
  the next one, so no line repeats twice in a row.
- Line 29 fills in placeholders: `"{app}: 1, You: 0"` → `"Chrome: 1, You: 0"`.
- Lines 33–39 do the same job as `formatDuration` in `limits.ts`, but say
  "45 sec" instead of "45s", which reads better in a sentence.

### 4.9 The font

`RES/font/nunito_black.ttf`, `nunito_extrabold.ttf`, `nunito_semibold.ttf`
are referenced in the layout as `@font/nunito_black` and so on. The app's
fonts are loaded at runtime by JavaScript (`@expo-google-fonts/nunito` in
`_layout.tsx` lines 1–8, 20–26), so they don't exist when the popup is drawn
over another app. Bundling the `.ttf` files in `res/font` makes them part of
the APK, available to native views at any time.

---

## Section 5 — Android features that make it possible

Each feature, where it's used, and the line that uses it.

### 5.1 AccessibilityService — the always-running watcher

| Where | Line |
|---|---|
| `KT/BlockerService.kt` 27 | `class BlockerService : AccessibilityService()` |
| `MAN` 13–24 | the `<service>` declaration |
| `RES/xml/app_blocker_accessibility.xml` | the config |

**Why it's needed:** a normal app gets paused when it isn't on screen. An
Accessibility service is kept running by Android whenever the user has it
switched on, including **after a reboot** (Android reconnects it and calls
`onServiceConnected` again). That's why Phase 1 needed no foreground
service, no permanent notification and no boot receiver.

**The cost:** Google reviews every app that uses it. Hence the disclosure card
(`AccessibilityCard.tsx`), the honest description (`strings.xml` line 7), and
`isAccessibilityTool="false"`.

### 5.2 Window-change events — knowing which app is open

| Where | Line |
|---|---|
| config line 4 | `accessibilityEventTypes="typeWindowStateChanged"` |
| config line 6 | `canRetrieveWindowContent="false"` |
| `BlockerService.kt` 64–65 | filter the event type, read `event.packageName` |

We get an event each time an activity (a full screen) or dialog comes to the
front, and read only one field: which app it belongs to.

### 5.3 TYPE_ACCESSIBILITY_OVERLAY — drawing over other apps

| Where | Line |
|---|---|
| `BlockerOverlay.kt` 75 | `WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY` |

Normally, drawing over other apps needs `TYPE_APPLICATION_OVERLAY` **plus**
the "Display over other apps" permission (`SYSTEM_ALERT_WINDOW`), which users
have to grant on a separate settings page. Android gives Accessibility
services their own overlay type that needs no extra permission. One
permission fewer means one setup step fewer and one less thing for Google to
question.

### 5.4 WindowManager — adding and removing that window

| Where | Line |
|---|---|
| `BlockerOverlay.kt` 30 | `service.getSystemService(Context.WINDOW_SERVICE) as WindowManager` |
| `BlockerOverlay.kt` 81 | `windowManager.addView(view, params)` |
| `BlockerOverlay.kt` 96 | `windowManager.removeView(view)` |

`getSystemService(...)` is how Android code gets access to a system
feature, roughly like importing a built-in module. You'll see it for
power, audio, keyboards and windows.

### 5.5 Audio focus — pausing the video

| Where | Line |
|---|---|
| `BlockerOverlay.kt` 31 | get `AudioManager` |
| `BlockerOverlay.kt` 122, 131 | request `AUDIOFOCUS_GAIN_TRANSIENT` |
| `BlockerOverlay.kt` 141 | `abandonAudioFocusRequest` on hide |

See 4.7. It's a request, not a command. Apps that respect focus pause.

### 5.6 Global actions — pressing Home for you

| Where | Line |
|---|---|
| `BlockerService.kt` 121 | `performGlobalAction(GLOBAL_ACTION_HOME)` |

Android never lets one app close another. An Accessibility service can press
system buttons (Home, Back, Recents) as if the user did. Phase 1.5 uses
`GLOBAL_ACTION_BACK` to leave Reels while staying in the app.

There's also `goHome()` in `AppBlockerModule.kt` lines 74–80, used from the
**Toll screen**. Our app is visible there, so it can just open the
home screen with a `CATEGORY_HOME` intent. No Accessibility action is needed.

### 5.7 SharedPreferences — storage that survives reboots

| Where | Line |
|---|---|
| `BlockerStore.kt` 29–30 | `ctx.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)` |

Android's built-in key-value store, the native cousin of `AsyncStorage`.
`MODE_PRIVATE` means only our app can read it. Details in Section 6.

### 5.8 Deep link — popup → Toll screen

| Where | Line |
|---|---|
| `app.json` 8 | `"scheme": "mindmusclesync"` |
| generated `android/app/src/main/AndroidManifest.xml` ~25–28 | `VIEW` + `BROWSABLE` + `scheme="mindmusclesync"` |
| `BlockerService.kt` 106–107, 143 | build and open the link |
| `src/app/toll.tsx` 20 | read `pkg` |

### 5.9 PackageManager + `<queries>` — listing installed apps

| Where | Line |
|---|---|
| `MAN` 4–9 | `<queries>` for MAIN + LAUNCHER |
| `AppBlockerModule.kt` 42–44 | `pm.queryIntentActivities(launcher, 0)` |
| `AppBlockerModule.kt` 64 | `getLaunchIntentForPackage(pkg)` for `openApp` |
| `BlockerOverlay.kt` 114 | `getApplicationLabel` for the app name |

Since Android 11, apps can't see other installed apps by default ("package
visibility"). The `<queries>` block says "I need to see apps that have a
launcher icon", which is exactly what the picker needs. The alternative,
`QUERY_ALL_PACKAGES`, needs a special justification on Google Play.

### 5.10 Settings.Secure — is our service on?

| Where | Line |
|---|---|
| `AppBlockerModule.kt` 27–31 | read `ENABLED_ACCESSIBILITY_SERVICES` and look for ours |

Explained in Section 3, 1b.

### 5.11 PowerManager — is the screen on?

| Where | Line |
|---|---|
| `BlockerService.kt` 124–125 | `PowerManager.isInteractive` |

Used so time isn't counted while the screen is off.

### 5.12 Expo Modules API (classic) — the bridge

| Where | Line |
|---|---|
| `expo-module.config.json` 2–5 | tells Expo to load `expo.modules.appblocker.AppBlockerModule` on Android |
| `AppBlockerModule.kt` 16, 21–22 | `class AppBlockerModule : Module()`, `ModuleDefinition { Name("AppBlocker") … }` |
| `AppBlockerModule.kt` 25, 41 | `Function(...)` = sync call, `AsyncFunction(...)` = returns a Promise |
| `index.ts` 16 | `requireNativeModule<NativeAppBlocker>('AppBlocker')` |
| `index.ts` 33–43 | the typed `AppBlocker` wrapper the app imports |

Expo autolinking reads `expo-module.config.json` at build time and registers
the Kotlin class. On the JS side `requireNativeModule` finds it by name. Each
`Function("x") { … }` block becomes `Native.x(...)` in JS.

---

## Section 6 — Where the data lives

**Files:** `KT/BlockerStore.kt` (all storage), `KT/AppBlockerModule.kt`
(exposes it), `modules/app-blocker/index.ts` (parses it),
`src/features/blocker/store.ts` (mirrors it for React)

### 6.1 The storage file

```kotlin
21  object BlockerStore {
22    private const val PREFS = "mms_app_blocker"
23    private const val KEY_TARGETS = "targets"
24    private const val KEY_DAY = "day"
25    private const val KEY_USAGE = "usage"
26    private const val KEY_EXTRA = "extra"
27    private const val KEY_TOLLS = "tolls"
29    private fun prefs(ctx: Context): SharedPreferences =
30      ctx.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
```

- `object BlockerStore` is a singleton. There's exactly one, shared by the
  service and the bridge, both running inside our app's process.
- Line 30 opens (or creates) the file
  `/data/data/com.mindmusclesync.app/shared_prefs/mms_app_blocker.xml`.
- On disk it's a small XML file. Each value is a JSON string:

```xml
<map>
  <string name="targets">{"com.android.chrome":1}</string>
  <string name="day">2026-11-08</string>
  <string name="usage">{"com.android.chrome":372000}</string>
  <string name="extra">{"com.android.chrome":300000}</string>
  <string name="tolls">{"com.android.chrome":1}</string>
</map>
```

(Read the real one with
`adb shell run-as com.mindmusclesync.app cat shared_prefs/mms_app_blocker.xml`.)

```kotlin
34  private fun readJson(p: SharedPreferences, key: String): JSONObject =
35    try { JSONObject(p.getString(key, "{}") ?: "{}") } catch (_: Exception) { JSONObject() }
```

- Reads one key and parses it. If it's missing or corrupt, you get `{}`
  instead of a crash.

### 6.2 The midnight reset

```kotlin
32  private fun today(): String = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
…
38  @Synchronized
39  private fun ensureToday(ctx: Context): SharedPreferences {
40    val p = prefs(ctx)
41    val day = today()
42    if (p.getString(KEY_DAY, null) != day) {
43      p.edit()
44        .putString(KEY_DAY, day)
45        .putString(KEY_USAGE, "{}")
46        .putString(KEY_EXTRA, "{}")
47        .putString(KEY_TOLLS, "{}")
48        .apply()
49    }
50    return p
51  }
```

- No timer or alarm is needed. Every read or write of daily data goes through
  `ensureToday`. The first call after midnight sees that the saved `day` is
  old (line 42) and wipes usage, extra and tolls (lines 44–47).
- `targets` is **not** reset. Your chosen apps and limits stay.
- `today()` uses the phone's local time zone, so the reset happens at your
  midnight.
- `Locale.US` (line 32) makes sure digits are always 0–9, even if the phone
  is set to a language that uses different numerals.

### 6.3 Reading limits and usage

```kotlin
68  fun limitMinutes(ctx: Context, pkg: String): Int? {
69    val targets = readJson(prefs(ctx), KEY_TARGETS)
70    return if (targets.has(pkg)) targets.optInt(pkg) else null
71  }
…
84  fun usedMillis(ctx: Context, pkg: String): Long = readJson(ensureToday(ctx), KEY_USAGE).optLong(pkg, 0L)
```

- `limitMinutes` returns `null` for apps that aren't blocked. The service uses
  this as the "is it blocked?" check (`BlockerService.kt` line 87).
- `usedMillis` feeds the popup's "6 min on Chrome" (`BlockerOverlay.kt` line 51).

### 6.4 The "over the limit" rule

```kotlin
87  fun isOverLimit(ctx: Context, pkg: String): Boolean {
88    val limit = limitMinutes(ctx, pkg) ?: return false
89    val p = ensureToday(ctx)
90    val used = readJson(p, KEY_USAGE).optLong(pkg, 0L)
91    val extra = readJson(p, KEY_EXTRA).optLong(pkg, 0L)
92    return used >= limit * 60_000L + extra
93  }
```

- Line 88: not blocked means never over.
- Line 92, worked example: limit 1 min, one toll paid.
  - allowance = 1 × 60 000 + 300 000 = 360 000 ms (6 min)
  - used 372 000 ms (6 min 12 s) ≥ 360 000 → **over**, so the popup shows.
- The JS side uses the identical formula (`limits.ts` line 33,
  `allowanceMs`), so the Home bar and the popup always agree.

### 6.5 Handing everything to JS

```kotlin
110  fun todayJson(ctx: Context): String {
111    val p = ensureToday(ctx)
112    return JSONObject()
113      .put("day", p.getString(KEY_DAY, today()))
114      .put("usage", readJson(p, KEY_USAGE))
115      .put("extra", readJson(p, KEY_EXTRA))
116      .put("tolls", readJson(p, KEY_TOLLS))
117      .toString()
118  }
```

→ exposed as `Function("getToday")` (`AppBlockerModule.kt` line 58)
→ parsed in `index.ts` line 39: `getToday: (): TodayStats => JSON.parse(Native.getToday())`
→ typed by `TodayStats` (`index.ts` lines 23–31)
→ stored in Zustand by `refresh()` (`store.ts` lines 39–45)
→ rendered by `TodayAppsCard` / `UsageBar` and the Toll screen.

**Why JSON strings across the bridge?** The Expo bridge can pass maps, but
nested maps with dynamic keys (package names) are easy to get subtly wrong
between Kotlin and TypeScript types. A JSON string is one simple, predictable
value. Each side parses it with a tool it already trusts (`org.json` in
Kotlin, `JSON.parse` in JS).

### 6.6 The full function list and where each lands

| JS call (`index.ts`) | Kotlin (`AppBlockerModule.kt`) | Does |
|---|---|---|
| `isAccessibilityEnabled()` (34) | lines 25–32 | read `Settings.Secure` |
| `openAccessibilitySettings()` (35) | lines 34–38 | open the system page |
| `getInstalledApps()` (36) | lines 41–52 (`getInstalledAppsAsync`) | list launchable apps |
| `getTargets()` (37) | line 54 → `BlockerStore.getTargetsJson` (56) | read limits |
| `setTargets(t)` (38) | line 56 → `BlockerStore.setTargetsJson` (58–66) | save limits |
| `getToday()` (39) | line 58 → `BlockerStore.todayJson` (110–118) | read today's numbers |
| `grantMinutes(pkg, m)` (40) | line 60 → `BlockerStore.grant` (97–107) | add toll minutes |
| `openApp(pkg)` (41) | lines 63–71 | launch an app |
| `goHome()` (42) | lines 74–80 | open the home screen |

### 6.7 Who writes what

| Data | Written by | Read by |
|---|---|---|
| `targets` | JS (Settings / picker → `setTargets`) | service (every tick), popup, JS |
| `usage` | service only (`flush` → `addUsage`) | service, popup, JS |
| `extra`, `tolls` | JS (Toll screen → `grantMinutes`) | service (`isOverLimit`), JS |
| `day` | `ensureToday` (automatically) | `ensureToday` |

Usage is only ever written by native code. JavaScript can't add or remove
counted time, which keeps the numbers trustworthy, and closes one easy way
around the block once tolls cost real effort.
