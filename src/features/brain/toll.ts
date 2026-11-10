/**
 * Brain toll rules (decided with the user, 2026-11-09). Pure functions, unit-tested.
 * - 1st toll of the day: 3 questions; +1 for each repeat that day, capped at 8.
 * - Pass mark ≈ 75–80% (2 of 3, then 3 of 4, 4 of 5, 5 of 6, 6 of 7, 6 of 8).
 * - A pass unlocks 10 minutes. "Keep going" adds BONUS_PER_EXTRA per extra right answer,
 *   up to MAX_BONUS per toll.
 * - Repeats also make questions harder (difficultyBump).
 * - Practice rounds bank minutes for later, up to BANK_DAILY_CAP per day.
 */
export const BASE_QUESTIONS = 3;
export const MAX_QUESTIONS = 8;
export const TOLL_MINUTES = 10;
export const BONUS_PER_EXTRA = 2;
export const MAX_BONUS = 10;
export const MAX_EXTRA_QUESTIONS = MAX_BONUS / BONUS_PER_EXTRA;

export const PRACTICE_QUESTIONS = 5;
export const PRACTICE_PASS = 4;
export const PRACTICE_BANK_MINUTES = 5;
export const BANK_DAILY_CAP = 20;
export const BANK_USE_MAX = 10;

export const CALIBRATION_SECONDS = 60;

/** How many questions this toll has; `tollsToday` = tolls already paid today (any app). */
export function questionCount(tollsToday: number): number {
  return Math.min(MAX_QUESTIONS, BASE_QUESTIONS + Math.max(0, tollsToday));
}

/** Right answers needed to pass a set of `total` questions. */
export function passMark(total: number): number {
  return total <= 3 ? Math.min(total, 2) : Math.ceil(total * 0.75);
}

export function passed(correct: number, total: number): boolean {
  return correct >= passMark(total);
}

/** Difficulty steps added on repeat tolls: 0, 0, 1, 1, 2, 2, … (max 2). */
export function difficultyBump(tollsToday: number): number {
  return Math.min(2, Math.floor(Math.max(0, tollsToday) / 2));
}

/** Minutes unlocked by a passed toll with `extraCorrect` right answers after "Keep going". */
export function tollReward(extraCorrect: number): number {
  return TOLL_MINUTES + Math.min(MAX_BONUS, Math.max(0, extraCorrect) * BONUS_PER_EXTRA);
}

/** Minutes a practice round adds to the bank, given what was already banked today. */
export function practiceReward(passedRound: boolean, bankedToday: number): number {
  if (!passedRound) return 0;
  return Math.max(0, Math.min(PRACTICE_BANK_MINUTES, BANK_DAILY_CAP - bankedToday));
}

/** Seconds allowed per question, by kind. Long word problems (aptitude, puzzles) get more time. */
export function timeLimitSeconds(q: { type: 'numeric' | 'mcq'; code?: string; prompt?: string }): number {
  if (q.code) return 45;
  const long = (q.prompt?.length ?? 0) > 90;
  if (q.type === 'numeric') return long ? 45 : 25;
  return long ? 40 : 20;
}

/** Answered within the first 40% of the time limit → "fast" (2× bonus, Sparks in Phase 5). */
export function isFast(ms: number, limitSeconds: number): boolean {
  return ms <= limitSeconds * 1000 * 0.4;
}
