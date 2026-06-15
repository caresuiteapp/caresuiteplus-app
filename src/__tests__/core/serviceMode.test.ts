import { afterEach, describe, expect, it, vi } from 'vitest';
import { assertLiveConfig, getServiceMode } from '@/lib/services/mode';
import { isDemoMode, isSupabaseConfigured } from '@/lib/supabase/config';

describe('Service mode switching', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('bleibt im Demo-Modus ohne Supabase-Konfiguration', () => {
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', '');

    expect(getServiceMode()).toBe('demo');
    expect(isDemoMode()).toBe(true);
    expect(isSupabaseConfigured()).toBe(false);
  });

  it('schaltet auf Supabase wenn DEMO_MODE=false und URL+Key gesetzt', () => {
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'false');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key');

    expect(getServiceMode()).toBe('supabase');
    expect(isDemoMode()).toBe(false);
    expect(isSupabaseConfigured()).toBe(true);
  });

  it('bleibt Demo wenn DEMO_MODE=false aber URL fehlt', () => {
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'false');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key');

    expect(getServiceMode()).toBe('demo');
    expect(isDemoMode()).toBe(false);
    expect(isSupabaseConfigured()).toBe(false);
  });

  it('assertLiveConfig meldet fehlende Live-Konfiguration', () => {
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', '');

    const result = assertLiveConfig();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((i) => i.code === 'demo_mode')).toBe(true);
    }
  });

  it('assertLiveConfig ok bei vollständiger Live-Konfiguration', () => {
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'false');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key');

    expect(assertLiveConfig()).toEqual({ ok: true });
  });
});
