import { describe, expect, it } from '@jest/globals';

import { answerRow, batches, canRetry, retryDelayMs, tollEventRow, type OutboxItem } from '../outbox';
import { hasProgress, readBackup, readBlocker, readBrain, readMuscle } from '../snapshot';

const item = (id: string, table: OutboxItem['table'], createdAt: number): OutboxItem => ({
  id,
  table,
  payload: { id },
  createdAt,
});

describe('outbox batches', () => {
  it('groups by table, oldest first', () => {
    const out = batches([item('a2', 'answers', 3), item('t1', 'toll_events', 1), item('a1', 'answers', 2)]);
    expect(out.map((b) => [b.table, b.items.map((i) => i.id)])).toEqual([
      ['toll_events', ['t1']],
      ['answers', ['a1', 'a2']],
    ]);
  });

  it('splits big queues into batches of the given size', () => {
    const many = Array.from({ length: 120 }, (_, i) => item(`a${i}`, 'answers', i));
    const out = batches(many, 50);
    expect(out.map((b) => b.items.length)).toEqual([50, 50, 20]);
    expect(out[2].items[0].id).toBe('a100');
  });

  it('empty queue → no batches', () => {
    expect(batches([])).toEqual([]);
  });
});

describe('retry backoff', () => {
  it('tries straight away with no failures, then doubles up to 30 min', () => {
    expect(retryDelayMs(0)).toBe(0);
    expect(retryDelayMs(1)).toBe(30_000);
    expect(retryDelayMs(2)).toBe(60_000);
    expect(retryDelayMs(3)).toBe(120_000);
    expect(retryDelayMs(20)).toBe(30 * 60_000);
  });

  it('canRetry waits out the delay', () => {
    expect(canRetry(1000, 0, 0)).toBe(true);
    expect(canRetry(20_000, 0, 1)).toBe(false);
    expect(canRetry(30_000, 0, 1)).toBe(true);
  });
});

describe('row builders', () => {
  const now = Date.UTC(2026, 10, 12, 8, 30);

  it('brain toll row', () => {
    expect(
      tollEventRow(
        { kind: 'brain', mode: 'toll', scope: 'com.instagram.android:short', passed: true, minutes: 12, questions: 4, correct: 4 },
        'id1',
        now
      )
    ).toEqual({
      id: 'id1',
      ts: '2026-11-12T08:30:00.000Z',
      kind: 'brain',
      mode: 'toll',
      scope: 'com.instagram.android:short',
      passed: true,
      minutes: 12,
      detail: { questions: 4, correct: 4 },
    });
  });

  it('muscle practice row has no scope', () => {
    const row = tollEventRow(
      { kind: 'muscle', mode: 'practice', passed: true, minutes: 5, exercise: 'squat', reps: 5, fullReps: 4 },
      'id2',
      now
    );
    expect(row.scope).toBeNull();
    expect(row.detail).toEqual({ exercise: 'squat', reps: 5, fullReps: 4 });
  });

  it('bank row counts as a passed toll', () => {
    const row = tollEventRow({ kind: 'bank', scope: 'com.google.android.youtube', minutes: 10 }, 'id3', now);
    expect(row).toMatchObject({ kind: 'bank', mode: 'toll', passed: true, minutes: 10, detail: {} });
  });

  it('answer row', () => {
    const row = answerRow(
      { questionId: 'gk-001', area: 'gk', subskill: 'geography', difficulty: 1, correct: true, ms: 3210.6, fast: true },
      'calibration',
      'id4',
      now
    );
    expect(row).toEqual({
      id: 'id4',
      ts: '2026-11-12T08:30:00.000Z',
      mode: 'calibration',
      question_id: 'gk-001',
      area: 'gk',
      subskill: 'geography',
      difficulty: 1,
      correct: true,
      ms: 3211,
      fast: true,
    });
  });
});

describe('reading a backup', () => {
  it('brain: keeps valid areas and numeric ratings only', () => {
    expect(
      readBrain({ areas: ['math', 'cooking', 'gk'], ratings: { math: 1100, gk: 'x' }, calibrated: true, fastAnswers: 3.4, seen: ['a', 1] })
    ).toEqual({ areas: ['math', 'gk'], ratings: { math: 1100 }, calibrated: true, fastAnswers: 3, seen: ['a'] });
    expect(readBrain(null)).toBeNull();
    expect(readBrain([1, 2])).toBeNull();
  });

  it('muscle: fills missing totals and drops unknown moves', () => {
    const m = readMuscle({ calibration: { squatDrop: 0.8, bogus: 1 }, checked: ['squat', 'pushup'], lastExercise: 'pushup', totals: { squat: { reps: 9, full: 7 } } });
    expect(m).toEqual({
      calibration: { squatDrop: 0.8 },
      checked: ['squat'],
      lastExercise: 'squat',
      totals: { squat: { reps: 9, full: 7 }, jack: { reps: 0, full: 0 }, raise: { reps: 0, full: 0 } },
    });
  });

  it('blocker: keeps real package scopes with sane limits', () => {
    expect(
      readBlocker({
        targets: {
          'com.instagram.android': 30,
          'com.instagram.android:short': 10,
          'not a package': 5,
          'com.evil.app:long': 5,
          'com.zero.app': 0,
          'com.huge.app': 99999,
        },
      })
    ).toEqual({ targets: { 'com.instagram.android': 30, 'com.instagram.android:short': 10 } });
  });

  it('readBackup takes the newest timestamp and ignores unknown keys', () => {
    const b = readBackup([
      { key: 'brain', data: { areas: ['math'] }, updated_at: '2026-11-10T10:00:00Z' },
      { key: 'blocker', data: { targets: { 'com.a.b': 20 } }, updated_at: '2026-11-11T10:00:00Z' },
      { key: 'weird', data: {}, updated_at: '2030-01-01T00:00:00Z' },
    ]);
    expect(b.updatedAt).toBe(Date.parse('2026-11-11T10:00:00Z'));
    expect(b.brain?.areas).toEqual(['math']);
    expect(b.blocker?.targets).toEqual({ 'com.a.b': 20 });
    expect(b.muscle).toBeUndefined();
  });

  it('hasProgress: empty backups are not worth restoring', () => {
    expect(hasProgress({ updatedAt: 0 })).toBe(false);
    expect(hasProgress(readBackup([{ key: 'brain', data: { areas: [] }, updated_at: '2026-11-11T00:00:00Z' }]))).toBe(false);
    expect(hasProgress(readBackup([{ key: 'blocker', data: { targets: { 'com.a.b': 5 } }, updated_at: '2026-11-11T00:00:00Z' }]))).toBe(true);
    expect(
      hasProgress(readBackup([{ key: 'muscle', data: { totals: { jack: { reps: 3, full: 1 } } }, updated_at: '2026-11-11T00:00:00Z' }]))
    ).toBe(true);
  });
});
