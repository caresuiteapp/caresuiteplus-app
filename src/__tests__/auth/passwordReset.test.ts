import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchPasswordResetInfo,
  requestBusinessPasswordReset,
} from '@/lib/auth/passwordResetService';

const requestPasswordResetEmail = vi.fn();

vi.mock('@/lib/supabase/authService', () => ({
  requestPasswordResetEmail: (...args: unknown[]) => requestPasswordResetEmail(...args),
  getPasswordResetRedirectUrl: () => 'http://localhost:8082/auth/reset-password',
}));

describe('passwordResetService', () => {
  beforeEach(() => {
    requestPasswordResetEmail.mockReset();
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'false');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', 'anon-key');
    vi.stubEnv('EXPO_PUBLIC_AUTH_REDIRECT_URL', 'http://localhost:8082');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('liefert Supabase-Hinweis im Live-Modus', async () => {
    const result = await fetchPasswordResetInfo();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.channel).toBe('supabase_email');
    }
  });

  it('validiert E-Mail-Adresse', async () => {
    const result = await requestBusinessPasswordReset('kein-email');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('gültige E-Mail');
    }
  });

  it('sendet Reset-Link per Supabase', async () => {
    requestPasswordResetEmail.mockResolvedValue({ ok: true, data: null });

    const result = await requestBusinessPasswordReset('info@helferhasen.com');
    expect(result.ok).toBe(true);
    expect(requestPasswordResetEmail).toHaveBeenCalledWith('info@helferhasen.com');
  });
});
