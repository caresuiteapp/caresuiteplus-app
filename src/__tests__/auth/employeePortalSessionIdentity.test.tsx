// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { usePortalActor, type PortalActor } from '@/hooks/usePortalActor';
import { createVerifiedPortalEmployeeLink } from '@/lib/auth/verifiedPortalEmployeeLink';

const h = vi.hoisted(() => ({
  platform: { OS: 'android' }, load: vi.fn(), save: vi.fn(), clear: vi.fn(), getSession: vi.fn(),
  repair: vi.fn(), bootstrap: vi.fn(), offline: false, listener: undefined as undefined | ((event: string, session: unknown) => void),
}));
vi.mock('react-native', () => ({ Platform: h.platform }));
vi.mock('@/lib/services/mode', () => ({ getServiceMode: () => 'supabase' }));
vi.mock('@/hooks/useConnectivity', () => ({ useConnectivity: () => ({ isOffline: h.offline }) }));
vi.mock('@/lib/react/runAppTransition', () => ({ runAppTransition: (fn: () => void) => fn() }));
vi.mock('@/lib/supabase', () => ({ resolveAuthMode: () => 'supabase', getSession: h.getSession,
  signOut: vi.fn().mockResolvedValue({ ok: true }),
  onAuthStateChange: (listener: typeof h.listener) => { h.listener = listener; return { unsubscribe: vi.fn() }; },
}));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => null }));
vi.mock('@/lib/supabase/authService', () => ({ toGermanAuthError: () => 'Sitzung ungültig.' }));
vi.mock('@/lib/supabase/edgeFunctions', () => ({ invokeEdgeFunction: vi.fn() }));
vi.mock('@/lib/supabase/tenantService', () => ({ bootstrapTenantContext: h.bootstrap }));
vi.mock('@/lib/supabase/permissionRepository', () => ({ fetchRuntimePermissions: vi.fn() }));
vi.mock('@/lib/modules/moduleAccessHydration', () => ({ hydrateTenantModulesFromSupabase: vi.fn() }));
vi.mock('@/lib/tenant/tenantModuleSettingsHydration', () => ({ hydrateTenantModuleSettings: vi.fn() }));
vi.mock('@/lib/auth/portalSessionStore', () => ({ loadPortalSession: h.load, savePortalSession: h.save, clearPortalSession: h.clear }));
vi.mock('@/lib/auth/portalSessionSecurityService', () => ({ revokePortalSession: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/auth/businessWelcomeSession', () => ({ clearBusinessWelcomePending: vi.fn() }));
vi.mock('@/lib/offline/idb', () => ({ clearOfflineDb: vi.fn() }));
vi.mock('@/lib/offline/portalBackgroundRefresh', () => ({ configurePortalBackgroundRefresh: vi.fn() }));
vi.mock('@/lib/offline/assignmentDetailPrefetch', () => ({ cancelAssignmentDetailPrefetch: vi.fn() }));
vi.mock('@/lib/portal/portalPushNotifications', () => ({ unregisterPortalPushDeviceBeforeLogout: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/auth/portalSupabaseAuth', async (original) => ({ ...await original<object>(), ensurePortalWriteSession: h.repair }));

import { AuthProvider } from '@/lib/auth/AuthProvider';
import { useAuth } from '@/lib/auth/context';
import type { PortalSessionRecord } from '@/lib/auth/portalSessionStore';
const portal: PortalSessionRecord = {
  accountId: 'account-a', tenantId: 'tenant-a', employeeId: 'employee-a', roleKey: 'employee_portal',
  loginType: 'employee_portal', sessionToken: 'test-only-portal-session', expiresAt: '2099-01-01T00:00:00Z',
};
const employeeSession = { access_token: 'test-only-token', user: { id: 'auth-a', app_metadata: {
  tenant_id: portal.tenantId, role_key: portal.roleKey, portal_type: 'employee', portal_account_id: portal.accountId,
} } };
const businessSession = { access_token: 'test-only-business-token', user: { id: 'auth-b', app_metadata: {
  tenant_id: 'tenant-b', role_key: 'business_admin',
} } };
function bootstrap(session: any) { return { ok: true, user: { id: session.user.id, roleKey: session.user.app_metadata.role_key },
  profile: { id: session.user.id, roleKey: session.user.app_metadata.role_key, tenantId: session.user.app_metadata.tenant_id }, session }; }
let root: Root, host: HTMLDivElement, auth: ReturnType<typeof useAuth>;
function Probe() { auth = useAuth(); return <span>{auth.portalSession?.accountId ?? 'no-portal'}</span>; }
let portalActor: PortalActor;
function ActorProbe() { auth = useAuth(); portalActor = usePortalActor(); return <span>{portalActor.employeeId}</span>; }
const render = () => act(async () => root.render(<AuthProvider><Probe /></AuthProvider>));
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks(); h.platform.OS = 'android'; h.listener = undefined; h.offline = false;
  h.load.mockResolvedValue(portal); h.save.mockResolvedValue(undefined); h.clear.mockResolvedValue(undefined);
  h.getSession.mockResolvedValue({ ok: true, data: businessSession });
  h.repair.mockResolvedValue({ ok: false, error: 'Sitzung konnte nicht erneuert werden.' });
  h.bootstrap.mockImplementation(async (session) => bootstrap(session));
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

describe('employee portal session identity', () => {
  it.each(['android', 'web'])('does not turn another %s Supabase account into the saved employee portal after failed repair', async (os) => {
    h.platform.OS = os;
    await render();
    expect(auth.portalSession).toBeNull();
    expect(auth.profile?.roleKey).toBe('business_admin');
    expect(auth.profile?.tenantId).toBe('tenant-b');
  });

  it('does not authenticate a saved employee portal without any live Supabase identity', async () => {
    h.getSession.mockResolvedValue({ ok: true, data: null });
    await render();
    expect(auth.portalSession).toBeNull();
    expect(auth.isAuthenticated).toBe(false);
  });

  it('preserves an aligned cached identity when session renewal is temporarily unavailable', async () => {
    h.getSession.mockResolvedValue({ ok: true, data: employeeSession });
    await render();
    expect(auth.portalSession?.accountId).toBe(portal.accountId);
    expect(auth.profile?.roleKey).toBe('employee_portal');
  });

  it('restores an aligned offline AuthProvider identity into the verified cache-only portal actor', async () => {
    h.offline = true;
    const expiresAt = Date.now() + 3_600_000;
    const signed = { ...employeeSession, access_token: 'header.payload.signature-a', expires_at: Math.floor(expiresAt / 1_000) };
    const record = { ...portal, expiresAt: new Date(expiresAt).toISOString() };
    const user = { id: 'auth-a', roleKey: 'employee_portal' as const, email: '', displayName: null };
    const session = { user, accessToken: signed.access_token, refreshToken: 'test-only-refresh-token', expiresAt: signed.expires_at * 1_000 };
    h.load.mockResolvedValue({ ...record, employeeLinkVerification: createVerifiedPortalEmployeeLink('employee-a', record, user, session) });
    h.getSession.mockResolvedValue({ ok: true, data: signed });
    h.bootstrap.mockResolvedValue({ ok: false, error: 'Network unavailable' });
    await act(async () => root.render(<AuthProvider><ActorProbe /></AuthProvider>));
    expect(auth.isAuthenticated).toBe(true); expect(auth.portalSession?.accountId).toBe('account-a');
    expect(portalActor.employeeId).toBe('employee-a'); expect(portalActor.isLinkedReady).toBe(true);
    expect(portalActor.employeeLinkReadOnly).toBe(true); expect(portalActor.employeeLinkVerifiedAt).toBeTruthy();
  });

  it.each(['android', 'web'])('preserves the first-login contract when %s repair emits SIGNED_IN before bootstrap completes', async (os) => {
    h.platform.OS = os;
    h.load.mockResolvedValue({ ...portal, mustChangePassword: true });
    h.repair.mockImplementation(async () => {
      await Promise.resolve();
      h.listener?.('SIGNED_IN', employeeSession);
      return { ok: true, data: employeeSession };
    });
    h.getSession.mockResolvedValue({ ok: true, data: employeeSession });
    await render();
    expect(auth.portalSession?.accountId).toBe(portal.accountId);
    expect(auth.portalSession?.mustChangePassword).toBe(true);
    expect(auth.profile?.roleKey).toBe('employee_portal');
  });

  it('drops the old portal record on a verified account switch without rewriting the new identity', async () => {
    h.repair.mockResolvedValue({ ok: true, data: employeeSession });
    h.getSession.mockResolvedValue({ ok: true, data: employeeSession });
    await render();
    await act(async () => h.listener?.('SIGNED_IN', businessSession));
    expect(auth.portalSession).toBeNull();
    expect(auth.profile?.roleKey).toBe('business_admin');
    expect(auth.profile?.tenantId).toBe('tenant-b');
  });

  it('does not leave an authenticated portal after a definitive SIGNED_OUT event', async () => {
    h.repair.mockResolvedValue({ ok: true, data: employeeSession });
    h.getSession.mockResolvedValue({ ok: true, data: employeeSession });
    await render();
    expect(auth.isAuthenticated).toBe(true);
    h.getSession.mockResolvedValue({ ok: true, data: null });
    await act(async () => h.listener?.('SIGNED_OUT', null));
    expect(auth.portalSession).toBeNull();
    expect(auth.isAuthenticated).toBe(false);
  });

  it('does not persist a portal login for a mismatched Supabase identity', async () => {
    h.load.mockResolvedValue(null);
    await render();
    await act(async () => { await expect(auth.signInPortalSession(portal)).rejects.toThrow(/Sitzung/); });
    expect(h.save).not.toHaveBeenCalled();
    expect(auth.portalSession).toBeNull();
  });
});
