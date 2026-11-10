import { describe, expect, it } from '@jest/globals';

import { initCounter, stepCounter, type CounterEvent, type CounterState } from '../counter';
import { checkFraming, STILL_COUNTDOWN, stayedStill, stillThere } from '../framing';
import { calibrationFrom, DEFAULTS } from '../metrics';
import { angle, P, parsePose, type Pose } from '../pose';
import { formBonus, muscleReward, repsFor } from '../toll';
import type { Calibration, Exercise } from '../types';
import { fakePose, ramp, type FakeOpts } from '../testing/fakePose';

type Opts = Omit<FakeOpts, 't'>;

/** Builds a movie: hold, go to `peak`, come back, repeated `times`. */
function reps(peak: Opts, times = 1, rest: Opts = {}, holdFrames = 6, moveFrames = 12): Pose[] {
  const frames: Pose[] = [];
  let t = 0;
  const push = (list: Pose[]) => {
    frames.push(...list);
    t = list[list.length - 1].t + 42;
  };
  push(ramp(t, holdFrames, rest, rest));
  for (let i = 0; i < times; i++) {
    push(ramp(t, moveFrames, rest, peak));
    push(ramp(t, 3, peak, peak));
    push(ramp(t, moveFrames, peak, rest));
    push(ramp(t, holdFrames, rest, rest));
  }
  return frames;
}

/** The squat depth a fake pose was built with (hip→ankle height / 220 px). */
const depthOf = (f: Pose) => (f.pts[P.lAnkle].y - f.pts[P.lHip].y) / 220;

function run(ex: Exercise, frames: (Pose | null)[], cal: Calibration = {}) {
  let state: CounterState = initCounter();
  const events: CounterEvent[] = [];
  for (const f of frames) {
    const r = stepCounter(ex, cal, state, f);
    state = r.state;
    if (r.event) events.push(r.event);
  }
  return { state, events };
}

describe('pose helpers', () => {
  it('parses a raw frame into pixel points', () => {
    const lm = new Array(99).fill(0);
    lm[0] = 0.5;
    lm[1] = 0.25;
    lm[2] = 0.9;
    const pose = parsePose({ t: 1, w: 480, h: 640, lm });
    expect(pose?.pts[0]).toEqual({ x: 240, y: 160, v: 0.9 });
    expect(parsePose({ t: 1, w: 480, h: 640, lm: [] })).toBeNull();
  });

  it('measures angles', () => {
    expect(angle({ x: 0, y: 0, v: 1 }, { x: 1, y: 0, v: 1 }, { x: 2, y: 0, v: 1 })).toBeCloseTo(180);
    expect(angle({ x: 0, y: 0, v: 1 }, { x: 1, y: 0, v: 1 }, { x: 1, y: 1, v: 1 })).toBeCloseTo(90);
  });
});

