import { describe, expect, it } from '@jest/globals';

import {
  appLimits,
  byUrgency,
  DEFAULT_LIMIT,
  limitMode,
  scopeStatuses,
  shortScope,
  targetsForMode,
  usageLevel,
  withAppLimits,
  worstLevel,
} from '../limits';

const IG = 'com.instagram.android';
const YT = 'com.google.android.youtube';
const MIN = 60_000;

describe('limit modes', () => {
  it('reads the mode from the targets', () => {
    expect(limitMode({ [IG]: 30 }, IG)).toBe('app');
    expect(limitMode({ [shortScope(IG)]: 15 }, IG)).toBe('short');
    expect(limitMode({ [IG]: 30, [shortScope(IG)]: 15 }, IG)).toBe('both');
    expect(limitMode({}, IG)).toBeNull();
  });

  it('keeps minutes of limits that stay and defaults new ones', () => {
    const start = { [shortScope(IG)]: 10, [YT]: 45 };
    expect(targetsForMode(start, IG, 'both')).toEqual({ [shortScope(IG)]: 10, [IG]: DEFAULT_LIMIT, [YT]: 45 });
    expect(targetsForMode(start, IG, 'app')).toEqual({ [IG]: DEFAULT_LIMIT, [YT]: 45 });
    expect(targetsForMode({ [IG]: 60, [shortScope(IG)]: 10 }, IG, 'short')).toEqual({ [shortScope(IG)]: 10 });
  });

  it('does not touch the input', () => {
    const start = { [IG]: 60 };
    targetsForMode(start, IG, 'short');
    expect(start).toEqual({ [IG]: 60 });
  });
});

describe('today status', () => {
  it('grades usage', () => {
    expect(usageLevel(0.5)).toBe('ok');
    expect(usageLevel(0.8)).toBe('near');
    expect(usageLevel(1)).toBe('over');
  });

  it('lists Reels first and counts toll minutes in the allowance', () => {
    const targets = { [IG]: 60, [shortScope(IG)]: 10 };
    const today = { usage: { [IG]: 30 * MIN, [shortScope(IG)]: 12 * MIN }, extra: { [shortScope(IG)]: 5 * MIN } };
    const s = scopeStatuses(targets, today, IG);
    expect(s.map((x) => x.kind)).toEqual(['short', 'app']);
    expect(s[0].allowanceMs).toBe(15 * MIN);
    expect(s[0].level).toBe('near');
    expect(s[1].level).toBe('ok');
    expect(worstLevel(s)).toBe('near');
  });

  it('handles no data yet', () => {
    const s = scopeStatuses({ [IG]: 15 }, null, IG);
    expect(s[0].usedMs).toBe(0);
    expect(worstLevel(s)).toBe('ok');
    expect(worstLevel([])).toBe('ok');
  });

  it('sorts the most urgent app first', () => {
    const targets = { [YT]: 30, [IG]: 10 };
    expect(byUrgency(targets, { usage: { [IG]: 10 * MIN, [YT]: 3 * MIN }, extra: {} })).toEqual([IG, YT]);
    expect(byUrgency(targets, null)).toEqual([YT, IG]);
  });
});

describe('saving one app', () => {
  it('replaces only that app and ignores other apps in the draft', () => {
    const start = { [IG]: 60, [shortScope(IG)]: 10, [YT]: 45 };
    expect(withAppLimits(start, IG, { [shortScope(IG)]: 20, [YT]: 5 })).toEqual({ [shortScope(IG)]: 20, [YT]: 45 });
  });

  it('picks out one app', () => {
    expect(appLimits({ [IG]: 60, [YT]: 45 }, IG)).toEqual({ [IG]: 60 });
  });
});
