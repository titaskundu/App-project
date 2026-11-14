import { useEffect, useState } from 'react';

import { applyBackup, fetchBackup, hasProgress } from '@/features/sync/account';
import { supabase } from '@/features/sync/supabase';
import { resetSnapshots, setAccountReady, useSync } from '@/features/sync/sync';

import { fetchProfile } from './api';
import { gateState, type CheckResult, type GateState } from './gate';
import { useAccount } from './store';

/**
 * The root layout's auth gate. Reads the session and the cached profile, and the first time a
 * user is signed in on this phone it restores their backup (limits, topics, levels, movement
 * checks) and loads their profile. Sync uploads only start once this reports 'ready'.
 * Call it once, from the root layout; screens read `useAccount((s) => s.gate)`.
 */
export function useAuthGate(): GateState {
  const { configured, sessionLoaded, userId, isAnonymous } = useSync();
  const { profile, pendingSetup, checkAttempt } = useAccount();
  const [check, setCheck] = useState<{ userId: string | null; attempt: number; result: CheckResult }>({
    userId: null,
    attempt: 0,
    result: 'pending',
  });

  const state = gateState({
    configured,
    sessionLoaded,
    userId,
    isAnonymous,
    pendingSetup,
    profileUserId: profile?.userId ?? null,
    // A result only counts for this user and this attempt ("Try again" starts a new one).
    check: check.userId === userId && check.attempt === checkAttempt ? check.result : 'pending',
  });

  // A leftover anonymous session from Phase 4a: sign it out, so the user creates a real account.
  useEffect(() => {
    if (isAnonymous && supabase) void supabase.auth.signOut({ scope: 'local' });
  }, [isAnonymous]);

  // First time this user is signed in here: restore their backup, then load their profile.
  useEffect(() => {
    if (state !== 'checking' || !userId) return;
    let cancelled = false;
    (async () => {
      try {
        if (useAccount.getState().deviceUserId !== userId) {
          const backup = await fetchBackup();
          if (hasProgress(backup)) await applyBackup(backup);
          resetSnapshots();
          useAccount.getState().setDeviceUser(userId);
        }
        const p = await fetchProfile();
        if (cancelled) return;
        if (p) useAccount.getState().setProfile(p);
        else setCheck({ userId, attempt: checkAttempt, result: 'missingProfile' });
      } catch {
        if (!cancelled) setCheck({ userId, attempt: checkAttempt, result: 'error' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [state, userId, checkAttempt]);

  // Uploads run only for a ready account. The state is also published for screens (setup).
  useEffect(() => {
    setAccountReady(state === 'ready' && configured);
    useAccount.getState().setGate(state);
  }, [state, configured]);

  return state;
}
