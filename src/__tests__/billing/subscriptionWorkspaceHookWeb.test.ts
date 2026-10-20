import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SubscriptionWorkspaceResult } from '@/lib/business/subscriptionWorkspaceService.web';

const runtime = vi.hoisted(() => ({
  slots: [] as unknown[], cursor: 0,
  effects: [] as { deps: readonly unknown[]; cleanup?: () => void }[], effectCursor: 0,
  pending: [] as (() => void)[],
  auth: { authReady: true, isAuthenticated: true, user: { id: 'user-a' }, profile: { id: 'profile-a', roleKey: 'business_admin' }, portalSession: null as null | { roleKey: string }, profileBootstrapError: null },
  tenant: 'tenant-a', fetch: vi.fn(),
}));
vi.mock('react', () => ({
  useCallback: (callback: () => void) => callback,
  useRef: (initial: unknown) => {
    const index = runtime.cursor++;
    if (!(index in runtime.slots)) runtime.slots[index] = { current: initial };
    return runtime.slots[index];
  },
  useState: (initial: unknown) => {
    const index = runtime.cursor++;
    if (!(index in runtime.slots)) runtime.slots[index] = initial;
    return [runtime.slots[index], (update: unknown) => {
      runtime.slots[index] = typeof update === 'function' ? update(runtime.slots[index]) : update;
    }];
  },
  useEffect: (effect: () => void | (() => void), deps: readonly unknown[]) => {
    const index = runtime.effectCursor++;
    const previous = runtime.effects[index];
    if (previous && deps.every((value, position) => Object.is(value, previous.deps[position]))) return;
    runtime.pending.push(() => {
      previous?.cleanup?.();
      runtime.effects[index] = { deps, cleanup: effect() || undefined };
    });
  },
}));
vi.mock('@/lib/auth/context', () => ({ useAuth: () => runtime.auth }));
vi.mock('@/lib/auth/sessionTarget', () => ({ resolveEffectiveRoleKey: () => runtime.auth.profile.roleKey }));
vi.mock('@/hooks/useTenantId', () => ({ useServiceTenantId: () => runtime.tenant }));
vi.mock('@/lib/business/subscriptionWorkspaceService.web', () => ({ fetchSubscriptionWorkspace: runtime.fetch }));
import { useSubscriptionWorkspace } from '@/hooks/useSubscriptionWorkspace.web';

function render() {
  runtime.cursor = 0; runtime.effectCursor = 0;
  const result = useSubscriptionWorkspace();
  runtime.pending.splice(0).forEach(effect => effect());
  return result;
}
async function settle() { await Promise.resolve(); await Promise.resolve(); return render(); }
function deferred() {
  let resolve!: (value: SubscriptionWorkspaceResult) => void;
  const promise = new Promise<SubscriptionWorkspaceResult>(done => { resolve = done; });
  return { promise, resolve };
}
function success(tenantId = runtime.tenant): SubscriptionWorkspaceResult {
  return { ok: true, data: { tenantId, tenantName: tenantId, source: 'live', loadedAt: '2026-10-20T12:00:00Z', monthlyTotal: 0,
    modules: [], activeModuleCount: 0, preparedModuleCount: 0, inactiveModuleCount: 0, blockedModuleCount: 0, totalModuleCount: 0, platformFeatureCount: 6 } };
}
beforeEach(() => {
  runtime.slots = []; runtime.cursor = 0; runtime.effects = []; runtime.effectCursor = 0; runtime.pending = [];
  runtime.auth = { authReady: true, isAuthenticated: true, user: { id: 'user-a' }, profile: { id: 'profile-a', roleKey: 'business_admin' }, portalSession: null, profileBootstrapError: null };
  runtime.tenant = 'tenant-a'; vi.clearAllMocks();
  runtime.fetch.mockImplementation(async () => success());
});

describe('subscription workspace identity and request lifecycle', () => {
  it('masks old data immediately when the tenant changes', async () => {
    render(); expect((await settle()).data?.tenantId).toBe('tenant-a');
    const pending = deferred(); runtime.fetch.mockReturnValue(pending.promise);
    runtime.tenant = 'tenant-b';
    expect(render().data).toBe(null);
    expect(render().loading).toBe(true);
    pending.resolve(success('tenant-b'));
    expect((await settle()).data?.tenantId).toBe('tenant-b');
  });

  it('discards a late previous-tenant response after the next tenant has loaded', async () => {
    const a = deferred(); const b = deferred();
    runtime.fetch.mockImplementation((scope: { tenantId: string }) => scope.tenantId === 'tenant-a' ? a.promise : b.promise);
    render(); runtime.tenant = 'tenant-b'; render();
    b.resolve(success('tenant-b')); expect((await settle()).data?.tenantId).toBe('tenant-b');
    a.resolve(success('tenant-a')); expect((await settle()).data?.tenantId).toBe('tenant-b');
  });

  it('masks previously loaded data when authentication becomes unready', async () => {
    render(); expect((await settle()).data?.tenantId).toBe('tenant-a');
    runtime.auth.authReady = false;
    expect(render().data).toBe(null);
    expect(render().loading).toBe(true);
  });

  it('masks data when the authenticated person changes within the same tenant', async () => {
    render(); expect((await settle()).data?.tenantId).toBe('tenant-a');
    runtime.auth.user.id = 'user-b'; runtime.auth.profile.id = 'profile-b';
    expect(render().data).toBe(null);
  });

  it('does not request data from an employee or client portal session', () => {
    runtime.auth.portalSession = { roleKey: 'employee_portal' };
    render();
    expect(render().errorCode).toBe('identity');
    expect(runtime.fetch).not.toHaveBeenCalled();
  });

  it('preserves a same-tenant snapshot with an explicit error only for a connection failure', async () => {
    render(); const loaded = await settle();
    const pending = deferred(); runtime.fetch.mockReturnValue(pending.promise);
    loaded.refresh(); render();
    expect(render().data?.tenantId).toBe('tenant-a'); expect(render().loading).toBe(true);
    pending.resolve({ ok: false, code: 'connection', error: 'Offline' });
    const failed = await settle();
    expect(failed.data?.tenantId).toBe('tenant-a'); expect(failed.error).toBe('Offline'); expect(failed.loading).toBe(false);
  });

  it.each(['identity', 'permission', 'invalid_response', 'unavailable'] as const)('clears previously loaded data after a %s failure', async code => {
    render(); const loaded = await settle();
    runtime.fetch.mockResolvedValue({ ok: false, code, error: 'Nicht mehr verfügbar' });
    loaded.refresh(); render();
    const failed = await settle();
    expect(failed.data).toBe(null); expect(failed.errorCode).toBe(code);
  });
});
