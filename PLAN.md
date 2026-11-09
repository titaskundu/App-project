# Mind-Muscle Sync — Build Plan (Android first, Play Store launch at the lowest cost)

## Context
Mind-Muscle Sync blocks distracting apps (Instagram, YouTube, etc.) once you've used them past your daily limit. To get more time, you pay a "toll": a quick round of math (Brain) or exercises checked by the camera (Muscle). Tolls earn Sparks, which feed a red-panda companion, a shop and a stats screen.

The repo is empty apart from the Stitch reference export (unpacked to `stitch_ref/`). Decisions made with you:
- Android only at first, published on the Play Store, with the lowest possible running cost.
- No server to pay for: Supabase free tier handles login, sync and the AI calls (Edge Functions).
- Blocking uses Android's Accessibility feature. We'll go through Google's approval process for it.
- Brain Mode covers **5 interest areas**: Mental Math, Logic & Patterns, General Knowledge (global), Coding (language-neutral) and Words & Vocabulary. At setup a questionnaire asks which areas interest you, and block-screen questions come only from the areas you picked. You can change them later in Settings.
- Questions are AI-made. Offline, Brain Mode falls back to stored AI questions, then to the starter pack bundled with the app (and, for math and logic, problems built on the phone).
- Muscle Mode: squats, jumping jacks and one low-impact move, with the phone propped facing you.
- Each toll unlocks more time, and each repeat that day gets harder.
- Skips: a few free ones a day, plus Time Passes (bought with Sparks or about ₹10–20 each). All skips share one daily cap of 2 passes on top of the free skips.
- New look: indigo #4F46E5, coral #FF6B57 (Muscle), teal #14B8A6 (Brain), gold #F5B700 (Sparks), warm cream #FAF7F2. Red panda mascot.
- Keep Duolingo's simple, chunky, bouncy feel, but not its colors or mascot.

