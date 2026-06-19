import { describe, expect, it } from 'vitest';
import { getPortalDisplayName } from '@/lib/auth/userdisplayname';
import type { PortalSessionRecord } from '@/lib/auth/portalSessionStore';

describe('getPortalDisplayName', () => {
  it('skips portal username labels for client portal sessions', () => {
    const portalSession: PortalSessionRecord = {
      sessionToken: 'token',
      tenantId: 'tenant-1',
      loginType: 'client_portal',
      roleKey: 'client_portal',
      expiresAt: '2099-01-01T00:00:00.000Z',
      accountId: 'cpa-1',
      displayName: 'ellen.zacharias',
    };

    expect(
      getPortalDisplayName(
        { displayName: 'ellen.zacharias' } as never,
        { displayName: 'ellen.zacharias' } as never,
        portalSession,
      ),
    ).toBe('Portal');
  });

  it('uses cached real client name from portal session', () => {
    const portalSession: PortalSessionRecord = {
      sessionToken: 'token',
      tenantId: 'tenant-1',
      loginType: 'client_portal',
      roleKey: 'client_portal',
      expiresAt: '2099-01-01T00:00:00.000Z',
      accountId: 'cpa-1',
      displayName: 'Frau Ellen Zacharias',
    };

    expect(getPortalDisplayName(null, null, portalSession)).toBe('Frau Ellen Zacharias');
  });

  it('falls back to profile displayName when portal session has no label', () => {
    expect(
      getPortalDisplayName(
        { displayName: 'Ellen Zacharias' } as never,
        null,
        null,
        'Portal',
      ),
    ).toBe('Ellen Zacharias');
  });
});
