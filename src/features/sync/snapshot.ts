import { AREA_IDS } from '@/features/brain/areas';
import type { Ratings } from '@/features/brain/rating';
import type { Area } from '@/features/brain/types';
import type { Calibration, Exercise } from '@/features/muscle/types';

/**
 * Backup snapshots of the phone's three stores (pure, unit-tested). They're uploaded to
 * `user_state` a few seconds after a change and read back on a new phone. Reading is defensive:
 * anything that doesn't look right is dropped rather than restored.
 */
export type StateKey = 'brain' | 'muscle' | 'blocker';

export type BrainSnapshot = {
  areas: Area[];
  ratings: Ratings;
  calibrated: boolean;
  fastAnswers: number;
  seen: string[];
};

type Totals = Record<Exercise, { reps: number; full: number }>;

export type MuscleSnapshot = {
  calibration: Calibration;
  checked: Exercise[];
  lastExercise: Exercise;
  totals: Totals;
};

/** scope ("pkg" or "pkg:short") → daily limit in minutes. */
export type BlockerSnapshot = { targets: Record<string, number> };

export type Backup = {
  brain?: BrainSnapshot;
  muscle?: MuscleSnapshot;
  blocker?: BlockerSnapshot;
  /** Newest updated_at across the snapshots (ms), for "Found your backup from …". */
  updatedAt: number;
};

const EXERCISES: Exercise[] = ['squat', 'jack', 'raise'];
const CALIBRATION_KEYS = ['squatDepth', 'squatDrop', 'jackSpread', 'jackArms', 'raiseArms'] as const;

export function brainSnapshot(s: BrainSnapshot): BrainSnapshot {
  return { areas: s.areas, ratings: s.ratings, calibrated: s.calibrated, fastAnswers: s.fastAnswers, seen: s.seen };
}

export function muscleSnapshot(s: MuscleSnapshot): MuscleSnapshot {
  return { calibration: s.calibration, checked: s.checked, lastExercise: s.lastExercise, totals: s.totals };
}

export function blockerSnapshot(targets: Record<string, number>): BlockerSnapshot {
  return { targets };
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export function readBrain(data: unknown): BrainSnapshot | null {
  if (!isObj(data)) return null;
  const areas = Array.isArray(data.areas) ? data.areas.filter((a): a is Area => AREA_IDS.includes(a as Area)) : [];
  const ratings: Ratings = {};
  if (isObj(data.ratings)) for (const [k, v] of Object.entries(data.ratings)) if (isNum(v)) ratings[k] = v;
  const seen = Array.isArray(data.seen) ? data.seen.filter((x): x is string => typeof x === 'string').slice(-150) : [];
  return {
    areas,
    ratings,
    calibrated: data.calibrated === true,
    fastAnswers: isNum(data.fastAnswers) ? Math.max(0, Math.round(data.fastAnswers)) : 0,
    seen,
  };
}

export function readMuscle(data: unknown): MuscleSnapshot | null {
  if (!isObj(data)) return null;
  const calibration: Calibration = {};
  if (isObj(data.calibration))
    for (const k of CALIBRATION_KEYS) {
      const v = data.calibration[k];
      if (isNum(v)) calibration[k] = v;
    }
  const checked = Array.isArray(data.checked) ? data.checked.filter((e): e is Exercise => EXERCISES.includes(e as Exercise)) : [];
  const lastExercise = EXERCISES.includes(data.lastExercise as Exercise) ? (data.lastExercise as Exercise) : 'squat';
  const totals = {} as Totals;
  for (const ex of EXERCISES) {
    const t = isObj(data.totals) ? data.totals[ex] : undefined;
    totals[ex] = isObj(t) && isNum(t.reps) && isNum(t.full) ? { reps: t.reps, full: t.full } : { reps: 0, full: 0 };
  }
  return { calibration, checked, lastExercise, totals };
}

/** Package name (+ optional ":short"), e.g. "com.instagram.android:short". */
const SCOPE_RE = /^[A-Za-z][\w]*(\.[A-Za-z_][\w]*)+(:short)?$/;

export function readBlocker(data: unknown): BlockerSnapshot | null {
  if (!isObj(data) || !isObj(data.targets)) return null;
  const targets: Record<string, number> = {};
  for (const [scope, v] of Object.entries(data.targets))
    if (SCOPE_RE.test(scope) && isNum(v) && v > 0 && v <= 24 * 60) targets[scope] = Math.round(v);
  return { targets };
}

/** Builds a Backup from `user_state` rows (unknown keys and bad data are ignored). */
export function readBackup(rows: { key: string; data: unknown; updated_at: string }[]): Backup {
  const backup: Backup = { updatedAt: 0 };
  for (const row of rows) {
    const t = Date.parse(row.updated_at);
    if (row.key === 'brain') backup.brain = readBrain(row.data) ?? undefined;
    else if (row.key === 'muscle') backup.muscle = readMuscle(row.data) ?? undefined;
    else if (row.key === 'blocker') backup.blocker = readBlocker(row.data) ?? undefined;
    else continue;
    if (Number.isFinite(t)) backup.updatedAt = Math.max(backup.updatedAt, t);
  }
  return backup;
}

/** True when a backup holds anything worth offering to restore. */
export function hasProgress(b: Backup): boolean {
  const brain = !!b.brain && (b.brain.areas.length > 0 || Object.keys(b.brain.ratings).length > 0);
  const muscle = !!b.muscle && (b.muscle.checked.length > 0 || EXERCISES.some((e) => b.muscle!.totals[e].reps > 0));
  const blocker = !!b.blocker && Object.keys(b.blocker.targets).length > 0;
  return brain || muscle || blocker;
}
