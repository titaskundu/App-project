import { generateLogic, LOGIC_SUBSKILLS } from './generators/logic';
import { generateMath, MATH_SUBSKILLS } from './generators/math';
import { STARTER_PACK } from './pack';
import type { Rng } from './random';
import { difficultyFor, ratingKeys, START_RATING, type Ratings } from './rating';
import type { Area, Difficulty, Question } from './types';

/**
 * Picks the next question for a player:
 *  1. an area from the ones they picked, leaning toward their weakest area;
 *  2. a subskill inside it, leaning toward their weakest subskill;
 *  3. a difficulty that suits their rating (+ `bump` on repeat tolls);
 *  4. a question: generated (math, logic) or from the starter pack (not seen recently).
 */
export type SelectInput = {
  areas: Area[];
  ratings: Ratings;
  /** Extra difficulty steps (repeat tolls). */
  bump?: number;
  /** Question ids seen recently or earlier in this session, to avoid repeats. */
  seen?: Set<string>;
  rng: Rng;
};

export function subskillsFor(area: Area): string[] {
  if (area === 'math') return [...MATH_SUBSKILLS];
  if (area === 'logic') return [...LOGIC_SUBSKILLS];
  return [...new Set((STARTER_PACK[area] ?? []).map((q) => q.subskill))];
}

/** Weighted pick: lower rating → higher chance (weight = 1 + how far below 1200 it is). */
function pickWeak<T>(items: T[], ratingOf: (item: T) => number, rng: Rng): T {
  const weights = items.map((it) => 1 + Math.max(0, 1200 - ratingOf(it)) / 100);
  let roll = rng.next() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < items.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return items[i];
  }
  return items[items.length - 1];
}

export function nextQuestion({ areas, ratings, bump = 0, seen = new Set(), rng }: SelectInput): Question {
  const pool = areas.length ? areas : (['math'] as Area[]);
  const area = pickWeak(pool, (a) => ratings[a] ?? START_RATING, rng);
  const subskill = pickWeak(subskillsFor(area), (s) => ratings[ratingKeys(area, s)[1]] ?? START_RATING, rng);
  const rating = ratings[ratingKeys(area, subskill)[1]] ?? ratings[area] ?? START_RATING;
  const difficulty = Math.min(5, difficultyFor(rating) + bump) as Difficulty;

  let q: Question;
  if (area === 'math') q = generateMath(subskill as (typeof MATH_SUBSKILLS)[number], difficulty, rng);
  else if (area === 'logic') q = generateLogic(subskill as (typeof LOGIC_SUBSKILLS)[number], difficulty, rng);
  else q = fromPack(area, subskill, difficulty, seen, rng);

  // Shuffle multiple-choice options so the right answer isn't always first.
  return q.options ? { ...q, options: rng.shuffle(q.options) } : q;
}

/** Closest-difficulty unseen pack question, preferring the chosen subskill. */
function fromPack(area: Area, subskill: string, difficulty: Difficulty, seen: Set<string>, rng: Rng): Question {
  const all = STARTER_PACK[area] ?? [];
  const unseen = all.filter((q) => !seen.has(q.id));
  const candidates = unseen.length ? unseen : all; // everything seen: allow repeats
  const score = (q: Question) => Math.abs(q.difficulty - difficulty) * 2 + (q.subskill === subskill ? 0 : 1);
  const best = Math.min(...candidates.map(score));
  return rng.pick(candidates.filter((q) => score(q) === best));
}
