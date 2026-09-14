// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({
  platform: { OS: 'web' }, getSession: vi.fn(), bootstrap: vi.fn(), loadPortal: vi.fn(),
  listener: undefined as undefined | ((event: string, session: unknown) => void),
  unsubscribe: vi.fn(), permissions: vi.fn(),
}));
vi.mock('react-native', () => ({ Platform: mock.platform }));
vi.mock('@/lib/react/runAppTransition', () => ({ runAppTransition: (fn: () => void) => fn() }));
vi.mock('@/lib/supabase', () => ({
  resolveAuthMode: () => 'supabase', getSession: mock.getSession, signOut: vi.fn(),
  onAuthStateChange: (callback: typeof mock.listener) => { mock.listener = callback; return { unsubscribe: mock.unsubscribe }; },
}));
vi.mock('@/lib/supabase/tenantService', () => ({ bootstrapTenantContext: mock.bootstrap }));
vi.mock('@/lib/supabase/permissionRepository', () => ({ fetchRuntimePermissions: mock.permissions }));
vi.mock('@/lib/modules/moduleAccessHydration', () => ({ hydrateTenantModulesFromSupabase: vi.fn() }));
vi.mock('@/lib/tenant/tenantModuleSettingsHydration', () => ({ hydrateTenantModuleSettings: vi.fn() }));
vi.mock('@/lib/auth/portalSessionStore', () => ({ loadPortalSession: mock.loadPortal, clearPortalSession: vi.fn(), savePortalSession: vi.fn() }));
vi.mock('@/lib/auth/portalSessionSecurityService', () => ({ revokePortalSession: vi.fn() }));
vi.mock('@/lib/auth/businessWelcomeSession', () => ({ clearBusinessWelcomePending: vi.fn() }));
vi.mock('@/lib/offline/idb', () => ({ clearOfflineDb: vi.fn() }));
vi.mock('@/lib/offline/portalBackgroundRefresh', () => ({ configurePortalBackgroundRefresh: vi.fn() }));
vi.mock('@/lib/offline/assignmentDetailPrefetch', () => ({ cancelAssignmentDetailPrefetch: vi.fn() }));
vi.mock('@/lib/portal/portalPushNotifications', () => ({ unregisterPortalPushDeviceBeforeLogout: vi.fn() }));
vi.mock('@/lib/auth/portalSupabaseAuth', () => ({ ensurePortalWriteSession: vi.fn() }));

import { AuthProvider } from '@/lib/auth/AuthProvider';
import { useAuth } from '@/lib/auth/context';

const liveSession = { user: { id: 'user-test', email: 'test@example.invalid' }, access_token: 'test-only-token' };
const identity = {
  ok: true, user: { id: 'user-test', roleKey: 'business_admin' },
  profile: { id: 'user-test', roleKey: 'business_admin', tenantId: 'tenant-test' }, session: liveSession,
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
let root: Root, host: HTMLDivElement;
let states: Array<{ ready: boolean; authenticated: boolean; role: string | null }>;
function Probe() {
  const auth = useAuth();
  states.push({ ready: auth.authReady, authenticated: auth.isAuthenticated, role: auth.profile?.roleKey ?? null });
  return <span>{auth.authReady ? auth.isAuthenticated ? 'Desktop' : 'Anmeldung' : 'Sitzung wird geladen'}</span>;
}
const render = () => act(async () => { root.render(<AuthProvider><Probe /></AuthProvider>); });

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks(); mock.platform.OS = 'web'; mock.listener = undefined; states = [];
  mock.loadPortal.mockResolvedValue(null);
  mock.getSession.mockResolvedValue({ ok: true, data: liveSession });
  mock.bootstrap.mockResolvedValue(identity);
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

describe('web session bootstrap', () => {
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
