// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ModuleAssignmentSection } from '@/lib/officeCore/types';
import type { ModuleAssignmentWorkspaceResult } from '@/lib/officeModules/moduleAssignmentWorkspaceService.web';

const runtime = vi.hoisted(() => ({
  auth: {
    authReady: true, isAuthenticated: true,
    user: { id: 'user-a' } as { id: string } | null,
    profile: { id: 'profile-a', roleKey: 'business_admin' } as { id: string; roleKey: string } | null,
    portalSession: null as { roleKey: string } | null,
    profileBootstrapError: null as string | null,
  },
  tenant: 'tenant-a' as string | null,
  fetch: vi.fn(),
}));
vi.mock('@/lib/auth/context', () => ({ useAuth: () => runtime.auth }));
vi.mock('@/lib/auth/sessionTarget', () => ({ resolveEffectiveRoleKey: () => runtime.auth.profile?.roleKey ?? null }));
vi.mock('@/hooks/useTenantId', () => ({ useServiceTenantId: () => runtime.tenant }));
vi.mock('@/lib/officeModules/moduleAssignmentWorkspaceService.web', () => ({ fetchModuleAssignmentWorkspace: runtime.fetch }));
import { useModuleAssignmentWorkspace } from '@/hooks/useModuleAssignmentWorkspace.web';

type HookState = ReturnType<typeof useModuleAssignmentWorkspace>;
let host: HTMLDivElement, root: Root, latest: HookState;
let observed: HookState[];
let section: ModuleAssignmentSection | undefined;
function Probe({ selected }: { selected?: ModuleAssignmentSection }) {
  latest = useModuleAssignmentWorkspace(selected);
  observed.push(latest);
  return null;
}
async function render() { await act(async () => root.render(createElement(Probe, { selected: section }))); }
async function refresh() { await act(async () => latest.refresh()); }
function deferred() {
  let resolve!: (result: ModuleAssignmentWorkspaceResult) => void;
  const promise = new Promise<ModuleAssignmentWorkspaceResult>(done => { resolve = done; });
  return { promise, resolve };
}
function success(tenantId = 'tenant-a', selected: ModuleAssignmentSection | null = null): ModuleAssignmentWorkspaceResult {
  return { ok: true, data: {
    tenantId, tenantName: tenantId, source: 'live', loadedAt: '2026-10-21T10:00:00Z',
    sections: [], section: selected, items: [], warnings: [],
  } };
}
beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  runtime.auth = { authReady: true, isAuthenticated: true, user: { id: 'user-a' }, profile: { id: 'profile-a', roleKey: 'business_admin' }, portalSession: null, profileBootstrapError: null };
  runtime.tenant = 'tenant-a'; section = undefined; observed = [];
  vi.clearAllMocks(); runtime.fetch.mockResolvedValue(success());
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

