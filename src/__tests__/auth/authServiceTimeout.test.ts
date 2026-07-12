import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getSession, signInWithPassword } from '../../lib/supabase/authService';

vi.mock('react-native-url-polyfill/auto', () => ({}));

const { signInWithPasswordRequest, getSessionRequest } = vi.hoisted(() => ({
  signInWithPasswordRequest: vi.fn(),
  getSessionRequest: vi.fn(),
}));

vi.mock('../../lib/supabase/client', () => ({
  getSupabaseClient: () => ({
    auth: {
      signInWithPassword: signInWithPasswordRequest,
      getSession: getSessionRequest,
    },
  }),
}));

describe('auth service request timeouts', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    signInWithPasswordRequest.mockReset();
    getSessionRequest.mockReset();
    signInWithPasswordRequest.mockImplementation(() => new Promise(() => {}));
    getSessionRequest.mockImplementation(() => new Promise(() => {}));
  });

  afterEach(() => {
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
});
