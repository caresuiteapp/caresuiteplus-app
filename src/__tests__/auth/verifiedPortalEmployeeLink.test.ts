import { describe, expect, it } from 'vitest';
import { createVerifiedPortalEmployeeLink, readVerifiedPortalEmployeeLink } from '@/lib/auth/verifiedPortalEmployeeLink';
import type { PortalSessionRecord } from '@/lib/auth/portalSessionStore';
import type { AuthSession, AuthUser } from '@/types';
const now = Date.parse('2026-10-11T12:00:00Z');
const user: AuthUser = { id: 'auth-a', roleKey: 'employee_portal', email: 'a@example.test', displayName: null };
const session: AuthSession = { user, accessToken: 'header.payload.signature-a', refreshToken: 'test-only-refresh', expiresAt: now + 3_600_000 };
const portal: PortalSessionRecord = { tenantId: 'tenant-a', accountId: 'account-a', employeeId: 'employee-a', loginType: 'employee_portal', roleKey: 'employee_portal', sessionToken: 'test-only-opaque-session', expiresAt: new Date(now + 7_200_000).toISOString() };
const verification = createVerifiedPortalEmployeeLink('employee-a', portal, user, session, now)!;
const saved = { ...portal, employeeLinkVerification: verification };

describe('server-verified employee cache binding', () => {
  it('permits the exact verified identity until the earlier JWT/portal expiry', () => {
    expect(readVerifiedPortalEmployeeLink(saved, user, session, now)?.employeeId).toBe('employee-a');
    expect(verification.expiresAt).toBe(new Date(session.expiresAt!).toISOString());
    expect(readVerifiedPortalEmployeeLink(saved, user, session, session.expiresAt!)).toBeNull();
  });
  it.each(['authUserId', 'tenantId', 'accountId', 'portalSessionToken', 'authSessionSignature', 'employeeId'])('rejects a changed %s binding', (key) => {
    const changed = { ...saved, employeeLinkVerification: { ...verification, [key]: 'other' } };
    expect(readVerifiedPortalEmployeeLink(changed, user, session, now)).toBeNull();
  });
  it.each(['employeeId', 'authUserId', 'tenantId', 'accountId', 'portalSessionToken', 'authSessionSignature', 'verifiedAt', 'expiresAt'])('rejects a malformed persisted %s without crashing', (key) => {
    const malformed = { ...saved, employeeLinkVerification: { ...verification, [key]: 7 } } as unknown as PortalSessionRecord;
    expect(() => readVerifiedPortalEmployeeLink(malformed, user, session, now)).not.toThrow();
    expect(readVerifiedPortalEmployeeLink(malformed, user, session, now)).toBeNull();
  });
  it('rejects invalid portal and auth expiry values', () => {
    expect(readVerifiedPortalEmployeeLink({ ...saved, expiresAt: 'invalid-date' }, user, session, now)).toBeNull();
    expect(readVerifiedPortalEmployeeLink(saved, user, { ...session, expiresAt: Number.NaN }, now)).toBeNull();
    expect(readVerifiedPortalEmployeeLink(saved, user, { ...session, expiresAt: 'invalid-date' } as unknown as AuthSession, now)).toBeNull();
  });
  it('rejects unsigned sessions and a missing logout identity', () => {
    expect(readVerifiedPortalEmployeeLink(saved, user, { ...session, accessToken: 'no-signature' }, now)).toBeNull();
    expect(readVerifiedPortalEmployeeLink(null, null, null, now)).toBeNull();
  });
});
