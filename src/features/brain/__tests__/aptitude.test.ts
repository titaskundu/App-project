import { describe, expect, it } from '@jest/globals';

import { APTITUDE_SUBSKILLS, generateAptitude } from '../generators/aptitude';
import { generatePuzzle, PUZZLE_SUBSKILLS } from '../generators/puzzles';
import { validateQuestions } from '../pack';
import { createRng } from '../random';
import type { Difficulty, Question } from '../types';

const DIFFS: Difficulty[] = [1, 2, 3, 4, 5];
const N = 300;

/** Re-solve an aptitude prompt from its text, with code that doesn't share anything with the generator. */
function solveAptitude(p: string): number {
  const n = (re: RegExp) => {
    const m = p.match(re);
    return m ? m.slice(1).map((x) => (/^\d+$/.test(x) ? Number(x) : NaN)) : null;
  };
  let m: number[] | null;
  if ((m = n(/travels at (\d+) km\/h for (\d+) hours/))) return m[0] * m[1];
  if ((m = n(/covers (\d+) km in (\d+) hours/))) return m[0] / m[1];
  if ((m = n(/rides (\d+) km at (\d+) km\/h/))) return m[0] / m[1];
  if ((m = n(/speed is (\d+) km\/h\. What is it in metres/))) return (m[0] * 1000) / 3600;
  if ((m = n(/start (\d+) km apart .* at (\d+) km\/h and (\d+) km\/h/))) return m[0] / (m[1] + m[2]);
  if ((m = n(/to B at (\d+) km\/h and comes back the same way at (\d+) km\/h/))) {
    const dist = 1; // any distance; time there + back
    return (2 * dist) / (dist / m[0] + dist / m[1]);
  }
  if ((m = n(/finishes (\d+) walls a day\. How many days to paint (\d+)/))) return m[1] / m[0];
  if ((m = n(/^(\d+) workers finish a job in (\d+) days\. How many days would (\d+) workers/))) return (m[0] * m[1]) / m[2];
  if ((m = n(/^(\d+) workers finish a job in (\d+) days\. How many days would one worker/))) return m[0] * m[1];
  if ((m = n(/in (\d+) days and B in (\d+) days/))) return 1 / (1 / m[0] + 1 / m[1]);
  if ((m = n(/marked ₹(\d+)\. With a (\d+)% discount/))) return m[0] - (m[0] * m[1]) / 100;
  if ((m = n(/bought for ₹(\d+) and sold at a (\d+)% profit/))) return m[0] + (m[0] * m[1]) / 100;
  if ((m = n(/bought for ₹(\d+) and sold at a (\d+)% loss/))) return m[0] - (m[0] * m[1]) / 100;
  if ((m = n(/bought for ₹(\d+) and sold for ₹(\d+)\. What is the profit percentage/))) return ((m[1] - m[0]) / m[0]) * 100;
  if ((m = n(/marked ₹(\d+) gets (\d+)% off, then a further (\d+)% off/))) return m[0] * (1 - m[1] / 100) * (1 - m[2] / 100);
  if ((m = n(/simple interest on ₹(\d+) at (\d+)% a year for (\d+) year/))) return (m[0] * m[1] * m[2]) / 100;
  if ((m = n(/₹(\d+) is invested at (\d+)% simple interest a year\. What is the total amount after (\d+)/))) return m[0] * (1 + (m[1] * m[2]) / 100);
  if ((m = n(/₹(\d+) earns ₹(\d+) simple interest in (\d+) years/))) return (m[1] * 100) / (m[0] * m[2]);
  if ((m = n(/₹(\d+) is invested at (\d+)% a year, compounded yearly/))) return m[0] * (1 + m[1] / 100) ** 2 - m[0];
  if ((m = n(/₹(\d+) is shared in the ratio (\d+) : (\d+)\. How much is the larger/))) return (m[0] * Math.max(m[1], m[2])) / (m[1] + m[2]);
  const three = p.match(/₹(\d+) is shared among A, B and C in the ratio (\d+) : (\d+) : (\d+)\. How much does ([ABC])/);
  if (three) {
    const parts = [+three[2], +three[3], +three[4]];
    return (+three[1] * parts['ABC'.indexOf(three[5])]) / (parts[0] + parts[1] + parts[2]);
  }
  if ((m = n(/boys to girls in a class is (\d+) : (\d+)\. There are (\d+) boys/))) return (m[2] / m[0]) * m[1];
  if ((m = n(/savings are in the ratio (\d+) : (\d+)\. A has ₹(\d+) more/))) return (m[2] / (m[0] - m[1])) * m[1];
  const avgOf = p.match(/^What is the average of ([\d, ]+)\?$/);
  if (avgOf) {
    const xs = avgOf[1].split(', ').map(Number);
    return xs.reduce((a, b) => a + b, 0) / xs.length;
  }
  const missing = p.match(/average of (\d+) numbers is (\d+)\. \d+ of them are ([\d, ]+)\. What is the last/);
  if (missing) return +missing[1] * +missing[2] - missing[3].split(', ').map(Number).reduce((a, b) => a + b, 0);
  if ((m = n(/average age of (\d+) players is (\d+)\. When a coach joins, the average becomes (\d+)/))) return (m[0] + 1) * m[2] - m[0] * m[1];
  if ((m = n(/Mia is (\d+)\. Leo is (\d+) years older\. How old will Leo be in (\d+)/))) return m[0] + m[1] + m[2];
  if ((m = n(/add up to (\d+), and one is (\d+) years older/))) return (m[0] + m[1]) / 2;
  if ((m = n(/father is (\d+) times as old as his son, who is (\d+)\. How old will the father be in (\d+)/))) return m[0] * m[1] + m[2];
  if ((m = n(/Ana is (\d+) times as old as Ben\. In (\d+) years, Ana will be twice/))) return m[1] / (m[0] - 2);
  throw new Error(`no solver for: ${p}`);
}

