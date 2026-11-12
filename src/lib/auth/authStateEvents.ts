import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import type { AuthSession } from '@/types';

/** Only explicit sign-out should drop a committed Supabase session from React state. */
export function shouldClearAuthOnNullSessionEvent(
  event: AuthChangeEvent,
  signOutRequested: boolean,
): boolean {
  if (signOutRequested) return true;
  return event === 'SIGNED_OUT';
}

export type RefreshedSessionCredentials = Readonly<{
  authUserId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}>;

/** Carry only credentials from the SDK event; never rebuild the account from metadata. */
export function captureRefreshedSessionCredentials(
  native: Session | null,
): RefreshedSessionCredentials | null {
  if (!native || typeof native.user?.id !== 'string' || !native.user.id
    || typeof native.access_token !== 'string' || !native.access_token.trim()
    || typeof native.refresh_token !== 'string' || !native.refresh_token.trim()
    || typeof native.expires_at !== 'number' || !Number.isSafeInteger(native.expires_at)) return null;
  const expiresAt = native.expires_at * 1000;
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= Date.now()) return null;
  return Object.freeze({
    authUserId: native.user.id,
    accessToken: native.access_token,
    refreshToken: native.refresh_token,
    expiresAt,
  });
}

/** A refresh cannot create a session or transfer it to a different account. */
export function applyRefreshedSessionCredentials(
  current: AuthSession | null,
  refreshed: RefreshedSessionCredentials,
): AuthSession | null {
  if (!current || current.user.id !== refreshed.authUserId || refreshed.expiresAt <= Date.now()) return current;
  const { accessToken, refreshToken, expiresAt } = refreshed;
  if (current.accessToken === accessToken && current.refreshToken === refreshToken && current.expiresAt === expiresAt) return current;
  return { ...current, accessToken, refreshToken, expiresAt };
}
