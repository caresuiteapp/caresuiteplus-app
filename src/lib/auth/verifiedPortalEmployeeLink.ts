import type { AuthSession, AuthUser } from '@/types';
import type { PortalSessionRecord } from './portalSessionStore';

export type VerifiedPortalEmployeeLink = {
  employeeId: string;
  authUserId: string;
  tenantId: string;
  accountId: string;
  portalSessionToken: string;
  authSessionSignature: string;
  verifiedAt: string;
  expiresAt: string;
};

export function portalEmployeeSessionSignature(session: AuthSession | null): string | null {
  const parts = typeof session?.accessToken === 'string' ? session.accessToken.split('.') : [];
  return parts.length === 3 && parts.every(Boolean) ? parts[2] : null;
}

/** Called only after the canonical server employee lookup succeeded. */
export function createVerifiedPortalEmployeeLink(
  employeeId: string,
  portal: PortalSessionRecord | null,
  user: AuthUser | null,
  session: AuthSession | null,
  now = Date.now(),
): VerifiedPortalEmployeeLink | null {
  const signature = portalEmployeeSessionSignature(session);
  const expires = Math.min(Date.parse(portal?.expiresAt ?? ''), session?.expiresAt ?? 0);
  if (typeof employeeId !== 'string' || !employeeId.trim() || !portal || !portal.tenantId || !portal.accountId || !portal.sessionToken || portal.loginType !== 'employee_portal' ||
      portal.roleKey !== 'employee_portal' || !user?.id || user.roleKey !== 'employee_portal' ||
      session?.user.id !== user.id || !signature || !Number.isFinite(expires) || expires <= now) return null;
  return {
    employeeId, authUserId: user.id, tenantId: portal.tenantId, accountId: portal.accountId,
    portalSessionToken: portal.sessionToken, authSessionSignature: signature,
    verifiedAt: new Date(now).toISOString(), expiresAt: new Date(expires).toISOString(),
  };
}

/** A cache identity permits offline reads only, never a live write. */
export function readVerifiedPortalEmployeeLink(
  portal: PortalSessionRecord | null,
  user: AuthUser | null,
  session: AuthSession | null,
  now = Date.now(),
): VerifiedPortalEmployeeLink | null {
  const link = portal?.employeeLinkVerification;
  if (!link || !portal || (['employeeId', 'authUserId', 'tenantId', 'accountId', 'portalSessionToken', 'authSessionSignature', 'verifiedAt', 'expiresAt'] as const)
    .some((key) => typeof link[key] !== 'string' || !link[key].trim()) ||
    (['tenantId', 'accountId', 'sessionToken', 'expiresAt'] as const)
      .some((key) => typeof portal[key] !== 'string' || !portal[key].trim())) return null;
  if (!link || !portal || portal.loginType !== 'employee_portal' || portal.roleKey !== 'employee_portal' ||
      user?.roleKey !== 'employee_portal' || session?.user?.id !== user?.id ||
      link.authUserId !== user?.id || link.tenantId !== portal.tenantId || link.accountId !== portal.accountId ||
      link.portalSessionToken !== portal.sessionToken || !link.authSessionSignature ||
      link.authSessionSignature !== portalEmployeeSessionSignature(session) ||
      typeof link.employeeId !== 'string' || !link.employeeId.trim() || link.employeeId !== portal.employeeId ||
      typeof link.verifiedAt !== 'string' || typeof link.expiresAt !== 'string') return null;
  const verified = Date.parse(link.verifiedAt);
  const expires = Date.parse(link.expiresAt);
  const portalExpires = Date.parse(portal.expiresAt);
  const authExpires = session?.expiresAt;
  if (!Number.isFinite(verified) || verified > now || !Number.isFinite(expires) || expires <= now ||
      !Number.isFinite(portalExpires) || typeof authExpires !== 'number' || !Number.isFinite(authExpires) ||
      portalExpires < expires || authExpires < expires) return null;
  return link;
}
