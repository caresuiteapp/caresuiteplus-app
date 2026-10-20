import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProductKey, TenantProduct } from '@/types';
import type { PlatformTenantModuleRecord } from '@/lib/modules/platformModuleKeyMap';

const mocks = vi.hoisted(() => ({
  demo: vi.fn(), client: vi.fn(), profile: vi.fn(), products: vi.fn(),
  permissions: vi.fn(), catalog: vi.fn(), tenantProfile: vi.fn(),
}));
vi.mock('@/data/demo/tenant', () => ({ demoTenant: { id: 'demo-tenant', name: 'Demo-Unternehmen' } }));
vi.mock('@/data/demo/products', () => ({ demoTenantProducts: [] }));
vi.mock('@/lib/permissions/staticRolePermissions', () => ({ getPermissionsForRole: mocks.permissions }));
vi.mock('@/lib/auth/resolveAuthenticatedProfile', () => ({ resolveAuthenticatedProfileId: mocks.profile }));
vi.mock('@/lib/modules/constants', () => ({ isUnreleasedModuleKey: (key: string) => ['pflege', 'stationaer', 'akademie'].includes(key) }));
vi.mock('@/lib/modules/moduleVisibilityConfig', () => ({ getCatalogEntry: mocks.catalog }));
vi.mock('@/lib/modules/moduleAccessRepository.supabase', () => ({ fetchTenantModulesFromSupabase: mocks.products }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: mocks.client }));
vi.mock('@/lib/supabase/config', () => ({ isDemoMode: mocks.demo }));
vi.mock('@/lib/supabase/tenantService', () => ({ fetchTenantProfile: mocks.tenantProfile }));
vi.mock('@/lib/navigation/routes', () => ({ getRouteByPath: (path: string) => ({
  allowedRoles: path === '/office' ? ['business_admin', 'business_manager', 'billing', 'dispatch', 'nurse', 'caregiver', 'counselor']
    : path === '/assist' ? ['business_admin', 'business_manager', 'dispatch', 'nurse', 'caregiver', 'counselor']
    : ['business_admin', 'business_manager', 'dispatch', 'counselor'],
}) }));
vi.mock('@/lib/supabase/untypedTable', () => ({ fromUnknownTable: (client: { from: (name: string) => unknown }, name: string) => client.from(name) }));

import { buildSubscriptionModuleStates, fetchSubscriptionWorkspace, type SubscriptionWorkspaceScope } from '@/lib/business/subscriptionWorkspaceService.web';

const scope: SubscriptionWorkspaceScope = { authUserId: 'auth-live', profileId: 'profile-live', tenantId: 'tenant-live', roleKey: 'business_admin' };
const now = Date.parse('2026-10-20T10:00:00.000Z');

function product(key: ProductKey, overrides: Partial<TenantProduct> = {}): TenantProduct {
  return { id: `tp-${key}`, tenantId: scope.tenantId, productId: `prod-${key}`, productKey: key,
    isActive: false, activatedAt: '2026-01-01T00:00:00.000Z', accessSource: 'free_available',
    includedByModuleKey: null, isBaseIncluded: false, billingStatus: 'free_available', ...overrides };
}
function platform(moduleKey: string, overrides: Partial<PlatformTenantModuleRecord> = {}): PlatformTenantModuleRecord {
  return { moduleKey, status: 'enabled', isTrial: false, trialEndsAt: null, startsAt: null, endsAt: null, manualOverride: false, ...overrides };
}
const status = (key: ProductKey, products: TenantProduct[] = [], records: PlatformTenantModuleRecord[] = [], settings: Partial<Record<ProductKey, boolean>> = {}) =>
  buildSubscriptionModuleStates(products, records, settings, now).find(module => module.key === key)?.status;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.demo.mockReturnValue(false);
  mocks.permissions.mockReturnValue(['business.subscription.view', 'office.access', 'assist.access', 'beratung.access']);
  mocks.catalog.mockReturnValue({ status: 'live' });
  mocks.profile.mockResolvedValue({ ok: true, data: scope.profileId });
  mocks.tenantProfile.mockResolvedValue({ id: scope.profileId, tenantId: scope.tenantId, roleKey: scope.roleKey });
  mocks.products.mockResolvedValue({ ok: true, data: [] });
});

