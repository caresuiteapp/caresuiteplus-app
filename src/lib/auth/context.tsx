/** WP088 — Session-Hilfsfunktionen (Kontext: ./context.ts) */
import type { AuthSession } from '@/types';

export function getSessionExpiry(session: AuthSession | null): Date | null {
  if (!session?.expiresAt) return null;
  return new Date(session.expiresAt);
}

export function isSessionValid(session: AuthSession | null, now = Date.now()): boolean {
  if (!session) return false;
  const expiry = getSessionExpiry(session);
  if (!expiry) return true;
  return expiry.getTime() > now;
}

export function getSessionUserId(session: AuthSession | null): string | null {
  return session?.user.id ?? null;
}

export function getSessionRoleKey(session: AuthSession | null) {
  return session?.user.roleKey ?? null;
}
