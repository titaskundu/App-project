import Storage from 'expo-sqlite/kv-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { GateState } from './gate';
import type { Profile } from './profile';

/** How long sign-up stays locked on this phone after an under-16 date of birth. */
export const UNDER_16_LOCK_MS = 24 * 60 * 60 * 1000;

type AccountState = {
  /** The signed-in user's profile, cached so the app opens offline. */
  profile: Profile | null;
  /** Whose data this phone's progress belongs to (restore runs when a different user logs in). */
  deviceUserId: string | null;
  /** Sign-up is locked until this time after an under-16 date of birth (ms), else null. */
  under16Until: number | null;
  /**
   * True while a sign-up or password reset is between "code verified" and "password set". The
   * session already exists then, but the auth screens must stay until the password is saved.
   * Not persisted: if the app closes mid-way, the user just logs in again.
   */
  pendingSetup: boolean;
  /** A screen to open right after login (e.g. the toll the blocker asked for). Not persisted. */
  pendingPath: string | null;
  /** Bumped by "Try again" on the setup screen to re-run the first-time check. */
  checkAttempt: number;
  /** The auth gate's current state, published by the root layout. Not persisted. */
  gate: GateState;

  setProfile: (p: Profile | null) => void;
  setDeviceUser: (id: string | null) => void;
  lockUnder16: () => void;
  setPendingSetup: (v: boolean) => void;
  setPendingPath: (p: string | null) => void;
  retryCheck: () => void;
  setGate: (g: GateState) => void;
};

export const useAccount = create<AccountState>()(
  persist(
    (set) => ({
      profile: null,
      deviceUserId: null,
      under16Until: null,
      pendingSetup: false,
      pendingPath: null,
      checkAttempt: 0,
      gate: 'loading',

      setProfile: (profile) => set({ profile }),
      setDeviceUser: (deviceUserId) => set({ deviceUserId }),
      lockUnder16: () => set({ under16Until: Date.now() + UNDER_16_LOCK_MS }),
      setPendingSetup: (pendingSetup) => set({ pendingSetup }),
      setPendingPath: (pendingPath) => set({ pendingPath }),
      retryCheck: () => set((s) => ({ checkAttempt: s.checkAttempt + 1 })),
      setGate: (gate) => set({ gate }),
    }),
    {
      name: 'mms-account',
      storage: createJSONStorage(() => ({
        getItem: (k) => Storage.getItemSync(k),
        setItem: (k, v) => Storage.setItemSync(k, v),
        removeItem: (k) => {
          Storage.removeItemSync(k);
        },
      })),
      partialize: (s) => ({ profile: s.profile, deviceUserId: s.deviceUserId, under16Until: s.under16Until }),
    }
  )
);

export function under16Locked(until: number | null, now = Date.now()): boolean {
  return until !== null && now < until;
}