describe('module assignment workspace request lifecycle', () => {
  it('keeps an initial pending request distinct from an empty successful result', async () => {
    const pending = deferred(); runtime.fetch.mockReturnValue(pending.promise);
    await render();
    expect(latest.data).toBeNull(); expect(latest.loading).toBe(true); expect(latest.error).toBeNull();
    await act(async () => pending.resolve(success()));
    expect(latest.data?.items).toEqual([]); expect(latest.loading).toBe(false); expect(latest.error).toBeNull();
  });

  it.each(['tenant', 'user', 'profile', 'role', 'section'] as const)('masks old data during the first render after a %s change', async change => {
    await render(); expect(latest.data?.tenantId).toBe('tenant-a');
    const previousIdentity = latest.identityKey;
    const pending = deferred(); runtime.fetch.mockReturnValue(pending.promise);
    if (change === 'tenant') runtime.tenant = 'tenant-b';
    if (change === 'user') runtime.auth.user = { id: 'user-b' };
    if (change === 'profile') runtime.auth.profile!.id = 'profile-b';
    if (change === 'role') runtime.auth.profile!.roleKey = 'business_manager';
    if (change === 'section') section = 'clients';
    observed = []; await render();
    expect(observed.length).toBeGreaterThan(0);
    expect(observed.every(state => state.data === null && state.loading && state.error === null)).toBe(true);
    expect(latest.identityKey).not.toBe(previousIdentity);
    expect(runtime.fetch).toHaveBeenLastCalledWith({ authUserId: runtime.auth.user!.id, profileId: runtime.auth.profile!.id, tenantId: runtime.tenant, roleKey: runtime.auth.profile!.roleKey }, section);
    await act(async () => pending.resolve(success(runtime.tenant!, section ?? null)));
    expect(latest.data?.tenantId).toBe(runtime.tenant); expect(latest.data?.section).toBe(section ?? null);
  });

  it('ignores an old tenant response that arrives after the new tenant has loaded', async () => {
    const first = deferred(), next = deferred();
    runtime.fetch.mockReturnValueOnce(first.promise).mockReturnValueOnce(next.promise);
    await render(); runtime.tenant = 'tenant-b'; await render();
    await act(async () => next.resolve(success('tenant-b')));
    expect(latest.data?.tenantId).toBe('tenant-b');
    await act(async () => first.resolve(success('tenant-a')));
    expect(latest.data?.tenantId).toBe('tenant-b'); expect(latest.error).toBeNull();
  });

  it('ignores a superseded same-identity refresh result', async () => {
    await render();
    const first = deferred(), next = deferred();
    runtime.fetch.mockReturnValueOnce(first.promise).mockReturnValueOnce(next.promise);
    await refresh(); await refresh();
    await act(async () => next.resolve({ ok: false, code: 'permission', error: 'Zugriff entzogen.' }));
    await act(async () => first.resolve(success()));
    expect(latest.data).toBeNull(); expect(latest.error).toBe('Zugriff entzogen.');
  });

  it('retains the last same-identity snapshot with an explicit connection error and permits retry', async () => {
    await render(); const previous = latest.data;
    const pending = deferred(); runtime.fetch.mockReturnValueOnce(pending.promise);
    await refresh(); expect(latest.data).toBe(previous); expect(latest.loading).toBe(true);
    await act(async () => pending.resolve({ ok: false, code: 'connection', error: 'Verbindung unterbrochen.' }));
    expect(latest.data).toBe(previous); expect(latest.error).toBe('Verbindung unterbrochen.'); expect(latest.loading).toBe(false);
    await refresh(); expect(latest.error).toBeNull(); expect(latest.data?.tenantId).toBe('tenant-a');
  });

  it.each(['identity', 'permission', 'unavailable'] as const)('clears all previously loaded data after a %s rejection', async code => {
    await render(); runtime.fetch.mockResolvedValueOnce({ ok: false, code, error: 'Nicht mehr verfügbar.' });
    await refresh(); expect(latest.data).toBeNull(); expect(latest.error).toBe('Nicht mehr verfügbar.'); expect(latest.loading).toBe(false);
  });

  it('clears old data when an unexpected rejection cannot confirm current access', async () => {
    await render(); expect(latest.data).not.toBeNull();
    runtime.fetch.mockRejectedValueOnce(new Error('Connection lost'));
    await refresh(); expect(latest.data).toBeNull(); expect(latest.error).toContain('nicht aktualisiert'); expect(latest.loading).toBe(false);
  });
});

describe('module assignment workspace authentication boundaries', () => {
  it('immediately hides loaded data while authentication is being resolved', async () => {
    await render(); runtime.auth.authReady = false; observed = []; await render();
    expect(observed.every(state => state.data === null && state.loading)).toBe(true);
    expect(runtime.fetch).toHaveBeenCalledTimes(1);
  });

  it.each(['employee_portal', 'client_portal', 'family_portal'])('blocks the %s session before requesting data', async roleKey => {
    runtime.auth.portalSession = { roleKey }; await render();
    expect(runtime.fetch).not.toHaveBeenCalled(); expect(latest.data).toBeNull(); expect(latest.error).toContain('Verwaltungskonto'); expect(latest.loading).toBe(false);
  });

  it.each(['signed-out', 'missing-user', 'missing-profile', 'missing-tenant', 'profile-error'] as const)('clears loaded data when the identity becomes %s', async reason => {
    await render();
    if (reason === 'signed-out') runtime.auth.isAuthenticated = false;
    if (reason === 'missing-user') runtime.auth.user = null;
    if (reason === 'missing-profile') runtime.auth.profile = null;
    if (reason === 'missing-tenant') runtime.tenant = null;
    if (reason === 'profile-error') runtime.auth.profileBootstrapError = 'Profil konnte nicht geladen werden.';
    observed = []; await render();
    expect(observed.every(state => state.data === null)).toBe(true);
    expect(runtime.fetch).toHaveBeenCalledTimes(1); expect(latest.error).toContain('Verwaltungskonto');
  });

  it('refreshes when returning to the browser window and removes that listener on unmount', async () => {
    await render();
    await act(async () => window.dispatchEvent(new Event('focus')));
    expect(runtime.fetch).toHaveBeenCalledTimes(2);
    await act(async () => root.render(null));
    await act(async () => window.dispatchEvent(new Event('focus')));
    expect(runtime.fetch).toHaveBeenCalledTimes(2);
  });
});
