import { getSupabaseConfig, isSupabaseConfigured } from '@/lib/supabase/config';

export type ServiceMode = 'demo' | 'supabase';

export type LiveConfigIssue = {
  code: 'missing_url' | 'missing_anon_key' | 'demo_mode';
  message: string;
};

/** Live Supabase when configured; demo in-memory path when EXPO_PUBLIC_DEMO_MODE=true. */
export function getServiceMode(): ServiceMode {
  const demoEnv = typeof process !== 'undefined' ? process.env?.EXPO_PUBLIC_DEMO_MODE : undefined;
  if (demoEnv === 'true') {
    return 'demo';
  }
  return 'supabase';
}

export { isDemoMode } from '@/lib/supabase/config';

/** Prüft Live-Pilot-Konfiguration — keine Secrets, nur Anon-Key + URL. */
export function assertLiveConfig(): { ok: true } | { ok: false; issues: LiveConfigIssue[] } {
  const issues: LiveConfigIssue[] = [];

  const { url, anonKey } = getSupabaseConfig();
  if (!url.trim()) {
    issues.push({
      code: 'missing_url',
      message: 'EXPO_PUBLIC_SUPABASE_URL fehlt.',
    });
  }
  if (!anonKey.trim()) {
    issues.push({
      code: 'missing_anon_key',
      message:
        'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY oder EXPO_PUBLIC_SUPABASE_ANON_KEY fehlt.',
    });
  }

  const demoEnv = typeof process !== 'undefined' ? process.env?.EXPO_PUBLIC_DEMO_MODE : undefined;
  if (demoEnv === 'true') {
    issues.push({
      code: 'demo_mode',
      message: 'Demo-Modus ist aktiv — kein Live-Zugriff.',
    });
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }
  return { ok: true };
}

/** Wirft bei fehlender Live-Konfiguration — kontrollierte deutsche Fehlermeldung. */
export function requireLiveConfig(): void {
  const result = assertLiveConfig();
  if (!result.ok) {
    const message = result.issues.map((issue) => issue.message).join(' ');
    throw new Error(message || 'Live-Konfiguration unvollständig.');
  }
}

/** @deprecated Demo mode removed — use isSupabaseConfigured() for env checks. */
export function isLiveServiceReady(): boolean {
  return isSupabaseConfigured();
}
