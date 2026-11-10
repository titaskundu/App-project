import { angle, clamp01, dist, mid, P, visible, type Pose } from './pose';
import type { Calibration, Exercise, Tip } from './types';

/**
 * Turns one pose into a single "progress" number per exercise: 0 = resting position,
 * 1 = a full rep. The counter (counter.ts) only looks at these numbers.
 *
 *  - p:    progress toward a full rep (used to detect reaching the rep).
 *  - back: how far from rest (used to detect coming back; for jumping jacks both arms AND
 *          feet must come back).
 *  - form: false when this frame's form is off even at full range (bent arms on a raise).
 *  - tip:  what to fix if the rep falls short.
 *  - raw:  the measured value, for calibration.
 */
export type Metric = { p: number; back: number; form: boolean; tip: Tip; raw: Record<string, number> };

type Sample = { t: number; v: number };

/**
 * Rolling state a metric needs between frames: the last few seconds of squat positions, so
 * "standing" is where the user usually is at the top (not one lucky or glitchy frame).
 */
export type MetricMemory = { hipY?: Sample[]; shoulderY?: Sample[]; legs?: Sample[]; feet?: Sample[] };

// Defaults before a movement check (fairly typical ranges). A movement check can only make a
// move easier than these, never harder (calibrationFrom).
export const DEFAULTS = {
  squatDepth: 0.68, // feet in view: hip→ankle height drops to 68% of standing = full squat
  squatDrop: 0.9, // upper body only: hips drop 0.9 shoulder widths = full squat
  jackSpread: 1.6, // feet 1.6 × shoulder width apart
  jackArms: 0.5, // hands half a torso above the shoulders (above the head)
  raiseArms: 0.6,
};

// Rest positions (progress 0).
const SQUAT_REST = 1;
const JACK_SPREAD_REST = 0.8;
const ARMS_REST = -0.6; // hands well below the shoulders

/** How long "standing" is remembered, and which share of those frames counts as the top. */
const STANDING_WINDOW_MS = 5000;
const STANDING_SHARE = 0.2;
/** A bow: shoulders drop at least half a squat while the hips drop less than 40% of that. */
const BOW_SHOULDERS = 0.5;
const BOW_HIPS = 0.4;
/**
 * Squats use the legs only when the feet were in view for most of the last few seconds. With
 * the phone on a table, the tracker sometimes "sees" made-up ankles for a few frames (e.g. at
 * the bottom of a bow); those must not switch the method.
 */
const FEET_SHARE = 0.6;

const SQUAT_CORE = [P.lShoulder, P.rShoulder, P.lHip, P.rHip];

const REQUIRED: Record<Exercise, number[]> = {
  // Feet are optional for squats: without them the upper body is measured instead.
  squat: SQUAT_CORE,
  jack: [P.lShoulder, P.rShoulder, P.lWrist, P.rWrist, P.lHip, P.rHip, P.lAnkle, P.rAnkle],
  raise: [P.lShoulder, P.rShoulder, P.lElbow, P.rElbow, P.lWrist, P.rWrist, P.lHip, P.rHip],
};

export function requiredPoints(ex: Exercise): number[] {
  return REQUIRED[ex];
}

/** Hands' height above the shoulders, in torso lengths (lower hand counts, so both must be up). */
function armsHeight(pose: Pose): number {
  const s = pose.pts;
  const shoulders = mid(s[P.lShoulder], s[P.rShoulder]);
  const torso = dist(shoulders, mid(s[P.lHip], s[P.rHip])) || 1;
  const lowerHandY = Math.max(s[P.lWrist].y, s[P.rWrist].y);
  return (shoulders.y - lowerHandY) / torso;
}

const span = (value: number, rest: number, full: number) => clamp01((value - rest) / (full - rest));

/**
 * Both legs visible and inside the frame, and in a body-like order (hips above knees above
 * ankles): squat depth can be measured from the legs.
 */
