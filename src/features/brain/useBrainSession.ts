import { useCallback, useEffect, useState } from 'react';

import { saveAnswer, type SessionMode } from './history';
import { createRng, type Rng } from './random';
import { nextQuestion } from './select';
import { useBrain } from './store';
import { CALIBRATION_SECONDS, isFast, MAX_EXTRA_QUESTIONS, timeLimitSeconds } from './toll';
import type { AnswerRecord, Question } from './types';

export type Phase = 'question' | 'feedback' | 'result';

type Options = {
  mode: SessionMode;
  /** Questions needed before the result (ignored in calibration, which runs on a clock). */
  required: number;
  /** Extra difficulty steps (repeat tolls). */
  bump: number;
};

/** Is the typed / picked answer right? Numbers ignore leading zeros. */
export function isCorrect(q: Question, given: string | null): boolean {
  if (given === null) return false;
  if (q.type === 'numeric') return given.replace(/^0+(?=\d)/, '') === q.answer;
  return given === q.answer;
}

/**
 * Runs one Brain session (toll, practice or calibration): picks questions, times them,
 * scores and records answers, and handles "Keep going" extra questions.
 */
/** Mutable bits of one session that never need a re-render. Only touched in handlers/effects. */
type SessionContext = {
  rng: Rng;
  seen: Set<string>;
  startedAt: number;
  sessionStart: number;
};

function pickQuestion(ctx: SessionContext, bump: number): Question {
  const { areas, ratings } = useBrain.getState();
  const q = nextQuestion({ areas, ratings, bump, seen: ctx.seen, rng: ctx.rng });
  ctx.seen.add(q.id);
  ctx.startedAt = Date.now();
  // Dev builds only: lets automated device tests know the right answer (adb logcat -s ReactNativeJS).
  if (__DEV__) console.log(`[brain-q] ${q.id} type=${q.type} answer=${q.answer} options=${JSON.stringify(q.options ?? [])}`);
  return q;
}

export function useBrainSession({ mode, required, bump }: Options) {
  // One-time setup: random generator, recently seen questions, clocks and the first question.
  const [init] = useState(() => {
    const ctx: SessionContext = {
      rng: createRng(Date.now() & 0x7fffffff),
      seen: new Set(useBrain.getState().seen),
      startedAt: 0,
      sessionStart: Date.now(),
    };
    return { ctx, first: pickQuestion(ctx, bump) };
  });
  const ctx = init.ctx;

  const makeQuestion = useCallback(() => pickQuestion(ctx, bump), [ctx, bump]);

  const [question, setQuestion] = useState<Question>(init.first);
  const [phase, setPhase] = useState<Phase>('question');
  const [input, setInput] = useState('');
  const [given, setGiven] = useState<string | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [extra, setExtra] = useState<AnswerRecord[]>([]);
  const [extraMode, setExtraMode] = useState(false);
  const [calibrationLeft, setCalibrationLeft] = useState(CALIBRATION_SECONDS);

  const limit = timeLimitSeconds(question);

  const submit = useCallback(
    (answer: string | null) => {
      if (phase !== 'question') return;
      const ms = Date.now() - ctx.startedAt;
      const correct = isCorrect(question, answer);
      const record: AnswerRecord = {
        questionId: question.id,
        area: question.area,
        subskill: question.subskill,
        difficulty: question.difficulty,
        correct,
        ms: answer === null ? limit * 1000 : ms,
        fast: correct && isFast(ms, limit),
      };
      useBrain.getState().recordAnswer(record, mode === 'calibration');
      saveAnswer(record, mode);
      setGiven(answer);
      setTimedOut(answer === null);
      if (extraMode) setExtra((e) => [...e, record]);
      else setAnswers((a) => [...a, record]);
      setPhase('feedback');
    },
    [phase, question, limit, mode, extraMode, ctx]
  );

  // Time's up for this question.
  useEffect(() => {
    if (phase !== 'question') return;
    const t = setTimeout(() => submit(null), limit * 1000);
    return () => clearTimeout(t);
  }, [phase, question.id, limit, submit]);

  // Calibration runs on one 60-second clock.
  useEffect(() => {
    if (mode !== 'calibration') return;
    const t = setInterval(() => {
      const left = Math.max(0, CALIBRATION_SECONDS - Math.floor((Date.now() - ctx.sessionStart) / 1000));
      setCalibrationLeft(left);
    }, 250);
    return () => clearInterval(t);
  }, [mode, ctx]);

  const ask = useCallback(() => {
    setQuestion(makeQuestion());
    setInput('');
    setGiven(null);
    setTimedOut(false);
    setPhase('question');
  }, [makeQuestion]);

  /** After the feedback panel: next question, or the result. */
  const next = useCallback(() => {
    const done =
      mode === 'calibration'
        ? calibrationLeft <= 0
        : extraMode
          ? extra.length >= MAX_EXTRA_QUESTIONS
          : answers.length >= required;
    if (done) setPhase('result');
    else ask();
  }, [mode, calibrationLeft, extraMode, extra.length, answers.length, required, ask]);

  /** "Keep going": extra questions after passing, each right one adds bonus minutes. */
  const keepGoing = useCallback(() => {
    setExtraMode(true);
    ask();
  }, [ask]);

  /** Start a fresh set (after failing). */
  const restart = useCallback(() => {
    setAnswers([]);
    setExtra([]);
    setExtraMode(false);
    ask();
  }, [ask]);

  return {
    question,
    phase,
    input,
    setInput,
    given,
    timedOut,
    limit,
    answers,
    correctCount: answers.filter((a) => a.correct).length,
    extra,
    extraCorrect: extra.filter((a) => a.correct).length,
    extraMode,
    calibrationLeft,
    submit,
    next,
    keepGoing,
    restart,
    /** End the extra round early and go to the result. */
    finishExtra: () => setPhase('result'),
  };
}