describe('subscription module availability', () => {
  it('does not invent active modules from an empty tenant response', () => {
    const modules = buildSubscriptionModuleStates([], [], {}, now);
    expect(modules).toHaveLength(6);
    expect(new Set(modules.map(module => module.key)).size).toBe(6);
    expect(modules.filter(module => module.status === 'active')).toHaveLength(0);
  });

  it.each(['pflege', 'stationaer', 'akademie'] as const)('keeps unreleased %s prepared despite historical grants', key => {
    const platformKey = { pflege: 'care', stationaer: 'stationary', akademie: 'academy' }[key];
    expect(status(key, [product(key, { isActive: true })], [platform(platformKey)], { [key]: true })).toBe('prepared');
  });

  it('does not count a prepared specialty as an active Office entitlement', () => {
    expect(status('office', [product('pflege', { isActive: true })], [platform('care')])).toBe('inactive');
  });

  it.each(['billingStatus', 'accessType'] as const)('preserves administrative denial from %s', field => {
    expect(status('assist', [product('assist', { isActive: true, [field]: 'admin_disabled' })], [platform('assist')], { assist: true })).toBe('blocked');
  });

  it('honors a disabled tenant setting over a legacy active row', () => {
    expect(status('assist', [product('assist', { isActive: true })], [], { assist: false })).toBe('inactive');
  });

  it('uses the current enabled setting over an old disabled legacy row', () => {
    expect(status('assist', [product('assist', { accessSource: 'disabled' })], [], { assist: true })).toBe('active');
  });

  it('uses an explicit current platform grant when a legacy row is inactive', () => {
    expect(status('assist', [product('assist')], [platform('assist')])).toBe('active');
  });

  it.each(['disabled', 'locked', 'expired', 'scheduled'] as const)('does not override the platform status %s with settings or legacy grants', platformStatus => {
    expect(status('assist', [product('assist', { isActive: true })], [platform('assist', { status: platformStatus })], { assist: true })).toBe('blocked');
  });

  it.each([
    { startsAt: '2026-10-20T10:00:01.000Z' },
    { endsAt: '2026-10-20T10:00:00.000Z' },
    { isTrial: true, trialEndsAt: '2026-10-20T10:00:00.000Z' },
  ])('respects platform validity windows: %j', window => {
    expect(status('assist', [product('assist', { isActive: true })], [platform('assist', window)])).toBe('blocked');
  });

  it('does not treat a malformed validity window as an active grant', () => {
    expect(status('assist', [], [platform('assist', { startsAt: 'invalid-date' })])).toBe('blocked');
  });

  it('includes Office once for an active released specialty, but preserves Office denial', () => {
    const products = [product('assist', { isActive: true })];
    expect(status('office', products)).toBe('active');
    expect(status('office', products, [platform('office', { status: 'disabled' })])).toBe('blocked');
    expect(status('office', [...products, product('office', { billingStatus: 'admin_disabled' })])).toBe('blocked');
  });

  it('respects catalog availability in addition to tenant grants', () => {
    mocks.catalog.mockReturnValue({ status: 'disabled' });
    expect(status('assist', [product('assist', { isActive: true })])).toBe('blocked');
    mocks.catalog.mockReturnValue({ status: 'coming_soon' });
    expect(status('assist', [product('assist', { isActive: true })])).toBe('prepared');
  });
});