export function feetInView(pose: Pose): boolean {
  const s = pose.pts;
  if (!visible(pose, [P.lKnee, P.rKnee, P.lAnkle, P.rAnkle])) return false;
  if (Math.max(s[P.lAnkle].y, s[P.rAnkle].y) > pose.h * 0.99) return false;
  const hips = mid(s[P.lHip], s[P.rHip]).y;
  const knees = mid(s[P.lKnee], s[P.rKnee]).y;
  const ankles = mid(s[P.lAnkle], s[P.rAnkle]).y;
  return hips < knees && knees < ankles;
}

function remember(list: Sample[] | undefined, t: number, v: number): Sample[] {
  const kept = (list ?? []).filter((s) => t - s.t < STANDING_WINDOW_MS);
  kept.push({ t, v });
  return kept;
}

/** The value at share `q` (0 = smallest, 1 = largest) of the remembered samples. */
function quantile(list: Sample[] | undefined, q: number): number | undefined {
  if (!list?.length) return undefined;
  const vs = list.map((s) => s.v).sort((a, b) => a - b);
  return vs[Math.round(q * (vs.length - 1))];
}

/**
 * Adds this frame to the squat memory (called on every frame before `measure`). Positions are
 * kept for a few seconds; "standing" is then the top 20% of them, which ignores glitches and
 * follows the user if they step closer or further away.
 */
export function rememberPose(ex: Exercise, pose: Pose, mem: MetricMemory): MetricMemory {
  if (ex !== 'squat' || !visible(pose, SQUAT_CORE)) return mem;
  const s = pose.pts;
  const shoulderW = dist(s[P.lShoulder], s[P.rShoulder]);
  if (shoulderW <= 0) return mem;
  const hips = mid(s[P.lHip], s[P.rHip]);
  const feet = feetInView(pose);
  const next: MetricMemory = {
    hipY: remember(mem.hipY, pose.t, hips.y),
    shoulderY: remember(mem.shoulderY, pose.t, mid(s[P.lShoulder], s[P.rShoulder]).y),
    legs: mem.legs,
    feet: remember(mem.feet, pose.t, feet ? 1 : 0),
  };
  if (feet) {
    const ankles = mid(s[P.lAnkle], s[P.rAnkle]);
    next.legs = remember(mem.legs, pose.t, (ankles.y - hips.y) / shoulderW);
  }
  return next;
}

/**
 * Squat progress. Feet in view: hip→ankle height compared with standing (knees must bend).
 * Otherwise: how far the hips drop from standing, in shoulder widths (distance-proof, works
 * with the phone on a table). Either way, shoulders dropping without the hips is a bow: it
 * moves `back` (so the user gets a tip) but never `p` (so it never counts).
 */
function measureSquat(pose: Pose, cal: Calibration, mem: MetricMemory): Metric | null {
  const s = pose.pts;
  const shoulderW = dist(s[P.lShoulder], s[P.rShoulder]);
  if (shoulderW <= 0) return null;
  const hips = mid(s[P.lHip], s[P.rHip]);
  const shoulders = mid(s[P.lShoulder], s[P.rShoulder]);
  const fullDrop = cal.squatDrop ?? DEFAULTS.squatDrop;

  // Image y grows downward, so "standing" is the smallest y (top share) of recent frames.
  const hipDrop = (hips.y - (quantile(mem.hipY, STANDING_SHARE) ?? hips.y)) / shoulderW;
  const shoulderDrop = (shoulders.y - (quantile(mem.shoulderY, STANDING_SHARE) ?? shoulders.y)) / shoulderW;
  // A real squat lowers both; min() also ignores a hip point that jumps on its own.
  const drop = Math.min(hipDrop, shoulderDrop);
  const shoulderP = span(shoulderDrop, 0, fullDrop);

  let p: number;
  const raw: Record<string, number> = { drop, hipDrop, shoulderDrop };
  const feetSeen = mem.feet?.length ? mem.feet.reduce((n, f) => n + f.v, 0) / mem.feet.length : 0;
  if (feetInView(pose) && feetSeen >= FEET_SHARE) {
    const ankles = mid(s[P.lAnkle], s[P.rAnkle]);
    const legs = (ankles.y - hips.y) / shoulderW;
    if (legs <= 0) return null;
    const depth = legs / (quantile(mem.legs, 1 - STANDING_SHARE) ?? legs);
    p = span(SQUAT_REST - depth, 0, SQUAT_REST - (cal.squatDepth ?? DEFAULTS.squatDepth));
    raw.depth = depth;
    raw.feet = 1;
  } else {
    p = span(drop, 0, fullDrop);
    raw.feet = 0;
  }

  const bow = shoulderP >= BOW_SHOULDERS && p < shoulderP * BOW_HIPS;
  return { p, back: Math.max(p, shoulderP), form: true, tip: bow ? 'knees' : 'lower', raw };
}

