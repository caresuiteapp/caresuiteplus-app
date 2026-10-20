import 'react-native-url-polyfill/auto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { sensitiveAuthStorage } from '@/lib/security/sensitiveAuthStorage';
import type { Database } from './types';
import { getSupabaseConfig, isDemoMode, isSupabaseConfigured } from './config';

let client: SupabaseClient<Database> | null = null;

export function getSupabaseClient(): SupabaseClient<Database> | null {
  if (isDemoMode() && !isSupabaseConfigured()) {
    return null;
  }

  if (!isSupabaseConfigured()) {
    return null;
  }

  if (!client) {
    const { url, anonKey } = getSupabaseConfig();
    client = createClient<Database>(url, anonKey, {
      auth: {
        storage: sensitiveAuthStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
  }

  return client;
}

export function resetSupabaseClient(): void {
  client = null;
}
