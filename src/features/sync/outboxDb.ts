import * as SQLite from 'expo-sqlite';

import type { OutboxItem, OutboxTable } from './outbox';

/**
 * The upload queue, stored in its own small SQLite database (`sync.db`) so queued rows survive
 * the app being closed or the phone restarting. All calls are synchronous and never throw:
 * syncing is a nice-to-have and must never break a toll.
 */
let db: SQLite.SQLiteDatabase | null = null;

function open(): SQLite.SQLiteDatabase {
  if (db) return db;
  db = SQLite.openDatabaseSync('sync.db');
  db.execSync(`
    CREATE TABLE IF NOT EXISTS outbox (
      id TEXT PRIMARY KEY NOT NULL,
      tbl TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);
  return db;
}

export function enqueue(item: OutboxItem): void {
  try {
    open().runSync('INSERT OR IGNORE INTO outbox (id, tbl, payload, created_at) VALUES (?, ?, ?, ?)', [
      item.id,
      item.table,
      JSON.stringify(item.payload),
      item.createdAt,
    ]);
  } catch {
    // Never let the queue break a toll.
  }
}

export function pending(limit = 500): OutboxItem[] {
  try {
    return open()
      .getAllSync<{ id: string; tbl: OutboxTable; payload: string; created_at: number }>(
        'SELECT id, tbl, payload, created_at FROM outbox ORDER BY created_at LIMIT ?',
        [limit]
      )
      .map((r) => ({ id: r.id, table: r.tbl, payload: JSON.parse(r.payload), createdAt: r.created_at }));
  } catch {
    return [];
  }
}

export function pendingCount(): number {
  try {
    return open().getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM outbox')?.n ?? 0;
  } catch {
    return 0;
  }
}

export function remove(ids: string[]): void {
  if (!ids.length) return;
  try {
    open().runSync(`DELETE FROM outbox WHERE id IN (${ids.map(() => '?').join(',')})`, ids);
  } catch {
    // Rows stay queued and are re-sent (harmless: uploads are keyed by id).
  }
}

export function clear(): void {
  try {
    open().runSync('DELETE FROM outbox');
  } catch {
    // ignore
  }
}
