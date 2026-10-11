// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({
  getSession: vi.fn(), bootstrap: vi.fn(), signOut: vi.fn(), loadPortal: vi.fn(),
  clearPortal: vi.fn(), clearOffline: vi.fn(),
  listener: undefined as undefined | ((event: string, session: unknown) => void),
}));
vi.mock('react-native', () => ({ Platform: { OS: 'android' } }));
vi.mock('@/lib/react/runAppTransition', () => ({ runAppTransition: (fn: () => void) => fn() }));
vi.mock('@/lib/supabase', () => ({
  resolveAuthMode: () => 'supabase', getSession: mock.getSession, signOut: mock.signOut,
  onAuthStateChange: (listener: typeof mock.listener) => { mock.listener = listener; return { unsubscribe: vi.fn() }; },
}));
vi.mock('@/lib/supabase/tenantService', () => ({ bootstrapTenantContext: mock.bootstrap }));
vi.mock('@/lib/supabase/permissionRepository', () => ({ fetchRuntimePermissions: vi.fn() }));
vi.mock('@/lib/modules/moduleAccessHydration', () => ({ hydrateTenantModulesFromSupabase: vi.fn() }));
vi.mock('@/lib/tenant/tenantModuleSettingsHydration', () => ({ hydrateTenantModuleSettings: vi.fn() }));
vi.mock('@/lib/auth/portalSessionStore', () => ({ loadPortalSession: mock.loadPortal, clearPortalSession: mock.clearPortal, savePortalSession: vi.fn() }));
vi.mock('@/lib/auth/portalSessionSecurityService', () => ({ revokePortalSession: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/auth/businessWelcomeSession', () => ({ clearBusinessWelcomePending: vi.fn() }));
vi.mock('@/lib/offline/idb', () => ({ clearOfflineDb: mock.clearOffline }));
vi.mock('@/lib/offline/portalBackgroundRefresh', () => ({ configurePortalBackgroundRefresh: vi.fn() }));
vi.mock('@/lib/offline/assignmentDetailPrefetch', () => ({ cancelAssignmentDetailPrefetch: vi.fn() }));
vi.mock('@/lib/portal/portalPushNotifications', () => ({ unregisterPortalPushDeviceBeforeLogout: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/auth/portalSupabaseAuth', () => ({ ensurePortalWriteSession: vi.fn(), isPortalSupabaseIdentityAligned: () => true }));

import { AuthProvider } from '@/lib/auth/AuthProvider';
import { useAuth } from '@/lib/auth/context';

const liveSession = { user: { id: 'client-old', email: 'client@example.invalid' }, access_token: 'test-only-token' };
const identity = {
  ok: true, user: { id: 'client-old', roleKey: 'client_portal' },
  profile: { id: 'client-old', roleKey: 'client_portal', tenantId: 'tenant-test' }, session: liveSession,
};
const nextSession = { ...liveSession, user: { ...liveSession.user, id: 'client-next' } };
const nextIdentity = {
  ...identity, user: { ...identity.user, id: 'client-next' },
  profile: { ...identity.profile, id: 'client-next' }, session: nextSession,
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
let root: Root, host: HTMLDivElement;
let latestAuth: ReturnType<typeof useAuth>;
function Probe() { latestAuth = useAuth(); return <span>{latestAuth.user?.id ?? 'signed-out'}</span>; }
const render = () => act(async () => root.render(<AuthProvider><Probe /></AuthProvider>));

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks(); mock.listener = undefined;
  mock.loadPortal.mockResolvedValue(null);
  mock.clearPortal.mockResolvedValue(undefined);
  mock.clearOffline.mockResolvedValue(undefined);
  mock.getSession.mockResolvedValue({ ok: true, data: liveSession });
  mock.bootstrap.mockResolvedValue(identity);
  mock.signOut.mockImplementation(async () => { mock.getSession.mockResolvedValue({ ok: true, data: null }); return { ok: true, data: null }; });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

describe('native client session lifecycle races', () => {
  it('cannot restore an old auth-event profile after explicit logout', async () => {
    await render();
    const pending = deferred<any>(); mock.bootstrap.mockReturnValueOnce(pending.promise);
    await act(async () => mock.listener?.('SIGNED_IN', liveSession));
    await act(async () => latestAuth.signOut());
    expect(latestAuth.isAuthenticated).toBe(false);
    await act(async () => pending.resolve(identity));
    expect(latestAuth.isAuthenticated).toBe(false);
    expect(latestAuth.profile).toBeNull();
  });

  it('invalidates a pending profile when Supabase reports SIGNED_OUT', async () => {
    await render();
    const pending = deferred<any>(); mock.bootstrap.mockReturnValueOnce(pending.promise);
    await act(async () => mock.listener?.('SIGNED_IN', liveSession));
    mock.getSession.mockResolvedValue({ ok: true, data: null });
    await act(async () => mock.listener?.('SIGNED_OUT', null));
    await act(async () => pending.resolve(identity));
    expect(latestAuth.isAuthenticated).toBe(false);
  });

  it('ignores sign-in events arriving while logout is still pending', async () => {
    await render();
    const logout = deferred<any>(); mock.signOut.mockReturnValueOnce(logout.promise);
    let signOutPromise!: Promise<void>;
    await act(async () => { signOutPromise = latestAuth.signOut(); });
    const calls = mock.bootstrap.mock.calls.length;
    await act(async () => mock.listener?.('SIGNED_IN', liveSession));
    expect(mock.bootstrap).toHaveBeenCalledTimes(calls);
    mock.getSession.mockResolvedValue({ ok: true, data: null });
    await act(async () => { logout.resolve({ ok: true, data: null }); await signOutPromise; });
    expect(latestAuth.isAuthenticated).toBe(false);
  });

  it('keeps the newer account if the previous sign-in resolves later', async () => {
    await render();
    const oldProfile = deferred<any>(); mock.bootstrap.mockReturnValueOnce(oldProfile.promise);
    await act(async () => mock.listener?.('SIGNED_IN', liveSession));
    mock.bootstrap.mockResolvedValueOnce(nextIdentity);
    await act(async () => mock.listener?.('SIGNED_IN', nextSession));
    expect(latestAuth.user?.id).toBe('client-next');
    await act(async () => oldProfile.resolve(identity));
    expect(latestAuth.user?.id).toBe('client-next');
  });

  it('cannot commit a delayed explicit profile retry after logout', async () => {
    await render();
    const pending = deferred<any>(); mock.bootstrap.mockReturnValueOnce(pending.promise);
    let retry!: Promise<void>;
    await act(async () => { retry = latestAuth.retryProfileBootstrap(); });
    await act(async () => latestAuth.signOut());
    await act(async () => { pending.resolve(identity); await retry; });
    expect(latestAuth.isAuthenticated).toBe(false);
    expect(latestAuth.profile).toBeNull();
  });

  it('cannot commit automatic profile repair after logout', async () => {
    const pending = deferred<any>();
    mock.bootstrap.mockResolvedValueOnce({ ok: false, error: 'role temporarily unavailable' });
    mock.bootstrap.mockReturnValue(pending.promise);
    await render();
    expect(mock.bootstrap.mock.calls.length).toBeGreaterThan(1);
    await act(async () => latestAuth.signOut());
    await act(async () => pending.resolve(identity));
    expect(latestAuth.isAuthenticated).toBe(false);
    expect(latestAuth.profile).toBeNull();
  });

  it('cannot restore the initial native session after logout completes', async () => {
    const pending = deferred<any>(); mock.bootstrap.mockReturnValue(pending.promise);
    await render();
    await act(async () => latestAuth.signOut());
    await act(async () => pending.resolve(identity));
    expect(latestAuth.isAuthenticated).toBe(false);
    expect(latestAuth.session).toBeNull();
  });

  it('cannot restore a direct login response that resolves after logout', async () => {
    await render();
    const pending = deferred<any>(); mock.bootstrap.mockReturnValueOnce(pending.promise);
    let login!: Promise<void>;
    await act(async () => { login = latestAuth.signInWithSupabaseSession(liveSession as any); });
    await act(async () => latestAuth.signOut());
    await act(async () => { pending.resolve(identity); await login; });
    expect(latestAuth.isAuthenticated).toBe(false);
  });

  it('cannot restore a portal login profile after the portal has signed out', async () => {
    await render();
    const pending = deferred<any>(); mock.bootstrap.mockReturnValueOnce(pending.promise);
    let login!: Promise<void>;
    await act(async () => { login = latestAuth.signInPortalSession({
      roleKey: 'client_portal', tenantId: 'tenant-test', accountId: 'client-old',
      clientId: 'linked-client-old', loginType: 'client_portal',
      expiresAt: '2099-01-01T00:00:00Z', sessionToken: 'test-only-portal-session',
    }); });
    expect(latestAuth.portalSession?.clientId).toBe('linked-client-old');
    await act(async () => latestAuth.signOut());
    await act(async () => { pending.resolve(identity); await login; });
    expect(latestAuth.isAuthenticated).toBe(false);
    expect(latestAuth.portalSession).toBeNull();
  });

  it.each(['portal storage', 'offline cache'])('releases loading and identity when %s cleanup rejects', async (cleanup) => {
    await render();
    (cleanup === 'portal storage' ? mock.clearPortal : mock.clearOffline)
      .mockRejectedValueOnce(new Error('test cleanup unavailable'));
    await act(async () => { await expect(latestAuth.signOut()).rejects.toThrow('test cleanup unavailable'); });
    expect(latestAuth.authReady).toBe(true);
    expect(latestAuth.isAuthenticated).toBe(false);
    expect(latestAuth.portalSession).toBeNull();
    expect(latestAuth.profile).toBeNull();
  });

  it('stops after one automatic retry when a signed-in native profile has no role', async () => {
    await render();
    let failures = 0;
    const held = deferred<any>();
    mock.bootstrap.mockImplementation(() => {
      failures += 1;
      return failures < 5 ? Promise.resolve({ ok: false, error: 'role temporarily unavailable' }) : held.promise;
    });
    await act(async () => mock.listener?.('SIGNED_IN', liveSession));
    expect(failures).toBe(2);
    expect(latestAuth.authReady).toBe(true);
    expect(latestAuth.profileBootstrapError).toBe('role temporarily unavailable');
    await act(async () => held.resolve(nextIdentity));
    expect(failures).toBe(2);
    mock.bootstrap.mockResolvedValueOnce(identity);
    await act(async () => latestAuth.retryProfileBootstrap());
    expect(latestAuth.profile?.roleKey).toBe('client_portal');
    expect(latestAuth.profileBootstrapError).toBeNull();
  });
});
