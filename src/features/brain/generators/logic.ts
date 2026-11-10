import type { Rng } from '../random';
import { generatePuzzle, PUZZLE_SUBSKILLS, type PuzzleSubskill } from './puzzles';
import type { Difficulty, Question } from '../types';

/**
 * Logic & Patterns questions made on the phone; answers are computed in code.
 * - sequences:   "2, 5, 8, 11, ?" (numeric keypad)
 * - odd-one-out: one number breaks the rule (multiple choice)
 * - ordering:    "A is taller than B…" who is tallest/shortest (multiple choice)
 */
const CORE_SUBSKILLS = ['sequences', 'odd-one-out', 'ordering'] as const;
type CoreSubskill = (typeof CORE_SUBSKILLS)[number];

/** Core patterns + aptitude-style puzzles (puzzles.ts). */
export const LOGIC_SUBSKILLS = [...CORE_SUBSKILLS, ...PUZZLE_SUBSKILLS] as const;
export type LogicSubskill = CoreSubskill | PuzzleSubskill;

const NAMES = ['Asha', 'Ben', 'Chen', 'Dara', 'Eli', 'Fatima', 'Gus', 'Hana', 'Ivan', 'Juno'];

function id(sub: string, d: number, rng: Rng) {
  return `logic-${sub}-${d}-${rng.int(0, 1e9)}`;
}

export function generateLogic(subskill: LogicSubskill, d: Difficulty, rng: Rng): Question {
  if ((PUZZLE_SUBSKILLS as readonly string[]).includes(subskill)) return generatePuzzle(subskill as PuzzleSubskill, d, rng);
  switch (subskill as CoreSubskill) {
    case 'sequences':
      return sequence(d, rng);
    case 'odd-one-out':
      return oddOneOut(d, rng);
    case 'ordering':
      return ordering(d, rng);
  }
}

function sequence(d: Difficulty, rng: Rng): Question {
  const kinds: ('add' | 'mul' | 'square' | 'fib' | 'alt' | 'growing')[] = (
    [['add'], ['add', 'mul'], ['add', 'mul', 'square', 'growing'], ['mul', 'square', 'fib', 'alt', 'growing'], ['fib', 'alt', 'growing', 'square']] as const
  )[d - 1].slice();
  const kind = rng.pick(kinds);
  let terms: number[] = [];
  let rule = '';
  switch (kind) {
    case 'add': {
      const start = rng.int(1, 20 * d);
      const step = rng.int(2, 4 + 3 * d);
      terms = Array.from({ length: 5 }, (_, i) => start + i * step);
      rule = `add ${step} each time`;
      break;
    }
    case 'mul': {
      const start = rng.int(1, 5);
      const k = rng.int(2, d >= 4 ? 4 : 3);
      terms = Array.from({ length: 5 }, (_, i) => start * k ** i);
      rule = `multiply by ${k} each time`;
      break;
    }
    case 'square': {
      const s = rng.int(1, 6);
      terms = Array.from({ length: 5 }, (_, i) => (s + i) ** 2);
      rule = `square numbers: ${s}², ${s + 1}², …`;
      break;
    }
    case 'fib': {
      const a = rng.int(1, 5);
      const b = rng.int(a, 8);
      terms = [a, b];
      while (terms.length < 6) terms.push(terms[terms.length - 1] + terms[terms.length - 2]);
      rule = 'each number is the sum of the two before it';
      break;
    }
    case 'alt': {
      const start = rng.int(5, 30);
      const up = rng.int(3, 9);
      const down = rng.int(1, up - 1);
      terms = [start];
      while (terms.length < 6) terms.push(terms.length % 2 === 1 ? terms[terms.length - 1] + up : terms[terms.length - 1] - down);
      rule = `alternately add ${up} and subtract ${down}`;
      break;
    }
    case 'growing': {
      const start = rng.int(1, 10);
      const step = rng.int(1, 3);
      terms = [start];
      for (let i = 1; terms.length < 6; i++) terms.push(terms[terms.length - 1] + i * step);
      rule = `the gap grows by ${step} each time`;
      break;
    }
  }
  const shown = terms.slice(0, -1);
  const answer = terms[terms.length - 1];
  return {
    id: id('sequences', d, rng),
    area: 'logic',
    subskill: 'sequences',
    type: 'numeric',
    prompt: `What comes next?\n${shown.join(', ')}, ?`,
    answer: String(answer),
    difficulty: d,
    explanation: `Rule: ${rule}, so the next number is ${answer}.`,
  };
}

function oddOneOut(d: Difficulty, rng: Rng): Question {
  // Three numbers follow a rule, one doesn't.
  const rules = [
    { name: 'even', test: (n: number) => n % 2 === 0, make: () => 2 * rng.int(2, 10 * d), odd: () => 2 * rng.int(2, 10 * d) + 1 },
    { name: 'multiples of 3', test: (n: number) => n % 3 === 0, make: () => 3 * rng.int(2, 8 * d), odd: () => 3 * rng.int(2, 8 * d) + rng.int(1, 2) },
    { name: 'multiples of 4', test: (n: number) => n % 4 === 0, make: () => 4 * rng.int(2, 6 * d), odd: () => 4 * rng.int(2, 6 * d) + rng.int(1, 3) },
    { name: 'multiples of 7', test: (n: number) => n % 7 === 0, make: () => 7 * rng.int(2, 5 * d), odd: () => 7 * rng.int(2, 5 * d) + rng.int(1, 6) },
    { name: 'square numbers', test: (n: number) => Number.isInteger(Math.sqrt(n)), make: () => rng.int(2, 12) ** 2, odd: () => rng.int(2, 11) ** 2 + rng.int(1, 2) },
  ].slice(0, Math.min(5, d + 1));
  const rule = rng.pick(rules);
  const good = new Set<number>();
  while (good.size < 3) good.add(rule.make());
  let odd = rule.odd();
  while (rule.test(odd) || good.has(odd)) odd = rule.odd();
  const options = rng.shuffle([...good, odd].map(String));
  return {
    id: id('odd-one-out', d, rng),
    area: 'logic',
    subskill: 'odd-one-out',
    type: 'mcq',
    prompt: 'Which number is the odd one out?',
    options,
    answer: String(odd),
    difficulty: d,
    explanation: `The others are all ${rule.name}; ${odd} isn't.`,
  };
}

function ordering(d: Difficulty, rng: Rng): Question {
  const count = Math.min(5, 2 + Math.ceil(d / 2)); // 3, 3, 4, 4, 5 people
  const people = rng.shuffle(NAMES).slice(0, count); // people[0] is tallest … last is shortest
  // Clues: each adjacent pair, shuffled, always phrased "X is taller than Y" or "Y is shorter than X".
  const clues = rng.shuffle(
    people.slice(0, -1).map((p, i) => {
      const next = people[i + 1];
      return rng.next() < 0.5 ? `${p} is taller than ${next}.` : `${next} is shorter than ${p}.`;
    })
  );
  const askTallest = rng.next() < 0.5;
  const answer = askTallest ? people[0] : people[people.length - 1];
  return {
    id: id('ordering', d, rng),
    area: 'logic',
    subskill: 'ordering',
    type: 'mcq',
    prompt: `${clues.join(' ')}\nWho is the ${askTallest ? 'tallest' : 'shortest'}?`,
    options: rng.shuffle(people),
    answer,
    difficulty: d,
    explanation: `From tallest to shortest: ${people.join(' > ')}.`,
  };
}
