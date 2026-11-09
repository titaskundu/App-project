import { describe, expect, it } from '@jest/globals';

import { DEFAULT_LIMIT, isShortScope, scopePkg, shortScope, targetsForPicked, trackedPackages } from '../limits';

const IG = 'com.instagram.android';
const CHROME = 'com.android.chrome';
const SHORT_APPS = { [IG]: 'Reels' };

describe('scope helpers', () => {
  it('builds and reads Reels scopes', () => {
    expect(shortScope(IG)).toBe(`${IG}:short`);
    expect(isShortScope(shortScope(IG))).toBe(true);
    expect(isShortScope(IG)).toBe(false);
    expect(scopePkg(shortScope(IG))).toBe(IG);
    expect(scopePkg(CHROME)).toBe(CHROME);
  });

  it('lists each tracked app once', () => {
    expect(trackedPackages({ [IG]: 60, [shortScope(IG)]: 15, [CHROME]: 30 })).toEqual([IG, CHROME]);
  });
});

describe('targetsForPicked', () => {
  it('gives new short-video apps a Reels limit and other apps a whole-app limit', () => {
    expect(targetsForPicked({}, [IG, CHROME], SHORT_APPS)).toEqual({
      [shortScope(IG)]: DEFAULT_LIMIT,
      [CHROME]: DEFAULT_LIMIT,
    });
  });

  it('keeps both limits of an app that stays picked', () => {
    const current = { [IG]: 60, [shortScope(IG)]: 10 };
    expect(targetsForPicked(current, [IG], SHORT_APPS)).toEqual(current);
  });

  it('removes every limit of an app that is unpicked', () => {
    const current = { [IG]: 60, [shortScope(IG)]: 10, [CHROME]: 30 };
    expect(targetsForPicked(current, [CHROME], SHORT_APPS)).toEqual({ [CHROME]: 30 });
  });

  it('keeps an old whole-app-only limit as it was', () => {
    expect(targetsForPicked({ [IG]: 20 }, [IG], SHORT_APPS)).toEqual({ [IG]: 20 });
  });
});
