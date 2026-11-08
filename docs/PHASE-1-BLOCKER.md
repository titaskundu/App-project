# Mind-Muscle Sync — Phase 0 & 1 Documentation

How the app shell and the app blocker work, and what every file is for.

- Status: Phase 0 complete; Phase 1 built and tested on the emulator, awaiting review
- Platform: Android, Expo SDK 58, React Native 0.88
- Baseline commit: `c9e1655`
- Roadmap: `PLAN.md` · Project rules: `CLAUDE.md`
- Line-by-line detail for sections 3–6: `docs/PHASE-1-CODE-WALKTHROUGH.md`

---

## Contents

1. What Phase 1 does
2. The three layers
3. How it flows, step by step
4. The popup, piece by piece
5. Android features that make it possible
6. Where the data lives
7. Every file and its purpose
8. Testing: what passed, known limits
9. Useful commands
10. Glossary

---

## 1. What Phase 1 does

The blocker watches which app you're using and counts the minutes against a
daily limit you set per app. When you go over, it covers that app with a
popup that offers two choices:

- **Pay toll** opens our app's Toll screen. Paying the toll adds more minutes
  for that app today. For now this is a test button that adds 5 minutes.
  Brain puzzles and Muscle reps replace it in Phases 2–3.
- **Take a break** closes the popup and sends you to the home screen.

All counters reset at local midnight. Blocking keeps working when our app is
closed, after it's swiped away from Recents, and after the phone restarts.

---

## 2. The three layers

React Native code only runs while our app is open. Blocking has to work while
you're inside YouTube or Instagram, so the watching and blocking live in
native Android code (Kotlin) that Android keeps running in the background. A
small bridge connects the two.

```
┌───────────────────────────────────────────────────────────┐
│ 1. YOUR APP'S SCREENS  (React Native + TypeScript)        │
│    Home · Settings · App picker · Toll screen             │
│    Pick apps, set limits, see today's usage, pay tolls    │
└──────────────┬────────────────────────────────────────────┘
               │ reads usage · saves limits · grants minutes
┌──────────────▼────────────────────────────────────────────┐
│ 2. THE BRIDGE: "AppBlocker" Expo module                   │
│    index.ts (JS half)  ⇄  AppBlockerModule.kt (Kotlin)    │
│    Complex values cross as JSON text                      │
└──────────────┬────────────────────────────────────────────┘
               │ same saved data on the phone
┌──────────────▼────────────────────────────────────────────┐
│ 3. NATIVE ANDROID  (runs even when our app is closed)     │
│    BlockerService  – the watcher, counts time             │
│    BlockerStore    – the memory (SharedPreferences)       │
│    BlockerOverlay  – draws the popup over other apps      │
└───────────────────────────────────────────────────────────┘
```

**Key rule:** the native store is the source of truth. JavaScript never keeps
its own copy of limits or usage. It reads from and writes to native.

---

## 3. How it flows, step by step

### Stage 1 — Setup (once, done by the user)

1. Settings shows an orange **AccessibilityCard** that explains what the
   permission is for. Google Play requires this "prominent disclosure"
   before the app sends users to the system screen.
2. **Open settings** jumps to Android's Accessibility page. The user turns on
   "Mind-Muscle Sync blocker" and accepts Android's warning.
3. **Add or remove apps** opens the app picker. It lists installed apps
   with common time-sinks (Instagram, YouTube, etc.) first.
4. Each picked app gets a limit, changed with the − / + stepper. The steps
   are 1, 5, 10, 15, 20, 30, 45, 60, 90 and 120 minutes; the default is 15.
5. Limits are saved straight into the native store (`setTargets`), where the
   background watcher reads them.

### Stage 2 — Watching and counting (all day, `BlockerService`)

Android tells the watcher every time a different app's window comes to the
front (`TYPE_WINDOW_STATE_CHANGED`). It **never reads what's on screen**, only
the app's package name (for example `com.google.android.youtube`).

On each app switch:
- The time for the previous app is saved (`flush`).
- If the popup is up for another app, it's hidden.
- The new app is checked against its limit (`enforce`).

Every 2 seconds (`TICK_MS = 2000`) a timer runs:

| Step    | Check                                                              |
|---------|--------------------------------------------------------------------|
| check   | Is the screen on, is this app on the blocked list, and is no popup showing? |
| add     | If yes, add the elapsed time to the app's total for today (BlockerStore) |
| compare | Is today's use ≥ limit × 60 000 ms + extra minutes earned from tolls? |
| block   | If yes, show the popup on top of the app                           |

