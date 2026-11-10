import type { Rng } from '../random';
import type { Difficulty, Question } from '../types';

/**
 * More Logic & Patterns puzzles made on the phone (aptitude-test style). Answers are computed in
 * code from the same data that builds the question, so they're always consistent.
 */
export const PUZZLE_SUBSKILLS = ['coding-decoding', 'directions', 'letter-series', 'analogies', 'blood-relations', 'seating'] as const;
export type PuzzleSubskill = (typeof PUZZLE_SUBSKILLS)[number];

const ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const WORDS = ['CAT', 'DOG', 'SUN', 'BOOK', 'TREE', 'FISH', 'LAMP', 'STAR', 'MILK', 'BIRD', 'ROSE', 'CAKE', 'GAME', 'KING', 'DESK', 'RAIN', 'MOON', 'PLAN', 'WIND', 'GOLD', 'SHIP', 'TIME', 'HOME', 'NOTE', 'CODE'];
const PEOPLE = ['Asha', 'Ben', 'Chen', 'Dara', 'Eli', 'Fatima', 'Gus', 'Hana', 'Ivan', 'Juno'];

function mcq(sub: PuzzleSubskill, d: Difficulty, prompt: string, answer: string, options: string[], explanation: string, rng: Rng): Question {
  return { id: `logic-${sub}-${d}-${rng.int(0, 1e9)}`, area: 'logic', subskill: sub, type: 'mcq', prompt, options: rng.shuffle(options), answer, difficulty: d, explanation };
}

function num(sub: PuzzleSubskill, d: Difficulty, prompt: string, answer: number, explanation: string, rng: Rng): Question {
  return { id: `logic-${sub}-${d}-${rng.int(0, 1e9)}`, area: 'logic', subskill: sub, type: 'numeric', prompt, answer: String(answer), difficulty: d, explanation };
}

/** The answer plus wrong options from `pool`, all different, `count` in total. */
function withDistractors(answer: string, pool: string[], count: number, rng: Rng): string[] {
  const out = [answer];
  for (const p of rng.shuffle(pool)) {
    if (out.length >= count) break;
    if (!out.includes(p)) out.push(p);
  }
  return out;
}

export function generatePuzzle(sub: PuzzleSubskill, d: Difficulty, rng: Rng): Question {
  switch (sub) {
    case 'coding-decoding':
      return codingDecoding(d, rng);
    case 'directions':
      return directions(d, rng);
    case 'letter-series':
      return letterSeries(d, rng);
    case 'analogies':
      return analogies(d, rng);
    case 'blood-relations':
      return bloodRelations(d, rng);
    case 'seating':
      return seating(d, rng);
  }
}

// ---- coding-decoding --------------------------------------------------------

type Code = { name: string; apply: (w: string) => string; describe: string };

const shiftLetter = (c: string, k: number) => ABC[(ABC.indexOf(c) + k + 26 * 3) % 26];
const shift = (k: number): Code => ({
  name: `shift${k}`,
  apply: (w) => [...w].map((c) => shiftLetter(c, k)).join(''),
  describe: `each letter moves ${Math.abs(k)} place${Math.abs(k) > 1 ? 's' : ''} ${k > 0 ? 'forward' : 'back'} in the alphabet`,
});
const MIRROR: Code = { name: 'mirror', apply: (w) => [...w].map((c) => ABC[25 - ABC.indexOf(c)]).join(''), describe: 'each letter is swapped with its mirror (A↔Z, B↔Y, C↔X…)' };
const ALTERNATE: Code = {
  name: 'alternate',
  apply: (w) => [...w].map((c, i) => shiftLetter(c, i % 2 === 0 ? 1 : -1)).join(''),
  describe: 'letters move +1, −1, +1, −1… in turn',
};
const REVERSE_SHIFT: Code = { name: 'reverse+1', apply: (w) => shift(1).apply([...w].reverse().join('')), describe: 'the word is reversed, then each letter moves 1 forward' };

