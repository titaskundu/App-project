# Mind-Muscle Sync — Phase 2: Brain Mode

How Brain tolls work, where the questions come from, how difficulty is chosen, and what every
new file does.

- Status: built, tested on the emulator and a Galaxy S23 (2026-11-09), awaiting review
- Code: `src/features/brain/` (logic), `src/app/brain.tsx`, `interests.tsx`, `toll.tsx` (screens)
- Tests: `src/features/brain/__tests__/` (26 Brain tests, 38 in the project)

---

## 1. What Phase 2 adds, from the user's side

1. **First launch → interests quiz.** Five topic cards (Mental Math, Logic & Patterns,
   General Knowledge, Coding, Words & Vocabulary). Pick at least one.
2. **60-second level check.** Mixed questions from the picked topics, to set a starting level.
3. **When a limit is hit**, the popup's *Pay toll* opens the Toll screen, which now offers:
   - **Use banked minutes** (if any were earned in practice),
   - **Brain toll** — answer N questions to unlock 10 minutes,
   - Muscle toll — shown as "coming soon" (Phase 3).
4. **Brain toll screen.** One question at a time: a progress bar, a timer bar, a number keypad
   or multiple-choice buttons, a dark code card for Coding questions. After each answer:
   "Correct!", "Lightning fast!", "Not quite" or "Time's up", with a one-line explanation when
   wrong.
5. **Result.** Pass → "Toll paid! 10 minutes unlocked", with an optional **Keep going** round
   for bonus minutes. Fail → "Not quite … Try a new set".
6. **Home → Practice → Brain.** 5 questions; 4 right banks 5 minutes for later.
7. **Settings → Brain topics.** Change topics or redo the level check.

All of it works **offline**: nothing in the Brain code uses the internet.

---

## 2. One question format for everything

`src/features/brain/types.ts`

```ts
type Question = {
  id: string;            // "math-percentages-3-81726354" or "gk-019"
  area: 'math' | 'logic' | 'gk' | 'coding' | 'words';
  subskill: string;      // finer topic, e.g. "percentages", "big-o", "synonyms"
  type: 'numeric' | 'mcq';
  prompt: string;
  code?: string;         // pseudocode for Coding questions
  options?: string[];    // multiple choice only
  answer: string;        // "42", or the exact text of the right option
  difficulty: 1 | 2 | 3 | 4 | 5;
  explanation: string;   // shown after a wrong answer
};
```

Generated questions, hand-written questions and (in Phase 4) AI-made questions all use this
shape, so the screens and the scoring don't care where a question came from.

---

## 3. How "unlimited" Math and Logic questions work

Math and Logic questions are **not stored anywhere**. Each one is built on the phone at the moment
it's needed, from a template plus random numbers, and **the answer is calculated by the code**,
never typed by a person. That's why they can't run out and can't have a wrong answer key.

### 3.1 The random numbers

`src/features/brain/random.ts` is a small *seeded* random generator (an algorithm called
mulberry32). In the app the seed is the current time, so every session is different. In tests a
fixed seed is used, so the exact same questions come out every run and failures can be reproduced.

### 3.2 Mental Math templates — `generators/math.ts`

Seven subskills. Each difficulty level (1–5) uses bigger numbers:

| Difficulty | Main number range |
|---|---|
| 1 | 2 – 12 |
| 2 | 10 – 40 |
| 3 | 20 – 99 |
| 4 | 50 – 250 |
| 5 | 100 – 999 |

| Subskill | How it's built | Example (difficulty) |
|---|---|---|
| addition | two numbers from the range | `27 + 64 = ?` (3) |
| subtraction | two numbers, bigger first (never negative) | `88 − 31 = ?` (3) |
| multiplication | one small factor (up to 9/12/15/20/25) × one from the range, so it stays "mental" | `12 × 34 = ?` (4) |
| division | built **backwards**: pick divisor and result, show `divisor × result ÷ divisor`, so it always divides exactly | `96 ÷ 8 = ?` (2) |
| percentages | pick a friendly percent (10%, 25%… harder levels 7%, 35%…), then pick a base that makes the result whole | `15% of 140 = ?` (3) |
| fractions | pick a denominator, then a base that's a multiple of it | `3/8 of 64 = ?` (3) |
| algebra | pick the answer x first, then build `ax + b = c` around it | `3x + 7 = 31. What is x?` (3) |

