// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useEmployeePortalWorkspace } from '@/hooks/useEmployeePortalWorkspace';
import type { PortalActor } from '@/hooks/usePortalActor';
import { employeePortalNavigation, employeePortalWorkspaceForPath } from '@/lib/portal/employee/employeePortalNavigation';
import { employeePortalWorkspaceStorageKey } from '@/lib/portal/employee/employeePortalWorkspaces';

const state = vi.hoisted(() => ({
  account: 'a', granted: ['assist', 'pflege', 'beratung'] as string[],
  tenantGrants: ['assist', 'pflege', 'beratung', 'akademie'] as string[],
  storage: new Map<string, string>(),
  query: vi.fn(),
  platform: { OS: 'web' },
}));
vi.mock('react-native', () => ({
  Platform: state.platform,
  AppState: { currentState: 'active', addEventListener: () => ({ remove() {} }) },
}));
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (key: string) => state.storage.get(key) ?? null,
    setItem: async (key: string, value: string) => { state.storage.set(key, value); },
  },
}));
vi.mock('@/lib/auth/context', () => ({
  useAuth: () => ({ user: { id: state.account }, portalSession: { accountId: state.account, sessionToken: state.account } }),
}));
vi.mock('@/lib/beratung/workspaceRelease', () => ({ isConsultationWorkspaceEnabled: () => true }));
vi.mock('@/lib/services/mode', () => ({ getServiceMode: () => 'supabase' }));
vi.mock('@/lib/modules/moduleAccessHydration', () => ({
  hydrateTenantModulesFromSupabase: async () => ({ ok: true, data: [] }),
}));
vi.mock('@/lib/modules/moduleAccessService', () => ({
  hasEffectiveModuleGateAccess: (module: string) => state.tenantGrants.includes(module),
}));
vi.mock('@/lib/modules/platformTenantModuleAccess', () => ({
  resolveProductModuleAccessDecision: (_tenant: string, module: string) => ({ allowed: state.tenantGrants.includes(module) }),
}));
vi.mock('@/lib/portal/employee/employeePortalWorkspaceService', () => ({
  loadEmployeePortalWorkspaceGrants: state.query,
}));

const actor = (): PortalActor => ({
  tenantId: 'tenant', actorId: state.account, employeeId: `employee-${state.account}`,
  roleKey: 'employee_portal', clientId: null, familyAccess: null, displayName: 'Test',
  isReady: true, isLinkedReady: true, isResolvingEmployeeLink: false, isResolvingClientLink: false,
  isResolvingDisplayName: false,
});
let root: Root;
let host: HTMLDivElement;
let current: ReturnType<typeof useEmployeePortalWorkspace>;
function Probe() { current = useEmployeePortalWorkspace(actor()); return null; }
const render = async () => { await act(async () => root.render(<Probe />)); };

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  state.account = 'a';
  state.granted = ['assist', 'pflege', 'beratung'];
  state.tenantGrants = ['assist', 'pflege', 'beratung', 'akademie'];
  state.storage.clear();
  state.query.mockReset().mockImplementation(async () => ({ ok: true, data: { products: state.granted, updatedAt: null } }));
  host = document.createElement('div');
  root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); });

describe('employee portal workspace choice', () => {
  it('saves a granted selection per account and restores it on a fresh mount', async () => {
    await render();
    expect(current.selected).toBe('assist');
    await act(async () => current.select('pflege'));
    expect(current.selected).toBe('pflege');
    expect(current.navigation.map(item => item.id)).toContain('care-tours');
    expect(state.storage.get(employeePortalWorkspaceStorageKey('tenant', 'a', 'employee-a'))).toBe('pflege');
    await act(async () => root.unmount());
    root = createRoot(host);
    await render();
    expect(current.selected).toBe('pflege');
  });

  it('checks personal and tenant grants, then falls back when a saved grant is revoked', async () => {
    state.tenantGrants = ['assist', 'pflege'];
    await render();
    expect(current.available).toEqual(['assist', 'pflege']);
    await act(async () => current.select('beratung'));
    expect(current.selected).toBe('assist');
    await act(async () => current.select('pflege'));
    state.granted = ['assist'];
    await act(async () => current.retry());
    expect(current.selected).toBe('assist');
    expect(current.navigation.some(item => item.id === 'care-tours')).toBe(false);
  });

  it('does not display a previous employee choice or grant while checking a different account', async () => {
    await render();
    await act(async () => current.select('pflege'));
    state.account = 'b';
    state.tenantGrants = ['assist', 'pflege'];
    let respond!: (value: unknown) => void;
    state.query.mockReturnValueOnce(new Promise(resolve => { respond = resolve; }));
    await render();
    expect(current.loading).toBe(true);
    expect(current.available).toEqual([]);
    expect(current.selected).toBeNull();
    await act(async () => respond({ ok: true, data: { products: ['beratung'], updatedAt: null } }));
    expect(current.selected).toBeNull();
    expect(current.available).toEqual([]);
    // No platform consulting release for the current scope.
    state.tenantGrants = ['beratung'];
    state.granted = ['beratung'];
    await act(async () => current.retry());
    expect(current.selected).toBe('beratung');
  });

  it('keeps legacy Assist when the personnel allowlist is empty, but never infers extra modules', async () => {
    state.granted = [];
    await render();
    expect(current.available).toEqual(['assist']);
  });

  it('uses one catalogue for every module and identifies legacy deep links', () => {
    expect(employeePortalNavigation('assist').some(item => item.id === 'consultation')).toBe(false);
    expect(employeePortalNavigation('beratung').filter(item => item.group === 'work').map(item => item.id)).toEqual(['consultation', 'time', 'logbook', 'leave', 'absence']);
    expect(employeePortalNavigation('akademie').map(item => item.id)).toContain('academy');
    expect(employeePortalNavigation('office').some(item => item.id === 'assignments')).toBe(false);
    expect(employeePortalWorkspaceForPath('/portal/employee/execution/')).toBe('assist');
    expect(employeePortalWorkspaceForPath('/portal/employee/beratung/case-1')).toBe('beratung');
    expect(employeePortalWorkspaceForPath('/portal/employee/messages/thread-1')).toBeNull();
  });
});
