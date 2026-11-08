import { describe, expect, it } from '@jest/globals';

import { allowanceMs, formatDuration, LIMIT_STEPS, stepLimit } from '../limits';

describe('stepLimit', () => {
  it('moves to the next step up and down', () => {
    expect(stepLimit(15, 1)).toBe(20);
    expect(stepLimit(15, -1)).toBe(10);
  });

  it('stops at the ends', () => {
    expect(stepLimit(LIMIT_STEPS[0], -1)).toBe(LIMIT_STEPS[0]);
    const max = LIMIT_STEPS[LIMIT_STEPS.length - 1];
    expect(stepLimit(max, 1)).toBe(max);
  });

  it('snaps an in-between value onto the step grid', () => {
    expect(stepLimit(12, 1)).toBe(15); // 12 sits between 10 and 15
    expect(stepLimit(12, -1)).toBe(10);
    expect(stepLimit(500, -1)).toBe(90); // above max → one step below max
  });
});

describe('formatDuration', () => {
  it('formats seconds, minutes and hours', () => {
    expect(formatDuration(0)).toBe('0s');
    expect(formatDuration(45_000)).toBe('45s');
    expect(formatDuration(12 * 60_000 + 30_000)).toBe('12 min');
    expect(formatDuration(65 * 60_000)).toBe('1h 05m');
  });

  it('never shows negative time', () => {
    expect(formatDuration(-5000)).toBe('0s');
  });
});

describe('allowanceMs', () => {
  it('adds toll extra time to the daily limit', () => {
    expect(allowanceMs(20, 0)).toBe(20 * 60_000);
    expect(allowanceMs(1, 5 * 60_000)).toBe(6 * 60_000);
  });
});