describe('squats', () => {
  it('counts full squats', () => {
    const { state, events } = run('squat', reps({ depth: 0.65 }, 3));
    expect(state.reps).toBe(3);
    expect(state.fullReps).toBe(3);
    expect(events.every((e) => e.kind === 'rep' && e.full)).toBe(true);
  });

  it('counts a half squat (lenient) but not as full form, with a tip', () => {
    const { state, events } = run('squat', reps({ depth: 0.79 }));
    expect(state.reps).toBe(1);
    expect(state.fullReps).toBe(0);
    expect(events).toEqual([{ kind: 'rep', full: false, tip: 'lower' }]);
  });

  it('gives a tip for a small bob but does not count it', () => {
    const { state, events } = run('squat', reps({ depth: 0.87 }));
    expect(state.reps).toBe(0);
    expect(events).toEqual([{ kind: 'shallow', tip: 'lower' }]);
  });

  it('ignores standing still and tiny wobbles', () => {
    const { state, events } = run('squat', reps({ depth: 0.96 }, 3));
    expect(state.reps).toBe(0);
    expect(events).toEqual([]);
  });

  it('ignores a too-fast twitch', () => {
    const { state } = run('squat', reps({ depth: 0.6 }, 1, {}, 6, 3));
    expect(state.reps).toBe(0);
  });

  it('mixes leg and upper-body frames when the feet flicker out of view', () => {
    const frames = reps({ depth: 0.65 }, 2).map((f, i) =>
      i % 3 === 0 ? fakePose({ t: f.t, depth: depthOf(f), hide: [P.lAnkle] }) : f
    );
    const { state } = run('squat', [null, ...frames, null]);
    expect(state.reps).toBe(2);
  });

  it('a single glitchy frame does not spoil "standing"', () => {
    const frames = reps({ depth: 0.65 }, 3);
    // Ankles jump 70 px down for one frame while standing (the old "tallest ever" bug).
    frames[3] = { ...frames[3], pts: frames[3].pts.map((p, i) => (i === P.lAnkle || i === P.rAnkle ? { ...p, y: p.y + 70 } : p)) };
    expect(run('squat', frames).state.reps).toBe(3);
  });

  it('a bow (no knee bend) does not count and says to bend the knees', () => {
    const { state, events } = run('squat', reps({ bow: 0.6 }));
    expect(state.reps).toBe(0);
    expect(events).toEqual([{ kind: 'shallow', tip: 'knees' }]);
  });

  it('a squat with a forward lean still counts', () => {
    const { state } = run('squat', reps({ depth: 0.65, bow: 0.3 }, 2));
    expect(state.reps).toBe(2);
    expect(state.fullReps).toBe(2);
  });

  it('keeps counting after the user steps closer', () => {
    const closer = reps({ depth: 0.65, scale: 1.2 }, 2, { scale: 1.2 });
    const first = reps({ depth: 0.65 }, 1);
    const shifted = closer.map((f) => ({ ...f, t: f.t + first[first.length - 1].t + 42 }));
    const { state } = run('squat', [...first, ...shifted]);
    expect(state.reps).toBe(3);
  });

  it('uses the movement check: a shallower personal range still earns full form', () => {
    const cal = calibrationFrom('squat', { depth: 0.75 });
    expect(cal.squatDepth).toBeCloseTo(0.79);
    expect(run('squat', reps({ depth: 0.77 }), cal).state.fullReps).toBe(1);
    expect(run('squat', reps({ depth: 0.77 })).state.fullReps).toBe(0);
  });
});

describe('squats from the upper body (feet out of view, e.g. phone on a table)', () => {
  const NO_LEGS = [P.lKnee, P.rKnee, P.lAnkle, P.rAnkle];
  const up = (o: Opts): Opts => ({ ...o, hide: NO_LEGS });

  it('counts full squats', () => {
    const { state } = run('squat', reps(up({ depth: 0.65 }), 3, up({})));
    expect(state.reps).toBe(3);
    expect(state.fullReps).toBe(3);
  });

  it('counts a half squat (lenient) but not as full form', () => {
    const { state, events } = run('squat', reps(up({ depth: 0.79 }), 1, up({})));
    expect(state.reps).toBe(1);
    expect(events).toEqual([{ kind: 'rep', full: false, tip: 'lower' }]);
  });

  it('a small bob gives a tip, standing still gives nothing', () => {
    expect(run('squat', reps(up({ depth: 0.87 }), 1, up({}))).events).toEqual([{ kind: 'shallow', tip: 'lower' }]);
    expect(run('squat', reps(up({ depth: 0.96 }), 3, up({}))).events).toEqual([]);
  });

  it('a bow does not count', () => {
    const { state, events } = run('squat', reps(up({ bow: 0.6 }), 1, up({})));
    expect(state.reps).toBe(0);
    expect(events).toEqual([{ kind: 'shallow', tip: 'knees' }]);
  });

  it('a bow with made-up ankles at the bottom still does not count (seen on a real phone)', () => {
    let fake = 0;
    const frames = reps(up({ bow: 0.6 }), 1, up({})).map((f) => {
      const s = f.pts;
      const bowed = (s[P.lHip].y - s[P.lShoulder].y) / 150 < 0.6;
      if (!bowed) return f;
      // The tracker "sees" knees and ankles inside the frame, jumping around.
      const hipY = s[P.lHip].y;
      const ankleY = hipY + (fake++ % 2 ? 100 : 200);
      const pts = s.map((p, i) => {
        if (i === P.lKnee || i === P.rKnee) return { ...p, y: (hipY + ankleY) / 2, v: 0.9 };
        if (i === P.lAnkle || i === P.rAnkle) return { ...p, y: ankleY, v: 0.9 };
        return p;
      });
      return { ...f, pts };
    });
    expect(fake).toBeGreaterThan(5);
    const { state, events } = run('squat', frames);
    expect(state.reps).toBe(0);
    expect(events).toEqual([{ kind: 'shallow', tip: 'knees' }]);
  });

  it('keeps counting after the user steps closer and stands for a moment', () => {
    const first = reps(up({ depth: 0.65 }), 1, up({}));
    const closer = reps(up({ depth: 0.65, scale: 1.2 }), 2, up({ scale: 1.2 }), 30);
    const shifted = closer.map((f) => ({ ...f, t: f.t + first[first.length - 1].t + 42 }));
    expect(run('squat', [...first, ...shifted]).state.reps).toBe(3);
  });

  it('uses a movement check measured from the upper body', () => {
    const cal = calibrationFrom('squat', { drop: 0.7 });
    expect(cal).toEqual({ squatDrop: 0.6 });
    expect(run('squat', reps(up({ depth: 0.75 }), 1, up({})), cal).state.fullReps).toBe(1);
    expect(run('squat', reps(up({ depth: 0.75 }), 1, up({}))).state.fullReps).toBe(0);
  });
});

