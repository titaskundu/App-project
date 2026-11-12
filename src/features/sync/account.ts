import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { isAuthApiError } from '@supabase/supabase-js';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { AppBlocker } from '@modules/app-blocker';

import { useBlocker } from '@/features/blocker/store';
import { clearHistory } from '@/features/brain/history';
import { useBrain } from '@/features/brain/store';
import { useMuscle } from '@/features/muscle/store';

import * as outbox from './outboxDb';
import { hasProgress, readBackup, type Backup } from './snapshot';
import { supabase } from './supabase';
import { ensureSession, flush, pauseSync, resetSnapshots, useSync } from './sync';

/**
 * Account actions for the "Account & data" screen. Google sign-in only *adds* a way to get the
 * same account back on another phone; the app keeps working without it.
 *
 * Two cases when the user taps "Back up with Google":
 *  - Normal: the Google account is new to us, so it's linked to the current anonymous account.
 *    Same user, same data, nothing moves.
 *  - New phone / reinstall: that Google account already has a backup. This phone's anonymous
 *    account hands its history over (one-time transfer token), we switch to the Google
 *    account, and the user is asked whether to restore the backup.
 */
export type BackupResult =
  | { kind: 'linked' }
  | { kind: 'switched'; backup: Backup }
  | { kind: 'cancelled' };

const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';

export const googleConfigured = !!supabase && !!webClientId;

function requireClient() {
  if (!supabase) throw new Error('Backup is not set up in this build.');
  return supabase;
}

async function googleIdToken(): Promise<string | null> {
  GoogleSignin.configure({ webClientId });
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const res = await GoogleSignin.signIn();
  if (res.type !== 'success') return null;
  if (!res.data.idToken) throw new Error('Google did not return a sign-in token.');
  return res.data.idToken;
}

export async function backupWithGoogle(): Promise<BackupResult> {
  const client = requireClient();
  const token = await googleIdToken();
  if (!token) return { kind: 'cancelled' };
  if (!(await ensureSession())) throw new Error('You need internet to back up.');

  const { error } = await client.auth.linkIdentity({ provider: 'google', token });
  if (!error) {
    await client.auth.refreshSession();
    return { kind: 'linked' };
  }
  if (!(isAuthApiError(error) && error.code === 'identity_already_exists')) throw error;

  // This Google account already has a backup: switch to it.
  pauseSync(true);
  try {
    const { data: transfer } = await client.rpc('issue_transfer_token');
    const { error: signInError } = await client.auth.signInWithIdToken({ provider: 'google', token });
    if (signInError) throw signInError;
    if (typeof transfer === 'string') await client.rpc('claim_transfer', { transfer });
    return { kind: 'switched', backup: await fetchBackup() };
  } catch (e) {
    // Couldn't switch (we're still on the anonymous account): carry on as before.
    pauseSync(false);
    throw e;
  }
}

/** The signed-in user's backup (settings and progress). */
export async function fetchBackup(): Promise<Backup> {
  const client = requireClient();
  const { data, error } = await client.from('user_state').select('key, data, updated_at');
  if (error) throw new Error(error.message);
  return readBackup(data ?? []);
}

export { hasProgress };

/** Writes a backup into the app. Limits for apps that aren't installed here are skipped. */
export async function applyBackup(b: Backup): Promise<void> {
  if (b.brain) useBrain.getState().restore(b.brain);
  if (b.muscle) useMuscle.getState().restore(b.muscle);
  if (b.blocker) {
    const installed = new Set((await AppBlocker.getInstalledApps()).map((a) => a.packageName));
    const targets = Object.fromEntries(
      Object.entries(b.blocker.targets).filter(([scope]) => installed.has(scope.split(':')[0]))
    );
    AppBlocker.setTargets({ ...AppBlocker.getTargets(), ...targets });
    useBlocker.getState().refresh();
  }
}

/** Ends the restore question: from now on this phone's data is backed up to the account. */
export async function finishSwitch(): Promise<void> {
  resetSnapshots();
  pauseSync(false);
  await flush(true);
}

/** Saves all of the user's synced rows to a JSON file and opens the share sheet. */
export async function exportMyData(): Promise<void> {
  const client = requireClient();
  if (!(await ensureSession())) throw new Error('You need internet to export your data.');
  await flush(true);
  const all = async (table: string) => {
    const rows: unknown[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await client.from(table).select('*').range(from, from + 999);
      if (error) throw new Error(error.message);
      rows.push(...(data ?? []));
      if (!data || data.length < 1000) return rows;
    }
  };
  const { data: user } = await client.auth.getUser();
  const out = {
    exportedAt: new Date().toISOString(),
    account: { id: user.user?.id, email: user.user?.email ?? null, createdAt: user.user?.created_at },
    settingsAndProgress: await all('user_state'),
    tolls: await all('toll_events'),
    answers: await all('answers'),
  };
  const file = new File(Paths.cache, `mind-muscle-sync-data-${new Date().toISOString().slice(0, 10)}.json`);
  file.create({ overwrite: true });
  await file.write(JSON.stringify(out, null, 2));
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Your Mind-Muscle Sync data' });
}

/**
 * "Delete my data": deletes the account and everything stored with it, resets Brain and Muscle
 * progress on this phone, and starts a fresh anonymous account. Blocked-app limits stay (they're
 * this phone's settings).
 */
export async function deleteMyData(): Promise<void> {
  const client = requireClient();
  if (!(await ensureSession())) throw new Error('You need internet to delete your data.');
  pauseSync(true);
  try {
    const { error } = await client.rpc('delete_my_account');
    if (error) throw new Error(error.message);
    await client.auth.signOut({ scope: 'local' });
    try {
      await GoogleSignin.signOut();
    } catch {
      // Not signed in to Google here: fine.
    }
    outbox.clear();
    clearHistory();
    useBrain.getState().resetProgress();
    useMuscle.getState().resetAll();
    useSync.setState({ userId: null, email: null, isAnonymous: true, lastSyncAt: null });
  } finally {
    resetSnapshots();
    pauseSync(false);
  }
  await ensureSession();
  await flush(true);
}
