import type { Rng } from '../random';
import type { Difficulty, Question } from '../types';

/**
 * Aptitude word problems for Mental Math, made on the phone. Like the arithmetic templates, the
 * numbers are picked so the answer is a whole number ≥ 0, and the answer is computed in code.
 */
export const APTITUDE_SUBSKILLS = [
  'speed-distance',
  'work-time',
  'profit-loss',
  'interest',
  'ratios',
  'averages',
  'ages',
] as const;
export type AptitudeSubskill = (typeof APTITUDE_SUBSKILLS)[number];

const RS = '₹';

function q(sub: AptitudeSubskill, d: Difficulty, prompt: string, answer: number, explanation: string, rng: Rng): Question {
  return {
    id: `math-${sub}-${d}-${rng.int(0, 1e9)}`,
    area: 'math',
    subskill: sub,
    type: 'numeric',
    prompt,
    answer: String(answer),
    difficulty: d,
    explanation,
  };
}

export function generateAptitude(sub: AptitudeSubskill, d: Difficulty, rng: Rng): Question {
  switch (sub) {
    case 'speed-distance':
      return speed(d, rng);
    case 'work-time':
      return work(d, rng);
    case 'profit-loss':
      return profit(d, rng);
    case 'interest':
      return interest(d, rng);
    case 'ratios':
      return ratios(d, rng);
    case 'averages':
      return averages(d, rng);
    case 'ages':
      return ages(d, rng);
  }
}

function speed(d: Difficulty, rng: Rng): Question {
  const sub = 'speed-distance';
  if (d <= 2) {
    const s = rng.pick(d === 1 ? [20, 30, 40, 50, 60] : [35, 45, 55, 65, 72, 80]);
    const t = rng.int(2, d === 1 ? 4 : 6);
    const dist = s * t;
    const ask = rng.int(0, 2);
    if (ask === 0)
      return q(sub, d, `A car travels at ${s} km/h for ${t} hours. How many km does it cover?`, dist, `Distance = speed × time = ${s} × ${t} = ${dist} km.`, rng);
    if (ask === 1)
      return q(sub, d, `A bus covers ${dist} km in ${t} hours. What is its speed in km/h?`, s, `Speed = distance ÷ time = ${dist} ÷ ${t} = ${s} km/h.`, rng);
    return q(sub, d, `A cyclist rides ${dist} km at ${s} km/h. How many hours does it take?`, t, `Time = distance ÷ speed = ${dist} ÷ ${s} = ${t} hours.`, rng);
  }
  if (d === 3) {
    const kmh = 18 * rng.int(2, 6);
    const ms = (kmh * 5) / 18;
    return q(sub, d, `A runner's speed is ${kmh} km/h. What is it in metres per second?`, ms, `km/h × 5/18 = m/s: ${kmh} × 5 ÷ 18 = ${ms} m/s.`, rng);
  }
  if (d === 4) {
    const s1 = 10 * rng.int(3, 7);
    const s2 = 10 * rng.int(2, 6);
    const t = rng.int(2, 5);
    const dist = (s1 + s2) * t;
    return q(
      sub,
      d,
      `Two trains start ${dist} km apart and move towards each other at ${s1} km/h and ${s2} km/h. After how many hours do they meet?`,
      t,
      `They close the gap at ${s1} + ${s2} = ${s1 + s2} km/h, so ${dist} ÷ ${s1 + s2} = ${t} hours.`,
      rng
    );
  }
  // Average speed over two equal distances = 2ab / (a + b); pairs chosen to give whole numbers.
  const [a, b] = rng.pick([[40, 60], [30, 60], [20, 30], [60, 90], [45, 90], [40, 120], [30, 90], [36, 45]] as const);
  const avg = (2 * a * b) / (a + b);
  return q(
    sub,
    d,
    `A car goes from A to B at ${a} km/h and comes back the same way at ${b} km/h. What is its average speed for the whole trip (km/h)?`,
    avg,
    `For equal distances, average speed = 2 × ${a} × ${b} ÷ (${a} + ${b}) = ${avg} km/h (not the simple average).`,
    rng
  );
}

