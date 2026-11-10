import type { Exercise, Tip } from './types';

/**
 * Muscle toll rules (decided with the user, 2026-11-10). Pure functions, unit-tested.
 * - "Tiny" tolls: 1st toll of the day 5 squats / 10 jumping jacks / 8 arm raises.
 * - Each toll already paid today (Brain or Muscle) adds one step, up to double.
 * - A pass unlocks 10 min (same as Brain) plus a form bonus: ≥80% full-form reps → +5,
 *   ≥50% → +2.
 * - Practice: the 1st-toll size; banks minutes like Brain practice.
 */
export const MUSCLE_TOLL_MINUTES = 10;
export const FORM_BONUS = [
  { share: 0.8, minutes: 5 },
  { share: 0.5, minutes: 2 },
] as const;
export const MUSCLE_PRACTICE_BANK_MINUTES = 5;

export const EXERCISES: Record<Exercise, { base: number; step: number }> = {
  squat: { base: 5, step: 1 },
  jack: { base: 10, step: 2 },
  raise: { base: 8, step: 2 },
};

export const EXERCISE_ORDER: Exercise[] = ['squat', 'jack', 'raise'];

/** Reps for this toll; `tollsToday` = tolls already paid today (any app, any kind). */
export function repsFor(ex: Exercise, tollsToday: number): number {
  const { base, step } = EXERCISES[ex];
  return Math.min(base * 2, base + step * Math.max(0, tollsToday));
}

/** Bonus minutes for good form. */
export function formBonus(fullReps: number, reps: number): number {
  if (reps <= 0) return 0;
  const share = fullReps / reps;
  return FORM_BONUS.find((b) => share >= b.share)?.minutes ?? 0;
}

export function muscleReward(fullReps: number, reps: number): number {
  return MUSCLE_TOLL_MINUTES + formBonus(fullReps, reps);
}

export const EXERCISE_TEXT: Record<Exercise, { name: string; plural: string; how: string }> = {
  squat: { name: 'Squat', plural: 'squats', how: 'Feet shoulder-width apart, sit back and down, then stand tall.' },
  jack: { name: 'Jumping jack', plural: 'jumping jacks', how: 'Jump your feet wide as your hands go overhead, then back.' },
  raise: { name: 'Arm raise', plural: 'arm raises', how: 'Raise both arms straight overhead, then lower them to your sides.' },
};

export const TIP_TEXT: Record<Tip, string> = {
  lower: 'Go a bit lower',
  knees: 'Bend your knees, chest up',
  'arms-higher': 'Hands all the way up',
  'feet-wider': 'Jump your feet wider',
  'reach-higher': 'Reach a bit higher',
  'straight-arms': 'Straighten your arms',
};
