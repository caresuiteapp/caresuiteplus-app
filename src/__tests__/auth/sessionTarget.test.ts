import { describe, expect, it } from 'vitest';
import { resolveAuthSessionTarget } from '@/lib/auth/sessionTarget';

describe('resolveAuthSessionTarget', () => {
  it('redirects business users away from public start', () => {
    const target = resolveAuthSessionTarget({
      profile: { roleKey: 'business_admin' } as never,
      portalSession: null,
      user: null,
    });

    expect(target.homePath).toBe('/business');
    expect(target.canRedirectHome).toBe(true);
  });

  it('uses user roleKey when profile roleKey is missing', () => {
    const target = resolveAuthSessionTarget({
      profile: null,
      portalSession: null,
      user: { roleKey: 'business_admin' } as never,
    });

    expect(target.hasSessionTarget).toBe(true);
    expect(target.homePath).toBe('/business');
    expect(target.canRedirectHome).toBe(true);
  });

  it('uses portal session roleKey when profile roleKey is missing', () => {
    const target = resolveAuthSessionTarget({
      profile: null,
      portalSession: {
        sessionToken: 'token',
        tenantId: 'tenant-1',
        loginType: 'client_portal',
        roleKey: 'client_portal',
        expiresAt: '2099-01-01T00:00:00.000Z',
        accountId: 'cpa-1',
        clientId: 'client-1',
      },
      user: null,
    });

    expect(target.roleKey).toBe('client_portal');
    expect(target.homePath).toBe('/portal/client');
    expect(target.canRedirectHome).toBe(true);
  });

  it('prefers active portal session role over stale profile role', () => {
    const target = resolveAuthSessionTarget({
      profile: { roleKey: 'business_admin' } as never,
      portalSession: {
        sessionToken: 'token',
        tenantId: 'tenant-1',
        loginType: 'client_portal',
        roleKey: 'client_portal',
        expiresAt: '2099-01-01T00:00:00.000Z',
        accountId: 'cpa-1',
        clientId: 'client-1',
      },
      user: { roleKey: 'business_admin' } as never,
    });

    expect(target.roleKey).toBe('client_portal');
    expect(target.homePath).toBe('/portal/client');
  });

  it('does not redirect authenticated users back to public start', () => {
    const target = resolveAuthSessionTarget({
      profile: null,
      portalSession: null,
      user: null,
    });

    expect(target.homePath).toBe('/');
    expect(target.canRedirectHome).toBe(false);
  });
});