function work(d: Difficulty, rng: Rng): Question {
  const sub = 'work-time';
  if (d === 1) {
    const r = rng.int(2, 6);
    const n = rng.int(3, 9);
    return q(sub, d, `A painter finishes ${r} walls a day. How many days to paint ${r * n} walls?`, n, `${r * n} ÷ ${r} = ${n} days.`, rng);
  }
  if (d === 2) {
    const m = rng.int(2, 6);
    const days = rng.int(3, 12);
    const total = m * days;
    const others = [2, 3, 4, 5, 6, 8, 9, 10, 12].filter((x) => x !== m && total % x === 0);
    const m2 = others.length ? rng.pick(others) : m * 2;
    const ans = total / m2;
    if (Number.isInteger(ans))
      return q(sub, d, `${m} workers finish a job in ${days} days. How many days would ${m2} workers take at the same speed?`, ans, `The job is ${m} × ${days} = ${total} worker-days, so ${total} ÷ ${m2} = ${ans} days.`, rng);
    return q(sub, d, `${m} workers finish a job in ${days} days. How many days would one worker take alone?`, total, `${m} × ${days} = ${total} days for one worker.`, rng);
  }
  // Together: a·b / (a + b); pairs chosen to give whole numbers.
  const pairs = {
    3: [[3, 6], [4, 12], [6, 12], [6, 3], [12, 4]],
    4: [[10, 15], [12, 24], [9, 18], [8, 24], [15, 10], [20, 30]],
    5: [[21, 42], [18, 36], [28, 21], [36, 45], [40, 60], [30, 60], [24, 40]],
  }[d as 3 | 4 | 5];
  const [a, b] = rng.pick(pairs);
  const t = (a * b) / (a + b);
  return q(
    sub,
    d,
    `A can finish a job in ${a} days and B in ${b} days. Working together, how many days will they take?`,
    t,
    `Together they do 1/${a} + 1/${b} of the job a day, so it takes ${a} × ${b} ÷ (${a} + ${b}) = ${t} days.`,
    rng
  );
}

function profit(d: Difficulty, rng: Rng): Question {
  const sub = 'profit-loss';
  if (d === 1) {
    const m = 100 * rng.int(2, 10);
    const p = rng.pick([10, 20, 25, 50]);
    const pay = (m * (100 - p)) / 100;
    return q(sub, d, `A shirt is marked ${RS}${m}. With a ${p}% discount, how much do you pay?`, pay, `${p}% of ${m} is ${m - pay}, so you pay ${m} − ${m - pay} = ${RS}${pay}.`, rng);
  }
  if (d === 2 || d === 3) {
    const c = 100 * rng.int(2, 20);
    const gain = d === 2;
    const p = rng.pick(gain ? [10, 20, 25, 30, 50] : [5, 10, 15, 20, 25]);
    const s = (c * (gain ? 100 + p : 100 - p)) / 100;
    return q(
      sub,
      d,
      `A phone is bought for ${RS}${c} and sold at a ${p}% ${gain ? 'profit' : 'loss'}. What is the selling price?`,
      s,
      `${p}% of ${c} is ${(c * p) / 100}, so ${c} ${gain ? '+' : '−'} ${(c * p) / 100} = ${RS}${s}.`,
      rng
    );
  }
  if (d === 4) {
    const c = 100 * rng.int(2, 30);
    const p = rng.pick([5, 10, 12, 15, 20, 25, 40]);
    const s = (c * (100 + p)) / 100;
    return q(sub, d, `A bike is bought for ${RS}${c} and sold for ${RS}${s}. What is the profit percentage?`, p, `Profit = ${s - c}; ${s - c} ÷ ${c} × 100 = ${p}%.`, rng);
  }
  const m = 400 * rng.int(1, 10);
  const p1 = rng.pick([10, 20, 25, 50]);
  const p2 = rng.pick([10, 20, 25]);
  const after1 = (m * (100 - p1)) / 100;
  const pay = (after1 * (100 - p2)) / 100;
  return q(
    sub,
    d,
    `An item marked ${RS}${m} gets ${p1}% off, then a further ${p2}% off the new price. What is the final price?`,
    pay,
    `${m} − ${p1}% = ${after1}, then ${after1} − ${p2}% = ${RS}${pay} (not ${p1 + p2}% off in one go).`,
    rng
  );
}

