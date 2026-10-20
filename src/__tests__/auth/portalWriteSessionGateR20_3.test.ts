import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mapTokens, setSession } = vi.hoisted(() => ({
  mapTokens: vi.fn(),
  setSession: vi.fn(),
}));

vi.mock('@/lib/services/mode', () => ({
  getServiceMode: () => 'supabase',
}));

vi.mock('@/lib/auth/portalSupabaseAuth', () => ({
  mapPortalSupabaseTokensFromEdge: mapTokens,
  signInWithPortalSupabaseTokens: setSession,
}));

import { completePortalLogin } from '@/lib/auth/portalLoginFlow';

const portalSession = {
  sessionToken: '1234567890123456',
  tenantId: '11111111-1111-1111-1111-111111111111',
  loginType: 'employee_portal' as const,
  roleKey: 'employee_portal' as const,
  expiresAt: '2026-09-03T10:00:00.000Z',
  accountId: '22222222-2222-2222-2222-222222222222',
  employeeId: '33333333-3333-3333-3333-333333333333',
};

describe('portal write-session login gate R20.3', () => {
  beforeEach(() => {
    mapTokens.mockReset();
    setSession.mockReset();
  });

  it('rejects a visually logged-in but non-writable live portal session', async () => {
    mapTokens.mockReturnValue(null);

    const result = await completePortalLogin(portalSession, {});

    expect(result).toEqual({
      ok: false,
      error: 'Die sichere App-Sitzung wurde nicht vollständig erstellt. Bitte erneut anmelden.',
    });
    expect(setSession).not.toHaveBeenCalled();
  });

  it('accepts the portal only after the Supabase RLS session is established', async () => {
    const tokens = { accessToken: 'access', refreshToken: 'refresh' };
    mapTokens.mockReturnValue(tokens);
    setSession.mockResolvedValue({ ok: true, data: { user: { id: 'auth-user' } } });

    const result = await completePortalLogin(portalSession, {
      supabaseAccessToken: 'access',
      supabaseRefreshToken: 'refresh',
    });

    expect(result.ok).toBe(true);
    expect(setSession).toHaveBeenCalledWith(tokens);
  });

  it('repairs only still-active employee and client portal accounts', () => {
    const source = readFileSync('supabase/functions/portal-session-refresh/index.ts', 'utf8');
    expect(source).toContain(".in('status', ['active', 'pending_first_login', 'password_reset_required'])");
    expect(source).toContain(".eq('portal_enabled', true)");
    expect(source).toContain(".eq('status', 'aktiv')");
  });
});
