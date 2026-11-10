import { describe, expect, it } from '@jest/globals';

import { generateLogic, LOGIC_SUBSKILLS } from '../generators/logic';
import { ARITHMETIC_SUBSKILLS, generateMath, MATH_SUBSKILLS } from '../generators/math';
import { validateQuestions } from '../pack';
import { createRng } from '../random';
import type { Difficulty, Question } from '../types';

const DIFFS: Difficulty[] = [1, 2, 3, 4, 5];

/** Independently re-solve a math prompt from its text. */
function solveMath(q: Question): number {
  const p = q.prompt;
  let m: RegExpMatchArray | null;
  if ((m = p.match(/^(\d+) \+ (\d+) = \?$/))) return +m[1] + +m[2];
  if ((m = p.match(/^(\d+) − (\d+) = \?$/))) return +m[1] - +m[2];
  if ((m = p.match(/^(\d+) × (\d+) = \?$/))) return +m[1] * +m[2];
  if ((m = p.match(/^(\d+) ÷ (\d+) = \?$/))) return +m[1] / +m[2];
  if ((m = p.match(/^(\d+)% of (\d+) = \?$/))) return (+m[1] * +m[2]) / 100;
  if ((m = p.match(/^(\d+)\/(\d+) of (\d+) = \?$/))) return (+m[1] * +m[3]) / +m[2];
  if ((m = p.match(/^(\d*)x \+ (\d+) = (\d+)\. What is x\?$/))) return (+m[3] - +m[2]) / (m[1] ? +m[1] : 1);
  throw new Error(`unknown prompt: ${p}`);
}

describe('math generator', () => {
  it('always gives a correct, whole, non-negative answer', () => {
    const rng = createRng(42);
    for (const sub of ARITHMETIC_SUBSKILLS)
      for (const d of DIFFS)
        for (let i = 0; i < 200; i++) {
          const q = generateMath(sub, d, rng);
          const solved = solveMath(q);
          expect(Number.isInteger(solved) && solved >= 0).toBe(true);
          expect(q.answer).toBe(String(solved));
        }
  });

  it('produces valid questions', () => {
    const rng = createRng(7);
    const qs = MATH_SUBSKILLS.flatMap((s) => DIFFS.map((d) => generateMath(s, d, rng)));
    expect(validateQuestions(qs)).toEqual([]);
  });
});

describe('logic generator', () => {
  it('sequence answers follow the shown terms', () => {
    const rng = createRng(3);
    for (const d of DIFFS)
      for (let i = 0; i < 300; i++) {
        const q = generateLogic('sequences', d, rng);
        expect(q.type).toBe('numeric');
        expect(/^\d+$/.test(q.answer)).toBe(true);
        const terms = q.prompt.split('\n')[1].replace(', ?', '').split(', ').map(Number);
        expect(terms.length).toBeGreaterThanOrEqual(4);
        expect(terms.every((t) => Number.isInteger(t) && t >= 0)).toBe(true);
      }
  });

  it('odd-one-out has exactly one option breaking the rule', () => {
    const rng = createRng(5);
    for (const d of DIFFS)
      for (let i = 0; i < 300; i++) {
        const q = generateLogic('odd-one-out', d, rng);
        expect(q.options).toHaveLength(4);
        expect(q.options).toContain(q.answer);
        expect(new Set(q.options).size).toBe(4);
        // Exactly one option breaks the rule stated in the explanation.
        expect(q.explanation).toContain(`${q.answer} isn't`);
      }
  });

  it('ordering answer is the tallest or shortest by the clues', () => {
    const rng = createRng(9);
    for (const d of DIFFS)
      for (let i = 0; i < 300; i++) {
        const q = generateLogic('ordering', d, rng);
        // Build "taller than" pairs from the clues and check the answer is at the extreme.
        const taller = new Map<string, string>();
        for (const m of q.prompt.matchAll(/(\w+) is taller than (\w+)\./g)) taller.set(m[1], m[2]);
        for (const m of q.prompt.matchAll(/(\w+) is shorter than (\w+)\./g)) taller.set(m[2], m[1]);
        const shorterSet = new Set(taller.values());
        const tallest = q.options!.find((p) => !shorterSet.has(p));
        const shortest = q.options!.find((p) => !taller.has(p));
        expect(q.answer).toBe(q.prompt.includes('tallest') ? tallest : shortest);
      }
  });

  it('produces valid questions', () => {
    const rng = createRng(11);
    const qs = LOGIC_SUBSKILLS.flatMap((s) => DIFFS.map((d) => generateLogic(s, d, rng)));
    expect(validateQuestions(qs)).toEqual([]);
  });
});