function interest(d: Difficulty, rng: Rng): Question {
  const sub = 'interest';
  if (d <= 3) {
    const P = 100 * rng.int(d === 1 ? 5 : 10, d === 1 ? 20 : 100);
    const R = rng.pick([4, 5, 8, 10, 12]);
    const T = rng.int(1, d === 1 ? 2 : 4);
    const I = (P * R * T) / 100;
    if (d === 3)
      return q(sub, d, `${RS}${P} is invested at ${R}% simple interest a year. What is the total amount after ${T} years?`, P + I, `Interest = ${P} × ${R} × ${T} ÷ 100 = ${I}; amount = ${P} + ${I} = ${RS}${P + I}.`, rng);
    return q(sub, d, `What is the simple interest on ${RS}${P} at ${R}% a year for ${T} year${T > 1 ? 's' : ''}?`, I, `Simple interest = P × R × T ÷ 100 = ${P} × ${R} × ${T} ÷ 100 = ${RS}${I}.`, rng);
  }
  if (d === 4) {
    const P = 100 * rng.int(10, 100);
    const R = rng.pick([4, 5, 6, 8, 10, 12]);
    const T = rng.int(2, 5);
    const I = (P * R * T) / 100;
    return q(sub, d, `${RS}${P} earns ${RS}${I} simple interest in ${T} years. What is the yearly interest rate (%)?`, R, `R = I × 100 ÷ (P × T) = ${I} × 100 ÷ (${P} × ${T}) = ${R}%.`, rng);
  }
  // Compound interest for 2 years. Base amounts keep the result whole: 10% → ×1000, 20% → ×500, 5% → ×4000.
  const R = rng.pick([5, 10, 20]);
  const base = R === 10 ? 1000 : R === 20 ? 500 : 4000;
  const P = base * rng.int(1, R === 5 ? 5 : 10);
  const I = (P * ((100 + R) ** 2 - 10000)) / 10000;
  return q(
    sub,
    d,
    `${RS}${P} is invested at ${R}% a year, compounded yearly. How much interest is earned in 2 years?`,
    I,
    `After 2 years: ${P} × (1 + ${R}/100)² = ${P + I}, so the interest is ${RS}${I}.`,
    rng
  );
}

function ratios(d: Difficulty, rng: Rng): Question {
  const sub = 'ratios';
  if (d <= 2) {
    const a = rng.int(1, d === 1 ? 4 : 7);
    let b = rng.int(1, d === 1 ? 4 : 7);
    if (b === a) b = a + 1;
    const k = rng.int(2, d === 1 ? 10 : 20);
    const total = (a + b) * k;
    const big = Math.max(a, b) * k;
    return q(sub, d, `${RS}${total} is shared in the ratio ${a} : ${b}. How much is the larger share?`, big, `${a} + ${b} = ${a + b} parts of ${total} ÷ ${a + b} = ${k} each; larger = ${Math.max(a, b)} × ${k} = ${big}.`, rng);
  }
  if (d === 3) {
    const parts = [rng.int(1, 5), rng.int(1, 5), rng.int(1, 5)];
    const k = rng.int(3, 15);
    const total = parts.reduce((x, y) => x + y, 0) * k;
    const who = rng.int(0, 2);
    const names = ['A', 'B', 'C'];
    return q(
      sub,
      d,
      `${RS}${total} is shared among A, B and C in the ratio ${parts.join(' : ')}. How much does ${names[who]} get?`,
      parts[who] * k,
      `${parts.join(' + ')} = ${total / k} parts of ${k} each; ${names[who]} gets ${parts[who]} × ${k} = ${parts[who] * k}.`,
      rng
    );
  }
  if (d === 4) {
    const a = rng.int(2, 7);
    let b = rng.int(2, 9);
    if (b === a) b = a + 1;
    const k = rng.int(3, 12);
    return q(sub, d, `The ratio of boys to girls in a class is ${a} : ${b}. There are ${a * k} boys. How many girls are there?`, b * k, `${a * k} ÷ ${a} = ${k} per part; girls = ${b} × ${k} = ${b * k}.`, rng);
  }
  const b = rng.int(2, 6);
  const a = b + rng.int(1, 4);
  const k = rng.int(5, 30);
  return q(
    sub,
    d,
    `A's and B's savings are in the ratio ${a} : ${b}. A has ${RS}${(a - b) * k} more than B. How much does B have?`,
    b * k,
    `The difference is ${a - b} part${a - b > 1 ? 's' : ''} = ${(a - b) * k}, so one part = ${k} and B has ${b} × ${k} = ${RS}${b * k}.`,
    rng
  );
}

