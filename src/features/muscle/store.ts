import Storage from 'expo-sqlite/kv-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { Calibration, Exercise } from './types';

type Totals = Record<Exercise, { reps: number; full: number }>;

type MuscleState = {
  /** The user's own range of motion, from the movement check. */
  calibration: Calibration;
  /** Exercises whose movement check is done. */
  checked: Exercise[];
  /** Last exercise picked (pre-selected next time). */
  lastExercise: Exercise;
  /** All-time reps (feeds Stats in Phase 6). */
  totals: Totals;

  saveCheck: (ex: Exercise, cal: Calibration) => void;
  resetChecks: () => void;
  setLastExercise: (ex: Exercise) => void;
  recordSet: (ex: Exercise, reps: number, full: number) => void;
};

const EMPTY_TOTALS: Totals = { squat: { reps: 0, full: 0 }, jack: { reps: 0, full: 0 }, raise: { reps: 0, full: 0 } };

/** Muscle progress, saved on the phone (same key-value store as Brain). */
export const useMuscle = create<MuscleState>()(
  persist(
    (set) => ({
      calibration: {},
      checked: [],
      lastExercise: 'squat',
      totals: EMPTY_TOTALS,

      saveCheck: (ex, cal) =>
        set((s) => ({ calibration: { ...s.calibration, ...cal }, checked: [...s.checked.filter((e) => e !== ex), ex] })),
      resetChecks: () => set({ calibration: {}, checked: [] }),
      setLastExercise: (ex) => set({ lastExercise: ex }),
      recordSet: (ex, reps, full) =>
        set((s) => ({
          totals: { ...s.totals, [ex]: { reps: s.totals[ex].reps + reps, full: s.totals[ex].full + full } },
        })),
    }),
    {
      name: 'mms-muscle',
      storage: createJSONStorage(() => ({
        getItem: (k) => Storage.getItemSync(k),
        setItem: (k, v) => Storage.setItemSync(k, v),
        removeItem: (k) => {
          Storage.removeItemSync(k);
        },
      })),
    }
  )
);
