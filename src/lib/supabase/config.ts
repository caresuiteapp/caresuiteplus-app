/** Dev-only: aktiv nur bei EXPO_PUBLIC_DEMO_MODE=true — nie aus fehlender URL ableiten. */
export function isDemoMode(): boolean {
  return process.env.EXPO_PUBLIC_DEMO_MODE === 'true';
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

/** Basis-URL für Auth-Redirects (Passwort-Reset). Env hat Vorrang vor Browser-Origin. */
export function getAuthRedirectBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_AUTH_REDIRECT_URL?.trim();
  if (configured) {
    return configured.replace(/\/$/, '');
  }

  if (typeof globalThis !== 'undefined') {
    const location = (globalThis as { location?: { origin?: string } }).location;
    if (location?.origin) {
      return location.origin;
    }
  }

  return 'http://localhost:8082';
}
