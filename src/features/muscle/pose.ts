/**
 * Body points from the pose camera, in frame pixels. Pure helpers, unit-tested.
 * Point numbers follow MediaPipe's 33-point body model.
 */
export const P = {
  nose: 0,
  lShoulder: 11,
  rShoulder: 12,
  lElbow: 13,
  rElbow: 14,
  lWrist: 15,
  rWrist: 16,
  lHip: 23,
  rHip: 24,
  lKnee: 25,
  rKnee: 26,
  lAnkle: 27,
  rAnkle: 28,
} as const;

export type Pt = { x: number; y: number; /** 0–1: how sure the tracker is this point is visible. */ v: number };

/** One frame: points in pixels of a w×h frame (y grows downward). */
export type Pose = { t: number; w: number; h: number; pts: Pt[] };

/** The raw frame shape sent by the native camera (subset of PoseFrame). */
export type RawFrame = { t: number; w: number; h: number; lm: number[] };

export const POINTS = 33;
export const VISIBLE = 0.5;

/** Raw frame → Pose, or null when nobody is in view. */
export function parsePose(f: RawFrame): Pose | null {
  if (f.lm.length < POINTS * 3) return null;
  const pts: Pt[] = [];
  for (let i = 0; i < POINTS; i++) {
    pts.push({ x: f.lm[i * 3] * f.w, y: f.lm[i * 3 + 1] * f.h, v: f.lm[i * 3 + 2] });
  }
  return { t: f.t, w: f.w, h: f.h, pts };
}

export const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
export const mid = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, v: Math.min(a.v, b.v) });

/** Angle at b (degrees) between b→a and b→c. 180 = straight. */
export function angle(a: Pt, b: Pt, c: Pt): number {
  const v1x = a.x - b.x;
  const v1y = a.y - b.y;
  const v2x = c.x - b.x;
  const v2y = c.y - b.y;
  const n = Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y);
  if (n === 0) return 180;
  const cos = Math.max(-1, Math.min(1, (v1x * v2x + v1y * v2y) / n));
  return (Math.acos(cos) * 180) / Math.PI;
}

export const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/** Are all these points visible enough? */
export function visible(pose: Pose, ids: readonly number[], min = VISIBLE): boolean {
  return ids.every((i) => pose.pts[i].v >= min);
}

/** Lines of the stick figure drawn over the camera. */
export const SKELETON: readonly (readonly [number, number])[] = [
  [P.lShoulder, P.rShoulder],
  [P.lShoulder, P.lElbow],
  [P.lElbow, P.lWrist],
  [P.rShoulder, P.rElbow],
  [P.rElbow, P.rWrist],
  [P.lShoulder, P.lHip],
  [P.rShoulder, P.rHip],
  [P.lHip, P.rHip],
  [P.lHip, P.lKnee],
  [P.lKnee, P.lAnkle],
  [P.rHip, P.rKnee],
  [P.rKnee, P.rAnkle],
];