describe('jumping jacks', () => {
  it('counts full jacks', () => {
    const { state } = run('jack', reps({ arms: 0.7, spread: 1.8 }, 4, {}, 4, 8));
    expect(state.reps).toBe(4);
    expect(state.fullReps).toBe(4);
  });

  it('arms only (feet together) is not a rep, and says to jump wider', () => {
    const { state, events } = run('jack', reps({ arms: 0.7 }, 1, {}, 4, 8));
    expect(state.reps).toBe(0);
    expect(events).toEqual([{ kind: 'shallow', tip: 'feet-wider' }]);
  });

  it('a lazy jack counts without full form, with a tip for the weaker part', () => {
    const { state, events } = run('jack', reps({ arms: 0.1, spread: 1.6 }, 1, {}, 4, 8));
    expect(state.reps).toBe(1);
    expect(events).toEqual([{ kind: 'rep', full: false, tip: 'arms-higher' }]);
  });
});

describe('arm raises', () => {
  it('counts full raises', () => {
    const { state } = run('raise', reps({ arms: 0.8 }, 3));
    expect(state.reps).toBe(3);
    expect(state.fullReps).toBe(3);
  });

  it('bent arms count but are not full form', () => {
    const { state, events } = run('raise', reps({ arms: 0.8, bent: true }, 1, { bent: true }));
    expect(state.reps).toBe(1);
    expect(events).toEqual([{ kind: 'rep', full: false, tip: 'straight-arms' }]);
  });

  it('hands to shoulder height only gives a tip', () => {
    const { state, events } = run('raise', reps({ arms: -0.1 }));
    expect(state.reps).toBe(0);
    expect(events).toEqual([{ kind: 'shallow', tip: 'reach-higher' }]);
  });
});

