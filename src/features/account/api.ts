import { GoogleSignin } from '@react-native-google-signin/google-signin';

import { clearHistory } from '@/features/brain/history';
import { useBrain } from '@/features/brain/store';
import { useMuscle } from '@/features/muscle/store';
import * as outbox from '@/features/sync/outboxDb';
import { supabase } from '@/features/sync/supabase';
import { resetSnapshots, setAccountReady, useSync } from '@/features/sync/sync';

import { normalizeUsername, type Profile } from './profile';
import { useAccount } from './store';

/**
 * Account actions: Google sign-in, email sign-up with a 6-digit code, password log-in and reset,
 * the profile, sign-out and account deletion. Screens call these and show any thrown message.
 */

const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';
export const googleConfigured = !!webClientId;

function client() {
  if (!supabase) throw new Error('Accounts are not set up in this build.');
  return supabase;
}

/** Friendlier wording for the errors people actually hit. */
export function friendlyError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/network|fetch|timed? ?out|offline/i.test(msg)) return 'No internet right now. Try again when you’re online.';
  if (/invalid login credentials/i.test(msg)) return 'Wrong email or password.';
  if (/token has expired|otp.*(expired|invalid)|invalid.*otp/i.test(msg)) return 'That code is wrong or has expired. Try again or get a new code.';
  if (/rate limit|too many|security purposes/i.test(msg)) return 'Too many tries. Please wait a minute and try again.';
  if (/same.*password|password.*same/i.test(msg)) return 'Pick a password you haven’t used here before.';
  if (/profiles_username_key|duplicate key/i.test(msg)) return 'That username was just taken. Try another.';
  if (/row-level security/i.test(msg)) return 'You need to be at least 16 to use the app for now.';
  return msg;
}

// ---- Google -----------------------------------------------------------------------------------

/** Google sign-in (creates the account the first time). Returns false if the user cancelled. */
export async function signInWithGoogle(): Promise<boolean> {
  GoogleSignin.configure({ webClientId });
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const res = await GoogleSignin.signIn();
  if (res.type !== 'success') return false;
  if (!res.data.idToken) throw new Error('Google did not return a sign-in token.');
  const { error } = await client().auth.signInWithIdToken({ provider: 'google', token: res.data.idToken });
  if (error) throw error;
  return true;
}

// ---- Email: sign up with a code, then set a password ------------------------------------------

/** Emails a 6-digit code (creates the account if it's new). */
export async function sendEmailCode(email: string): Promise<void> {
  const { error } = await client().auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } });
  if (error) throw error;
}

/**
 * Checks the code. This signs the user in, so the auth gate is told to wait (pendingSetup)
 * until the password is set. Returns 'existing' when the email already had an account with a
 * profile: then there's no password step, the gate just logs them in.
 */
export async function verifyEmailCode(email: string, code: string): Promise<'new' | 'existing'> {
  const acc = useAccount.getState();
  acc.setPendingSetup(true);
  const { error } = await client().auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
  if (error) {
    acc.setPendingSetup(false);
    throw error;
  }
  let existing = false;
  try {
    existing = (await fetchProfile()) !== null;
  } catch {
    // Can't tell (e.g. connection dropped): ask for a password as for a new account.
  }
  if (existing) acc.setPendingSetup(false);
  return existing ? 'existing' : 'new';
}

/** Sets (or changes) the password, then lets the auth gate continue. */
export async function setPassword(password: string): Promise<void> {
  const { error } = await client().auth.updateUser({ password });
  if (error) throw error;
  useAccount.getState().setPendingSetup(false);
}

/** Leaves a half-finished sign-up or reset (signs out). */
export async function cancelSetup(): Promise<void> {
  useAccount.getState().setPendingSetup(false);
  await client().auth.signOut({ scope: 'local' });
}

// ---- Email: log in and reset -------------------------------------------------------------------

export async function logInWithPassword(email: string, password: string): Promise<void> {
  const { error } = await client().auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw error;
}

/** Emails a 6-digit reset code. */
export async function sendResetCode(email: string): Promise<void> {
  const { error } = await client().auth.resetPasswordForEmail(email.trim());
  if (error) throw error;
}

