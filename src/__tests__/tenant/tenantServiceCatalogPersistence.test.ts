import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SaveCatalogItemInput } from '@/lib/tenant/tenantServiceCatalogService';

type Query = { table: string; action: string; payload?: unknown; filters: [string, unknown][]; selected: boolean };
type Result = { data: unknown; error: unknown };
const f = vi.hoisted(() => ({ queries: [] as Query[], replies: [] as Result[], permission: vi.fn(), access: vi.fn(), tenant: vi.fn() }));
vi.mock('@/lib/tenant/companyAccessService', () => ({ loadCompanyAccess: (...args: unknown[]) => f.access(...args) }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => ({}) }));
vi.mock('@/lib/permissions', () => ({ enforcePermission: f.permission }));
vi.mock('@/lib/services/liveServiceGuard', () => ({ isLiveServiceMode: () => true, guardServiceTenant: f.tenant }));
vi.mock('@/lib/supabase/untypedTable', () => ({ fromUnknownTable: (_client: unknown, table: string) => {
  const query: Query = { table, action: 'select', filters: [], selected: false }; f.queries.push(query);
  const chain = {
    select: () => { query.selected = true; return chain; },
    update: (payload: unknown) => { query.action = 'update'; query.payload = payload; return chain; },
    insert: (payload: unknown) => { query.action = 'insert'; query.payload = payload; return chain; },
    upsert: (payload: unknown) => { query.action = 'upsert'; query.payload = payload; return chain; },
    eq: (key: string, value: unknown) => { query.filters.push([key, value]); return chain; },
    in: () => chain, order: () => chain,
    single: () => chain, maybeSingle: () => chain,
    then: (resolve: (result: Result) => unknown) => Promise.resolve(f.replies.shift() ?? { data: [], error: null }).then(resolve),
  };
  return chain;
} }));
import { fetchTenantServiceCatalog, saveTenantServiceCatalogItem } from '@/lib/tenant/tenantServiceCatalogService';
const input: SaveCatalogItemInput = { id: 'item-a', moduleKey: 'assist', serviceKey: 'assist.test', name: 'Begleitung', category: 'service', unit: 'hour', priceNet: 32.75, taxMode: 'standard_19' };
const success = (data: unknown = { id: 'item-a' }): Result => ({ data, error: null });
const failure: Result = { data: null, error: { message: 'Datenbank nicht erreichbar' } };
const oldPrice = { id: 'price-a', price_net: 30, tax_rate: 19, tax_mode: 'standard_19', valid_from: '2026-01-01', valid_to: null };
beforeEach(() => { vi.clearAllMocks(); f.queries = []; f.replies = []; f.permission.mockReturnValue(null); f.access.mockResolvedValue({ ok: true, data: { permissions: ['business.tenant.manage'], scopeLimited: false } }); f.tenant.mockReturnValue(null); });

describe('company catalogue confirms price persistence', () => {
  it('propagates failed price reads instead of displaying an empty price', async () => {
    f.replies = [success([{ id: 'item-a' }]), failure];
    expect((await fetchTenantServiceCatalog('tenant-a', 'business_admin')).ok).toBe(false);
  });
  it.each(['read', 'history', 'update', 'insert'])('does not report success when price %s fails', async (step) => {
    f.replies = step === 'read' ? [success(), failure] : step === 'history' ? [success(), success(oldPrice), failure] : step === 'update' ? [success(), success(oldPrice), success(), failure] : [success(), success(null), failure];
    const result = await saveTenantServiceCatalogItem('tenant-a', input, 'business_admin');
    expect(result).toMatchObject({ ok: false, error: expect.stringContaining('Preis jedoch nicht') });
    if (step === 'history' || step === 'read') expect(f.queries.filter((query) => query.table === 'tenant_service_prices' && query.action !== 'select')).toHaveLength(0);
  });
  it('checks an existing position update and scopes price updates to the tenant', async () => {
    f.replies = [success(), success(oldPrice), success(), success({ id: 'price-a' }), success([])];
    expect((await saveTenantServiceCatalogItem('tenant-a', input, 'business_admin')).ok).toBe(true);
    const catalog = f.queries.find((query) => query.action === 'update' && query.table === 'tenant_service_catalog');
    expect(catalog?.selected).toBe(true);
    const price = f.queries.find((query) => query.action === 'update' && query.table === 'tenant_service_prices');
    expect(price).toMatchObject({ selected: true, payload: expect.objectContaining({ tax_rate: 19 }) });
    expect(price?.filters).toContainEqual(['tenant_id', 'tenant-a']);
  });
  it('preserves the current price version when only the description changes', async () => {
    f.replies = [success(), success({ ...oldPrice, price_net: 32.75 }), success([])];
    expect((await saveTenantServiceCatalogItem('tenant-a', input, 'business_admin')).ok).toBe(true);
    expect(f.queries.some((query) => query.table === 'tenant_service_price_versions')).toBe(false);
    expect(f.queries.some((query) => query.table === 'tenant_service_prices' && query.action === 'update')).toBe(false);
  });
  it('uses stable service keys on retry after a partially saved new position', async () => {
    f.replies = [success(), success(null), failure, success(), success(null), success(), success([])];
    expect((await saveTenantServiceCatalogItem('tenant-a', { ...input, id: undefined }, 'business_admin')).ok).toBe(false);
    expect((await saveTenantServiceCatalogItem('tenant-a', { ...input, id: undefined }, 'business_admin')).ok).toBe(true);
    const writes = f.queries.filter((query) => query.table === 'tenant_service_catalog' && query.action !== 'select');
    expect(writes.map((query) => query.action)).toEqual(['upsert', 'upsert']);
    expect(writes[0]?.payload).toMatchObject({ service_key: 'assist.test' });
    expect(writes[1]?.payload).toMatchObject({ service_key: 'assist.test' });
  });
  it('blocks invalid values, permission failures and foreign tenants before writes', async () => {
    expect((await saveTenantServiceCatalogItem('tenant-a', { ...input, priceNet: Number.NaN }, 'business_admin')).ok).toBe(false);
    expect((await saveTenantServiceCatalogItem('tenant-a', { ...input, name: ' ' }, 'business_admin')).ok).toBe(false);
    f.access.mockResolvedValue({ ok: true, data: { permissions: [], scopeLimited: false } });
    expect((await saveTenantServiceCatalogItem('tenant-a', input, 'dispatch')).ok).toBe(false);
    f.access.mockResolvedValue({ ok: true, data: { permissions: ['business.tenant.manage'], scopeLimited: false } }); f.tenant.mockReturnValue({ ok: false, error: 'Fremder Mandant' });
    expect((await saveTenantServiceCatalogItem('tenant-other', input, 'business_admin')).ok).toBe(false);
    expect(f.queries).toHaveLength(0);
  });
  it('stops after a denied/zero-row position update', async () => {
    f.replies = [failure];
    expect((await saveTenantServiceCatalogItem('tenant-a', input, 'business_admin')).ok).toBe(false);
    expect(f.queries).toHaveLength(1);
  });
});