function codingDecoding(d: Difficulty, rng: Rng): Question {
  const code: Code =
    d === 1 ? shift(1) : d === 2 ? shift(rng.pick([2, -1])) : d === 3 ? shift(rng.pick([3, -2])) : d === 4 ? rng.pick([MIRROR, ALTERNATE]) : rng.pick([REVERSE_SHIFT, ALTERNATE, MIRROR]);
  const [w1, w2] = rng.shuffle(WORDS).slice(0, 2);
  const answer = code.apply(w2);
  const pool = [shift(1), shift(2), shift(-1), shift(3), MIRROR, ALTERNATE, REVERSE_SHIFT]
    .filter((c) => c.name !== code.name)
    .map((c) => c.apply(w2))
    .concat([[...answer].reverse().join('')]);
  return mcq(
    'coding-decoding',
    d,
    `In a code, ${w1} is written as ${code.apply(w1)}. How is ${w2} written?`,
    answer,
    withDistractors(answer, pool, 4, rng),
    `The rule: ${code.describe}. So ${w2} → ${answer}.`,
    rng
  );
}

// ---- directions -------------------------------------------------------------

const DIRS = ['North', 'East', 'South', 'West'];
const TRIPLES: [number, number, number][] = [[3, 4, 5], [6, 8, 10], [5, 12, 13], [9, 12, 15], [8, 15, 17], [12, 16, 20]];

function directions(d: Difficulty, rng: Rng): Question {
  if (d <= 2) {
    const start = rng.int(0, 3);
    const turns = Array.from({ length: d === 1 ? 1 : rng.int(2, 3) }, () => rng.pick(['right', 'left', 'around'] as const));
    let dir = start;
    for (const t of turns) dir = (dir + (t === 'right' ? 1 : t === 'left' ? 3 : 2)) % 4;
    const steps = turns.map((t) => (t === 'around' ? 'turns around' : `turns ${t}`)).join(', then ');
    return mcq(
      'directions',
      d,
      `Sam faces ${DIRS[start]}, then ${steps}. Which direction is Sam facing now?`,
      DIRS[dir],
      [...DIRS],
      `Right = a quarter turn clockwise, left = anticlockwise, around = half turn. ${DIRS[start]} → ${DIRS[dir]}.`,
      rng
    );
  }
  // Walks that end at a 3-4-5 style distance from the start, so the answer is a whole number.
  const [p, qv, h] = rng.pick(TRIPLES.slice(0, d === 3 ? 3 : 6));
  if (d === 3)
    return num('directions', d, `Riya walks ${p} km North, then turns right and walks ${qv} km. How far is she from where she started (km)?`, h, `She is ${p} km North and ${qv} km East of the start: √(${p}² + ${qv}²) = ${h} km.`, rng);
  const back = rng.int(1, 6);
  if (d === 4)
    return num(
      'directions',
      d,
      `Riya walks ${p + back} km North, turns right and walks ${qv} km, then turns right again and walks ${back} km. How far is she from the start (km)?`,
      h,
      `Net: ${p + back} − ${back} = ${p} km North and ${qv} km East, so √(${p}² + ${qv}²) = ${h} km.`,
      rng
    );
  const e1 = rng.int(1, qv - 1);
  return num(
    'directions',
    d,
    `Riya walks ${p + back} km North, turns right and walks ${e1} km, turns right and walks ${back} km, then turns left and walks ${qv - e1} km. How far is she from the start (km)?`,
    h,
    `Net: ${p} km North and ${e1} + ${qv - e1} = ${qv} km East, so √(${p}² + ${qv}²) = ${h} km.`,
    rng
  );
}

// ---- letter series ----------------------------------------------------------