Every answer is a whole number ≥ 0, so it can always be typed on the keypad. The explanation is
also generated (e.g. `15% of 140 = 140 × 15 ÷ 100 = 21`).

**How many different questions?** Even one template at one level has thousands of combinations
(level-3 addition alone: 80 × 80 = 6,400), times 7 subskills × 5 levels. In practice a user never
sees the same one twice.

**Aptitude word problems** (added after review, `generators/aptitude.ts`), same rules: numbers
picked so the answer is whole, answer computed in code.

| Subskill | Easy → hard | Example |
|---|---|---|
| speed-distance | distance/speed/time → km/h to m/s → trains meeting → average speed over a round trip | `Two trains start 210 km apart … at 40 km/h and 30 km/h. After how many hours do they meet?` |
| work-time | walls per day → workers × days → two people working together | `A can finish a job in 10 days and B in 15 days. Together?` → 6 |
| profit-loss | discount → profit/loss price → profit % → two discounts in a row | `Marked ₹800, 25% off, then a further 10% off` → 540 |
| interest | simple interest → total amount → find the rate → 2-year compound interest | `₹2000 at 10% compounded yearly, interest in 2 years?` → 420 |
| ratios | split in a : b → three-way split → boys/girls → difference given | `₹120 shared 2 : 3, larger share?` → 72 |
| averages | average of a list → missing number → new member changes the average | `Average age of 5 players is 20; a coach joins, average 22; coach's age?` → 32 |
| ages | in n years → sum and difference → "father is k times as old" → "in n years twice as old" | `Ana is 3 times as old as Ben. In 6 years, twice as old. Ben's age?` → 6 |

### 3.3 Logic templates — `generators/logic.ts`

| Subskill | How it's built | Answer type |
|---|---|---|
| sequences | Six rule types: add a step, multiply, square numbers, Fibonacci-style, alternate up/down, growing gaps. Harder levels unlock harder rules. Shows 4–5 terms, asks for the next. | keypad |
| odd-one-out | Three numbers that follow a rule (even, multiple of 3/4/7, square numbers) + one that doesn't. Harder levels unlock more rules. | multiple choice |
| ordering | 3–5 people; clues like "Asha is taller than Ben" for each neighbouring pair, shuffled; asks who is tallest/shortest. | multiple choice |

**Aptitude-style puzzles** (added after review, `generators/puzzles.ts`):

| Subskill | How it's built | Answer type |
|---|---|---|
| coding-decoding | Example word + its code; rule gets harder: shift +1 → +2/−1 → +3/−2 → mirror (A↔Z) or alternating ±1 → reverse-then-shift. | multiple choice |
| directions | Easy: which way you face after turns. Harder: walks with turns that end a whole-number distance from the start (3-4-5 style triangles). | multiple choice / keypad |
| letter-series | +step, backwards, growing gaps, two interleaved series. | multiple choice |
| analogies | Two examples (`3 → 27`, `4 → 64`) then `5 → ?`; rules: ×k, +c, squares, cubes, n(n+1), 2n²+1… | keypad |
| blood-relations | Fixed, checked relation chains ("P is the father of Q. R is the sister of P" → Aunt), 2 steps, then 3 steps. | multiple choice |
| seating | 3–5 friends in a row facing North; one end clue + "immediately left/right of" clues, shuffled; who is in the middle / at an end / second from left. | multiple choice |

Long word problems get more time: up to 45 s on the keypad and 40 s for multiple choice.

### 3.4 How we know the answers are right

`__tests__/aptitude.test.ts` re-solves **10,500 aptitude questions** from their text with separate
code, and for every puzzle type checks that **exactly one** answer fits (e.g. no code that two
different rules could explain, no pattern with two possible next numbers).
`__tests__/generators.test.ts` generates **7,000 arithmetic questions** (200 × 7 subskills × 5 levels)
and **re-solves each one from the text on screen** with independent code, checking it matches the
stored answer. Logic tests check 1,500 questions per subskill (sequence terms are whole numbers,
exactly one odd option, the tallest/shortest really follows from the clues).

---

## 4. The hand-written starter packs (GK, Coding, Words)

