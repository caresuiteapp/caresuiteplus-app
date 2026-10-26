import type { AuthSession, AuthUser } from '@/types';
import type { PortalSessionRecord } from '@/lib/auth/portalSessionStore';

/** Presentation restriction only. Server-side identity and RLS remain authoritative. */
export function isAcademyOnlyPortal(portal: PortalSessionRecord | null, session: AuthSession | null, user?: AuthUser | null): boolean {
  if (user?.portalType === 'academy_family' || user?.accessScope === 'academy') return true;
  if (portal?.portalType === 'academy_family' || portal?.accessScope === 'academy') return true;
  try {
    const payload = session?.accessToken.split('.')[1];
    if (!payload) return false;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')));
    return claims?.app_metadata?.portal_type === 'academy_family';
  } catch { return false; }
}