function letterSeries(d: Difficulty, rng: Rng): Question {
  let idx: number[] = [];
  let rule = '';
  if (d <= 2) {
    const step = d === 1 ? rng.int(1, 2) : 3;
    const start = rng.int(0, 25 - step * 4);
    idx = Array.from({ length: 5 }, (_, i) => start + i * step);
    rule = `+${step} each time`;
  } else if (d === 3) {
    const step = rng.int(2, 3);
    const start = rng.int(step * 4, 25);
    idx = Array.from({ length: 5 }, (_, i) => start - i * step);
    rule = `back ${step} each time`;
  } else if (d === 4) {
    const start = rng.int(0, 15);
    idx = [start];
    for (let g = 1; idx.length < 5; g++) idx.push(idx[idx.length - 1] + g);
    rule = 'the gap grows: +1, +2, +3, +4';
  } else {
    // Two interleaved series: odd positions go up by a, even positions go up by b.
    const a = rng.int(1, 2);
    const b = rng.int(2, 3);
    const s1 = rng.int(0, 8);
    const s2 = rng.int(0, 8);
    idx = [s1, s2, s1 + a, s2 + b, s1 + 2 * a, s2 + 2 * b];
    rule = `two series take turns: one goes +${a}, the other +${b}`;
  }
  const letters = idx.map((i) => ABC[i]);
  const answer = letters[letters.length - 1];
  const ai = idx[idx.length - 1];
  const pool = [ai - 1, ai + 1, ai + 2, ai - 2].filter((i) => i >= 0 && i < 26).map((i) => ABC[i]);
  return mcq('letter-series', d, `What comes next?\n${letters.slice(0, -1).join(', ')}, ?`, answer, withDistractors(answer, pool, 4, rng), `Rule: ${rule}, so the next letter is ${answer}.`, rng);
}

// ---- number analogies -------------------------------------------------------

type Rule = { f: (n: number) => number; text: string };

function analogies(d: Difficulty, rng: Rng): Question {
  const k = rng.int(2, 5);
  const c = rng.int(2, 9);
  const rules: Rule[][] = [
    [{ f: (n) => n * k, text: `× ${k}` }, { f: (n) => n + c, text: `+ ${c}` }],
    [{ f: (n) => n * n, text: 'squared' }, { f: (n) => n * k + 1, text: `× ${k}, then + 1` }],
    [{ f: (n) => n * n * n, text: 'cubed' }, { f: (n) => n * n + 1, text: 'squared, then + 1' }],
    [{ f: (n) => n * (n + 1), text: 'n × (n + 1)' }, { f: (n) => n * n - n, text: 'n² − n' }],
    [{ f: (n) => n * n * n - 1, text: 'cubed, then − 1' }, { f: (n) => 2 * n * n + 1, text: '2n² + 1' }],
  ];
  const rule = rng.pick(rules[d - 1]);
  const [a1, a2, b] = rng.shuffle([2, 3, 4, 5, 6, 7, 8, 9].slice(0, d >= 3 ? 6 : 8)).slice(0, 3);
  const ans = rule.f(b);
  return num(
    'analogies',
    d,
    `Find the pattern:\n${a1} → ${rule.f(a1)}\n${a2} → ${rule.f(a2)}\n${b} → ?`,
    ans,
    `Each number is ${rule.text}: ${b} → ${ans}.`,
    rng
  );
}

// ---- blood relations --------------------------------------------------------