The watcher ignores Android's own system UI and keyboard packages, so pulling
down the notification shade or typing doesn't reset the current app.

### Stage 3 — The popup appears (`BlockerOverlay`)

- It slides up over the app, which is dimmed behind it. All taps on the app
  are absorbed.
- It asks Android for **audio focus**, which normally makes video apps pause.
- It shows the time used today, the limit, and one of 12 funny lines.
- Reopening the blocked app while still over the limit brings the popup
  straight back. A short gap (`RESHOW_GAP_MS = 800`) stops it flickering.

### Stage 4a — Pay toll

1. The popup closes and opens our app through the deep link
   `mindmusclesync://toll?pkg=<package name>`.
2. The Toll screen shows how long you used the app. The test toll button calls
   `grantMinutes(pkg, 5)`, which adds 5 minutes to that app's allowance today
   and adds one to its toll count.
3. The blocked app reopens (`openApp`) and works for 5 more minutes.
4. "Not now · go home", or Back on the Toll screen, sends you home instead.

### Stage 4b — Take a break

1. The popup closes and the service presses Home for you
   (`performGlobalAction(GLOBAL_ACTION_HOME)`). Android doesn't let one app
   close another, so the blocked app is sent to the background instead.
2. The phone's Back button does the same thing.
3. A 1.5-second cooldown (`BREAK_COOLDOWN_MS = 1500`) stops a late
   "window opened" signal from popping the popup straight back up.

### Meanwhile on the Home screen

The "Today's apps" card re-reads native data every 3 seconds while Home is
visible (`useLiveBlocker`), and again whenever you return to the app. Each
app's bar is:
- indigo normally,
- coral at 80% of the limit or more,
- red with "Toll due" once the limit is reached.

---

## 4. The popup, piece by piece

The popup is **not** React Native, because React Native isn't running inside
YouTube. It's built from native Android views (an XML layout plus Kotlin),
styled to match the app's tokens.

```
┌──────────────────────────────────┐
│░░░░░░ dimmed blocked app ░░░░░░░░│  ← (1) dim layer
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
│ ╭──────────────────────────────╮ │
│ │            ( 🐼 )            │ │  ← (2) mascot circle
│ │      6 min on Chrome         │ │  ← (3) time used
│ │  today · your limit was 1 min│ │
│ │ ╭──────────────────────────╮ │ │
│ │ │ Your feed will still be  │ │ │  ← (4) funny line
│ │ │ here. Your focus might   │ │ │
│ │ │ not.                     │ │ │
│ │ ╰──────────────────────────╯ │ │
│ │ [        PAY TOLL          ] │ │  ← (5) primary button
│ │ Quick puzzles or a few reps  │ │
│ │ unlock more time             │ │
│ │ [      TAKE A BREAK        ] │ │  ← (6) neutral button
│ ╰──────────────────────────────╯ │
└──────────────────────────────────┘
```

1. **Dim layer** (`#B31F2340`, navy at 70%) covers the whole screen and absorbs
   every tap, so the app behind can't be used.
2. **Mascot circle**: a placeholder panda emoji until the red panda art lands
   in Phase 6.
3. **Time and limit** come from BlockerStore. The app's name comes from
   Android's PackageManager.
4. **Funny line**: picked at random from 12 lines in `BlockerLines.kt`, never
   the same one twice in a row. Lines use `{time}` and `{app}` placeholders.
5. **Pay toll**: indigo chunky button. Its face drops into the darker bottom
   edge when pressed, the same effect as the app's `ChunkyButton`.
6. **Take a break**: neutral white button. The Back key does the same thing.

**Font:** Nunito (Black, ExtraBold, SemiBold) is bundled inside the module's
`res/font` folder. The app loads its fonts through JavaScript, and those fonts
don't exist outside the app, so the popup needs its own copies.

---

## 5. Android features that make it possible

Normally an app needs the "Display over other apps" permission to draw on top
of other apps. The blocker doesn't, because Accessibility services get their
own overlay window type.

