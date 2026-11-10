import { DEFAULTS, feetInView, requiredPoints } from './metrics';
import { dist, mid, P, VISIBLE, type Pose } from './pose';
import type { Exercise } from './types';

/**
 * Is the user placed well in the camera view for this exercise? Used before counting starts
 * ("Step back so I can see your feet"). Pure, unit-tested.
 */
export type Framing = 'ok' | 'no-person' | 'step-back' | 'come-closer';

export function checkFraming(ex: Exercise, pose: Pose | null): Framing {
  if (!pose) return 'no-person';
  const s = pose.pts;
  const core = [P.lShoulder, P.rShoulder, P.lHip, P.rHip];
  if (core.some((i) => s[i].v < VISIBLE)) return 'no-person';

  const inFrame = (i: number) =>
    s[i].v >= VISIBLE && s[i].x >= pose.w * 0.02 && s[i].x <= pose.w * 0.98 && s[i].y >= pose.h * 0.01 && s[i].y <= pose.h * 0.99;
  if (!requiredPoints(ex).every(inFrame)) return 'step-back';

  // Jumping jacks and arm raises need room above the head for the hands.
  if (ex !== 'squat' && s[P.nose].v >= VISIBLE && s[P.nose].y < pose.h * 0.2) return 'step-back';

  // Squats without feet in view (phone on a table): the hips need room below to drop.
  const feet = ex !== 'raise' && feetInView(pose);
  const hipsLow = Math.max(s[P.lHip].y, s[P.rHip].y);
  const shoulderW = dist(s[P.lShoulder], s[P.rShoulder]);
  if (ex === 'squat' && !feet && hipsLow + shoulderW * DEFAULTS.squatDrop > pose.h * 0.99) return 'step-back';

  // Too far away: the body is small in the frame and tracking gets shaky.
  const top = Math.min(s[P.lShoulder].y, s[P.rShoulder].y);
  const bottom = feet ? Math.max(s[P.lAnkle].y, s[P.rAnkle].y) : hipsLow;
  const share = (bottom - top) / pose.h;
  if (share < (feet ? 0.35 : 0.15)) return 'come-closer';

  return 'ok';
}

/**
 * Has the user stayed put since `anchor`? (hips moved less than `tolerance` shoulder widths).
 * Setup waits for this (strict), and the 3-2-1 stops if the user walks off (looser, so
 * getting into stance is fine).
 */
export const STILL_SETUP = 0.25;
export const STILL_COUNTDOWN = 0.6;

export function stayedStill(anchor: Pose, now: Pose, tolerance = STILL_SETUP): boolean {
  const a = anchor.pts;
  const b = now.pts;
  const shoulderW = dist(b[P.lShoulder], b[P.rShoulder]) || 1;
  return dist(mid(a[P.lHip], a[P.rHip]), mid(b[P.lHip], b[P.rHip])) < shoulderW * tolerance;
}

/**
 * During a set: is the user still there, roughly where they started? False when they've gone,
 * their shoulders left the frame, they walked sideways, or the tracker returns a glitchy
 * half-body (shoulders suddenly much narrower or wider). Only the shoulders are needed, so a
 * deep squat or raised hands near the frame edge don't count as leaving.
 */
export function stillThere(anchor: Pose, pose: Pose | null): boolean {
  if (!pose) return false;
  const s = pose.pts;
  const a = anchor.pts;
  const shoulders = [P.lShoulder, P.rShoulder];
  const inside = shoulders.every(
    (i) => s[i].v >= VISIBLE && s[i].x >= pose.w * 0.02 && s[i].x <= pose.w * 0.98 && s[i].y >= pose.h * 0.01 && s[i].y <= pose.h * 0.99
  );
  if (!inside) return false;
  const startW = dist(a[P.lShoulder], a[P.rShoulder]) || 1;
  const w = dist(s[P.lShoulder], s[P.rShoulder]);
  if (w < startW * 0.6 || w > startW * 1.7) return false;
  const sideways = Math.abs(mid(s[P.lShoulder], s[P.rShoulder]).x - mid(a[P.lShoulder], a[P.rShoulder]).x);
  return sideways < startW * 1.5;
}

export const FRAMING_TEXT: Record<Framing, string> = {
  ok: 'Perfect, hold still…',
  'no-person': 'Stand in front of the camera',
  'step-back': 'Step back so I can see all of you',
  'come-closer': 'Come a little closer',
};
