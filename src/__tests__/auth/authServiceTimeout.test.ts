import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getSession, signInWithPassword, signOut } from '../../lib/supabase/authService';

vi.mock('react-native-url-polyfill/auto', () => ({}));

const { signInWithPasswordRequest, getSessionRequest, signOutRequest } = vi.hoisted(() => ({
  signInWithPasswordRequest: vi.fn(),
  getSessionRequest: vi.fn(),
  signOutRequest: vi.fn(),
}));

vi.mock('../../lib/supabase/client', () => ({
  getSupabaseClient: () => ({
    auth: {
      signInWithPassword: signInWithPasswordRequest,
      getSession: getSessionRequest,
      signOut: signOutRequest,
    },
  }),
}));

describe('auth service request timeouts', () => {
  beforeEach(() => {
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'false');
    vi.useFakeTimers();
    signInWithPasswordRequest.mockReset();
    getSessionRequest.mockReset();
    signOutRequest.mockReset(); signOutRequest.mockImplementation(() => new Promise(() => {}));
    signInWithPasswordRequest.mockImplementation(() => new Promise(() => {}));
    getSessionRequest.mockImplementation(() => new Promise(() => {}));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it('returns from a stalled login request', async () => {
    const pending = signInWithPassword('admin@example.com', 'SecurePass1');
    await vi.advanceTimersByTimeAsync(10_000);

    const result = await pending;
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('zu lange gedauert');
    }
  });

  it('returns from a stalled session restore request', async () => {
    const pending = getSession();
    await vi.advanceTimersByTimeAsync(10_000);

    const result = await pending;
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('zu lange gedauert');
    }
  });
  it('ends a stalled web logout instead of leaving the application in a permanent loader', async () => {
    const pending = signOut();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await pending).toEqual({ ok: false, error: 'Abmeldung hat zu lange gedauert.' });
  });
});