function averages(d: Difficulty, rng: Rng): Question {
  const sub = 'averages';
  if (d <= 3) {
    // Pick n positive numbers, then nudge the last one so the total divides evenly.
    const n = rng.int(3, d === 1 ? 4 : 6);
    const centre = rng.int(10, 20 + 15 * d);
    const nums = Array.from({ length: n }, () => centre + rng.int(-8, 8));
    const rem = nums.reduce((x, y) => x + y, 0) % n;
    if (rem) nums[n - 1] += n - rem;
    const sum = nums.reduce((x, y) => x + y, 0);
    const avg = sum / n;
    if (d === 1) return q(sub, d, `What is the average of ${nums.join(', ')}?`, avg, `Sum = ${sum}; ${sum} ÷ ${n} = ${avg}.`, rng);
    const shown = nums.slice(0, -1);
    const shownSum = shown.reduce((x, y) => x + y, 0);
    return q(
      sub,
      d,
      `The average of ${n} numbers is ${avg}. ${n - 1} of them are ${shown.join(', ')}. What is the last number?`,
      nums[n - 1],
      `All ${n} add up to ${n} × ${avg} = ${sum}; ${sum} − ${shownSum} = ${nums[n - 1]}.`,
      rng
    );
  }
  const count = rng.int(4, 9);
  const m = rng.int(15, 50);
  const m2 = m + rng.pick([1, 2, 3, 4, 5]);
  const added = (count + 1) * m2 - count * m;
  return q(
    sub,
    d,
    `The average age of ${count} players is ${m}. When a coach joins, the average becomes ${m2}. How old is the coach?`,
    added,
    `Before: ${count} × ${m} = ${count * m}. After: ${count + 1} × ${m2} = ${(count + 1) * m2}. Coach = ${(count + 1) * m2} − ${count * m} = ${added}.`,
    rng
  );
}

function ages(d: Difficulty, rng: Rng): Question {
  const sub = 'ages';
  if (d === 1) {
    const a = rng.int(5, 30);
    const k = rng.int(2, 10);
    const n = rng.int(2, 10);
    return q(sub, d, `Mia is ${a}. Leo is ${k} years older. How old will Leo be in ${n} years?`, a + k + n, `Leo is ${a + k} now, so ${a + k} + ${n} = ${a + k + n}.`, rng);
  }
  if (d === 2) {
    const older = rng.int(12, 40);
    const younger = rng.int(4, older - 2);
    return q(
      sub,
      d,
      `The ages of two sisters add up to ${older + younger}, and one is ${older - younger} years older. How old is the older sister?`,
      older,
      `(${older + younger} + ${older - younger}) ÷ 2 = ${older}.`,
      rng
    );
  }
  if (d === 3) {
    const s = rng.int(4, 15);
    const k = rng.int(3, 5);
    const n = rng.int(2, 10);
    return q(sub, d, `A father is ${k} times as old as his son, who is ${s}. How old will the father be in ${n} years?`, k * s + n, `Father = ${k} × ${s} = ${k * s}; in ${n} years: ${k * s + n}.`, rng);
  }
  // A = k·B now; in n years A = 2·(B + n). Choosing n = B·(k − 2) makes it work for any B.
  const b = rng.int(4, d === 4 ? 10 : 16);
  const k = rng.pick(d === 4 ? [3] : [3, 4]);
  const n = b * (k - 2);
  return q(
    sub,
    d,
    `Ana is ${k} times as old as Ben. In ${n} years, Ana will be twice as old as Ben. How old is Ben now?`,
    b,
    `If Ben is x: ${k}x + ${n} = 2(x + ${n}), so ${k - 2}x = ${n} and x = ${b}.`,
    rng
  );
}