/** "P is the r1 of Q. R is the r2 of P (S is the r3 of R). How is R/S related to Q?" */
const TWO_STEP: [string, string, string][] = [
  ['father', 'sister', 'Aunt'],
  ['father', 'brother', 'Uncle'],
  ['mother', 'sister', 'Aunt'],
  ['mother', 'brother', 'Uncle'],
  ['mother', 'father', 'Grandfather'],
  ['father', 'mother', 'Grandmother'],
  ['brother', 'son', 'Nephew'],
  ['sister', 'daughter', 'Niece'],
  ['brother', 'daughter', 'Niece'],
  ['sister', 'son', 'Nephew'],
  ['son', 'son', 'Grandson'],
  ['daughter', 'daughter', 'Granddaughter'],
  ['son', 'daughter', 'Granddaughter'],
  ['uncle', 'son', 'Cousin'],
  ['aunt', 'daughter', 'Cousin'],
  ['brother', 'wife', 'Sister-in-law'],
  ['sister', 'husband', 'Brother-in-law'],
];
const THREE_STEP: [string, string, string, string][] = [
  ['father', 'brother', 'son', 'Cousin'],
  ['mother', 'sister', 'daughter', 'Cousin'],
  ['father', 'sister', 'son', 'Cousin'],
  ['mother', 'father', 'wife', 'Grandmother'],
  ['father', 'father', 'father', 'Great-grandfather'],
  ['son', 'son', 'son', 'Great-grandson'],
  ['brother', 'son', 'sister', 'Niece'],
];
const RELATION_POOL = ['Aunt', 'Uncle', 'Cousin', 'Niece', 'Nephew', 'Sister', 'Brother', 'Mother', 'Grandmother', 'Grandfather', 'Grandson', 'Granddaughter'];

function bloodRelations(d: Difficulty, rng: Rng): Question {
  const [P, Q, R, S] = rng.shuffle(['P', 'Q', 'R', 'S', 'M', 'N', 'K']).slice(0, 4);
  if (d <= 3) {
    const [r1, r2, ans] = rng.pick(TWO_STEP);
    return mcq(
      'blood-relations',
      d,
      `${P} is the ${r1} of ${Q}. ${R} is the ${r2} of ${P}. How is ${R} related to ${Q}?`,
      ans,
      withDistractors(ans, RELATION_POOL, 4, rng),
      `${R} is ${Q}'s ${r1}'s ${r2}, which makes ${R} ${Q}'s ${ans.toLowerCase()}.`,
      rng
    );
  }
  const [r1, r2, r3, ans] = rng.pick(THREE_STEP);
  return mcq(
    'blood-relations',
    d,
    `${P} is the ${r1} of ${Q}. ${R} is the ${r2} of ${P}. ${S} is the ${r3} of ${R}. How is ${S} related to ${Q}?`,
    ans,
    withDistractors(ans, [...RELATION_POOL, 'Great-grandson', 'Great-grandfather'], 4, rng),
    `${S} is ${Q}'s ${r1}'s ${r2}'s ${r3}: ${Q}'s ${ans.toLowerCase()}.`,
    rng
  );
}

// ---- seating ----------------------------------------------------------------

function seating(d: Difficulty, rng: Rng): Question {
  const n = d <= 2 ? 3 : d <= 4 ? 4 : 5;
  const row = rng.shuffle(PEOPLE).slice(0, n); // row[0] is the left end
  const fromLeft = rng.next() < 0.5;
  const clues: string[] = [fromLeft ? `${row[0]} sits at the left end.` : `${row[n - 1]} sits at the right end.`];
  for (let i = 0; i < n - 1; i++) {
    const [l, r] = [row[i], row[i + 1]];
    clues.push(rng.next() < 0.5 ? `${r} sits immediately to the right of ${l}.` : `${l} sits immediately to the left of ${r}.`);
  }
  const shown = rng.shuffle(clues);
  let ask: string;
  let answer: string;
  if (n % 2 === 1 && rng.next() < 0.5) {
    ask = 'Who sits in the middle?';
    answer = row[(n - 1) / 2];
  } else if (rng.next() < 0.5) {
    ask = fromLeft ? 'Who sits at the right end?' : 'Who sits at the left end?';
    answer = fromLeft ? row[n - 1] : row[0];
  } else {
    ask = 'Who sits second from the left?';
    answer = row[1];
  }
  // Wrong options come from the people in the row first (outsiders only to fill up a row of 3).
  const options = [answer, ...rng.shuffle(row.filter((p) => p !== answer)), ...rng.shuffle(PEOPLE.filter((p) => !row.includes(p)))].slice(0, 4);
  return mcq('seating', d, `${n} friends sit in a row, all facing North. ${shown.join(' ')}\n${ask}`, answer, options, `From left to right: ${row.join(', ')}.`, rng);
}
