import type { AnswerRecord, Difficulty } from './types';

/**
 * Elo-style skill ratings, like chess ratings: every answer moves the rating toward the
 * player's real level. A right answer to a hard question raises it a lot, a wrong answer to
 * an easy one lowers it a lot. Fast right answers count a bit more.
 * Kept per area ("math") and per subskill ("math/percentages").
 */
export const START_RATING = 1000;
const K = 32;
/** Calibration moves ratings faster, so a 60-second test lands near the right level. */
export const K_CALIBRATION = 64;

export type Ratings = Record<string, number>;

/** A question's own rating, from its difficulty: 1 → 900 … 5 → 1300. */
export function questionRating(d: Difficulty): number {
  return 800 + d * 100;
}

/** Chance (0–1) that a player with `rating` answers a `d` question right. */
export function expectedScore(rating: number, d: Difficulty): number {
  return 1 / (1 + 10 ** ((questionRating(d) - rating) / 400));
}

export function ratingKeys(area: string, subskill: string): [string, string] {
  return [area, `${area}/${subskill}`];
}

/** New ratings after one answer (area and subskill both move). */
export function updateRatings(ratings: Ratings, a: AnswerRecord, k = K): Ratings {
  const next = { ...ratings };
  const score = a.correct ? (a.fast ? 1.15 : 1) : 0;
  for (const key of ratingKeys(a.area, a.subskill)) {
    const r = next[key] ?? START_RATING;
    next[key] = Math.round(r + k * (score - expectedScore(r, a.difficulty)));
  }
  return next;
}

/** The difficulty that suits a rating (the one the player gets right about 60–75% of the time). */
export function difficultyFor(rating: number): Difficulty {
  const d = Math.round((rating - 800) / 100) - 1;
  return Math.min(5, Math.max(1, d)) as Difficulty;
}
