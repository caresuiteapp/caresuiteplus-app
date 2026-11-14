// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PermissionKey } from '@/types/permissions';
import { emptyPflegeDashboardStats } from '@/types/modules/pflege';
import { usePflegeDashboard } from '@/hooks/usePflegeDashboard';

const mocks = vi.hoisted(() => {
  const tenant = '10000000-0000-0000-0000-000000000001';
  const user = '10000000-0000-0000-0000-000000000002';
  const profile = '10000000-0000-0000-0000-000000000003';
  const renewed = '10000000-0000-0000-0000-000000000004';
  return {
    tenant, user, profile, renewed, actor: profile,
    token: 'test-session-original', grants: ['pflege.access', 'pflege.documentation.view'] as PermissionKey[],
    fetch: vi.fn(), plans: vi.fn(), status: true, refreshPermissions: vi.fn(),
  };
});
vi.mock('react-native', () => ({ AppState: {}, Platform: { OS: 'web' } }));
vi.mock('@/hooks/core/useLiveRefresh', () => ({ useLiveRefresh: () => ({}), DEFAULT_LIVE_POLL_MS: 30_000 }));
vi.mock('@/lib/auth/context', () => ({
  useAuth: () => ({
    user: { id: mocks.user }, profile: { id: mocks.actor, tenantId: mocks.tenant, roleKey: 'nurse' },
    session: { user: { id: mocks.user }, accessToken: mocks.token, expiresAt: null },
    authReady: true, isAuthenticated: true, isLoading: false, profileBootstrapError: null, portalSession: null,
  }),
}));
vi.mock('@/hooks/useTenantId', () => ({ useServiceTenantId: () => mocks.tenant }));
vi.mock('@/hooks/pflege/useCareRuntimePermissions', () => ({
  useCareRuntimePermissions: () => {
    const captured = mocks.grants;
    return {
      tenantId: mocks.tenant, roleKey: 'nurse', loading: false, error: null, permissions: captured,
      can: (permission: PermissionKey) => mocks.status && mocks.grants === captured && captured.includes(permission),
      hasModuleGate: () => mocks.status, refreshPermissions: mocks.refreshPermissions,
    };
  },
}));
vi.mock('@/lib/pflege/careDashboardOperationalService', () => ({ fetchCareOperationalStats: mocks.fetch }));
vi.mock('@/lib/pflege/carePlanListService', () => ({ fetchActiveCarePlans: mocks.plans }));

function stats(count: number) {
  return { ok: true as const, data: { ...emptyPflegeDashboardStats(), openDocumentationCount: count } };
}
let root: Root;
let host: HTMLDivElement;
let current: ReturnType<typeof usePflegeDashboard>;
function Showcase() {
  current = usePflegeDashboard();
  return <div>{current.stats?.openDocumentationCount ?? 'kein Stand'}</div>;
}
const render = () => act(async () => { root.render(<Showcase />); });
beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  mocks.actor = mocks.profile; mocks.token = 'test-session-original'; mocks.status = true;
  mocks.grants = ['pflege.access', 'pflege.documentation.view'];
  mocks.fetch.mockReset(); mocks.plans.mockReset(); mocks.refreshPermissions.mockReset();
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

describe('Dashboard-Sichtbereich', () => {
  it('drops an older account reply and exposes no role-wide plan read for home', async () => {
    let complete!: (value: ReturnType<typeof stats>) => void;
    mocks.fetch.mockImplementationOnce(() => new Promise(resolve => { complete = resolve; })).mockResolvedValueOnce(stats(8));
    await render();
    expect(current.isScopeCurrent()).toBe(true);
    const originalScope = mocks.fetch.mock.calls[0][0];
    expect(originalScope.actorId).toBe(mocks.profile);
    expect(mocks.plans).not.toHaveBeenCalled();
    mocks.actor = mocks.renewed; mocks.token = 'test-session-renewed';
    await render();
    expect(originalScope.isCurrent()).toBe(false);
    expect(host.textContent).toBe('8');
    await act(async () => complete(stats(987)));
    expect(host.textContent).toBe('8');
  });

  it('clears already rendered counts upon permission change and never shows old numbers when refresh fails', async () => {
    mocks.fetch.mockResolvedValueOnce(stats(17)).mockResolvedValueOnce({ ok: false, error: 'Kennzahl konnte nicht aktualisiert werden.' });
    await render();
    expect(host.textContent).toBe('17');
    await act(async () => { await current.refresh(); });
    expect(host.textContent).toBe('kein Stand');
    expect(current.refreshError).toContain('nicht aktualisiert');
    expect(current.isScopeCurrent()).toBe(true);
    mocks.grants = []; mocks.status = false;
    await render();
    expect(host.textContent).toBe('kein Stand');
    expect(current.isScopeCurrent()).toBe(false);
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
  });
});
