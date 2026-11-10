import { useCallback, useEffect, useRef, useState } from 'react';

import { initCounter, stepCounter, type CounterState } from './counter';
import { checkFraming, STILL_COUNTDOWN, stayedStill, stillThere, type Framing } from './framing';
import { calibrationFrom } from './metrics';
import { parsePose, type Pose, type RawFrame } from './pose';
import { useMuscle } from './store';
import type { Exercise, Tip } from './types';

/**
 * One Muscle session, driven by camera frames:
 *   setup (get fully in view, hold ~1 s) → countdown 3-2-1 → check (one slow rep, first time
 *   only) → go (count to target) → done.
 * Leaving the frame during the 3-2-1 or during a set pauses: back to setup, then a fresh
 * 3-2-1, then counting carries on. Reps are kept (only "Again" resets them).
 * React state changes only when something visible changes (not on every frame).
 */
export type Stage = 'setup' | 'countdown' | 'check' | 'checked' | 'go' | 'done';

/** Why setup is showing again: the user left during the 3-2-1, or during the set. */
export type Interruption = 'countdown' | 'set' | null;

const HOLD_MS = 1200;
const COUNTDOWN = 3;
const TIP_MS = 2200;
const CHECKED_MS = 1400;
const SETTLE_FRAMES = 24;
/** How long the user may be out of place before we pause (one bad frame is just noise). */
const AWAY_MS = 450;

type Options = { exercise: Exercise; target: number; checkOnly?: boolean };