General Knowledge, Coding and Words can't be generated from a formula, so Phase 2 ships
**40 hand-written, fact-checked questions per topic** (`pack/gk.ts`, `pack/coding.ts`,
`pack/words.ts`), spread over all 5 difficulty levels and several subskills (geography, science,
history, culture; output, loops, bugs, complexity, data structures; synonyms, antonyms,
meanings, odd word out, spelling).

`pack/index.ts → validateQuestions()` checks every question: unique id, no duplicates, the answer
is one of the options, 4 distinct options, short enough to fit on screen, code ≤ 10 lines of
≤ 34 characters. It runs in the tests, and will also check AI-made questions in Phase 4.

These packs are the **offline safety net**. In Phase 4, AI-generated batches downloaded from
Supabase take over, and the packs become the last resort.

---

## 5. How the difficulty level is decided

### 5.1 A skill rating, like chess — `rating.ts`

Every player has a rating per topic (`math`) **and** per subskill (`math/percentages`), starting at
**1000**. Every question also has a rating from its difficulty: level 1 = 900 … level 5 = 1300.

Before each answer the app works out how likely the player is to get it right:

```
expected = 1 / (1 + 10^((questionRating − playerRating) / 400))
```

After the answer, the rating moves by how surprising the result was:

```
newRating = rating + K × (score − expected)
  score = 1 for right (1.15 if also fast), 0 for wrong
  K     = 32 normally, 64 during the level check (moves faster)
```

**Example.** Rating 1000, level-3 question (rating 1100): expected ≈ 0.36.
- Right → 1000 + 32 × (1 − 0.36) = **1020** (a hard one right is a big step up)
- Wrong → 1000 + 32 × (0 − 0.36) = **988** (a small step down, it was hard anyway)

The same maths on an easy level-1 question (expected ≈ 0.64): right = +12, wrong = −20. So
getting easy ones wrong costs more than getting hard ones wrong.

### 5.2 From rating to difficulty

| Rating | Difficulty asked |
|---|---|
| below 1050 (new players start at 1000) | 1 |
| 1050 – 1149 | 2 |
| 1150 – 1249 | 3 |
| 1250 – 1349 | 4 |
| 1350 and up | 5 |

(`difficultyFor(rating)` — chosen so the player usually gets roughly two out of three right:
challenging, not crushing.)

### 5.3 Choosing the next question — `select.ts`

1. **Topic:** only from the topics the user picked, chosen at random but **weighted toward the
   weakest topic** (weight = 1 + how far its rating is below 1200).
2. **Subskill:** the same weighting inside the topic, so weak spots come up more often.
3. **Difficulty:** from the subskill rating (5.2), **plus a bump on repeat tolls** (+1 level from the
   3rd toll of the day, +2 from the 5th), so unlocking again and again gets harder.
4. **The question:** generated (Math/Logic), or the starter-pack question closest to that
   difficulty, preferring the subskill and **skipping the last 150 seen**.
5. Multiple-choice options are shuffled every time.

### 5.4 Phase 4 upgrade (planned)

The user asked for AI questions and ML difficulty. Phase 4 adds an **item-response-theory model**
on Supabase that learns each question's *real* difficulty from everyone's answers (a question
labelled "3" that most people miss becomes a "4"). The answer history saved now (section 7) is the
training data.

---

## 6. Toll rules — `toll.ts` (all numbers in one file)

| Rule | Value |
|---|---|
| Questions in a toll | 3 for the first toll of the day, +1 per toll already paid today (any app), max 8 |
| Pass mark | 2 of 3, then ~75% (3/4, 4/5, 5/6, 6/7, 6/8) |
| Reward | **10 minutes**, added to the exact limit that was hit (whole app, or Reels/Shorts only) |
| Keep going | up to 5 extra questions, +2 min per right answer, max +10 |
| Failing | "Try a new set" straight away, no waiting |
| Time per question | 20 s multiple choice, 25 s keypad, 45 s code |
| "Fast" answer | within 40% of the time → "Lightning fast!" (becomes Sparks in Phase 5) |
| Practice round | 5 questions, 4 right → +5 min to the bank |
| Bank | max 20 min earned per day, resets at midnight, use up to 10 at a time; using it doesn't count as a toll |

---

## 7. Saving progress on the phone

- `store.ts` — a Zustand store saved with **expo-sqlite's key-value store** (synchronous, so it's
  ready on the first screen, and offline). Holds: picked topics, ratings, last 150 seen
  pack-question ids, banked minutes, "level check done", fast-answer count.
