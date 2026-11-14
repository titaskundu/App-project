import { describe, expect, it } from '@jest/globals';

import { gateState, pendingPath, type GateInput } from '../gate';

const base: GateInput = {
  configured: true,
  sessionLoaded: true,
  userId: 'u1',
  isAnonymous: false,
  pendingSetup: false,
  profileUserId: 'u1',
  check: 'pending',
};

describe('gateState', () => {
  it('phone-only builds skip accounts', () => {
    expect(gateState({ ...base, configured: false, userId: null })).toBe('ready');
  });
  it('waits for the saved session', () => {
    expect(gateState({ ...base, sessionLoaded: false })).toBe('loading');
  });
  it('signed out, leftover anonymous, or mid sign-up → auth screens', () => {
    expect(gateState({ ...base, userId: null })).toBe('signedOut');
    expect(gateState({ ...base, isAnonymous: true })).toBe('signedOut');
    expect(gateState({ ...base, pendingSetup: true })).toBe('signedOut');
  });
  it('cached profile for this user → straight in (works offline)', () => {
    expect(gateState(base)).toBe('ready');
  });
  it('first time on this phone: check, then profile or retry', () => {
    const fresh = { ...base, profileUserId: null };
    expect(gateState(fresh)).toBe('checking');
    expect(gateState({ ...fresh, check: 'missingProfile' })).toBe('needsProfile');
    expect(gateState({ ...fresh, check: 'error' })).toBe('offline');
  });
  it("another user's cached profile doesn't count", () => {
    expect(gateState({ ...base, profileUserId: 'someone-else' })).toBe('checking');
  });
});

describe('pendingPath', () => {
  it('remembers toll links only', () => {
    expect(pendingPath('mindmusclesync://toll?pkg=com.instagram.android&scope=com.instagram.android%3Ashort')).toBe(
      '/toll?pkg=com.instagram.android&scope=com.instagram.android%3Ashort'
    );
    expect(pendingPath('mindmusclesync:///toll')).toBe('/toll');
    expect(pendingPath('mindmusclesync://muscle?mode=practice')).toBeNull();
    expect(pendingPath(null)).toBeNull();
  });
});