| Feature | What it does for us |
|---|---|
| **AccessibilityService** | The background watcher. Android starts it, keeps it alive, and restarts it after a reboot, as long as the user left it on. No separate foreground service or boot receiver is needed. |
| **Window-change events** | `TYPE_WINDOW_STATE_CHANGED` tells us which app is in front. Reading screen content is switched off (`canRetrieveWindowContent="false"`). |
| **Accessibility overlay** | `TYPE_ACCESSIBILITY_OVERLAY` is a window type only Accessibility services may create. It draws over any app with no extra permission. |
| **WindowManager** | Adds the popup window to the screen and removes it again. |
| **Audio focus** | An `AUDIOFOCUS_GAIN_TRANSIENT` request. Video apps pause when another app takes focus. It's released when the popup closes. |
| **Global actions** | `performGlobalAction(GLOBAL_ACTION_HOME)` lets the service press Home for the user. |
| **SharedPreferences** | Small key-value storage on the phone for limits, usage, extra minutes and toll counts. Survives restarts and reboots. |
| **Deep link** | The `mindmusclesync://` scheme declared in `app.json`. It's how the popup opens the Toll screen for the right app. |
| **PackageManager + `<queries>`** | Lists launchable apps for the picker without the stricter "see all apps" permission (`QUERY_ALL_PACKAGES`), which Google Play limits. |
| **Settings.Secure** | Checks whether our service is turned on. This decides whether the card reads "Blocking is on · ACTIVE" or "Blocking is off". |
| **Expo Modules API (classic)** | The bridge that exposes Kotlin functions to JavaScript (`ModuleDefinition`, `Function`, `AsyncFunction`). |

---

## 6. Where the data lives

Everything is stored in one SharedPreferences file, `mms_app_blocker`, on the
phone. It's managed only by `BlockerStore.kt`.

| Key | Contents | Resets at midnight? |
|---|---|---|
| `targets` | JSON `{ "com.app.package": limitMinutes, … }` | No |
| `day`     | Today's date as `yyyy-MM-dd` | Updated to the new date |
| `usage`   | JSON `{ package: millisecondsUsedToday }` | Yes |
| `extra`   | JSON `{ package: extraMillisFromTolls }` | Yes |
| `tolls`   | JSON `{ package: tollsPaidToday }` | Yes |

Before every read or write, the store compares `day` with today's date
(`ensureToday`). If the date has changed, `usage`, `extra` and `tolls` are
cleared.

**Over the limit means:** `usedMillis ≥ limitMinutes × 60 000 + extraMillis`.

**Functions JavaScript can call** (from `@modules/app-blocker`):

| Function | Purpose |
|---|---|
| `isAccessibilityEnabled()` | Is our blocker service turned on? |
| `openAccessibilitySettings()` | Opens Android's Accessibility settings page |
| `getInstalledApps()` | Launchable apps as `{ packageName, label }[]` (async) |
| `getTargets()` / `setTargets(targets)` | Read or replace the blocked-apps-and-limits map |
| `getToday()` | `{ day, usage, extra, tolls }` for today |
| `grantMinutes(pkg, minutes)` | Add toll minutes for an app and count the toll |
| `openApp(pkg)` | Launch an app (used after a toll) |
| `goHome()` | Send the user to the home screen |

To view the saved data on a device:
`adb shell run-as com.mindmusclesync.app cat shared_prefs/mms_app_blocker.xml`

---

## 7. Every file and its purpose

Generated folders (`android/`, `node_modules/`, build output) aren't listed.
They're rebuilt automatically and must not be hand-edited.

Tag: **[P0]** = Phase 0 (app shell), **[P1]** = Phase 1 (blocker).

### 7.1 Native blocker module — `modules/app-blocker/`

The Kotlin side that runs in the background.
Kotlin files are in `android/src/main/java/expo/modules/appblocker/`.

