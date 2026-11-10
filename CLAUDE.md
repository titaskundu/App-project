# Mind-Muscle Sync

Android-first Expo (SDK 58) app that blocks distracting apps past a daily limit. Users unlock more time by paying a "toll": Brain questions or camera-verified exercises. The full roadmap is in `PLAN.md`. Expo-specific rules are in `AGENTS.md`; read both before working.

## Working rules
- Build one phase at a time from `PLAN.md`, and **stop for the user's review after each phase**. Don't start the next phase without approval.
- The user knows React/JS but not native Android. Explain any Kotlin or native code in plain terms.
- Don't commit or push unless asked.
- Before calling something done, run: `npx tsc --noEmit` and `npx eslint src` (`npx expo lint` hits a version check bug on this setup).
- Add packages with `npx expo install <pkg>`, never `npm install <pkg>`.
- Check versioned Expo docs (`https://docs.expo.dev/versions/v58.0.0/`) before using an Expo/RN API. Don't rely on memory.

## Architecture
- `src/app/` holds routes only (Expo Router). `(tabs)/` contains Home, Stats, Shop and Settings.
- `src/components/ui/` holds shared building blocks: `AppText`, `ChunkyButton` (pill; `size="sm"` for in-card actions), `Card` (optional colored `border`/`edge` lip), `Chip` (tinted pill + icon + uppercase micro-label), `Screen`. Design notes for the 2026-11-10 redesign: `docs/UI-REDESIGN.md`.
- `src/features/<feature>/` holds feature logic (brain, muscle, economy…), keeping pure logic separate from UI so it can be unit-tested.
- `src/theme/tokens.ts` is the **only** place colors, fonts, spacing and radii are defined.
- `modules/app-blocker/` is the native blocker (Kotlin, classic Expo Modules API, not the new v2 annotation API). Import it as `@modules/app-blocker`.
  - `BlockerService.kt`: Accessibility service (window-change + scroll events), 2s ticker. All logic runs on its own `HandlerThread`; the main thread only copies events across. Every tick it re-checks the active window's app (Samsung skips some window events) and looks for a tracked app in a floating (PiP) window, counted only while audio plays and reopened full screen when over its limit. When an app is over its limit it shows `BlockerOverlay` on top of it; "Pay toll" opens `mindmusclesync://toll?pkg=…`. The scheme is hard-coded there and must match `scheme` in app.json.
  - `BlockerOverlay.kt` + `res/layout/mms_blocker_overlay.xml`: native popup (TYPE_ACCESSIBILITY_OVERLAY, no extra permission), styled with the same tokens and bundled Nunito fonts (`res/font`). Funny lines live in `BlockerLines.kt`. `show`/`hide` are thread-safe and do view work on the main thread. Never make the popup depend on an animation: Samsung pauses animations for background apps, so a fade from transparent left it invisible.
  - `BlockerStore.kt`: SharedPreferences `mms_app_blocker` (targets, daily usage/extra/tolls/counts; resets at local midnight; plus rule `health`). Native is the source of truth; JS reads and writes through it.
  - Everything is keyed by **scope**: `pkg` = whole app, `pkg:short` = its Reels/Shorts viewer only. Whole-app usage includes Reels time.
  - `ShortFormRules.kt`: per-app rules (layout IDs, then selected-tab labels as fallback; labels match exactly or as a prefix before a comma, e.g. Facebook's "Reels, tab 2 of 6") that tell whether the Reels/Shorts viewer is open. Only IDs and labels are read, never text. Swipes are counted from scroll bursts (Instagram) or, when a rule has `pageId`, by the visible page container changing (YouTube sends us no scroll events). A Reels limit's popup says "Leave Reels": tap the app's Home tab (`exitTabId`) if visible, else Back, then Back, then phone home. A whole-app popup goes Home. Safety net: 3 h of app use without a match marks the rules stale and counts the whole app against the Reels limit.
  - Inspect a screen's IDs on a device with `adb shell uiautomator dump /sdcard/ui.xml` then `adb pull /sdcard/ui.xml`.
  - Complex values cross the bridge as JSON strings.
- `src/features/blocker/`: Zustand store, `useLiveBlocker` polling hook, pure helpers in `limits.ts` (unit-tested: steps, scopes, `limitMode`/`targetsForMode`, `scopeStatuses`/`worstLevel`/`byUrgency`), UI components.
  - Settings is a short hub; the per-app list lives on `src/app/blocked-apps.tsx` (tile grid, most urgent app wide, tap → `LimitSheet` bottom sheet). `LimitSheet` is an in-screen overlay, not an RN `Modal` (Android Modals stop above the nav bar). Render it last, outside the `SafeAreaView`. It edits a draft (Save, with a save/discard prompt on close). The grid order is frozen while it's open and re-sorts with `LinearTransition` after.
  - Reels/Shorts limits are always coral + film icon, whole-app limits indigo + phone icon (`modeTones` in tokens, `KIND_ICON` in `ModeChips.tsx`). Keep that coding on any new screen.
  - App icons: native `getAppIconsAsync` writes PNGs to the cache folder; call `useAppIcons(pkgs)` once per screen (batched), then render `AppIcon`.
- `src/features/brain/`: Brain Mode. Pure logic (unit-tested): `types.ts`, `generators/` (math + aptitude, logic + puzzles), `pack/` (hand-written GK/Coding/Words + `validateQuestions`), `rating.ts` (Elo), `select.ts`, `toll.ts` (all toll rules and numbers). State: `store.ts` (Zustand persisted via `expo-sqlite/kv-store`), `history.ts` (answers table in `brain.db`). UI: `useBrainSession.ts` + `components/`. Routes: `src/app/brain.tsx` (`?mode=toll|practice|calibration`), `interests.tsx`, `toll.tsx`.
  - Debug builds log `[brain-q] <id> type=… answer=…` for automated device tests. For emulator automation turn animations off (`settings put global animator_duration_scale 0`, etc.), otherwise `uiautomator dump` waits on the timer bar.
- Tests: `npx jest` (pure logic only, in `__tests__` folders). Import `describe/it/expect` from `@jest/globals` (TypeScript 6 doesn't load Jest's global types automatically).
- `metro.config.js` blocks Metro from watching Gradle/CMake output (it crashed the watcher). If a JS edit doesn't show up on the device, reload manually with `adb shell input text "RR"`. If Metro's log shows no new "Bundled" line after edits, its watcher has died: restart it with `npx expo start --dev-client --clear`.
- Tab bar types come from `expo-router/js-tabs` (React Navigation is bundled inside expo-router in SDK 58).
- `android/` is generated (`npx expo prebuild`). Never hand-edit it; configure native behavior through `app.json` or config plugins.
- `plugins/` holds local config plugins. `with-cmake-version.js` pins CMake 4.1.2 (Ninja 1.12+), because the default CMake 3.22/Ninja 1.10 fails on Windows paths over 260 chars. Keep it.

## Building on this Windows machine
- Android SDK `T:\Android\Sdk`, Gradle cache `T:\Android\gradle`, emulator `MindMuscle_Pixel` in `T:\Android\avd` (drive C is nearly full, so don't put large files there).
- JDK 17 is at `C:\Program Files\Microsoft\jdk-17.0.21.21-hotspot` (the system's default Java 27 is too new for Android builds).
- Emulator dev build: `cd android && .\gradlew.bat assembleDebug -PreactNativeArchitectures=x86_64`. Drop the flag for real-phone builds.
- After an emulator reboot, run `adb reverse tcp:8081 tcp:8081` again, or debug builds show a black screen.
- Release builds (`assembleRelease`, JS bundled in, works without Metro). The page file is on T (16–32 GB, set 2026-11-10), so normal builds work. If one still runs out of memory: `gradlew --stop`, stop Metro, then `.\gradlew.bat assembleRelease --no-daemon "-Dorg.gradle.jvmargs=-Xmx1536m" -PreactNativeArchitectures=<arch>`. Release is signed with the debug key, so it installs over a debug build and keeps data.
- Test hooks: enable the blocker with `adb shell settings put secure enabled_accessibility_services com.mindmusclesync.app/expo.modules.appblocker.BlockerService` (**this replaces the whole list**. On the user's real phone, read the current value first and append ours with `:`); read saved state with `adb shell run-as com.mindmusclesync.app cat shared_prefs/mms_app_blocker.xml`.
- Known: a **force stop** of the app makes Android disable the Accessibility service until the user re-enables it. Swipe-away and reboot are fine.
- After `adb install -r` while the blocker is on, Android may list it under "Crashed services" and stop delivering events: delete and re-put `enabled_accessibility_services` after each install. Blocker logs: `adb logcat -s MmsBlocker`.

## Design rules
- Feel: simple, chunky, bouncy, friendly (the Duolingo-like *feel*). **Do not** copy Duolingo's green palette or owl-style mascot.
- Colors: indigo `#4F46E5` = main actions, teal `#14B8A6` = Brain, coral `#FF6B57` = Muscle, gold `#F5B700` = Sparks, warm cream `#FAF7F2` = background. Text is navy-ink `#1F2340`, never pure black.
- Font: Nunito (ExtraBold/Black for headings, SemiBold/Medium for body). Labels are uppercase with letter spacing.
- Shapes: extra-rounded (radius ≥ 20 on cards and buttons, pill shapes for chips and progress bars).
- Depth: solid darker bottom edge, no blurry shadows. Buttons drop into their edge when pressed (`ChunkyButton`).
- Touch targets are at least 52px tall.
- Mascot: original 3D-style red panda (brainy / athletic / zen versions).
- `stitch_ref/` holds the Stitch exports. They're reference for screen concepts and stats only, not exact visuals.

## Product decisions (don't change without asking)
- Brain areas: Mental Math, Logic & Patterns, General Knowledge (global), Coding (language-neutral), Words & Vocabulary. The user picks areas during setup.
- Muscle: squats, jumping jacks, one low-impact move. Phone propped facing the user. No push-ups.
- Backend: Supabase only (free tier). No FastAPI, no Spark/Snowflake pipeline.
- Skips: a few free ones daily plus Time Passes (Sparks or ₹10–20), sharing one daily cap.
- Every toll must work offline.