**Why this order:** the blocking feature is the riskiest part (Android limits plus Google's approval), so it's built and tested first, before any polish.

---

## Tech stack
| Part | Choice | Why |
|---|---|---|
| App | Expo (React Native, TypeScript) with a development build | Uses your React/JS skills. A development build is needed because Expo Go can't run custom native code. |
| Navigation | Expo Router | Screens are organized as files, which is simple to follow |
| Styling & animation | React Native styles with a shared tokens file (`src/theme/tokens.ts`) + Reanimated | Design tokens in one place, plus the bouncy button presses. Chosen over NativeWind because it's less risky on Expo SDK 58. |
| Local storage | MMKV (settings and state) + expo-sqlite (history and problem cache) | Fast, and works offline |
| State | Zustand | Small and simple |
| Blocking | Custom Kotlin module (Expo Modules API) | I write it and explain it |
| Camera + pose tracking | react-native-vision-camera + a pose model running on the phone (MediaPipe or MoveNet via fast-tflite) | Free, private, no network needed |
| Charts | react-native-svg (radar chart, heatmap) | Lightweight |
| Backend | Supabase: Auth (anonymous first, link Google later), Postgres, Edge Functions | Free tier |
| AI problems | Supabase Edge Function → an inexpensive Claude model, generating problems **in batches and pooled by difficulty level** | Problems are shared across users at the same level, so there are very few AI calls |
| Payments | Google Play Billing via RevenueCat (free tier) | Simplest way to sell one-off Time Passes |
| Builds | Local Gradle builds (free); EAS free tier as backup | No build costs |

---

## How the blocking works (Android)
1. **Detect the app in use:** the Accessibility service is notified whenever the app on screen changes, and tracks time per target app. Running time is stored on the device so it survives restarts. Accessibility services restart automatically after a reboot, so no separate boot receiver or foreground service is needed, which means less to explain to Google.
2. **Block (updated 2026-11-08):** when an app passes its limit, the service draws a **popup right on top of that app** (an Accessibility overlay, so no extra permission). It shows time spent in the app today, the limit, and a rotating funny line, with two buttons: **Pay toll** (opens our Toll screen) and **Take a break** (goes to the home screen; Android doesn't allow closing another app). The popup blocks taps on the app behind, pauses its video via audio focus, and treats the back button as "Take a break". Reopening the app brings the popup back.
3. **Unlock:** finishing a toll grants N more minutes for that app (the toll level goes up each repeat that day). The grant is stored on the device, and the service lets the app through until it runs out.
4. **Daily totals for stats** come from Android's usage statistics (needs the "Usage access" permission), so Hours Reclaimed can be calculated.
5. **Permissions** (each gets its own setup screen with a clear explanation): Accessibility, Display over other apps, Usage access, Camera, Notifications.

**Google Play approval risk:** Google limits apps that use Accessibility for non-accessibility purposes. Plan: an in-app explanation shown before the permission is requested, the Play Console policy declaration, and a demo video. **Plan B** if we're rejected: detect the app in use from usage statistics checked every few seconds, plus a full-screen overlay. The blocking module is written so it can switch to Plan B without touching the rest of the app.

---

## Screens
**From Stitch (redesigned):** Block screen, Home, Brain Mode, Muscle Mode, Stats (Mind/Muscle tabs), Shop, Settings.
**New:** Welcome & how it works → **Interests questionnaire** → Permissions setup → Calibration (60-second mixed test across your picked areas + one squat to set your range of motion) → Persona title → Toll Complete (reward) → Time Pass sheet → Sunday Boss battle.

**Interests questionnaire:** five large tappable cards (icon + one-line description). Pick at least one, multiple allowed. Each card has a "Pick at least 1" style hint, and a mascot reaction appears when you select something.
| Area | Example questions | How you answer |
|---|---|---|
| Mental Math | 14 × 7, fractions, percentages, simple algebra | Number keypad |
| Logic & Patterns | Number sequences, odd one out, simple deductions | Multiple choice or keypad |
| General Knowledge | Global geography, science, history, culture | Multiple choice (4 options) |
| Coding (language-neutral) | Pseudocode output, spot the bug, which loop runs N times, Big-O, data structures | Multiple choice, with a code block shown in a monospace card |
| Words & Vocabulary | Synonyms, meanings, odd word out, spelling | Multiple choice |

Changes from Stitch: Home shows **Hours Reclaimed**, with no streak flame. Toll and Muscle screens hide the bottom navigation. Shield becomes a Time Pass. Settings gets a permissions status section.

### Home screen (decided 2026-11-08)
Rule: Home shows one clear next action and stays uncluttered. Top to bottom:
1. **HUD:** Hours Reclaimed (left) and Sparks (right).
2. **Reclaimed-time translator** under the HUD: turns time saved into real things ("3h ≈ 1 movie + a long walk"), rotating examples.
3. **Weekly recap card:** Mondays only, can be dismissed. Last week's time saved, best skill and total reps.
4. **Reactive mascot:** the red panda's mood and speech bubble follow your day ("Instagram's at 80%, careful!", celebrations after tolls, calm when you're well under your limits).
5. **Today's apps:** live time used vs limit for each blocked app (e.g. `Instagram 16/20 min`), with the bar turning coral near the limit.
6. **Practice:** Brain and Muscle buttons to do a toll anytime. Earns Sparks and **banks minutes** to spend later (capped per day, so the bank can't cover a whole day). **Sunday Boss** shows here as a third option on Sundays.

Removed: the "Today's tolls 0/5" goal card. A toll quota could push people to use blocked apps more just to hit it.

---

## Phases

### Phase 0 — Setup
- Create an Expo TypeScript project in the repo root. Set up the development build, Expo Router, NativeWind with the new color tokens, the font (Nunito), and the chunky button component.
- Add `CLAUDE.md` (design rules, architecture, how to work in this repo). Add `.gitignore` entries for `stitch_ref/` and the zip.
- **Done when:** the app runs on your Android phone through the development build.

### Phase 1 — Blocking prototype (riskiest, so first)
- Kotlin module `modules/app-blocker/`: Accessibility service, per-app timers, a grants store, launching the Toll screen, and JS functions for permissions, limits and grants.
- Basic Settings (pick apps, set limits) and a plain Toll screen with an "unlock" button.
- Home: the **Today's apps** card, reading live time used and limits from the blocker.
- **Done when:** Instagram is blocked after a 1-minute test limit, stays blocked after closing our app or restarting the phone, and unlocks for N minutes after the test toll.

### Phase 1.5 — Reels/Shorts-only tracking (decided 2026-11-08)
Goal: count and limit only short-video feeds, so the rest of the app (DMs, feed, normal videos) stays usable.
- **Apps in v1:** Instagram Reels, YouTube Shorts, Facebook Reels. (Snapchat Spotlight later.)
- **Two limits per supported app, both optional:** a *Reels/Shorts* limit and a *whole-app* limit (e.g. Reels 15 min, Instagram overall 60 min). Other apps keep whole-app limits only.
- **Detection:** the Accessibility service also reads window content, but **only layout IDs and accessibility labels** (never text, messages or images), only for the supported apps, at most every 2 s, using direct find-by-ID lookups. A **rules list** per app (`{ app, viewIds[], labelMatchers[] }`) is bundled with the app. Accessibility labels like "Reels"/"Shorts" are the fallback signal when internal IDs change.
- **Counting:** time in the short-video viewer, plus **number of reels/shorts watched** (each swipe fires a scroll event). The popup shows e.g. "47 reels · 23 min on Instagram Reels".
- **When a limit is hit:**
  - Reels/Shorts limit → popup appears when entering the viewer; **Take a break presses Back** (leaves Reels, keeps the app open).
  - Whole-app limit → popup anywhere in the app; Take a break goes to the home screen.
- **Data model:** usage, extra time and tolls tracked per *scope* (`app` and `app:short`).
- **Privacy & Play:** rewrite the disclosure ("checks which section of an app is open, like Reels; never reads messages or what you type"); update the Accessibility declaration text and demo video plan.
- **Safety net:** if a supported app hasn't matched any rule for a long time while open (likely an app update changed its layout), fall back to whole-app counting and flag it.
- **Needs:** real Instagram, YouTube and Facebook screens to find the IDs (Google sign-in on the emulator, or a real phone).
- **Later:** remote rule updates via Supabase (Phase 4); re-verify IDs against the latest app versions before launch (Phase 7).
- **Done when:** on a device with the real apps, Reels/Shorts time and count are tracked separately from the rest of the app, both limits trigger the right popup, and Take a break leaves Reels without closing the app.

### Phase 2 — Brain Mode (works offline, multi-topic)
**Toll rules (decided 2026-11-09):**
- 1st Brain toll of the day = **3 questions**, +1 for each repeat that day (cap 8). Difficulty also rises with repeats. Pass ≈ 80% correct; a failed set offers a fresh set right away (no lockout).
- A passed toll always unlocks **10 min**. After the minimum, the user can tap **"Keep going"** for extra questions; each extra correct answer adds bonus minutes (default +2 min, up to +10 per toll). Minutes go to the exact limit that was hit (whole app or Reels/Shorts scope).
- Home **Practice → Brain** banks minutes (max 20 per day, reset at midnight). When a limit is hit, the popup/Toll screen offers "Use banked minutes" before asking for a toll.
- Fast-answer 2× bonus is recorded now and becomes Sparks in Phase 5.

**Question sources (decided 2026-11-09):** questions will be **AI-generated** (Phase 4), but every toll must work offline, so Phase 2 ships:
- Mental Math and Logic & Patterns generated on the phone (infinite, answers computed in code).
- A **small hand-written starter pack** (~40 per area) for General Knowledge, Coding and Words: the offline safety net until Phase 4's AI pool takes over, then the last resort.

**Difficulty (decided 2026-11-09):** Phase 2 uses an Elo-style rating per area and subskill (speed + accuracy, favours weak spots). Phase 4 adds an ML model (item response theory) on Supabase that learns each question's real difficulty from all users' answers; the Phase 2 ratings feed into it.

**Build steps:**
1. Question format `{id, area, subskill, type: numeric | mcq, prompt, code?, options?, answer, difficulty, explanation}` + on-device storage (expo-sqlite: key-value for picks/ratings/bank, a table for answer history).
2. Math and logic generators (5 difficulty steps each), unit-tested.
3. Starter packs (GK, Coding, Words) + a validator script (format, answer in options, no duplicates, code length).
4. Elo ratings, adaptive selection from picked areas, recently-seen filter; toll rules (size, pass mark, 10 min + bonus, bank) as pure, unit-tested logic.
5. Screens: Interests quiz (first launch + Settings), Brain toll (keypad / multiple choice / code card, timer, explanations, "Keep going"), result screen, Toll screen with Brain (Muscle "coming in Phase 3") and banked minutes, 60-second calibration, Home Practice → Brain.
6. Phone test: a Brain toll in each of the 5 areas with Wi-Fi and mobile data off unlocks the blocked app.
- **Done when:** a Brain toll in each of the 5 areas works fully offline and unlocks the blocked app.

### Phase 3 — Muscle Mode
- `src/features/muscle/`: camera + pose model in a background frame processor, joint-angle helpers, rep counters:
  - **Squat:** hip–knee–ankle angle (points 23–25–27 / 24–26–28), down below ~100°, up above ~160°, plus a depth check.
  - **Jumping jack:** wrists above head + feet wider than shoulders, then back.
  - **Low-impact:** overhead arm raises (shoulder angle) or a timed wall-sit.
- Single-squat calibration to set your range of motion, a "step back so I can see you" check, skeleton overlay, rep ring, form tips.
- **Done when:** reps are counted reliably by a phone propped about 2 m away, in normal room lighting.

### Phase 4 — Supabase + AI
- Tables: profiles, skill_ratings, toll_events, problem_pool, purchases, inventory. Row-level security so each user only sees their own data.
- Anonymous sign-in at first launch; optional Google sign-in to keep data across phones.
- **Brain questions become AI-generated here** (decided 2026-11-09): the phone downloads fresh AI batches for the user's areas whenever online, so the offline supply is AI-made; the Phase 2 starter pack becomes the last resort.
- **ML difficulty:** fit an item-response-theory model on all users' answers (Edge Function or scheduled job) to learn each question's real difficulty; combine with the Phase 2 Elo ratings for selection.
- Edge Function `generate-questions`: tops up `question_pool` for each **area × subskill × difficulty level**. Quality checks before saving:
  - Math and logic: the answer is recomputed in code.
  - GK, Coding and Words: a second AI pass checks the answer independently, and anything it disagrees with is thrown away. Duplicates are removed.
  - In the app: a "Report question" button. Questions reported a lot are hidden automatically.
- Questions are shared across users at the same level, so AI calls stay rare. The app downloads a batch for your picked areas ahead of time, so tolls work offline: stored AI questions → starter pack → templates.
- Edge Function `coach-tip`: one short weekly tip based on your stats.
- **Remote Reels/Shorts detection rules:** the app downloads the latest rules list from Supabase, so detection can be fixed after Instagram/YouTube/Facebook updates without a new app release.
- The app syncs events when online and works fully offline.

### Phase 5 — Rewards & shop
- Sparks (bonuses for speed and good form), Toll Complete screen, Time Pass (bought with Sparks or paid through Play Billing), one shared daily cap, avatar wardrobe.
- Sunday Boss: a combined squats + algebra challenge that drops rare cosmetics. It **does not** lock your weekend, it's a bonus. It appears in Home's Practice section on Sundays.
- Banked minutes from practice tolls: daily bank cap, spent automatically when a blocked app hits its limit, counted against the shared daily cap rules.
- Home: Monday **weekly recap card**.

### Phase 6 — Mascot, onboarding, stats, polish
- Red panda: AI-generated 3D-style images in a fixed pose for each state (brainy/athletic/zen), with outfits as aligned layers on top. Idle float and tap-bounce animations.
- Stats: skill radar (one axis per area you picked, with subskills on tap), coach tip, form score, weekly volume, 30-day heatmap, Hours Reclaimed.
- Full onboarding and permission flow, sounds and vibration, empty states.
- Home: **reactive mascot** (moods + speech bubble driven by limits, tolls and time of day) and the **reclaimed-time translator**.
- **Blocker battery pass (decided 2026-11-09).** Today the blocker checks every 2 s; the cost is small but unmeasured. Measure first (reset battery stats, use the phone normally for a few hours, read the app's share in Settings → Battery / `adb shell dumpsys batterystats`), then:
  1. Slow down or pause the 2 s check when no limited app and no floating video window is on screen; wake it on the next app switch.
  2. Stop the check completely while the screen is off (it already skips counting then) and resume when it turns on.
  3. Keep today's minutes in memory and save them every 10–20 s (and on app switch / screen off) instead of every tick.
  4. Run the Facebook tab-label scan less often (e.g. every 4 s); ID lookups for Instagram/YouTube stay at 2 s.
  Measure again afterwards. Blocking behavior must not change; re-run the Phase 1.5 device checks.

### After launch (not in v1)
- **Strict Mode (optional, decided 2026-11-08):** uses Android Device Admin so the app's Force stop and Uninstall buttons are greyed out while it's on. Needs a Google Play policy check first. In v1, Force stop is handled by clearly showing "Blocking is off" on Home and in Settings.
- **Friends & leaderboard:** compare hours reclaimed with friends. Needs Supabase accounts, friend invites and moderation.

### Phase 7 — Launch on Google Play
- Privacy policy (free GitHub Pages site), Data safety form (the camera runs only on the phone, nothing is uploaded), Accessibility declaration + video, store listing.
- **New personal Play accounts must run a closed test with at least 12 testers for 14 days before going public.** Line up testers early, around Phase 5.
- During the closed test, check the blocker's battery use on a few testers' phones (different brands, especially Samsung and Xiaomi) and in Play Console's Android vitals.

---

## Running costs
| Item | Cost |
|---|---|
| Google Play Console | $25 once |
| Supabase | Free tier (note: free projects pause after 7 days with no activity) |
| AI problems | Small. Pooled batches mean a few calls per difficulty level, not one per user. I'll estimate it in Phase 4 with real numbers. |
| RevenueCat | Free under its revenue limit |
| Builds | Free (local) |

## What you'll need
- An Android phone for testing (the Accessibility feature and camera don't work properly in an emulator).
- A Google Play developer account ($25), by Phase 7.
- A Supabase account (free) and an Anthropic API key, by Phase 4.

## How each phase is verified
- Every phase ends with a hands-on check on your phone against its "Done when" line.
- Unit tests (Jest) for the pure logic: Elo, difficulty adjustment, problem builder, interest-based question selection, starter-pack format checks, joint angles and rep counting (with recorded sample pose data), and Spark/cap rules.
- After Phase 1 and before launch, I'll run through ways to get around the block: force-closing, restarting the phone, turning on battery saver, changing the clock, and turning off Accessibility. Turning off Accessibility can't be prevented, but it's detected and shown on Home.

**Review points:** I'll stop for your review after each phase before starting the next.

---

## Current status (2026-11-08)
**Phase 1.5 re-test (2026-11-09 evening, Galaxy S23, clean test data, user data restored afterwards): ✅ all checks pass after 6 fixes.**
- Instagram: Home feed adds no Reels time; 1 entry + 5 swipes counted exactly (by page change now); popup "7 reels today"; Leave Reels taps the Home tab.
- YouTube: 1 entry + 3 swipes counted exactly; Shorts popup + Leave Shorts; Pay toll opens the Toll screen on the first tap; +5 min on Shorts only; floating window counted on the home screen and reopened with the whole-app popup when over the limit; Take a break no longer loops.
- Facebook: Reels detected by tab label, 3 swipes counted, popup + Leave Reels via the Home tab, leaving no longer adds a reel; going Home stops the counting.
- Fixes found by the re-test: (1) window events from background windows (Samsung's Google Discover panel, Samsung Pay hints) briefly switched the "current app" (extra counts, could hide the popup) → only switch if that app owns the active window; (2) Instagram over/under-counted swipes → count by the visible reel container (`clips_media_component`), checked 0.8 s after a scroll, choosing the reel filling most of the screen; (3) the popup re-appeared over our Toll screen while it was opening → 10 s grace after Pay toll; (4) Take a break → YouTube auto-floats and kept playing → reopened in a loop → now the floating video is paused (audio focus) instead; (5) any app's sound made a paused floating window look like it was playing (pulled the user out of Facebook) → floating windows are only counted/reopened when the app in front isn't our app or another limited app; (6) Facebook's Home-tab tap counted as a reel → scrolls ignored while leaving.
- Known limit added: Android only tells us that *some* sound is playing, not which app; exact per-app playback would need the optional "Notification access" permission (later phase).

**Phase 1.5 — ✅ built and tested on a real phone (2026-11-09), awaiting your review.** Test phone: Galaxy S23 (SM-S911B, Android 16), with Instagram, YouTube and Facebook.
- Built: per-scope tracking (`pkg` / `pkg:short`), `ShortFormRules.kt` (IDs → tab labels, prefix match), reel counting (scroll bursts for Instagram/Facebook, page change for YouTube), Reels popup mode with **Leave Reels/Shorts**, floating-window (picture-in-picture) counting and blocking, safety net (3 h without a match → whole app counts against the Reels limit), two optional limits per app in Settings, Reels/Shorts bars + counts on Home, scope-aware Toll screen, new disclosure text, 6 new unit tests (12 total). The blocker's logic now runs on its own background thread.
- Verified on the phone:
  - Instagram: ✅ Reels detected by `clips_viewer_view_pager`, Home feed not counted; ✅ swipes counted; ✅ popup only inside Reels; ✅ Leave Reels taps `feed_tab` and stays in Instagram (also when Reels was the first screen).
  - YouTube: ✅ Shorts detected (`reel_recycler` etc.); ✅ 3 swipes → 3 counted (page change); ✅ popup + Leave Shorts (Back) → YouTube Home; ✅ Pay toll → Toll screen → +5 min on `youtube:short` only; ✅ whole-app limit popup → Take a break → phone home screen; ✅ floating window keeps counting while it plays (+8.2 s in 8 s); ✅ over the limit while floating → YouTube reopened full screen with the Shorts popup.
  - Facebook: ✅ Reels detected by the selected tab label "Reels, tab 2 of 6"; ✅ 3 swipes counted; ✅ popup "1 min on Facebook Reels · 6 reels today"; ✅ Leave Reels taps "Home, tab 1 of 6" and stays in Facebook.
  - ✅ Going Home stops the counting (Samsung doesn't always send a window event; the service now re-checks the active window every tick).
  - ✅ tsc, eslint, 12 Jest tests pass.
- Fixed during testing: stale accessibility tree (`refresh()`); already-open app after restart and missed Home switches (re-check the active window every tick); YouTube swipes send no scroll events (count by page container); Facebook labels carry extra text (prefix match); Leave Reels tapped before the app's window was active (250 ms settle, Home tab first); **invisible popup on Samsung** (it pauses animations for background apps, so the fade-in never ran: the popup now starts visible and a timer snaps the slide into place); first YouTube check froze our main thread ~1.4 s (all blocker work moved to a background thread); "ADD LIMIT" / "Turn off" labels clipped.
- Known limits:
  - Facebook Reels opened full-screen from the News Feed (not the Reels tab) isn't recognised: Facebook hides its IDs, so only the Reels tab is detectable. Revisit with remote rules (Phase 4).
  - A floating window only counts while sound is playing (so a paused one is free); a muted-but-playing video in a floating window isn't counted.
  - Dev only: re-toggle the service after each `adb install -r` (it's marked "crashed"); debug builds need Metro to show our screens.
- Testing notes: `uiautomator dump` pauses other Accessibility services (restarts the blocker). Old Metro processes hold ports 8081/8082; current Metro runs on 8083 (`adb reverse tcp:8081 tcp:8083`).

**Phase 1 — ✅ built and tested on the emulator (2026-11-08); approved (Phase 1.5 started).**
- Built: native blocker module (Accessibility watcher, per-app daily timers, toll grants, deep link to the Toll screen); Settings (permission explainer + status, blocked apps with limit stepper); app picker; plain Toll screen with a test toll (+5 min); live **Today's apps** card on Home; unit tests for limit logic.
- Tested (YouTube and Chrome as targets, 1-minute limits): ✅ blocked after ~62 s; ✅ reopening a blocked app brings the Toll screen straight back; ✅ paying the toll adds 5 min and the app stays open; ✅ survives swiping the app away from Recents; ✅ survives a phone reboot (usage carries over, still blocked).
- ⚠️ Found: **Force stop** (Settings → Apps → Force stop) makes Android switch the blocker off until the user turns it back on. This is standard Android behavior for all Accessibility apps. Decision: v1 shows "Blocking is off" clearly; an optional Device Admin "Strict Mode" comes after launch.
- Instagram wasn't testable on the emulator (needs a Google sign-in); the blocking logic is the same for any app.
- **Update: block popup over the app.** Replaced "jump to our app" with a native popup drawn on top of the blocked app (time spent today, limit, rotating funny line, **Pay toll** / **Take a break**). Tested: ✅ appears over Chrome when over limit; ✅ taps on the app behind are blocked; ✅ Take a break and the Back key go to the home screen (with a short cooldown so a late window event can't re-pop it; 3/3 passes); ✅ reopening brings it back; ✅ Pay toll opens our Toll screen; ✅ incremental native builds now take ~30 s–1 min.
- Known (debug only): Expo Router logs an unhandled `NAVIGATE … __root` warning when the toll link arrives while the app is already open. Navigation still works. Revisit when the Toll screen is rebuilt in Phase 2.

**Phase 0 — ✅ complete (2026-11-08).** The app builds and runs on the `MindMuscle_Pixel` emulator, showing the Home screen and working tabs. Windows long-path build failure fixed with `plugins/with-cmake-version.js` (CMake 4.1.2). Android uppercase-text wrapping fixed in `AppText`.

<details><summary>Earlier status notes</summary>

**Phase 0 — almost done; build paused by request.**
- Done: Node.js 26, JDK 17 and Android Studio installed; Expo SDK 58 project created (app name "Mind-Muscle Sync", Android package `com.mindmusclesync.app`); design tokens; text, button and card components; custom tab bar; placeholder Home, Stats, Shop and Settings screens; `CLAUDE.md`; `.gitignore` additions; type check and lint passing; native `android/` project generated.
- Android setup (all on drive T because C is nearly full): SDK at `T:\Android\Sdk`, Gradle cache at `T:\Android\gradle`, virtual phone `MindMuscle_Pixel` (Pixel 7, Android 16) at `T:\Android\avd`. User env vars set: `ANDROID_HOME`, `ANDROID_SDK_ROOT`, `ANDROID_AVD_HOME`, `GRADLE_USER_HOME`, `JAVA_HOME` (JDK 17). Windows Hypervisor Platform turned on (needs a PC restart).
- Left to do:
  1. Restart the PC (activates the hypervisor for the emulator).
  2. First build: `cd android && .\gradlew.bat assembleDebug` (it was stopped partway; downloaded files stay cached).
  3. Launch on the emulator and confirm the Home screen and tabs show up.
- Nothing has been committed to git yet.

</details>