| File | Tag | Purpose |
|---|---|---|
| `BlockerService.kt` | P1 | **The watcher.** An Accessibility service that hears every app switch, adds time to blocked apps every 2 seconds while the screen is on, decides when an app is over its limit, and shows or hides the popup. Also handles Pay toll (opens the deep link) and Take a break (presses Home, then a short cooldown). |
| `BlockerStore.kt` | P1 | **The memory.** Reads and writes SharedPreferences: blocked apps and limits, milliseconds used today, extra minutes from tolls and toll counts. Clears the daily numbers automatically when the date changes. |
| `BlockerOverlay.kt` | P1 | **The popup.** Inflates the XML layout and adds it to the screen as an Accessibility overlay. Fills in the time, limit and funny line, wires the two buttons and the Back key, takes audio focus while it's showing, and slides the card in. |
| `OverlayRootView.kt` | P1 | The popup's outer container. Its only job is catching the Android Back button so it can mean "take a break". |
| `BlockerLines.kt` | P1 | The 12 playful lines shown on the popup, a picker that avoids repeating the last one, and time formatting like "45 sec", "12 min", "1h 05m". |
| `AppBlockerModule.kt` | P1 | **The bridge's native half.** Defines the functions JavaScript can call (listed in section 6). |
| `index.ts` | P1 | **The bridge's JavaScript half.** Loads the native module with `requireNativeModule('AppBlocker')`, wraps each function with TypeScript types, and turns the JSON text from Kotlin into objects. Exports `AppBlocker` and the types `InstalledApp`, `Targets`, `TodayStats`. |
| `expo-module.config.json` | P1 | Tells Expo this folder is an Android module and which Kotlin class to load (`AppBlockerModule`), so it's linked into the app automatically. |
| `android/build.gradle` | P1 | Build settings for the module: an Android library that uses Expo's module Gradle plugin, with namespace `expo.modules.appblocker`. |
| `android/src/main/AndroidManifest.xml` | P1 | Registers the watcher service with Android (protected by `BIND_ACCESSIBILITY_SERVICE`, so only the system can connect to it). Also declares the `<queries>` entry that lets the app list launchable apps. Merged into the app's manifest at build time. |
| `NUNITO_FONT_LICENSE.txt` | P1 | The SIL Open Font License for Nunito, kept next to the bundled font files as the license requires. |

### 7.2 Popup design resources — `modules/app-blocker/android/src/main/res/`

How the native popup looks.

| File | Tag | Purpose |
|---|---|---|
| `layout/mms_blocker_overlay.xml` | P1 | The popup's layout: full-screen dim layer, bottom card, mascot circle, time and limit text, funny-line bubble, and the two buttons with the hint text. |
| `drawable/mms_btn_primary.xml` | P1 | Indigo chunky button with a darker bottom edge. When pressed, the face drops into the edge. |
| `drawable/mms_btn_neutral.xml` | P1 | White chunky button with a border and the same pressed effect. Used for Take a break. |
| `drawable/mms_overlay_card.xml` | P1 | Warm cream bottom card with large rounded top corners. |
| `drawable/mms_bubble.xml` | P1 | Rounded white box with a soft border behind the funny line. |
| `drawable/mms_mascot_circle.xml` | P1 | Soft indigo circle that holds the mascot. |
| `font/nunito_black.ttf`, `nunito_extrabold.ttf`, `nunito_semibold.ttf` | P1 | Three Nunito weights bundled so the popup can use the app's font outside the app. |
| `values/strings.xml` | P1 | Button labels ("PAY TOLL", "TAKE A BREAK", the hint line) and the service's name and description shown in Android's Accessibility settings. |
| `xml/app_blocker_accessibility.xml` | P1 | The service's configuration: listen only to window-change events, don't read screen content, don't present it as an accessibility tool, and use the privacy description from `strings.xml`. |

### 7.3 Blocker logic in the app — `src/features/blocker/`

The React side of the blocker.

| File | Tag | Purpose |
|---|---|---|
| `store.ts` | P1 | Shared state (Zustand) for installed apps, limits, today's usage and whether blocking is on. Actions: `loadApps`, `refresh`, `addTargets`, `setTargetSet`, `setLimit` and `removeTarget`. Every change is written straight through to the native store. Also has `appLabel()` for display names. |
| `useLiveBlocker.ts` | P1 | A hook that refreshes blocker data every few seconds (3 s by default) while a screen is focused, and again when the app returns to the foreground (for example after turning on Accessibility). |
| `limits.ts` | P1 | Pure helpers with no UI, so they can be unit-tested: `LIMIT_STEPS`, `DEFAULT_LIMIT` (15), `TOLL_MINUTES` (5), `stepLimit`, `formatDuration`, `allowanceMs`, and `SUGGESTED_PACKAGES` (common distracting apps). |
| `__tests__/limits.test.ts` | P1 | 6 unit tests for `limits.ts`: stepping up and down, stopping at the ends, snapping in-between values, time formatting, negative time, and allowance math. |
| `components/TodayAppsCard.tsx` | P1 | The Home card listing each blocked app with a usage bar, plus a prompt to pick apps or fix blocking when needed. |
| `components/UsageBar.tsx` | P1 | One app's row: name, "used / allowed" or "Toll due", and a bar that turns coral near the limit and red at it. |
| `components/AccessibilityCard.tsx` | P1 | The permission explainer shown before Android's settings (required by Google Play), or a "Blocking is on · ACTIVE" card once it's enabled. |
| `components/LimitStepper.tsx` | P1 | The "− 15 min +" control for each blocked app. |

