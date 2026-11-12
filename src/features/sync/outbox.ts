import type { AnswerRecord } from '@/features/brain/types';

/**
 * Pure helpers for the upload queue ("outbox"). Every toll result and Brain answer is saved on
 * the phone first and queued here; the queue uploads when there's internet. Rows carry an id
 * made on the phone, so uploading the same row twice (after a dropped connection) is harmless.
 */
export type OutboxTable = 'toll_events' | 'answers';

export type OutboxItem = {
  id: string;
  table: OutboxTable;
  payload: Record<string, unknown>;
  createdAt: number;
};

export const BATCH_SIZE = 50;

/** Splits the queue into upload batches: one table per batch, oldest first, at most BATCH_SIZE. */
export function batches(items: OutboxItem[], size = BATCH_SIZE): { table: OutboxTable; items: OutboxItem[] }[] {
  const out: { table: OutboxTable; items: OutboxItem[] }[] = [];
  const byTable = new Map<OutboxTable, OutboxItem[]>();
  for (const it of [...items].sort((a, b) => a.createdAt - b.createdAt)) {
    const list = byTable.get(it.table) ?? [];
    list.push(it);
    byTable.set(it.table, list);
  }
  for (const [table, list] of byTable) {
    for (let i = 0; i < list.length; i += size) out.push({ table, items: list.slice(i, i + size) });
  }
  return out;
}

const RETRY_BASE_MS = 30_000;
const RETRY_MAX_MS = 30 * 60_000;

/** How long to wait before trying again after `failures` failed uploads in a row (0 = now). */
export function retryDelayMs(failures: number): number {
  if (failures <= 0) return 0;
  return Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** (failures - 1));
}

/** True when enough time has passed since the last failure to try uploading again. */
export function canRetry(now: number, lastFailureAt: number, failures: number): boolean {
  return now - lastFailureAt >= retryDelayMs(failures);
}

export type TollEventInput =
  | {
      kind: 'brain';
      mode: 'toll' | 'practice';
      scope?: string;
      passed: boolean;
      minutes: number;
      questions: number;
      correct: number;
    }
  | {
      kind: 'muscle';
      mode: 'toll' | 'practice';
      scope?: string;
      passed: boolean;
      minutes: number;
      exercise: string;
      reps: number;
      fullReps: number;
    }
  | { kind: 'bank'; scope: string; minutes: number };

/** The `toll_events` row for one result (user_id is filled in by the server). */
export function tollEventRow(e: TollEventInput, id: string, now: number): Record<string, unknown> {
  const base = { id, ts: new Date(now).toISOString(), kind: e.kind, scope: e.scope || null, minutes: Math.round(e.minutes) };
  if (e.kind === 'bank') return { ...base, mode: 'toll', passed: true, detail: {} };
  if (e.kind === 'brain')
    return { ...base, mode: e.mode, passed: e.passed, detail: { questions: e.questions, correct: e.correct } };
  return { ...base, mode: e.mode, passed: e.passed, detail: { exercise: e.exercise, reps: e.reps, fullReps: e.fullReps } };
}

/** The `answers` row for one Brain answer (mirrors the phone's brain.db). */
export function answerRow(
  a: AnswerRecord,
  mode: 'toll' | 'practice' | 'calibration',
  id: string,
  now: number
): Record<string, unknown> {
  return {
    id,
    ts: new Date(now).toISOString(),
    mode,
    question_id: a.questionId,
    area: a.area,
    subskill: a.subskill,
    difficulty: a.difficulty,
    correct: a.correct,
    ms: Math.round(a.ms),
    fast: a.fast,
  };
}