/**
 * Progress for one frame, or null when the needed body points aren't visible (the frame is
 * skipped; nothing is counted).
 */
export function measure(ex: Exercise, pose: Pose, cal: Calibration, mem: MetricMemory): Metric | null {
  if (!visible(pose, REQUIRED[ex])) return null;
  const s = pose.pts;

  if (ex === 'squat') return measureSquat(pose, cal, mem);

  if (ex === 'jack') {
    const shoulderW = dist(s[P.lShoulder], s[P.rShoulder]) || 1;
    const spread = Math.abs(s[P.lAnkle].x - s[P.rAnkle].x) / shoulderW;
    const arms = armsHeight(pose);
    const legsP = span(spread, JACK_SPREAD_REST, cal.jackSpread ?? DEFAULTS.jackSpread);
    const armsP = span(arms, ARMS_REST, cal.jackArms ?? DEFAULTS.jackArms);
    return {
      p: Math.min(legsP, armsP),
      back: Math.max(legsP, armsP),
      form: true,
      tip: armsP < legsP ? 'arms-higher' : 'feet-wider',
      raw: { spread, arms },
    };
  }

  // Overhead arm raise: both hands up; elbows fairly straight at the top.
  const arms = armsHeight(pose);
  const p = span(arms, ARMS_REST, cal.raiseArms ?? DEFAULTS.raiseArms);
  const elbows = Math.min(
    angle(s[P.lShoulder], s[P.lElbow], s[P.lWrist]),
    angle(s[P.rShoulder], s[P.rElbow], s[P.rWrist])
  );
  const straight = elbows >= 140;
  return { p, back: p, form: straight, tip: p >= 0.9 && !straight ? 'straight-arms' : 'reach-higher', raw: { arms, elbows } };
}

/**
 * Calibration from the extremes of one slow rep. It can lower the bar for someone with a
 * smaller range, but never raise it above the defaults: a botched check (e.g. bending down to
 * fix the phone) must not make reps harder to count.
 */
export function calibrationFrom(ex: Exercise, extremes: Record<string, number>): Calibration {
  const within = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
  if (ex === 'squat') {
    // Only what the check actually measured (feet may have been out of view).
    const cal: Calibration = {};
    if (extremes.depth !== undefined) cal.squatDepth = within(extremes.depth + 0.04, DEFAULTS.squatDepth, 0.8);
    if (extremes.drop !== undefined) cal.squatDrop = within(extremes.drop - 0.1, 0.5, DEFAULTS.squatDrop);
    return cal;
  }
  if (ex === 'jack') {
    return {
      jackSpread: within((extremes.spread ?? DEFAULTS.jackSpread) - 0.1, 1.2, DEFAULTS.jackSpread),
      jackArms: within((extremes.arms ?? DEFAULTS.jackArms) - 0.1, 0.2, DEFAULTS.jackArms),
    };
  }
  return { raiseArms: within((extremes.arms ?? DEFAULTS.raiseArms) - 0.1, 0.3, DEFAULTS.raiseArms) };
}

/** Which raw value is "more extreme" for calibration: lower depth, bigger drop, wider spread, higher arms. */
export function moreExtreme(key: string, a: number, b: number): number {
  return key === 'depth' ? Math.min(a, b) : Math.max(a, b);
}