### 7.4 Screens — `src/app/`

With Expo Router, every file here is a screen or a layout.

| File | Tag | Purpose |
|---|---|---|
| `_layout.tsx` | P0 | Root of the app. Loads the Nunito fonts, keeps the splash screen up until they're ready, and sets up the screen stack: tabs, the Toll screen (full-screen, swipe-to-dismiss off) and the app picker (modal). |
| `(tabs)/_layout.tsx` | P0 | Defines the four tabs (Home, Stats, Shop, Settings) and plugs in the custom tab bar. |
| `(tabs)/index.tsx` | P1 | **Home:** Hours Reclaimed and Sparks (placeholders for now), the mascot card, the live Today's apps card, and the Practice Brain/Muscle buttons for later phases. |
| `(tabs)/settings.tsx` | P1 | **Settings:** the permission card, each blocked app with its limit stepper and remove button, and the Add or remove apps button. |
| `(tabs)/stats.tsx` | P0 | Placeholder tab that says which phase will fill it. |
| `(tabs)/shop.tsx` | P0 | Placeholder tab that says which phase will fill it. |
| `pick-apps.tsx` | P1 | **App picker:** a searchable list of installed apps with common time-sinks first, checkboxes, and Save (`setTargetSet`). |
| `toll.tsx` | P1 | **Toll screen**, opened from the popup by the deep link. Shows time used, a test toll (+5 min, then reopens the app) and "Not now · go home". The hardware Back button also goes home. Brain and Muscle tolls replace the test button later. |

### 7.5 Shared UI and design system — `src/theme/`, `src/components/`

| File | Tag | Purpose |
|---|---|---|
| `src/theme/tokens.ts` | P0 | **The only place** colors (indigo, teal, coral, gold, cream, ink), fonts, type sizes, spacing, corner radii and chunky-button depth are defined. |
| `src/components/ui/ChunkyButton.tsx` | P0 | The signature button: a solid darker edge under the face that springs down when pressed (Reanimated), with a light vibration (expo-haptics). |
| `src/components/ui/AppText.tsx` | P0 | The only text component screens use, so typography stays consistent. It uppercases label strings in JavaScript to avoid an Android wrapping bug with `textTransform`. |
| `src/components/ui/Card.tsx` | P0 | Flat card with a 2px border and a thicker bottom edge instead of a blurry shadow. |
| `src/components/ui/Screen.tsx` | P0 | Standard scrolling page wrapper on the cream background, with safe-area padding. |
| `src/components/TabBar.tsx` | P0 | Custom rounded bottom tab bar. The active tab gets a soft indigo pill. |
| `src/components/ComingSoon.tsx` | P0 | Body for tabs that arrive in later phases. |

### 7.6 Configuration and tooling — project root

