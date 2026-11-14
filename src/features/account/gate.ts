/**
 * Which part of the app may be shown (pure, unit-tested). The root layout turns this into
 * Expo Router Stack.Protected guards.
 *
 *  loading      → the saved session is still being read (splash stays up)
 *  signedOut    → welcome / log-in / sign-up screens (also mid sign-up, until the password is set)
 *  checking     → signed in on this phone for the first time: restoring the backup, loading profile
 *  offline      → that first check needs the internet (retry screen)
 *  needsProfile → "Complete your profile" (name, username, birth date)
 *  ready        → the app
 */
export type GateState = 'loading' | 'signedOut' | 'checking' | 'offline' | 'needsProfile' | 'ready';

/** Result of the first-time check for this user on this phone. */
export type CheckResult = 'pending' | 'missingProfile' | 'error';

export type GateInput = {
  /** False when the build has no Supabase keys (the app then runs phone-only, for development). */
  configured: boolean;
  sessionLoaded: boolean;
  userId: string | null;
  isAnonymous: boolean;
  pendingSetup: boolean;
  /** Owner of the profile cached on this phone. */
  profileUserId: string | null;
  check: CheckResult;
};

export function gateState(g: GateInput): GateState {
  if (!g.configured) return 'ready';
  if (!g.sessionLoaded) return 'loading';
  if (!g.userId || g.isAnonymous || g.pendingSetup) return 'signedOut';
  if (g.profileUserId === g.userId) return 'ready';
  if (g.check === 'missingProfile') return 'needsProfile';
  if (g.check === 'error') return 'offline';
  return 'checking';
}

/**
 * Deep links that should open after login (e.g. the blocker's "Pay toll" while signed out).
 * Returns the in-app path, or null for links that don't need remembering.
 */
export function pendingPath(url: string | null): string | null {
  if (!url) return null;
  const m = /^mindmusclesync:\/\/\/?(toll)(\?.*)?$/.exec(url);
  return m ? `/${m[1]}${m[2] ?? ''}` : null;
}
