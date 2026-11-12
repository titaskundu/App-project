import * as SQLite from 'expo-sqlite';

import { queueAnswer } from '@/features/sync/sync';

import type { AnswerRecord } from './types';

/**
 * Every answer is kept in a small on-device SQLite table. Phase 6 builds the Stats screen
 * (skill radar, heatmap) from it. Each answer is also queued for upload to the user's account
 * (features/sync), which feeds the Phase 4b difficulty model.
 */
let db: SQLite.SQLiteDatabase | null = null;

function open(): SQLite.SQLiteDatabase {
  if (db) return db;
  db = SQLite.openDatabaseSync('brain.db');
  db.execSync(`
    CREATE TABLE IF NOT EXISTS answers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts INTEGER NOT NULL,
      mode TEXT NOT NULL,
      question_id TEXT NOT NULL,
      area TEXT NOT NULL,
      subskill TEXT NOT NULL,
      difficulty INTEGER NOT NULL,
      correct INTEGER NOT NULL,
      ms INTEGER NOT NULL,
      fast INTEGER NOT NULL
    );
  `);
  return db;
}

export type SessionMode = 'toll' | 'practice' | 'calibration';

export function saveAnswer(a: AnswerRecord, mode: SessionMode): void {
  try {
    open().runSync(
      'INSERT INTO answers (ts, mode, question_id, area, subskill, difficulty, correct, ms, fast) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [Date.now(), mode, a.questionId, a.area, a.subskill, a.difficulty, a.correct ? 1 : 0, Math.round(a.ms), a.fast ? 1 : 0]
    );
  } catch {
    // History is nice to have; never let it break a toll.
  }
  queueAnswer(a, mode);
}

/** Deletes the on-phone answer history ("Delete my data"). */
export function clearHistory(): void {
  try {
    open().runSync('DELETE FROM answers');
  } catch {
    // ignore
  }
}

export function answerCount(): number {
  try {
    return open().getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM answers')?.n ?? 0;
  } catch {
    return 0;
  }
}
