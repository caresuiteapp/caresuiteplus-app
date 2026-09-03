import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

const { getSession, setSession, invokeEdgeFunction, runtimeProbe } = vi.hoisted(() => ({
  getSession: vi.fn(),
  setSession: vi.fn(),
  invokeEdgeFunction: vi.fn(),
  runtimeProbe: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({
  getSupabaseClient: () => ({ auth: { getSession, setSession }, rpc: runtimeProbe }),
}));

vi.mock('@/lib/supabase/config', () => ({
  isDemoMode: () => false,
}));

vi.mock('@/lib/supabase/edgeFunctions', () => ({
  invokeEdgeFunction,
}));

vi.mock('@/lib/supabase/authService', () => ({
  toGermanAuthError: () => 'Sitzung ungültig.',
}));

// Vitest mocks must be registered before importing the module under test.
// eslint-disable-next-line import/first
import {
  ensurePortalWriteSession,
  isPortalSupabaseSessionAligned,
} from '@/lib/auth/portalSupabaseAuth';

const portalSession = {
  sessionToken: '1234567890123456',
  tenantId: '11111111-1111-1111-1111-111111111111',
  loginType: 'employee_portal' as const,
  roleKey: 'employee_portal' as const,
  expiresAt: '2026-09-04T10:00:00.000Z',
  accountId: '22222222-2222-2222-2222-222222222222',
  employeeId: '33333333-3333-3333-3333-333333333333',
};

const alignedSession = {
  user: {
    id: 'auth-user',
    app_metadata: {
      tenant_id: portalSession.tenantId,
      role_key: 'employee_portal',
      portal_type: 'employee',
      portal_account_id: portalSession.accountId,
    },
  },
  access_token: 'access',
  refresh_token: 'refresh',
  expires_at: 2_000_000_000,
};

describe('portal write-session recovery R20.4', () => {
  beforeEach(() => {
    getSession.mockReset();
    setSession.mockReset();
    invokeEdgeFunction.mockReset();
    runtimeProbe.mockReset();
  });

  it('accepts only a JWT aligned with tenant, role, portal type and account', () => {
    expect(isPortalSupabaseSessionAligned(alignedSession as never, portalSession, 0)).toBe(true);
    expect(
      isPortalSupabaseSessionAligned(
        {
          ...alignedSession,
          user: { ...alignedSession.user, app_metadata: { role_key: 'employee_portal' } },
        } as never,
        portalSession,
        0,
      ),
    ).toBe(false);
  });

  it('repairs a stale persisted session before the first portal write', async () => {
    getSession.mockResolvedValue({
      data: { session: { ...alignedSession, user: { ...alignedSession.user, app_metadata: {} } } },
      error: null,
    });
    invokeEdgeFunction.mockResolvedValue({
      ok: true,
      data: { supabaseAccessToken: 'new-access', supabaseRefreshToken: 'new-refresh' },
    });
    setSession.mockResolvedValue({ data: { session: alignedSession }, error: null });

    const result = await ensurePortalWriteSession(portalSession);

    expect(result.ok).toBe(true);
    expect(invokeEdgeFunction).toHaveBeenCalledWith('portal-session-refresh', {
      sessionToken: portalSession.sessionToken,
    });
    expect(setSession).toHaveBeenCalledWith({
      access_token: 'new-access',
      refresh_token: 'new-refresh',
    });
  });

  it('does not block a real write behind a synthetic runtime probe', async () => {
    getSession.mockResolvedValue({ data: { session: alignedSession }, error: null });

    const result = await ensurePortalWriteSession(portalSession, 'messages');

    expect(result.ok).toBe(true);
    expect(runtimeProbe).not.toHaveBeenCalled();
  });

  it('repairs bootstrap, messaging and visit actions instead of trusting visible login state', () => {
    const authProvider = readFileSync('src/lib/auth/AuthProvider.tsx', 'utf8');
    const chat = readFileSync('src/components/portal/PortalNewChatModal.tsx', 'utf8');
    const thread = readFileSync('src/hooks/useportalofficethreaddetail.ts', 'utf8');
    const visit = readFileSync('src/hooks/useEmployeePortalVisitExecution.ts', 'utf8');
    const portalAuth = readFileSync('supabase/functions/_shared/portalAuth.ts', 'utf8');

    expect(authProvider).toContain('await ensurePortalWriteSession(restoredPortal)');
    expect(chat).toContain("await ensurePortalWriteSession(portalSession, 'messages')");
    expect(thread).toContain("await ensurePortalWriteSession(portalSession, 'messages')");
    expect(visit.match(/await ensurePortalWriteSession\(portalSession, 'workflow'\)/g)).toHaveLength(2);
    expect(portalAuth).toContain('linkedEmail === email.toLowerCase()');
    expect(portalAuth).toContain('replacing mismatched auth link');
  });
});
