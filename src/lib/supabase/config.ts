export function isDemoMode(): boolean {
  const flag = process.env.EXPO_PUBLIC_DEMO_MODE;
  if (flag === 'false') return false;
  return flag === 'true' || !process.env.EXPO_PUBLIC_SUPABASE_URL;
}

export function getSupabaseConfig() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
  return { url, anonKey };
}

export function isSupabaseConfigured(): boolean {
  const { url, anonKey } = getSupabaseConfig();
  return Boolean(url && anonKey);
}

export type AuthMode = 'demo' | 'supabase';

export function resolveAuthMode(): AuthMode {
  if (isDemoMode() || !isSupabaseConfigured()) {
    return 'demo';
  }
  return 'supabase';
}
