import { measure, moreExtreme, rememberPose, type MetricMemory } from './metrics';
import type { Pose } from './pose';
import type { Calibration, Exercise, Tip } from './types';

/**
 * Rep counter: a small state machine over the progress number from metrics.ts.
 *
 *   rest ──(progress ≥ COUNT_AT)──▶ out ──(back ≤ REST_AT)──▶ rest  = one rep
 *
 * The gap between COUNT_AT and REST_AT means a shaky frame can't count a rep twice, and a rep
 * must take at least MIN_REP_MS. Counting is lenient (decided 2026-11-10): reaching 60% of a
 * full rep counts; a rep is "full form" when it reaches FULL_AT (and, for arm raises, with
 * straight arms). A movement that starts but stays below COUNT_AT gives a tip instead.
 */
export const COUNT_AT = 0.6;
export const FULL_AT = 0.92;
export const REST_AT = 0.25;
export const STARTED_AT = 0.3;
export const MIN_REP_MS: Record<Exercise, number> = { squat: 700, jack: 400, raise: 600 };
/** Weight of the newest frame when smoothing (the rest is the previous smoothed value). */
const SMOOTH = 0.6;

export type CounterState = {
  phase: 'rest' | 'out';
  /** Smoothed progress / distance from rest. */
  p: number;
  back: number;
  /** Highest progress in the current movement, and the tip measured there. */
  peak: number;
  tip: Tip;
  fullForm: boolean;
  /** When the user last left the rest position (ms). */
  leftRestAt: number;
  mem: MetricMemory;
  reps: number;
  fullReps: number;
  /** Most extreme raw values seen (for the movement check). */
  extremes: Record<string, number>;
  /** The latest frame's raw values (for dev logs while tuning). */
  raw: Record<string, number>;
  /** Frames measured (skipped frames don't count). */
  frames: number;
};

export type CounterEvent = { kind: 'rep'; full: boolean; tip?: Tip } | { kind: 'shallow'; tip: Tip };

export function initCounter(): CounterState {
  return {
    phase: 'rest',
    p: 0,
    back: 0,
    peak: 0,
    tip: 'lower',
    fullForm: false,
    leftRestAt: 0,
    mem: {},
    reps: 0,
    fullReps: 0,
    extremes: {},
    raw: {},
    frames: 0,
  };
}

/** Feeds one frame to the counter. Returns the new state and, at most, one event. */
export function stepCounter(
  ex: Exercise,
  cal: Calibration,
  state: CounterState,
  pose: Pose | null
): { state: CounterState; event?: CounterEvent } {
  if (!pose) return { state };
  const mem = rememberPose(ex, pose, state.mem);
  const m = measure(ex, pose, cal, mem);
  if (!m) return { state: { ...state, mem } };

  const first = state.frames === 0;
  const p = first ? m.p : state.p * (1 - SMOOTH) + m.p * SMOOTH;
  const back = first ? m.back : state.back * (1 - SMOOTH) + m.back * SMOOTH;

  const extremes = { ...state.extremes };
  for (const [k, v] of Object.entries(m.raw)) {
    extremes[k] = k in extremes ? moreExtreme(k, extremes[k], v) : v;
  }

  let s: CounterState = { ...state, p, back, mem, extremes, raw: m.raw, frames: state.frames + 1 };
  const atRest = back <= REST_AT;

  if (s.phase === 'rest') {
    if (atRest) s.leftRestAt = pose.t;
    // While resting, track the biggest movement (for jumping jacks: arms OR feet), so a half
    // attempt still gets a tip.
    if (back > s.peak) {
      s.peak = back;
      s.tip = m.tip;
    }
    if (p >= COUNT_AT) {
      s = { ...s, phase: 'out', peak: p, tip: m.tip, fullForm: p >= FULL_AT && m.form };
      return { state: s };
    }
    if (atRest && s.peak >= STARTED_AT) {
      const tip = s.tip;
      s = { ...s, peak: 0 };
      return { state: s, event: { kind: 'shallow', tip } };
    }
    if (atRest) s.peak = 0;
    return { state: s };
  }

  // phase === 'out'
  if (p >= s.peak) {
    s.peak = p;
    s.tip = m.tip;
  }
  if (p >= FULL_AT && m.form) s.fullForm = true;

  if (atRest) {
    const long = pose.t - s.leftRestAt >= MIN_REP_MS[ex];
    const full = s.fullForm;
    const tip = full ? undefined : s.tip;
    s = { ...s, phase: 'rest', peak: 0, fullForm: false, leftRestAt: pose.t };
    if (!long) return { state: s };
    s.reps += 1;
    if (full) s.fullReps += 1;
    return { state: s, event: { kind: 'rep', full, tip } };
  }
  return { state: s };
}