- `history.ts` — every answer is written to a small SQLite table (`brain.db → answers`: time,
  mode, question id, topic, subskill, difficulty, right/wrong, milliseconds, fast). Phase 6 builds
  the Stats screen from it; Phase 4 can use it to train the difficulty model.
- Native change: `AppBlocker.grantMinutes(scope, minutes, countToll)`. Banked minutes pass
  `countToll = false`, so spending them doesn't make the next toll longer.

---

## 8. Every new or changed file

### Logic (`src/features/brain/`)

| File | Purpose |
|---|---|
| `types.ts` | `Question`, `Area`, `Difficulty`, `AnswerRecord` |
| `areas.ts` | The 5 topics: title, description, icon |
| `random.ts` | Seeded random generator (int, pick, shuffle) |
| `generators/math.ts` | 7 arithmetic templates × 5 levels (+ hands aptitude subskills to `aptitude.ts`) |
| `generators/aptitude.ts` | 7 aptitude word-problem templates × 5 levels |
| `generators/puzzles.ts` | 6 aptitude-style Logic puzzles × 5 levels |
| `generators/logic.ts` | Sequences, odd-one-out, ordering × 5 levels |
| `pack/build.ts` | Short helper for writing pack questions |
| `pack/gk.ts`, `pack/coding.ts`, `pack/words.ts` | 40 hand-written questions each |
| `pack/index.ts` | `STARTER_PACK` + `validateQuestions()` |
| `rating.ts` | Elo ratings, `difficultyFor()` |
| `select.ts` | Picks the next question (topic → subskill → difficulty → question) |
| `toll.ts` | Every toll/practice/bank rule and number |
| `store.ts` | Saved Brain progress (topics, ratings, bank, …) |
| `history.ts` | Answer history table in SQLite |
| `useBrainSession.ts` | Runs one session: picks questions, timer, scoring, Keep going, retry |
| `components/Keypad.tsx` | Chunky 0–9 keypad (tracks fast taps itself) |
| `components/ChoiceList.tsx` | Multiple-choice buttons, green/red after answering |
| `components/CodeCard.tsx` | Dark monospace card for pseudocode |
| `components/TimerBar.tsx` | Shrinking timer bar (visual only; the real timer is in the session) |
| `__tests__/generators.test.ts`, `__tests__/brain.test.ts`, `__tests__/aptitude.test.ts` | 26 tests |

### Screens and other changes

| File | Change |
|---|---|
| `src/app/brain.tsx` | New. The Brain session screen + result screen (`?mode=toll / practice / calibration`) |
| `src/app/interests.tsx` | New. Interests quiz |
| `src/app/toll.tsx` | Bank card, Brain toll card, Muscle "coming soon"; dev-only skip button |
| `src/app/(tabs)/index.tsx` | First launch → interests quiz; Practice → Brain; "MIN BANKED" pill |
| `src/app/(tabs)/settings.tsx` | "Brain topics" card: change topics, level check |
| `src/app/_layout.tsx` | Registers the new screens |
| `src/theme/tokens.ts` | Monospace font, code-card colours, soft success/danger colours |
| `src/features/blocker/limits.ts` | Old Phase 1 test-toll constant removed |
| `modules/app-blocker/…` | `grantMinutes(…, countToll)` |
| `package.json`, `app.json` | Added `expo-sqlite` |

---

## 9. Testing done

| Check | Where | Result |
|---|---|---|
| 34 unit tests, type check, lint | PC | ✅ |
| Interests quiz → level check → Home | emulator | ✅ |
| Practice 5/5 → +5 min banked | emulator | ✅ |
| Popup → Pay toll → Brain toll 2/3 → Keep going → +12 min, app reopens | emulator | ✅ |
| Use banked minutes (doesn't count as a toll) | emulator | ✅ |
| Failed toll → Try a new set | emulator + phone | ✅ |
| **Offline: a toll in each of the 5 topics** (5, 6, 7, 8, 8 questions) | emulator | ✅ |
| Release build (no PC needed) pays a toll offline | emulator | ✅ |
| Instagram Reels popup → 8-question toll → Reels unlocked | Galaxy S23, release | ✅ |

Bug found and fixed: the keypad's ✓ could ignore a tap that came faster than the screen updated.
