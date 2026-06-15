import { getSupabaseConfig, isDemoMode, isSupabaseConfigured } from '@/lib/supabase/config';

export type ServiceMode = 'demo' | 'supabase';

export type LiveConfigIssue = {
  code: 'demo_mode' | 'missing_url' | 'missing_anon_key';
  message: string;
};

export function getServiceMode(): ServiceMode {
  if (isDemoMode() || !isSupabaseConfigured()) {
    return 'demo';
  }
  return 'supabase';
}

export { isDemoMode } from '@/lib/supabase/config';

/** Prüft Live-Pilot-Konfiguration — keine Secrets, nur Anon-Key + URL. */
export function assertLiveConfig(): { ok: true } | { ok: false; issues: LiveConfigIssue[] } {
  const issues: LiveConfigIssue[] = [];

  if (isDemoMode()) {
    issues.push({
      code: 'demo_mode',
      message: 'EXPO_PUBLIC_DEMO_MODE ist aktiv — Live-Pilot erfordert false.',
    });
  }

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
      message: 'EXPO_PUBLIC_SUPABASE_ANON_KEY fehlt.',
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