export function useMuscleSession({ exercise, target, checkOnly = false }: Options) {
  const needsCheck = checkOnly || !useMuscle.getState().checked.includes(exercise);
  const [stage, setStage] = useState<Stage>('setup');
  const [framing, setFraming] = useState<Framing>('no-person');
  const [count, setCount] = useState(COUNTDOWN);
  const [reps, setReps] = useState(0);
  const [fullReps, setFullReps] = useState(0);
  const [tip, setTip] = useState<Tip | null>(null);
  const [interrupted, setInterrupted] = useState<Interruption>(null);
  /** Bumped on every counted rep, so the UI can pop the counter. */
  const [repTick, setRepTick] = useState(0);

  const stageRef = useRef<Stage>('setup');
  const counter = useRef<CounterState>(initCounter());
  /**
   * Where the user stood when setup succeeded (start of the "in view and still" hold). The
   * 3-2-1 and the set compare against it to notice the user walking off.
   */
  const anchor = useRef<Pose | null>(null);
  /** When the user first looked out of place (3-2-1 or set). */
  const awaySince = useRef<number | null>(null);
  const lastLog = useRef(0);
  const tipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Latest pose, for the skeleton overlay. */
  const pose = useRef<Pose | null>(null);

  const go = useCallback((next: Stage) => {
    stageRef.current = next;
    awaySince.current = null;
    if (next === 'countdown') setCount(COUNTDOWN);
    setStage(next);
  }, []);

  const showTip = useCallback((t: Tip | null) => {
    if (tipTimer.current) clearTimeout(tipTimer.current);
    setTip(t);
    if (t) tipTimer.current = setTimeout(() => setTip(null), TIP_MS);
  }, []);

  /** The user left: back to setup. Reps stay; the next 3-2-1 picks up where we were. */
  const pause = useCallback(
    (why: Exclude<Interruption, null>, f: Framing) => {
      anchor.current = null;
      setFraming(f);
      setInterrupted(why);
      showTip(null);
      go('setup');
    },
    [go, showTip]
  );

  // 3-2-1, then start (or resume) counting, or the movement check.
  useEffect(() => {
    if (stage !== 'countdown') return;
    let n = COUNTDOWN;
    const id = setInterval(() => {
      n -= 1;
      if (n > 0) setCount(n);
      else {
        clearInterval(id);
        // Fresh "standing" memory (the user may now stand somewhere else), same rep count.
        const { reps: done, fullReps: doneFull } = counter.current;
        counter.current = { ...initCounter(), reps: done, fullReps: doneFull };
        setInterrupted(null);
        go(needsCheck ? 'check' : 'go');
      }
    }, 1000);
    return () => clearInterval(id);
  }, [stage, needsCheck, go]);

  // After a successful movement check: a short "Got it", then count for real.
  useEffect(() => {
    if (stage !== 'checked') return;
    const id = setTimeout(() => {
      counter.current = initCounter();
      go(checkOnly ? 'done' : 'go');
    }, CHECKED_MS);
    return () => clearTimeout(id);
  }, [stage, checkOnly, go]);

  useEffect(() => () => {
    if (tipTimer.current) clearTimeout(tipTimer.current);
  }, []);

  const onFrame = useCallback(
    (frame: RawFrame) => {
      const p = parsePose(frame);
      pose.current = p;
      const st = stageRef.current;

      if (st === 'setup') {
        const f = checkFraming(exercise, p);
        setFraming(f);
        if (f === 'ok' && p) {
          // Restart the hold whenever the user moves (still walking back, fixing the phone…).
          if (!anchor.current || !stayedStill(anchor.current, p)) anchor.current = p;
          else if (frame.t - anchor.current.t >= HOLD_MS) go('countdown');
        } else anchor.current = null;
        return;
      }

      if (st === 'countdown') {
        // Stop the 3-2-1 if the user leaves the frame or walks off.
        const f = checkFraming(exercise, p);
        const inPlace = f === 'ok' && p && anchor.current && stayedStill(anchor.current, p, STILL_COUNTDOWN);
        if (inPlace) awaySince.current = null;
        else {
          awaySince.current ??= frame.t;
          if (frame.t - awaySince.current >= AWAY_MS) pause('countdown', f);
        }
        return;
      }

      if (st !== 'check' && st !== 'go') return;

      // Frames where the user isn't really there (gone, half out of frame, a glitchy pose)
      // are never counted; if it lasts, pause the set.
      if (!anchor.current || !stillThere(anchor.current, p)) {
        awaySince.current ??= frame.t;
        if (frame.t - awaySince.current >= AWAY_MS) pause('set', checkFraming(exercise, p));
        return;
      }
      awaySince.current = null;

      // The movement check is judged by the default ranges, so an earlier odd check can't
      // affect a new one.
      const cal = st === 'check' ? {} : useMuscle.getState().calibration;
      const { state, event } = stepCounter(exercise, cal, counter.current, p);
      counter.current = state;
      // Dev only: the measured movement 4× a second, for tuning on a real phone.
      if (__DEV__ && frame.t - lastLog.current >= 250) {
        lastLog.current = frame.t;
        const raw = Object.entries(state.raw)
          .map(([k, v]) => `${k}=${v.toFixed(2)}`)
          .join(' ');
        console.log(`[muscle-p] ${exercise} ${state.phase} p=${state.p.toFixed(2)} back=${state.back.toFixed(2)} ${raw}`);
      }
      if (!event) return;
      if (__DEV__) console.log(`[muscle-rep] ${exercise} ${JSON.stringify(event)} p=${state.p.toFixed(2)}`);

      if (event.kind === 'shallow') {
        // Counting may start mid-movement; no tips in the first second.
        if (state.frames > SETTLE_FRAMES) showTip(event.tip);
        return;
      }

      if (st === 'check') {
        // One slow rep shows the user's own range; save it and start counting.
        const cal = calibrationFrom(exercise, state.extremes);
        if (__DEV__) console.log(`[muscle-check] ${exercise} ${JSON.stringify(state.extremes)} → ${JSON.stringify(cal)}`);
        useMuscle.getState().saveCheck(exercise, cal);
        showTip(null);
        go('checked');
        return;
      }

      setReps(state.reps);
      setFullReps(state.fullReps);
      setRepTick((n) => n + 1);
      showTip(event.full ? null : (event.tip ?? null));
      if (state.reps >= target) {
        useMuscle.getState().recordSet(exercise, state.reps, state.fullReps);
        go('done');
      }
    },
    [exercise, target, go, showTip, pause]
  );

  /** Start over (same exercise): "Again" on the result screen. Resets the reps. */
  const restart = useCallback(() => {
    counter.current = initCounter();
    anchor.current = null;
    setReps(0);
    setFullReps(0);
    setInterrupted(null);
    showTip(null);
    go('setup');
  }, [go, showTip]);

  return { stage, framing, count, reps, fullReps, tip, interrupted, repTick, pose, onFrame, restart, needsCheck };
}
