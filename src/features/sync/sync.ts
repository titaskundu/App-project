import { randomUUID } from 'expo-crypto';
import { AppState } from 'react-native';
import { create } from 'zustand';

import { AppBlocker } from '@modules/app-blocker';

import { useBlocker } from '@/features/blocker/store';
import type { SessionMode } from '@/features/brain/history';
import { useBrain } from '@/features/brain/store';
import type { AnswerRecord } from '@/features/brain/types';
import { useMuscle } from '@/features/muscle/store';

import { answerRow, batches, canRetry, tollEventRow, type TollEventInput } from './outbox';
import * as outbox from './outboxDb';
import { blockerSnapshot, brainSnapshot, muscleSnapshot, type StateKey } from './snapshot';
import { supabase } from './supabase';

/**
 * Background sync. Everything is saved on the phone first; this only mirrors it to Supabase
 * when there's internet. Nothing here is awaited by a toll or a screen, and every failure is
 * swallowed and retried later, so the app behaves exactly the same offline.
 *
 * Uploads only run for a signed-in account that the auth gate has marked ready (profile done and
 * any backup restored), so an empty phone can never overwrite an account's backup.
 */
export type SyncStatus = {
  configured: boolean;
  /** The saved login session has been read (false only for a moment at launch). */
  sessionLoaded: boolean;
  userId: string | null;
  /** Leftover anonymous session from Phase 4a (signed out by the auth gate). */
  isAnonymous: boolean;
  email: string | null;
  /** How the user signs in: 'google' | 'email' (null when signed out). */
  provider: string | null;
  /** Name from Google, used to pre-fill the profile. */
  fullName: string | null;
  pending: number;
  lastSyncAt: number | null;
  /** Last error message (for the account screen), cleared by the next good sync. */
  error: string | null;
};

export const useSync = create<SyncStatus>(() => ({
  configured: !!supabase,
  sessionLoaded: !supabase,
  userId: null,
  isAnonymous: false,
  email: null,
  provider: null,
  fullName: null,
  pending: outbox.pendingCount(),
  lastSyncAt: null,
  error: null,
}));

let failures = 0;
let lastFailureAt = 0;
let flushing = false;
/** Set by the auth gate once the signed-in account is ready (see the comment above). */
let accountReady = false;

function refreshPending() {
  useSync.setState({ pending: outbox.pendingCount() });
}

// ---- queueing (called from tolls and answers) -------------------------------------------------

export function recordTollEvent(e: TollEventInput): void {
  const now = Date.now();
  const id = randomUUID();
  outbox.enqueue({ id, table: 'toll_events', payload: tollEventRow(e, id, now), createdAt: now });
  refreshPending();
  void flush();
}

export function queueAnswer(a: AnswerRecord, mode: SessionMode): void {
  const now = Date.now();
  const id = randomUUID();
  outbox.enqueue({ id, table: 'answers', payload: answerRow(a, mode, id, now), createdAt: now });
  refreshPending();
  // Answers upload with the toll result (or on the next foreground), not one by one.
}

// ---- session ----------------------------------------------------------------------------------

type SessionUser = {
  id: string;
  is_anonymous?: boolean;
  email?: string;
  app_metadata?: { provider?: string };
  user_metadata?: { full_name?: string; name?: string };
};

function applySession(user: SessionUser | null | undefined) {
  useSync.setState({
    sessionLoaded: true,
    userId: user?.id ?? null,
    isAnonymous: user?.is_anonymous === true,
    email: user?.email || null,
    provider: user?.app_metadata?.provider ?? null,
    fullName: user?.user_metadata?.full_name || user?.user_metadata?.name || null,
  });
}

/** True when a (non-anonymous) user is signed in. Never creates an account. */
export async function hasSession(): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { data } = await supabase.auth.getSession();
    return !!data.session && data.session.user.is_anonymous !== true;
  } catch {
    return false;
  }
}

// ---- uploads ----------------------------------------------------------------------------------