describe('framing', () => {
  it('is ok when the whole body is in view', () => {
    for (const ex of ['squat', 'jack', 'raise'] as Exercise[]) expect(checkFraming(ex, fakePose({ t: 0 }))).toBe('ok');
  });

  it('feet cut off: fine for squats and arm raises, not for jumping jacks', () => {
    const pose = fakePose({ t: 0, hide: [P.lAnkle, P.rAnkle] });
    expect(checkFraming('squat', pose)).toBe('ok');
    expect(checkFraming('raise', pose)).toBe('ok');
    expect(checkFraming('jack', pose)).toBe('step-back');
  });

  it('squats without feet need room below the hips', () => {
    const low = fakePose({ t: 0, hide: [P.lAnkle, P.rAnkle] });
    low.pts = low.pts.map((p) => ({ ...p, y: p.y + 250 }));
    expect(checkFraming('squat', low)).toBe('step-back');
  });

  it('asks to come closer when tiny, and reports nobody', () => {
    expect(checkFraming('squat', fakePose({ t: 0, scale: 0.4 }))).toBe('come-closer');
    expect(checkFraming('squat', fakePose({ t: 0, scale: 0.3, hide: [P.lAnkle, P.rAnkle] }))).toBe('come-closer');
    expect(checkFraming('squat', null)).toBe('no-person');
    expect(checkFraming('squat', fakePose({ t: 0, hide: [P.lShoulder] }))).toBe('no-person');
  });

  it('setup waits until the user stands still', () => {
    const here = fakePose({ t: 0 });
    expect(stayedStill(here, fakePose({ t: 500, depth: 0.98 }))).toBe(true);
    const walked = { ...here, pts: here.pts.map((p) => ({ ...p, x: p.x + 40 })) };
    expect(stayedStill(here, walked)).toBe(false);
    // The 3-2-1 is looser (getting into stance is fine), but walking off still stops it.
    expect(stayedStill(here, walked, STILL_COUNTDOWN)).toBe(true);
    const gone = { ...here, pts: here.pts.map((p) => ({ ...p, x: p.x + 80 })) };
    expect(stayedStill(here, gone, STILL_COUNTDOWN)).toBe(false);
  });

  it('during a set: notices the user leaving or a glitchy half-body, not a deep squat', () => {
    const start = fakePose({ t: 0 });
    // Deep squat, bow, hands overhead: still there.
    expect(stillThere(start, fakePose({ t: 1, depth: 0.4 }))).toBe(true);
    expect(stillThere(start, fakePose({ t: 1, bow: 0.6 }))).toBe(true);
    expect(stillThere(start, fakePose({ t: 1, arms: 0.8 }))).toBe(true);
    // Gone, shoulders out of frame, walked sideways, shoulders suddenly tiny (glitch).
    expect(stillThere(start, null)).toBe(false);
    expect(stillThere(start, fakePose({ t: 1, hide: [P.lShoulder] }))).toBe(false);
    const shift = (dx: number) => ({ ...start, pts: start.pts.map((p) => ({ ...p, x: p.x + dx })) });
    expect(stillThere(start, shift(140))).toBe(false);
    expect(stillThere(start, shift(30))).toBe(true);
    const tiny = { ...start, pts: start.pts.map((p, i) => (i === P.rShoulder ? { ...p, x: start.pts[P.lShoulder].x + 20 } : p)) };
    expect(stillThere(start, tiny)).toBe(false);
  });
});

describe('calibration bounds', () => {
  it('can make a move easier, never harder than the defaults', () => {
    expect(calibrationFrom('squat', { depth: 0.2, drop: 3 })).toEqual({
      squatDepth: DEFAULTS.squatDepth,
      squatDrop: DEFAULTS.squatDrop,
    });
    expect(calibrationFrom('squat', { depth: 0.95, drop: 0.3 })).toEqual({ squatDepth: 0.8, squatDrop: 0.5 });
    expect(calibrationFrom('squat', {})).toEqual({});
    expect(calibrationFrom('jack', { spread: 5, arms: 2 })).toEqual({ jackSpread: DEFAULTS.jackSpread, jackArms: DEFAULTS.jackArms });
    expect(calibrationFrom('raise', {}).raiseArms).toBeCloseTo(DEFAULTS.raiseArms - 0.1);
  });
});

describe('muscle toll rules', () => {
  it('starts tiny and grows per toll, up to double', () => {
    expect([0, 1, 2, 5, 9].map((n) => repsFor('squat', n))).toEqual([5, 6, 7, 10, 10]);
    expect([0, 1, 5, 9].map((n) => repsFor('jack', n))).toEqual([10, 12, 20, 20]);
    expect([0, 1, 4, 9].map((n) => repsFor('raise', n))).toEqual([8, 10, 16, 16]);
  });

  it('adds a form bonus', () => {
    expect(formBonus(5, 5)).toBe(5);
    expect(formBonus(4, 5)).toBe(5);
    expect(formBonus(3, 5)).toBe(2);
    expect(formBonus(2, 5)).toBe(0);
    expect(formBonus(0, 0)).toBe(0);
    expect(muscleReward(8, 10)).toBe(15);
  });
});
