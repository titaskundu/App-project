import type { Rng } from '../random';
import { APTITUDE_SUBSKILLS, generateAptitude, type AptitudeSubskill } from './aptitude';
import type { Difficulty, Question } from '../types';

/**
 * Mental Math questions made on the phone. The answer is always computed in code, so it can't
 * be wrong, and every answer is a whole number ≥ 0 (typed on the number keypad).
 */
export const ARITHMETIC_SUBSKILLS = ['addition', 'subtraction', 'multiplication', 'division', 'percentages', 'fractions', 'algebra'] as const;
type ArithmeticSubskill = (typeof ARITHMETIC_SUBSKILLS)[number];

/** Arithmetic + aptitude word problems (aptitude.ts). */
export const MATH_SUBSKILLS = [...ARITHMETIC_SUBSKILLS, ...APTITUDE_SUBSKILLS] as const;
export type MathSubskill = ArithmeticSubskill | AptitudeSubskill;

/** Number ranges per difficulty: [min, max] for the main operands. */
const RANGE: Record<Difficulty, [number, number]> = {
  1: [2, 12],
  2: [10, 40],
  3: [20, 99],
  4: [50, 250],
  5: [100, 999],
};

function q(subskill: ArithmeticSubskill, d: Difficulty, prompt: string, answer: number, explanation: string, rng: Rng): Question {
  return {
    id: `math-${subskill}-${d}-${rng.int(0, 1e9)}`,
    area: 'math',
    subskill,
    type: 'numeric',
    prompt,
    answer: String(answer),
    difficulty: d,
    explanation,
  };
}

export function generateMath(subskill: MathSubskill, d: Difficulty, rng: Rng): Question {
  if ((APTITUDE_SUBSKILLS as readonly string[]).includes(subskill)) return generateAptitude(subskill as AptitudeSubskill, d, rng);
  const sub = subskill as ArithmeticSubskill;
  const [lo, hi] = RANGE[d];
  switch (sub) {
    case 'addition': {
      const a = rng.int(lo, hi);
      const b = rng.int(lo, hi);
      return q(sub, d, `${a} + ${b} = ?`, a + b, `${a} + ${b} = ${a + b}`, rng);
    }
    case 'subtraction': {
      const a = rng.int(lo, hi);
      const b = rng.int(lo, hi);
      const [big, small] = a >= b ? [a, b] : [b, a];
      return q(sub, d, `${big} − ${small} = ?`, big - small, `${big} − ${small} = ${big - small}`, rng);
    }
    case 'multiplication': {
      // Keep one factor small so it stays "mental".
      const smallMax = [0, 9, 12, 15, 20, 25][d];
      const a = rng.int(2, smallMax);
      const b = rng.int(Math.max(2, Math.floor(lo / 2)), Math.max(12, Math.floor(hi / 4)));
      return q(sub, d, `${a} × ${b} = ?`, a * b, `${a} × ${b} = ${a * b}`, rng);
    }
    case 'division': {
      const divisorMax = [0, 9, 12, 15, 20, 25][d];
      const divisor = rng.int(2, divisorMax);
      const result = rng.int(2, Math.max(12, Math.floor(hi / 5)));
      const dividend = divisor * result;
      return q(sub, d, `${dividend} ÷ ${divisor} = ?`, result, `${divisor} × ${result} = ${dividend}`, rng);
    }
    case 'percentages': {
      // Percent values chosen so the answer is a whole number.
      const pcts = [[10, 50], [10, 20, 25, 50], [5, 15, 20, 25, 75], [5, 12, 15, 35, 60, 75], [3, 7, 12, 15, 35, 45, 65, 85]][d - 1];
      const p = rng.pick(pcts);
      // base must make p% whole: multiple of 100 / gcd(p, 100)
      const step = 100 / gcd(p, 100);
      const base = step * rng.int(Math.max(1, Math.ceil(lo / step)), Math.max(2, Math.ceil(hi * 2 / step)));
      const ans = (p * base) / 100;
      return q(sub, d, `${p}% of ${base} = ?`, ans, `${p}% of ${base} = ${base} × ${p} ÷ 100 = ${ans}`, rng);
    }
    case 'fractions': {
      const dens = [[2, 4], [2, 3, 4, 5], [3, 4, 5, 6, 8], [5, 6, 8, 9, 12], [7, 8, 9, 12, 15]][d - 1];
      const den = rng.pick(dens);
      const num = rng.int(1, den - 1);
      const base = den * rng.int(Math.max(2, Math.ceil(lo / den)), Math.max(3, Math.ceil(hi / den)));
      const ans = (num * base) / den;
      return q(sub, d, `${num}/${den} of ${base} = ?`, ans, `${base} ÷ ${den} = ${base / den}, × ${num} = ${ans}`, rng);
    }
    case 'algebra': {
      // ax + b = c, solved for x (x is a whole number ≥ 1).
      const x = rng.int(1, [0, 10, 15, 20, 30, 50][d]);
      const a = d <= 2 ? 1 : rng.int(2, [0, 0, 0, 5, 9, 12][d]);
      const b = rng.int(1, hi);
      const c = a * x + b;
      const lhs = a === 1 ? 'x' : `${a}x`;
      return q(sub, d, `${lhs} + ${b} = ${c}. What is x?`, x, `${lhs} = ${c} − ${b} = ${c - b}${a === 1 ? '' : `, so x = ${c - b} ÷ ${a} = ${x}`}`, rng);
    }
  }
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}