function liveClient() {
  const replies: Record<string, { data: unknown; error: unknown }> = {
    tenants: { data: { id: scope.tenantId, name: '  Live-Pflegedienst  ' }, error: null },
    tenant_module_settings: { data: null, error: null },
    roles: { data: null, error: null },
    role_permission_sets: { data: [], error: null },
    role_permissions: { data: [], error: null },
  };
  const getUser = vi.fn().mockResolvedValue({ data: { user: { id: scope.authUserId } }, error: null });
  const rpc = vi.fn(async (_name: string): Promise<{ data: unknown; error: unknown }> => ({ data: [], error: null }));
  const from = vi.fn((table: string) => {
    const query = {
      select: vi.fn((): unknown => query), eq: vi.fn((): unknown => query),
      maybeSingle: vi.fn(async () => replies[table]),
      then: (resolve: (value: unknown) => unknown) => Promise.resolve(replies[table]).then(resolve),
    };
    return query;
  });
  const client = { auth: { getUser }, rpc, from };
  mocks.client.mockReturnValue(client);
  return { client, replies, getUser, rpc, from };
}

describe('subscription live read boundary', () => {
  it('loads the current tenant name, a zero platform price and separate counts', async () => {
    liveClient();
    mocks.products.mockResolvedValue({ ok: true, data: [product('assist', { isActive: true })] });
    const result = await fetchSubscriptionWorkspace(scope);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toMatchObject({ tenantId: scope.tenantId, tenantName: 'Live-Pflegedienst', source: 'live', monthlyTotal: 0,
      totalModuleCount: 6, platformFeatureCount: 6, activeModuleCount: 2, preparedModuleCount: 3, inactiveModuleCount: 1, blockedModuleCount: 0 });
    expect(result.data.modules).toHaveLength(6);
  });

  it('rejects missing identity before starting any data read', async () => {
    const { from } = liveClient();
    expect(await fetchSubscriptionWorkspace({ ...scope, authUserId: '' })).toMatchObject({ ok: false, code: 'identity' });
    expect(from).not.toHaveBeenCalled();
    expect(mocks.products).not.toHaveBeenCalled();
  });

  it('does not let a caller-supplied admin role replace server permission', async () => {
    const { replies, from } = liveClient();
    replies.role_permission_sets = { data: [{ permission_key: 'office.access' }], error: null };
    expect(await fetchSubscriptionWorkspace(scope)).toMatchObject({ ok: false, code: 'permission' });
    expect(from).not.toHaveBeenCalledWith('tenants');
  });

  it('fails closed when server permission cannot be checked', async () => {
    const { replies, from } = liveClient();
    replies.roles = { data: null, error: { message: 'offline' } };
    expect(await fetchSubscriptionWorkspace(scope)).toMatchObject({ ok: false, code: 'unavailable' });
    expect(from).not.toHaveBeenCalledWith('tenants');
  });

  it('rejects a different authenticated user before reading tenant data', async () => {
    const { getUser, from } = liveClient();
    getUser.mockResolvedValue({ data: { user: { id: 'another-user' } }, error: null });
    expect(await fetchSubscriptionWorkspace(scope)).toMatchObject({ ok: false, code: 'identity' });
    expect(from).not.toHaveBeenCalled();
  });

  it('rejects a different profile before reading tenant data', async () => {
    const { from } = liveClient();
    mocks.profile.mockResolvedValue({ ok: true, data: 'another-profile' });
    expect(await fetchSubscriptionWorkspace(scope)).toMatchObject({ ok: false, code: 'identity' });
    expect(from).not.toHaveBeenCalled();
  });

  it('discards a successful response when the signed-in user changes during the request', async () => {
    const { getUser } = liveClient();
    getUser.mockResolvedValueOnce({ data: { user: { id: scope.authUserId } }, error: null });
    getUser.mockResolvedValueOnce({ data: { user: { id: scope.authUserId } }, error: null });
    getUser.mockResolvedValueOnce({ data: { user: { id: 'replacement-user' } }, error: null });
    expect(await fetchSubscriptionWorkspace(scope)).toMatchObject({ ok: false, code: 'identity' });
  });

  it('discards a successful response when permission is revoked during the request', async () => {
    const { replies } = liveClient();
    mocks.products.mockImplementation(async () => {
      replies.role_permission_sets = { data: [{ permission_key: 'office.access' }], error: null };
      return { ok: true, data: [] };
    });
    expect(await fetchSubscriptionWorkspace(scope)).toMatchObject({ ok: false, code: 'permission' });
  });

  it('rejects a stale or forged role that differs from the live profile', async () => {
    const { from } = liveClient();
    mocks.tenantProfile.mockResolvedValue({ id: scope.profileId, tenantId: scope.tenantId, roleKey: 'billing' });
    expect(await fetchSubscriptionWorkspace(scope)).toMatchObject({ ok: false, code: 'identity' });
    expect(from).not.toHaveBeenCalled();
  });

  it('separates tenant activation from the individual permission to open a module', async () => {
    const { replies } = liveClient();
    mocks.products.mockResolvedValue({ ok: true, data: [product('assist', { isActive: true })] });
    replies.role_permission_sets = { data: [{ permission_key: 'business.subscription.view' }, { permission_key: 'office.access' }], error: null };
    const result = await fetchSubscriptionWorkspace(scope);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.modules.find(module => module.key === 'assist')).toMatchObject({ status: 'active', canOpen: false, route: '/assist' });
    expect(result.data.modules.find(module => module.key === 'office')).toMatchObject({ status: 'active', canOpen: true, route: '/office' });
  });

  it('requires the route role as well as the permission before offering an open action', async () => {
    liveClient();
    mocks.tenantProfile.mockResolvedValue({ id: scope.profileId, tenantId: scope.tenantId, roleKey: 'billing' });
    mocks.products.mockResolvedValue({ ok: true, data: [product('assist', { isActive: true })] });
    const result = await fetchSubscriptionWorkspace({ ...scope, roleKey: 'billing' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.modules.find(module => module.key === 'assist')).toMatchObject({ status: 'active', canOpen: false });
  });

  it('never substitutes the demo company for a failed live read', async () => {
    const { replies } = liveClient();
    replies.tenants = { data: null, error: { message: 'offline' } };
    const result = await fetchSubscriptionWorkspace(scope);
    expect(result).toMatchObject({ ok: false, code: 'connection' });
    expect(result).not.toHaveProperty('data');
  });

  it('rejects cross-tenant product rows even when the tenant query succeeds', async () => {
    liveClient();
    mocks.products.mockResolvedValue({ ok: true, data: [product('assist', { tenantId: 'another-tenant', isActive: true })] });
    expect(await fetchSubscriptionWorkspace(scope)).toMatchObject({ ok: false, code: 'invalid_response' });
  });

  it('rejects malformed and duplicate platform responses', async () => {
    const { rpc } = liveClient();
    for (const invalid of [{}, [null], [platform('assist'), platform('assist')], [platform('assist', { startsAt: 'not-a-date' })]]) {
      rpc.mockResolvedValue({ data: invalid, error: null });
      expect(await fetchSubscriptionWorkspace(scope)).toMatchObject({ ok: false, code: 'invalid_response' });
    }
  });

  it('rejects non-boolean module settings rather than treating text as a grant', async () => {
    const { replies } = liveClient();
    replies.tenant_module_settings = { data: { assist_enabled: 'false' }, error: null };
    expect(await fetchSubscriptionWorkspace(scope)).toMatchObject({ ok: false, code: 'invalid_response' });
  });

  it('only returns a clearly labelled demo for the explicit demo tenant', async () => {
    mocks.demo.mockReturnValue(true);
    expect(await fetchSubscriptionWorkspace(scope)).toMatchObject({ ok: false, code: 'identity' });
    expect(await fetchSubscriptionWorkspace({ ...scope, tenantId: 'demo-tenant' })).toMatchObject({ ok: true, data: { source: 'demo', tenantName: 'Demo-Unternehmen' } });
    expect(mocks.client).not.toHaveBeenCalled();
  });
});