| File | Tag | Purpose |
|---|---|---|
| `app.json` | P0 | App identity and native settings: name, Android package `com.mindmusclesync.app`, deep-link scheme `mindmusclesync`, light mode only, icon and splash colors, and the config plugin list. |
| `plugins/with-cmake-version.js` | P0 | Config plugin that pins CMake 4.1.2 in the generated Android project. This fixes a Windows build failure caused by file paths over 260 characters. Keep it. |
| `metro.config.js` | P1 | Tells Metro to ignore Gradle and CMake build output, which crashed its file watcher during native builds. |
| `package.json` | P0/P1 | Dependencies, scripts (`start`, `android`, `typecheck`, `test`) and the Jest setup with the `@/` and `@modules/` import aliases. Test tools are in devDependencies. |
| `package-lock.json` | P0 | Exact installed versions of every package, so installs are repeatable. Generated by npm; not edited by hand. |
| `tsconfig.json` | P0/P1 | TypeScript settings, plus the `@/*` → `src/*` and `@modules/*` → `modules/*` import shortcuts. |
| `eslint.config.js` | P0 | Lint rules (Expo's preset). Run with `npx eslint src`. |
| `.gitignore` | P0/P1 | Keeps generated folders, build output, the Stitch reference files and personal Claude settings out of Git. |
| `.vscode/extensions.json`, `.vscode/settings.json` | P0 | Editor recommendations and settings from the Expo template. |

### 7.7 Docs

| File | Tag | Purpose |
|---|---|---|
| `PLAN.md` | P0/P1 | The full roadmap: decisions, tech stack, screens, every phase with its "done when" check, costs, and current status. |
| `CLAUDE.md` | P0/P1 | Project rules for Claude: work one phase at a time, design rules, architecture map, build commands for this Windows machine, and known issues. |
| `AGENTS.md` | P0 | Expo-specific rules from the template (use versioned docs, `npx expo install`, etc.). |
| `docs/PHASE-1-BLOCKER.md` | P1 | This document. |
| `docs/PHASE-1-CODE-WALKTHROUGH.md` | P1 | Line-by-line walkthrough of sections 3–6, with code excerpts. |

---

## 8. Testing

### Passed on the emulator (Pixel 7, Android 16 / API 36)

- [x] The popup appears once an app is over its limit (tested with a 1-minute limit)
- [x] Taps on the app behind the popup are blocked
- [x] Take a break and Back go to the home screen (3 out of 3 tries, no re-pop)
- [x] Reopening the blocked app brings the popup back
- [x] Pay toll opens the Toll screen and adds 5 minutes, and the app works again
- [x] Survives swiping our app away from Recents
- [x] Survives a reboot, and today's usage carries over
- [x] `npx tsc --noEmit`, `npx eslint src` and `npx jest` (6 tests) all pass

### Known limits

- **Force stop** in Android settings turns the blocker off. This is true of
  every Accessibility app. The app then shows "Blocking is off". An optional
  Strict Mode (Device Admin) is planned after launch.
- **Time is counted per app**, not per Reels or Shorts. That's Phase 1.5.
- **Video pausing** (audio focus) isn't verified yet, because no video was
  playing on the emulator. It needs a real phone.
- **Instagram itself** wasn't tested. Installing it on the emulator needs a
  Google sign-in. Chrome was used as the stand-in blocked app.
- If an app is **already open** when the service first switches on, the popup
  waits until the next app-switch event.
- A **debug-only navigation warning** appears when the popup opens the app
  while it's already running. Navigation still works correctly.

---

## 9. Useful commands

```powershell
# Type check, lint, unit tests (run before calling anything done)
npx tsc --noEmit
npx eslint src
npx jest

# Start Metro (JS dev server)
npx expo start --port 8081

# Emulator debug build (drop the flag for a real phone)
cd android; .\gradlew.bat assembleDebug -PreactNativeArchitectures=x86_64

# After an emulator reboot (otherwise a black screen)
adb reverse tcp:8081 tcp:8081

# Turn the blocker on without tapping through settings
adb shell settings put secure enabled_accessibility_services com.mindmusclesync.app/expo.modules.appblocker.BlockerService

# Read the blocker's saved data
adb shell run-as com.mindmusclesync.app cat shared_prefs/mms_app_blocker.xml

# Force a JS reload if an edit doesn't show up
adb shell input text "RR"
```

Machine notes: the Android SDK is in `T:\Android\Sdk`, the Gradle cache in
`T:\Android\gradle`, and the emulator `MindMuscle_Pixel` in `T:\Android\avd`.
Builds use JDK 17 (`C:\Program Files\Microsoft\jdk-17.0.21.21-hotspot`).

---

## 10. Glossary

- **Accessibility service**: an Android feature meant for assistive apps. It
  runs in the background and is told about screen changes. We use only the
  "which app is open" part.
- **Overlay**: a window drawn on top of other apps. Ours is an Accessibility
  overlay, so it needs no extra permission.
- **Package name**: an app's unique ID on Android, for example
  `com.instagram.android`.
- **Expo module**: a package of native code (Kotlin here) with a JavaScript
  wrapper, so React Native screens can call it.
- **Bridge**: the connection between JavaScript and native code. Here it's the
  AppBlocker Expo module.
- **SharedPreferences**: Android's simple built-in key-value storage, kept in
  a small XML file inside the app's private folder.
- **Deep link**: a URL like `mindmusclesync://toll?pkg=…` that opens a specific
  screen inside the app.
- **Config plugin**: a small script Expo runs when it generates the `android/`
  folder, used to change native settings without hand-editing generated files.
- **Prebuild**: the Expo step (`npx expo prebuild`) that generates the native
  `android/` project from `app.json` and plugins.
- **Metro**: the JavaScript bundler that serves code to the app during
  development and reloads it when files change.
- **Zustand**: a small React state library. It holds the blocker's data for
  the screens.
- **Prominent disclosure**: Google Play's rule that an app must clearly explain
  why it needs a sensitive permission before asking for it.