/** Checks the reset code (signs in); the screen then asks for the new password. */
export async function verifyResetCode(email: string, code: string): Promise<void> {
  useAccount.getState().setPendingSetup(true);
  const { error } = await client().auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'recovery' });
  if (error) {
    useAccount.getState().setPendingSetup(false);
    throw error;
  }
}

// ---- Profile ----------------------------------------------------------------------------------

type Row = { user_id: string; display_name: string; username: string; birth_date: string; created_at: string };

const toProfile = (r: Row): Profile => ({
  userId: r.user_id,
  displayName: r.display_name,
  username: r.username,
  birthDate: r.birth_date,
  createdAt: r.created_at,
});

/** The signed-in user's profile, or null if they haven't made one yet. */
export async function fetchProfile(): Promise<Profile | null> {
  const { data, error } = await client().from('profiles').select('*').maybeSingle<Row>();
  if (error) throw error;
  return data ? toProfile(data) : null;
}

export async function usernameAvailable(username: string): Promise<boolean> {
  const { data, error } = await client().rpc('username_available', { name: normalizeUsername(username) });
  if (error) throw error;
  return data === true;
}

export async function createProfile(p: { displayName: string; username: string; birthDate: string }): Promise<Profile> {
  const { data, error } = await client()
    .from('profiles')
    .insert({ display_name: p.displayName.trim(), username: normalizeUsername(p.username), birth_date: p.birthDate })
    .select('*')
    .single<Row>();
  if (error) throw error;
  const profile = toProfile(data);
  useAccount.getState().setProfile(profile);
  return profile;
}

export async function updateProfile(p: { displayName?: string; username?: string }): Promise<Profile> {
  const patch: Record<string, string> = {};
  if (p.displayName !== undefined) patch.display_name = p.displayName.trim();
  if (p.username !== undefined) patch.username = normalizeUsername(p.username);
  const userId = useAccount.getState().profile?.userId;
  if (!userId) throw new Error('Not signed in');
  const { data, error } = await client().from('profiles').update(patch).eq('user_id', userId).select('*').single<Row>();
  if (error) throw error;
  const profile = toProfile(data);
  useAccount.getState().setProfile(profile);
  return profile;
}

// ---- Sign out / delete -------------------------------------------------------------------------

/**
 * Clears this phone's copy of the user's data (their account keeps it). Blocked-app limits,
 * camera consent and today's toll counts stay: they belong to the phone, and blocking must keep
 * working while signed out.
 */
function resetLocalAccountData(): void {
  setAccountReady(false);
  outbox.clear();
  clearHistory();
  useBrain.getState().resetProgress();
  useMuscle.getState().resetAll();
  resetSnapshots();
  const acc = useAccount.getState();
  acc.setProfile(null);
  acc.setDeviceUser(null);
  acc.setPendingSetup(false);
  // Forget the gate's last "has a profile?" answer, so the next login checks again (a user who
  // finished their profile after that answer would otherwise be asked for it again).
  acc.retryCheck();
  useSync.setState({ lastSyncAt: null, error: null, pending: 0 });
}

async function googleSignOut() {
  try {
    await GoogleSignin.signOut();
  } catch {
    // Not signed in to Google here: fine.
  }
}

export async function signOut(): Promise<void> {
  resetLocalAccountData();
  await googleSignOut();
  await client().auth.signOut({ scope: 'local' });
}

/** "Delete account": removes the account and everything stored with it, then signs out. */
export async function deleteAccount(): Promise<void> {
  const c = client();
  const { error } = await c.rpc('delete_my_account');
  if (error) throw error;
  resetLocalAccountData();
  await googleSignOut();
  await c.auth.signOut({ scope: 'local' });
}

/** Under 16: the account isn't kept (no profile was made), and sign-up locks for a day. */
export async function rejectUnder16(): Promise<void> {
  const c = client();
  await c.rpc('delete_my_account');
  useAccount.getState().lockUnder16();
  resetLocalAccountData();
  await googleSignOut();
  await c.auth.signOut({ scope: 'local' });
}