/** Uploads queued rows. Safe to call any time; does nothing offline or while backing off. */
export async function flush(force = false): Promise<void> {
  if (!supabase || flushing || !accountReady) return;
  if (!force && !canRetry(Date.now(), lastFailureAt, failures)) return;
  flushing = true;
  try {
    if (!(await hasSession())) throw new Error('Not signed in');
    for (const batch of batches(outbox.pending())) {
      const { error } = await supabase.from(batch.table).upsert(
        batch.items.map((i) => i.payload),
        { onConflict: 'id', ignoreDuplicates: true }
      );
      if (error) throw new Error(error.message);
      outbox.remove(batch.items.map((i) => i.id));
    }
    await pushDirtySnapshots();
    failures = 0;
    useSync.setState({ lastSyncAt: Date.now(), error: null });
  } catch (e) {
    failures += 1;
    lastFailureAt = Date.now();
    useSync.setState({ error: e instanceof Error ? e.message : String(e) });
  } finally {
    flushing = false;
    refreshPending();
  }
}

// ---- snapshots (backup of settings and progress) ----------------------------------------------

const lastPushed: Partial<Record<StateKey, string>> = {};
const dirty = new Set<StateKey>();
let snapshotTimer: ReturnType<typeof setTimeout> | null = null;
const SNAPSHOT_DELAY_MS = 5000;

function snapshotOf(key: StateKey): unknown {
  if (key === 'brain') return brainSnapshot(useBrain.getState());
  if (key === 'muscle') return muscleSnapshot(useMuscle.getState());
  // Read limits from the native store (the source of truth), not the JS mirror, which is empty
  // until the blocker screen first loads them: an empty mirror must never overwrite a backup.
  return blockerSnapshot(AppBlocker.getTargets());
}

function markDirty(key: StateKey) {
  dirty.add(key);
  if (snapshotTimer) clearTimeout(snapshotTimer);
  snapshotTimer = setTimeout(() => void flush(), SNAPSHOT_DELAY_MS);
}

async function pushDirtySnapshots(): Promise<void> {
  if (!supabase) return;
  const rows: { key: StateKey; data: unknown; updated_at: string }[] = [];
  for (const key of dirty) {
    const data = snapshotOf(key);
    const json = JSON.stringify(data);
    if (lastPushed[key] !== json) rows.push({ key, data, updated_at: new Date().toISOString() });
  }
  if (!rows.length) {
    dirty.clear();
    return;
  }
  const { error } = await supabase.from('user_state').upsert(rows, { onConflict: 'user_id,key' });
  if (error) throw new Error(error.message);
  for (const r of rows) lastPushed[r.key] = JSON.stringify(r.data);
  dirty.clear();
}

// ---- start / pause ----------------------------------------------------------------------------

let started = false;

/**
 * Starts background sync once (from the root layout): reads the saved session, uploads, and keeps
 * the backup fresh when the stores change. Also refreshes the login token only while the app is
 * open.
 */
export function startSync(): void {
  if (started || !supabase) return;
  started = true;
  const client = supabase;

  client.auth.onAuthStateChange((_event, session) => applySession(session?.user));
  client.auth
    .getSession()
    .then(({ data }) => applySession(data.session?.user))
    .catch(() => useSync.setState({ sessionLoaded: true }));

  const onAppState = (s: string | null | undefined) => {
    if (s === 'active') {
      client.auth.startAutoRefresh();
      void flush(true);
    } else {
      client.auth.stopAutoRefresh();
    }
  };
  AppState.addEventListener('change', onAppState);
  onAppState(AppState.currentState);

  // Back up a store a few seconds after it changes. The first push after launch always happens
  // once (lastPushed starts empty), so a phone that was offline catches up.
  useBrain.subscribe(() => markDirty('brain'));
  useMuscle.subscribe(() => markDirty('muscle'));
  useBlocker.subscribe((s, prev) => {
    if (s.targets !== prev.targets) markDirty('blocker');
  });
  (['brain', 'muscle', 'blocker'] as const).forEach((k) => dirty.add(k));
}

/** Called by the auth gate: true once the signed-in account is ready, false on sign-out. */
export function setAccountReady(ready: boolean): void {
  accountReady = ready;
  if (ready) void flush(true);
}

/** Forget what was pushed, so the next sync re-uploads every snapshot (after an account change). */
export function resetSnapshots(): void {
  for (const k of Object.keys(lastPushed) as StateKey[]) delete lastPushed[k];
  (['brain', 'muscle', 'blocker'] as const).forEach((k) => dirty.add(k));
}
