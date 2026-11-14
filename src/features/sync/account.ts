import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { AppBlocker } from '@modules/app-blocker';

import { useBlocker } from '@/features/blocker/store';
import { useBrain } from '@/features/brain/store';
import { useMuscle } from '@/features/muscle/store';

import { hasProgress, readBackup, type Backup } from './snapshot';
import { supabase } from './supabase';
import { flush, hasSession } from './sync';

/**
 * Backup and data-export helpers. Sign-in, profile, sign-out and delete live in
 * features/account/api.ts.
 */
function requireClient() {
  if (!supabase) throw new Error('Accounts are not set up in this build.');
  return supabase;
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

/** Saves all of the user's synced rows to a JSON file and opens the share sheet. */
export async function exportMyData(): Promise<void> {
  const client = requireClient();
  if (!(await hasSession())) throw new Error('Please log in again to export your data.');
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
    profile: await all('profiles'),
    settingsAndProgress: await all('user_state'),
    tolls: await all('toll_events'),
    answers: await all('answers'),
  };
  const file = new File(Paths.cache, `mind-muscle-sync-data-${new Date().toISOString().slice(0, 10)}.json`);
  file.create({ overwrite: true });
  await file.write(JSON.stringify(out, null, 2));
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Your Mind-Muscle Sync data' });
}