describe('aptitude generator (Mental Math)', () => {
  it('every answer is whole, ≥ 0 and matches an independent solution', () => {
    const rng = createRng(101);
    for (const sub of APTITUDE_SUBSKILLS)
      for (const d of DIFFS)
        for (let i = 0; i < N; i++) {
          const q = generateAptitude(sub, d, rng);
          const solved = solveAptitude(q.prompt);
          expect(Math.abs(solved - Math.round(solved))).toBeLessThan(1e-9);
          expect(Math.round(solved)).toBeGreaterThanOrEqual(0);
          expect(q.answer).toBe(String(Math.round(solved)));
        }
  });

  it('produces valid questions', () => {
    const rng = createRng(102);
    const qs = APTITUDE_SUBSKILLS.flatMap((s) => DIFFS.map((d) => generateAptitude(s, d, rng)));
    expect(validateQuestions(qs)).toEqual([]);
  });
});

// ---- independent puzzle checkers ---------------------------------------------

const ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const sh = (w: string, k: number) => [...w].map((c) => ABC[(ABC.indexOf(c) + k + 78) % 26]).join('');
const CODE_RULES: ((w: string) => string)[] = [
  ...[-3, -2, -1, 1, 2, 3].map((k) => (w: string) => sh(w, k)),
  (w) => [...w].map((c) => ABC[25 - ABC.indexOf(c)]).join(''),
  (w) => [...w].map((c, i) => sh(c, i % 2 === 0 ? 1 : -1)).join(''),
  (w) => sh([...w].reverse().join(''), 1),
];

function checkCoding(q: Question) {
  const m = q.prompt.match(/^In a code, (\w+) is written as (\w+)\. How is (\w+) written\?$/)!;
  const predictions = new Set(CODE_RULES.filter((r) => r(m[1]) === m[2]).map((r) => r(m[3])));
  // Exactly one possible answer, and it's the stored one.
  expect([...predictions]).toEqual([q.answer]);
}

function checkDirections(q: Question) {
  const DIRS = ['North', 'East', 'South', 'West'];
  if (q.type === 'mcq') {
    const start = q.prompt.match(/faces (\w+)/)![1];
    let dir = DIRS.indexOf(start);
    for (const t of q.prompt.matchAll(/turns (right|left|around)/g)) dir = (dir + { right: 1, left: 3, around: 2 }[t[1] as 'right'] + 4) % 4;
    expect(q.answer).toBe(DIRS[dir]);
    return;
  }
  // Walk: starts facing North; each "turns right/left" turns, each "walks X km" moves.
  let dir = 0;
  let x = 0;
  let y = 0;
  for (const t of q.prompt.matchAll(/turns (right|left)|walks (\d+) km/g)) {
    if (t[1]) dir = (dir + (t[1] === 'right' ? 1 : 3)) % 4;
    else {
      const km = Number(t[2]);
      x += [0, km, 0, -km][dir];
      y += [km, 0, -km, 0][dir];
    }
  }
  expect(Number(q.answer)).toBeCloseTo(Math.hypot(x, y), 9);
}

