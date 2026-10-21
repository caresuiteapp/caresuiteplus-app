// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({
  platform: { OS: 'web' }, getSession: vi.fn(), bootstrap: vi.fn(), loadPortal: vi.fn(),
  listener: undefined as undefined | ((event: string, session: unknown) => void),
  unsubscribe: vi.fn(), permissions: vi.fn(), signOut: vi.fn(), clearOffline: vi.fn(), clearPortal: vi.fn(),
  ensurePortal: vi.fn(), savePortal: vi.fn(), backgroundRefresh: vi.fn(), hydrateModules: vi.fn(), hydrateSettings: vi.fn(),
}));
vi.mock('react-native', () => ({ Platform: mock.platform }));
vi.mock('@/lib/react/runAppTransition', () => ({ runAppTransition: (fn: () => void) => fn() }));
vi.mock('@/lib/supabase', () => ({
  resolveAuthMode: () => 'supabase', getSession: mock.getSession, signOut: mock.signOut,
  onAuthStateChange: (callback: typeof mock.listener) => { mock.listener = callback; return { unsubscribe: mock.unsubscribe }; },
}));
vi.mock('@/lib/supabase/tenantService', () => ({ bootstrapTenantContext: mock.bootstrap }));
vi.mock('@/lib/supabase/permissionRepository', () => ({ fetchRuntimePermissions: mock.permissions }));
vi.mock('@/lib/modules/moduleAccessHydration', () => ({ hydrateTenantModulesFromSupabase: mock.hydrateModules }));
vi.mock('@/lib/tenant/tenantModuleSettingsHydration', () => ({ hydrateTenantModuleSettings: mock.hydrateSettings }));
vi.mock('@/lib/auth/portalSessionStore', () => ({ loadPortalSession: mock.loadPortal, clearPortalSession: mock.clearPortal, savePortalSession: mock.savePortal }));
vi.mock('@/lib/auth/portalSessionSecurityService', () => ({ revokePortalSession: vi.fn() }));
vi.mock('@/lib/auth/businessWelcomeSession', () => ({ clearBusinessWelcomePending: vi.fn() }));
vi.mock('@/lib/offline/idb', () => ({ clearOfflineDb: mock.clearOffline }));
vi.mock('@/lib/offline/portalBackgroundRefresh', () => ({ configurePortalBackgroundRefresh: mock.backgroundRefresh }));
vi.mock('@/lib/offline/assignmentDetailPrefetch', () => ({ cancelAssignmentDetailPrefetch: vi.fn() }));
vi.mock('@/lib/portal/portalPushNotifications', () => ({ unregisterPortalPushDeviceBeforeLogout: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/auth/portalSupabaseAuth', () => ({ ensurePortalWriteSession: mock.ensurePortal, isPortalSupabaseIdentityAligned: () => true }));

import { AuthProvider } from '@/lib/auth/AuthProvider';
import { useAuth } from '@/lib/auth/context';
import type { PortalSessionRecord } from '@/lib/auth/portalSessionStore';

const liveSession = { user: { id: 'user-test', email: 'test@example.invalid' }, access_token: 'test-only-token' };
const identity = {
  ok: true, user: { id: 'user-test', roleKey: 'business_admin' },
  profile: { id: 'user-test', roleKey: 'business_admin', tenantId: 'tenant-test' }, session: liveSession,
};
const familyRecord: PortalSessionRecord = {
  accountId: 'family-account', tenantId: 'family-tenant', relativeContactId: 'family-contact',
  sessionToken: 'opaque-test-family-session', expiresAt: '2099-01-01T00:00:00Z',
  loginType: 'relative_portal', roleKey: 'family_portal', clientId: null,
  portalType: 'academy_family', accessScope: 'academy', accessGeneration: 1, displayName: 'Eigene Lernperson',
};
const familySession = {
  user: { id: 'family-auth-user', email: 'family@example.invalid', app_metadata: {
    tenant_id: familyRecord.tenantId, role_key: 'family_portal', portal_type: 'academy_family',
    portal_account_id: familyRecord.accountId, relative_contact_id: familyRecord.relativeContactId,
    access_scope: 'academy', academy_access_generation: 1,
  } }, access_token: 'test-only-family-token',
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
let root: Root, host: HTMLDivElement;
let states: { ready: boolean; authenticated: boolean; role: string | null }[];
let latestAuth: ReturnType<typeof useAuth>;
function Probe() {
  const auth = useAuth();
  React.useLayoutEffect(() => {
    latestAuth = auth;
    states.push({ ready: auth.authReady, authenticated: auth.isAuthenticated, role: auth.profile?.roleKey ?? null });
  });
  return <span>{auth.authReady ? auth.isAuthenticated ? 'Desktop' : 'Anmeldung' : 'Sitzung wird geladen'}</span>;
}
const render = () => act(async () => { root.render(<AuthProvider><Probe /></AuthProvider>); });

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks(); mock.platform.OS = 'web'; mock.listener = undefined; states = [];
  mock.loadPortal.mockResolvedValue(null);
  mock.ensurePortal.mockResolvedValue({ ok: false, error: 'No portal fixture' });
  mock.savePortal.mockResolvedValue(undefined);
  mock.signOut.mockResolvedValue({ ok: true, data: null });
  mock.clearOffline.mockResolvedValue(true); mock.clearPortal.mockResolvedValue(undefined);
  mock.getSession.mockResolvedValue({ ok: true, data: liveSession });
  mock.bootstrap.mockResolvedValue(identity);
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

describe('web session bootstrap', () => {
  function expectOwnFamilyIdentity() {
    expect(latestAuth.authReady).toBe(true);
    expect(latestAuth.isAuthenticated).toBe(true);
    expect(latestAuth.profile).toMatchObject({ id: 'family-auth-user', tenantId: 'family-tenant', roleKey: 'family_portal' });
    expect(latestAuth.user).toMatchObject({ id: 'family-auth-user', roleKey: 'family_portal', portalType: 'academy_family', accessScope: 'academy' });
    expect(latestAuth.profileBootstrapError).toBeNull();
    expect(mock.permissions).not.toHaveBeenCalled();
    expect(mock.hydrateModules).not.toHaveBeenCalled();
    expect(mock.hydrateSettings).not.toHaveBeenCalled();
    expect(mock.backgroundRefresh.mock.calls.some(([enabled]) => enabled === true)).toBe(false);
  }

  it('opens a direct family portal sign-in without loading general profile, module or care data', async () => {
    mock.getSession.mockResolvedValue({ ok: true, data: null });
    await render();
    mock.getSession.mockResolvedValue({ ok: true, data: familySession });
    await act(async () => latestAuth.signInPortalSession(familyRecord));
    expectOwnFamilyIdentity();
    expect(mock.bootstrap).not.toHaveBeenCalled();
    expect(mock.savePortal).toHaveBeenCalledWith(familyRecord);
    expect(latestAuth.portalSession).toMatchObject({ clientId: null, relativeContactId: 'family-contact' });
  });

  it('waits for the repaired saved family session before publishing the academy-only identity', async () => {
    const repaired = deferred<any>();
    mock.loadPortal.mockResolvedValue(familyRecord);
    mock.ensurePortal.mockReturnValueOnce(repaired.promise);
    await render();
    expect(host.textContent).toBe('Sitzung wird geladen');
    expect(latestAuth.portalSession).toBeNull();
    await act(async () => repaired.resolve({ ok: true, data: familySession }));
    expectOwnFamilyIdentity();
    expect(mock.ensurePortal).toHaveBeenCalledWith(familyRecord);
    expect(mock.getSession).not.toHaveBeenCalled();
    expect(mock.bootstrap).not.toHaveBeenCalled();
    expect(latestAuth.portalSession).toEqual(familyRecord);
  });

  it('restores a signed family session when its local opaque portal record is missing', async () => {
    mock.getSession.mockResolvedValue({ ok: true, data: familySession });
    await render();
    expectOwnFamilyIdentity();
    expect(latestAuth.portalSession).toBeNull();
    expect(mock.bootstrap).not.toHaveBeenCalled();
    expect(mock.ensurePortal).not.toHaveBeenCalled();
  });

  it('does not restore an earlier business profile request over a confirmed family account switch', async () => {
    const earlier = deferred<any>();
    mock.bootstrap.mockReturnValueOnce(earlier.promise);
    await render();
    mock.getSession.mockResolvedValue({ ok: true, data: familySession });
    await act(async () => latestAuth.signInPortalSession(familyRecord));
    await act(async () => earlier.resolve(identity));
    expectOwnFamilyIdentity();
    expect(mock.bootstrap).toHaveBeenCalledOnce();
    expect(latestAuth.session?.user.id).toBe('family-auth-user');
  });

  it('preserves native logout error propagation and its existing cleanup', async () => {
    mock.platform.OS = 'android';
    const restored = deferred<any>();
    mock.bootstrap.mockReturnValueOnce(restored.promise);
    await render();
    await act(async () => restored.resolve(identity));
    expect(latestAuth.profile?.roleKey).toBe('business_admin');
    mock.getSession.mockResolvedValue({ ok: true, data: null });
    mock.signOut.mockRejectedValueOnce(new Error('native logout unavailable'));
    await act(async () => { await expect(latestAuth.signOut()).rejects.toThrow('native logout unavailable'); });
    expect(latestAuth.isAuthenticated).toBe(false);
    expect(latestAuth.authReady).toBe(true);
    expect(mock.clearOffline).toHaveBeenCalledOnce();
    expect(latestAuth.signOutError).toBeNull();
  });
  it('does not restore a stale profile response after sign-out has finished', async () => {
    await render();
    const stale = deferred<any>(); mock.bootstrap.mockReturnValueOnce(stale.promise);
    await act(async () => mock.listener?.('SIGNED_IN', liveSession));
    await act(async () => latestAuth.signOut());
    expect(latestAuth.authReady).toBe(true);
    expect(latestAuth.isAuthenticated).toBe(false);
    await act(async () => stale.resolve(identity));
    expect(latestAuth.isAuthenticated).toBe(false);
    expect(latestAuth.profile).toBeNull();
  });
  it('releases the loading state even when browser cache cleanup fails after a confirmed sign-out', async () => {
    await render(); mock.clearOffline.mockRejectedValueOnce(new Error('cache unavailable'));
    await act(async () => { await expect(latestAuth.signOut()).rejects.toThrow('cache unavailable'); });
    expect(latestAuth.authReady).toBe(true);
    expect(latestAuth.isAuthenticated).toBe(false);
    expect(latestAuth.session).toBeNull();
  });
  it('does not claim to have signed out when server logout fails, and keeps the page usable for retry', async () => {
    await render(); mock.signOut.mockResolvedValueOnce({ ok: false, error: 'Abmeldung hat zu lange gedauert.' });
    await act(async () => { await expect(latestAuth.signOut()).rejects.toThrow('Abmeldung hat zu lange gedauert'); });
    expect(latestAuth.authReady).toBe(true);
    expect(latestAuth.isAuthenticated).toBe(true);
    expect(latestAuth.signOutError).toBe('Abmeldung hat zu lange gedauert.');
    expect(mock.clearOffline).not.toHaveBeenCalled();
    await act(async () => latestAuth.signOut());
    expect(latestAuth.isAuthenticated).toBe(false);
    expect(latestAuth.signOutError).toBeNull();
  });
  it('stops automatic repairs after one failed retry of a roleless saved session', async () => {
    mock.bootstrap.mockResolvedValue({ ok: false, error: 'Benutzerrolle konnte nicht geladen werden.' });
    await render();
    await act(async () => { await Promise.resolve(); });
    expect(mock.bootstrap).toHaveBeenCalledTimes(2);
    expect(latestAuth.authReady).toBe(true);
    expect(latestAuth.profileBootstrapError).toBe('Benutzerrolle konnte nicht geladen werden.');
    expect(latestAuth.profile).toBeNull();
    expect(latestAuth.user?.roleKey).toBeNull();
    await act(async () => { await Promise.resolve(); });
    expect(mock.bootstrap).toHaveBeenCalledTimes(2);
  });
  it('allows an explicit retry to recover the role without another automatic request', async () => {
    mock.bootstrap.mockResolvedValue({ ok: false, error: 'Benutzerrolle konnte nicht geladen werden.' });
    await render();
    expect(mock.bootstrap).toHaveBeenCalledTimes(2);
    mock.bootstrap.mockResolvedValue(identity);
    await act(async () => latestAuth.retryProfileBootstrap());
    expect(latestAuth.profile?.roleKey).toBe('business_admin');
    expect(latestAuth.profileBootstrapError).toBeNull();
    expect(mock.bootstrap).toHaveBeenCalledTimes(3);
  });
  it('keeps login and desktop hidden until a slow session and profile resolve', async () => {
    const session = deferred<any>(), profile = deferred<any>();
    mock.getSession.mockReturnValue(session.promise); mock.bootstrap.mockReturnValue(profile.promise);
    await render(); expect(host.textContent).toBe('Sitzung wird geladen');
    await act(async () => session.resolve({ ok: true, data: liveSession }));
    expect(host.textContent).toBe('Sitzung wird geladen');
    await act(async () => profile.resolve(identity));
    expect(host.textContent).toBe('Desktop');
    expect(states.some(state => state.ready && (!state.authenticated || !state.role))).toBe(false);
    expect(mock.getSession).toHaveBeenCalledOnce(); expect(mock.bootstrap).toHaveBeenCalledOnce();
  });
  it('does not repeat the profile bootstrap for INITIAL_SESSION', async () => {
    const profile = deferred<any>(); mock.bootstrap.mockReturnValue(profile.promise);
    await render();
    await act(async () => mock.listener?.('INITIAL_SESSION', liveSession));
    expect(mock.bootstrap).toHaveBeenCalledOnce();
    await act(async () => profile.resolve(identity));
    expect(host.textContent).toBe('Desktop'); expect(mock.permissions).toHaveBeenCalledOnce();
  });
  it('opens login after an anonymous restore without a second reconciliation request', async () => {
    mock.getSession.mockResolvedValue({ ok: true, data: null });
    await render(); expect(host.textContent).toBe('Anmeldung');
    expect(mock.getSession).toHaveBeenCalledOnce(); expect(mock.bootstrap).not.toHaveBeenCalled();
  });
  it('still handles a subsequent sign-in and sign-out', async () => {
    mock.getSession.mockResolvedValue({ ok: true, data: null }); await render();
    await act(async () => mock.listener?.('SIGNED_IN', liveSession));
    expect(host.textContent).toBe('Desktop');
    await act(async () => mock.listener?.('SIGNED_OUT', null));
    expect(host.textContent).toBe('Anmeldung');
  });
  it('preserves the existing native background restoration behavior', async () => {
    mock.platform.OS = 'android'; const profile = deferred<any>(); mock.bootstrap.mockReturnValue(profile.promise);
    await render(); expect(states.some(state => state.ready)).toBe(true);
    await act(async () => profile.resolve(identity)); expect(host.textContent).toBe('Desktop');
  });
});
