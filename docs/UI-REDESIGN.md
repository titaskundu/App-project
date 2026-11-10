# UI redesign (2026-11-10)

This redesign borrows the *ideas* from the Stitch export (`stitch_app_ui_redesign.zip`, "Tactile Arcade Habit System"): pill shapes, chips, stat tiles, color-coded sections and a non-monotonous layout. It keeps our own palette (indigo / teal / coral / gold on warm cream) and the Nunito font. We did **not** take the slides' mint green, cool background, Plus Jakarta Sans, lives/hearts, XP/streaks/quests, toll strictness modes or a Fitness topic.

## What changed

### Shared building blocks
- `ChunkyButton`: full pill shape. New `size="sm"` for compact actions inside cards, with extra touch area.
- `Chip` (new, `src/components/ui/Chip.tsx`): a tinted pill with an optional icon and an uppercase micro-label. `solid` is for the loudest states ("TOLL DUE").
- `Card`: optional `border` and `edge` (a colored bottom lip).
- Tokens: `warn` / `warnSoft` (amber, "almost out of time"), `scrim`, `textDark`, the `micro` text style, and **`modeTones`**: Reels/Shorts = coral, whole app = indigo.

### Reels only vs whole app, distinct everywhere
- Reels/Shorts = **coral + film icon**. Whole app = **indigo + phone icon**. Both = both chips.
- The same coding is used on tile chips, usage rings, Home's "Today's apps" bars, the steppers, and the app picker's "Can limit just Reels" chip.

### Settings is a compact hub (`src/app/(tabs)/settings.tsx`)
- A status card ("Blocking is on · ACTIVE", green lip).
- **Blocked apps** row: up to 3 overlapping real app icons plus a "+N" bubble, the app count, and a live line ("2 over limit today" in red, "1 almost out of time" in amber, or "All within limits" in teal). Tapping it opens `/blocked-apps`, or the picker when no apps are blocked yet.
- **Brain topics** row: topic chips (up to 3 + "+N") and a small "Redo level check" button. Tapping it opens the interests screen.
- New settings get their own short row, so the page never becomes a long scroll.

### New Blocked apps screen (`src/app/blocked-apps.tsx`)
- A summary strip at the top: guarded · over limit · used today.
- The most urgent app gets a **wide tile**. The rest sit in a **2-column grid**, ending with a dashed "+ Add app" tile.
- Each tile shows the app icon inside **usage rings** (one ring per limit; with both limits the outer ring is Reels and the inner ring is the whole app), the name, the mode chips and time used.
- Tiles change with their state:
  - normal: white;
  - 80% or more used: amber;
  - over the limit: red, with a lock badge and a "TOLL DUE" chip.
- Tapping a tile opens **`LimitSheet`**, a bottom sheet with that app's controls:
  - a 3-way **Reels only | Whole app | Both** switch; the selected segment pops up in its mode color;
  - a colored block per limit with today's usage bar and a mode-colored stepper;
  - the stale-rules warning;
  - "Stop blocking".
- The sheet is drawn as an overlay inside the screen, not as a React Native `Modal`. On this phone an Android Modal stops above the navigation bar and leaves a gray band. The Android back button closes the sheet.

### Home (`src/app/(tabs)/index.tsx`)
- Stat tiles: Reclaimed · Sparks · Banked. Reclaimed and Sparks stay placeholders until Phase 5.
- Companion: the 🐼 placeholder plus a speech bubble whose line follows today's state, most important first:
  - no apps blocked;
  - blocking turned off;
  - an app over its limit;
  - an app almost out of time;
  - minutes banked;
  - all fine.
- "Today's apps" bars: app icon, mode icon, and a bar in the mode's color (amber when almost out, red when over). An "Edit limits" link opens Blocked apps.
- Practice: big colored cards. Brain shows an icon tile, a description, a "+5 MIN" reward chip and a START button. Muscle is dimmed with a "SOON" chip until Phase 3.

### Other screens
- Interests: a level chip on each topic ("LV 3"), from that area's rating. It is hidden for areas never played.
- Brain session: the area is shown as a chip. A gold **"2× if fast"** chip shows only while a fast answer still counts, then fades out. A fast correct answer gets a **"2× fast"** tag on the right option, or on the answer box for number questions.
- Tab bar: each section has its own color (Home indigo, Stats teal, Shop gold, Settings coral). The active icon sits in a tinted pill with a colored lip.
- App picker: real app icons, the Reels chip, and a pill-shaped search box.

### Native: app icons
- `getAppIconsAsync(pkgs)` in `AppBlockerModule.kt` draws each app's launcher icon once into a 144 px PNG in the app's cache folder and returns `{ pkg: "file://…" }`.
  - The file name includes the app's last-update time, so a new icon after an app update gets a new file.
  - In JS it's `AppBlocker.getAppIcons()`. The store keeps the results in `icons`, and `''` marks apps that have no icon.
- Screens call `useAppIcons(pkgs)` so icons are fetched in one batch. `AppIcon` shows the first letter until the icon arrives.

## Pure logic (unit-tested in `src/features/blocker/__tests__/modes.test.ts`)
- `limitMode` and `targetsForMode`: switching between Reels only, whole app and both. Limits that stay keep their minutes; a newly turned-on limit starts at 15 min.
- `scopeStatuses`, `usageLevel`, `worstLevel` and `byUrgency` give the per-app status used by every screen above.

## Review round 1 (2026-11-10): fixes from the user's phone test
1. **Sheet bounced too much.** It now slides in with a plain timing curve (260 ms ease-out) and slides out over 200 ms. There is no spring.
2. **The bar ran backwards while adjusting.** It showed "used ÷ limit", so pressing + emptied it. The sheet's bar now shows **time left today** ("25 min left today"), so + grows it and − shrinks it. When over the limit it is empty and says "No time left today". The tile rings and Home bars still show time used.
3. **Tiles re-sorted live behind the sheet.**
   - The sheet edits a **draft**, and a **Save** button (greyed out as "Saved" until something changes) applies it in one write through `saveAppLimits` (pure helpers `appLimits` and `withAppLimits`).
   - Closing with unsaved changes (✕, back button or the backdrop) asks **"Save your changes?"** with Save / Discard / Keep editing.
   - Switching a limit off and back on in the draft restores its minutes.
   - The tile order is **frozen while the sheet is open**. 240 ms after it closes, the grid re-sorts and tiles glide to their new places (`LinearTransition`, 380 ms).
   - The grid is now a single wrapping list keyed by app, so a tile can also glide into the wide top slot.
   - "Stop blocking" still applies at once.
4. **Colored bottom lips on white cards looked odd.** The Settings rows, the "Blocking is on" card and Home's stat tiles now use the normal beige border for their lip. Cards that are colored all the way round (amber/red tiles, sheet blocks, the Brain card) keep matching lips.
5. **+/− borders drew as a crescent.** They are now "coins": a darker circle 4 px under the colored face, and the face sinks when pressed.

Verified on the emulator (the user's phone was not connected): the slide, + growing the bar, the Save button lighting up, the prompt, Discard keeping the old value, Save writing the new value, the shuffle with Chrome moving up a slot after going over its limit, and the blended borders.
**Not yet installed on the phone.** Next time: build the release (`assembleRelease -PreactNativeArchitectures=arm64-v8a`), install it, and restore `enabled_accessibility_services`.