function checkLetterSeries(q: Question) {
  const xs = q.prompt.split('\n')[1].replace(', ?', '').split(', ').map((c) => ABC.indexOf(c));
  const diffs = xs.slice(1).map((v, i) => v - xs[i]);
  const predictions = new Set<number>();
  if (diffs.every((d) => d === diffs[0])) predictions.add(xs[xs.length - 1] + diffs[0]);
  if (diffs.every((d, i) => i === 0 || d === diffs[i - 1] + 1)) predictions.add(xs[xs.length - 1] + diffs[diffs.length - 1] + 1);
  if (xs.length >= 5) {
    const evens = xs.filter((_, i) => i % 2 === 0);
    const odds = xs.filter((_, i) => i % 2 === 1);
    const steady = (a: number[]) => a.every((v, i) => i === 0 || v - a[i - 1] === a[1] - a[0]);
    if (steady(evens) && steady(odds)) {
      const next = xs.length % 2 === 0 ? evens : odds;
      predictions.add(next[next.length - 1] + (next[1] - next[0]));
    }
  }
  expect([...predictions].map((i) => ABC[i])).toEqual([q.answer]);
}

function checkAnalogy(q: Question) {
  const pairs = [...q.prompt.matchAll(/^(\d+) → (\d+)$/gm)].map((m) => [Number(m[1]), Number(m[2])]);
  const b = Number(q.prompt.match(/^(\d+) → \?$/m)![1]);
  const rules: ((n: number) => number)[] = [];
  for (let k = 2; k <= 5; k++) rules.push((n) => n * k, (n) => n * k + 1);
  for (let c = 2; c <= 9; c++) rules.push((n) => n + c);
  rules.push((n) => n * n, (n) => n ** 3, (n) => n * n + 1, (n) => n * (n + 1), (n) => n * n - n, (n) => n ** 3 - 1, (n) => 2 * n * n + 1);
  const predictions = new Set(rules.filter((f) => pairs.every(([a, fa]) => f(a) === fa)).map((f) => f(b)));
  expect([...predictions]).toEqual([Number(q.answer)]);
}

function checkSeating(q: Question) {
  const right = new Map<string, string>(); // person → who sits immediately to their right
  for (const m of q.prompt.matchAll(/(\w+) sits immediately to the right of (\w+)\./g)) right.set(m[2], m[1]);
  for (const m of q.prompt.matchAll(/(\w+) sits immediately to the left of (\w+)\./g)) right.set(m[1], m[2]);
  const hasLeft = new Set(right.values());
  const leftEnd = [...right.keys()].find((p) => !hasLeft.has(p))!;
  const row = [leftEnd];
  while (right.has(row[row.length - 1])) row.push(right.get(row[row.length - 1])!);
  const end = q.prompt.match(/(\w+) sits at the (left|right) end\./)!;
  expect(end[2] === 'left' ? row[0] : row[row.length - 1]).toBe(end[1]);
  const ask = q.prompt.split('\n')[1];
  const expected = ask.includes('middle')
    ? row[(row.length - 1) / 2]
    : ask.includes('right end')
      ? row[row.length - 1]
      : ask.includes('left end')
        ? row[0]
        : row[1];
  expect(q.answer).toBe(expected);
}

describe('puzzle generator (Logic & Patterns)', () => {
  it('every puzzle has exactly one correct answer, and it is the stored one', () => {
    const rng = createRng(202);
    for (const d of DIFFS)
      for (let i = 0; i < N; i++) {
        checkCoding(generatePuzzle('coding-decoding', d, rng));
        checkDirections(generatePuzzle('directions', d, rng));
        checkLetterSeries(generatePuzzle('letter-series', d, rng));
        checkAnalogy(generatePuzzle('analogies', d, rng));
        checkSeating(generatePuzzle('seating', d, rng));
        const rel = generatePuzzle('blood-relations', d, rng);
        expect(rel.options).toContain(rel.answer);
      }
  });

  it('produces valid questions (options unique, answer among them)', () => {
    const rng = createRng(203);
    for (let i = 0; i < 50; i++) {
      const qs = PUZZLE_SUBSKILLS.flatMap((s) => DIFFS.map((d) => generatePuzzle(s, d, rng)));
      expect(validateQuestions(qs)).toEqual([]);
    }
  });
});
