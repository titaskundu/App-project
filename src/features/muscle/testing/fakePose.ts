import { P, POINTS, type Pose, type Pt } from '../pose';

/**
 * A simple stick figure in a 480×640 frame, for tests. Torso 150 px, shoulders 80 px wide,
 * standing hip→ankle height 220 px.
 *  - depth:  hip height as a share of standing (1 = standing, 0.65 = deep squat)
 *  - arms:   hands' height above the shoulders in torso lengths (-0.9 = at the sides)
 *  - spread: feet distance in shoulder widths (0.625 = together)
 *  - bent:   bend the elbows (arms raise form check)
 *  - bow:    lean forward without bending the knees (0–1: shoulders drop by that share of the torso)
 *  - scale:  how big the person looks (1 = normal, 1.2 = stepped closer)
 *  - hide:   point ids with low visibility
 */
export type FakeOpts = {
  t: number;
  depth?: number;
  arms?: number;
  spread?: number;
  bent?: boolean;
  bow?: number;
  scale?: number;
  hide?: number[];
};

export function fakePose({ t, depth = 1, arms = -0.9, spread = 0.625, bent = false, bow = 0, scale = 1, hide = [] }: FakeOpts): Pose {
  const cx = 240;
  const ankleY = 560;
  const S = (n: number) => n * scale;
  const pts: Pt[] = Array.from({ length: POINTS }, () => ({ x: cx, y: 320, v: 0.1 }));
  const set = (i: number, x: number, y: number) => {
    pts[i] = { x, y, v: hide.includes(i) ? 0.1 : 0.95 };
  };

  const hipY = ankleY - S(220) * depth;
  const shoulderY = hipY - S(150) * (1 - bow);
  const kneeY = (hipY + ankleY) / 2;
  const kneeOut = S(30) * (1 - depth);
  const footHalf = (S(80) * spread) / 2;

  set(P.nose, cx, shoulderY - S(50));
  set(P.lShoulder, cx - S(40), shoulderY);
  set(P.rShoulder, cx + S(40), shoulderY);
  set(P.lHip, cx - S(25), hipY);
  set(P.rHip, cx + S(25), hipY);
  set(P.lKnee, cx - S(25) - kneeOut, kneeY);
  set(P.rKnee, cx + S(25) + kneeOut, kneeY);
  set(P.lAnkle, cx - footHalf, ankleY);
  set(P.rAnkle, cx + footHalf, ankleY);

  const wristY = shoulderY - arms * S(150);
  const lWristX = cx - S(40) - S(30);
  const rWristX = cx + S(40) + S(30);
  set(P.lWrist, lWristX, wristY);
  set(P.rWrist, rWristX, wristY);
  // Elbow halfway along the arm, pushed sideways when bent.
  const bend = bent ? S(45) : 0;
  set(P.lElbow, (cx - S(40) + lWristX) / 2 - bend, (shoulderY + wristY) / 2);
  set(P.rElbow, (cx + S(40) + rWristX) / 2 + bend, (shoulderY + wristY) / 2);

  return { t, w: 480, h: 640, pts };
}

const PEAKS: Record<'squat' | 'jack' | 'raise', Omit<FakeOpts, 't'>> = {
  squat: { depth: 0.65 },
  jack: { arms: 0.7, spread: 1.8 },
  raise: { arms: 0.8 },
};

/**
 * Debug simulator (dev builds only): frame `i` of an endless loop of full reps, as the raw
 * numbers the camera sends. Lets the Muscle screen be tested on the emulator.
 */
export function simFrame(ex: 'squat' | 'jack' | 'raise', i: number): { t: number; w: number; h: number; lm: number[] } {
  const c = i % 36;
  const k = c < 8 ? 0 : c < 20 ? (c - 8) / 11 : c < 23 ? 1 : 1 - (c - 23) / 12;
  const peak = PEAKS[ex];
  const pose = fakePose({
    t: i * 42,
    depth: 1 + ((peak.depth ?? 1) - 1) * k,
    arms: -0.9 + ((peak.arms ?? -0.9) + 0.9) * k,
    spread: 0.625 + ((peak.spread ?? 0.625) - 0.625) * k,
  });
  return { t: pose.t, w: pose.w, h: pose.h, lm: pose.pts.flatMap((p) => [p.x / pose.w, p.y / pose.h, p.v]) };
}

/** Frames moving smoothly from `from` to `to` options over `frames` frames (~24 fps). */
export function ramp(
  start: number,
  frames: number,
  from: Omit<FakeOpts, 't'>,
  to: Omit<FakeOpts, 't'>
): Pose[] {
  const out: Pose[] = [];
  const lerp = (a = 0, b = 0, k: number) => a + (b - a) * k;
  for (let i = 0; i < frames; i++) {
    const k = frames === 1 ? 1 : i / (frames - 1);
    out.push(
      fakePose({
        t: start + i * 42,
        depth: lerp(from.depth ?? 1, to.depth ?? 1, k),
        arms: lerp(from.arms ?? -0.9, to.arms ?? -0.9, k),
        spread: lerp(from.spread ?? 0.625, to.spread ?? 0.625, k),
        bent: k > 0.5 ? to.bent : from.bent,
        bow: lerp(from.bow ?? 0, to.bow ?? 0, k),
        scale: lerp(from.scale ?? 1, to.scale ?? 1, k),
        hide: to.hide ?? from.hide,
      })
    );
  }
  return out;
}
