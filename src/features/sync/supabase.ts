import 'expo-sqlite/localStorage/install';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * The Supabase client. The URL and publishable key come from `.env.local`
 * (EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_KEY). They're public by design: row-level
 * security on every table keeps each user's data private. Without them the app runs exactly
 * as before, fully on the phone (`supabase` is null and sync is skipped).
 *
 * The login session is kept with expo-sqlite's localStorage (as Expo's Supabase guide does).
 */
const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const key = process.env.EXPO_PUBLIC_SUPABASE_KEY ?? '';

export const supabase: SupabaseClient | null =
  url && key
    ? createClient(url, key, {
        auth: {
          storage: localStorage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        },
      })
    : null;
