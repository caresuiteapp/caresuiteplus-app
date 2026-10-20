import { describe, expect, it } from 'vitest';
import { shouldClearAuthOnNullSessionEvent } from '@/lib/auth/authStateEvents';

describe('shouldClearAuthOnNullSessionEvent', () => {
  it('ignores transient null session events after sign-in', () => {
    expect(shouldClearAuthOnNullSessionEvent('INITIAL_SESSION', false)).toBe(false);
    expect(shouldClearAuthOnNullSessionEvent('TOKEN_REFRESHED', false)).toBe(false);
    expect(shouldClearAuthOnNullSessionEvent('USER_UPDATED', false)).toBe(false);
  });

  it('clears auth only on explicit sign-out', () => {
    expect(shouldClearAuthOnNullSessionEvent('SIGNED_OUT', false)).toBe(true);
  });

  it('clears auth when signOut was requested locally', () => {
    expect(shouldClearAuthOnNullSessionEvent('INITIAL_SESSION', true)).toBe(true);
  });
});
