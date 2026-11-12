import Storage from 'expo-sqlite/kv-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { K_CALIBRATION, updateRatings, type Ratings } from './rating';
import { BANK_DAILY_CAP } from './toll';
import type { AnswerRecord, Area } from './types';

/** Local date "YYYY-MM-DD", so daily things reset at the user's midnight. */
export function todayKey(d = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

const SEEN_KEEP = 150;

type Bank = {
  day: string;
  /** Minutes currently available. */
  minutes: number;
  /** Minutes earned today (capped at BANK_DAILY_CAP). */
  earnedToday: number;
};

type BrainState = {
  /** Areas picked in the interests quiz (empty = not set up yet). */
  areas: Area[];
  ratings: Ratings;
  /** Recently seen starter-pack question ids (newest last), to avoid repeats. */
  seen: string[];
  bank: Bank;
  calibrated: boolean;
  /** Fast answers so far (become Sparks in Phase 5). */
  fastAnswers: number;

  setAreas: (areas: Area[]) => void;
  recordAnswer: (a: AnswerRecord, calibration?: boolean) => void;
  setCalibrated: () => void;
  /** Adds earned minutes (respects the daily cap); returns how many were added. */
  bankAdd: (minutes: number) => number;
  /** Takes up to `max` banked minutes; returns how many were taken. */
  bankUse: (max: number) => number;
  /** Banked minutes available right now (after the midnight reset). */
  bankAvailable: () => number;
  /** Replace progress with a backup (new phone). Today's bank is kept. */
  restore: (b: { areas: Area[]; ratings: Ratings; calibrated: boolean; fastAnswers: number; seen: string[] }) => void;
  /** Start over ("Delete my data"). */
  resetProgress: () => void;
};

function freshBank(bank: Bank): Bank {
  // Banked minutes don't carry over to the next day.
  return bank.day === todayKey() ? bank : { day: todayKey(), minutes: 0, earnedToday: 0 };
}

/**
 * Brain progress, saved on the phone with expo-sqlite's key-value store (synchronous, so it's
 * ready on the first render and works offline).
 */
export const useBrain = create<BrainState>()(
  persist(
    (set, get) => ({
      areas: [],
      ratings: {},
      seen: [],
      bank: { day: todayKey(), minutes: 0, earnedToday: 0 },
      calibrated: false,
      fastAnswers: 0,

      setAreas: (areas) => set({ areas }),

      recordAnswer: (a, calibration = false) =>
        set((s) => ({
          ratings: updateRatings(s.ratings, a, calibration ? K_CALIBRATION : undefined),
          seen: a.area === 'math' || a.area === 'logic' ? s.seen : [...s.seen.filter((id) => id !== a.questionId), a.questionId].slice(-SEEN_KEEP),
          fastAnswers: s.fastAnswers + (a.correct && a.fast ? 1 : 0),
        })),

      setCalibrated: () => set({ calibrated: true }),

      bankAdd: (minutes) => {
        const bank = freshBank(get().bank);
        const add = Math.max(0, Math.min(minutes, BANK_DAILY_CAP - bank.earnedToday));
        set({ bank: { ...bank, minutes: bank.minutes + add, earnedToday: bank.earnedToday + add } });
        return add;
      },

      bankUse: (max) => {
        const bank = freshBank(get().bank);
        const take = Math.min(max, bank.minutes);
        set({ bank: { ...bank, minutes: bank.minutes - take } });
        return take;
      },

      bankAvailable: () => freshBank(get().bank).minutes,

      restore: (b) =>
        set({ areas: b.areas, ratings: b.ratings, calibrated: b.calibrated, fastAnswers: b.fastAnswers, seen: b.seen }),

      resetProgress: () =>
        set({
          areas: [],
          ratings: {},
          seen: [],
          calibrated: false,
          fastAnswers: 0,
          bank: { day: todayKey(), minutes: 0, earnedToday: 0 },
        }),
    }),
    {
      name: 'mms-brain',
      storage: createJSONStorage(() => ({
        getItem: (k) => Storage.getItemSync(k),
        setItem: (k, v) => Storage.setItemSync(k, v),
        removeItem: (k) => {
          Storage.removeItemSync(k);
        },
      })),
      partialize: (s) => ({
        areas: s.areas,
        ratings: s.ratings,
        seen: s.seen,
        bank: s.bank,
        calibrated: s.calibrated,
        fastAnswers: s.fastAnswers,
      }),
    }
  )
);
