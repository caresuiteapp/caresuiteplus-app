import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getAuthRedirectBaseUrl } from '@/lib/supabase/config';
import { getPasswordResetRedirectUrl } from '@/lib/supabase/authService';

describe('auth redirect config', () => {
  beforeEach(() => {
    vi.stubEnv('EXPO_PUBLIC_AUTH_REDIRECT_URL', 'http://localhost:8082');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('nutzt EXPO_PUBLIC_AUTH_REDIRECT_URL für Passwort-Reset', () => {
    expect(getAuthRedirectBaseUrl()).toBe('http://localhost:8082');
    expect(getPasswordResetRedirectUrl()).toBe('http://localhost:8082/auth/reset-password');
  });
});
