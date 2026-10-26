import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SaveCatalogItemInput } from '@/lib/tenant/tenantServiceCatalogService';

type Query = { table: string; action: string; payload?: unknown; filters: [string, unknown][]; inFilters: [string, unknown[]][]; selected: boolean; count?: string; range?: [number, number]; orders: string[] };
type Result = { data: unknown; error: unknown; count?: number | null };
const f = vi.hoisted(() => ({ queries: [] as Query[], replies: [] as Result[], permission: vi.fn(), access: vi.fn(), tenant: vi.fn(), platform: 'web' }));
vi.mock('react-native', () => ({ Platform: { get OS() { return f.platform; } } }));
vi.mock('@/lib/tenant/companyAccessService', () => ({ loadCompanyAccess: (...args: unknown[]) => f.access(...args) }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => ({}) }));
vi.mock('@/lib/permissions', () => ({ enforcePermission: f.permission }));
vi.mock('@/lib/services/liveServiceGuard', () => ({ isLiveServiceMode: () => true, guardServiceTenant: f.tenant }));
vi.mock('@/lib/supabase/untypedTable', () => ({ fromUnknownTable: (_client: unknown, table: string) => {
  const query: Query = { table, action: 'select', filters: [], inFilters: [], selected: false, orders: [] }; f.queries.push(query);
  const chain = {
    select: (_columns?: string, options?: { count?: string }) => { query.selected = true; query.count = options?.count; return chain; },
    update: (payload: unknown) => { query.action = 'update'; query.payload = payload; return chain; },
    insert: (payload: unknown) => { query.action = 'insert'; query.payload = payload; return chain; },
    upsert: (payload: unknown) => { query.action = 'upsert'; query.payload = payload; return chain; },
    eq: (key: string, value: unknown) => { query.filters.push([key, value]); return chain; },
    in: (key: string, values: unknown[]) => { query.inFilters.push([key, values]); return chain; },
    order: (key: string) => { query.orders.push(key); return chain; },
    range: (from: number, to: number) => { query.range = [from, to]; return chain; },
    single: () => chain, maybeSingle: () => chain,
    then: (resolve: (result: Result) => unknown) => Promise.resolve(f.replies.shift() ?? { data: [], error: null, count: 0 }).then(resolve),
  };
  return chain;
} }));
import { fetchTenantServiceCatalog, saveTenantServiceCatalogItem } from '@/lib/tenant/tenantServiceCatalogService';
const input: SaveCatalogItemInput = { id: 'item-a', moduleKey: 'assist', serviceKey: 'assist.test', name: 'Begleitung', category: 'service', unit: 'hour', priceNet: 32.75, taxMode: 'standard_19' };
const success = (data: unknown = { id: 'item-a' }, count: number | null = Array.isArray(data) ? data.length : null): Result => ({ data, error: null, count });
const failure: Result = { data: null, error: { message: 'Datenbank nicht erreichbar' } };
const oldPrice = { id: 'price-a', price_net: 30, tax_rate: 19, tax_mode: 'standard_19', valid_from: '2026-01-01', valid_to: null };
const catalogRow = (id = 'item-a', sortOrder = 10) => ({ id, tenant_id: 'tenant-a', module_key: 'assist', service_key: `assist.${id}`, name: id, unit: 'hour', category: 'service', is_active: true, sort_order: sortOrder });
const priceRow = (catalogId = 'item-a', id = `price-${catalogId}`) => ({ ...oldPrice, id, tenant_id: 'tenant-a', catalog_id: catalogId, is_default: true });
beforeEach(() => { vi.clearAllMocks(); f.queries = []; f.replies = []; f.platform = 'web'; f.permission.mockReturnValue(null); f.access.mockResolvedValue({ ok: true, data: { permissions: ['business.tenant.manage'], scopeLimited: false } }); f.tenant.mockReturnValue(null); });

describe('company catalogue confirms price persistence', () => {
  it('propagates failed price reads instead of displaying an empty price', async () => {
    f.replies = [success([catalogRow()]), failure];
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
  it('rejects locked modules and invalid validity periods before any write', async () => {
    for (const patch of [
      { moduleKey: 'pflege' as const },
      { moduleKey: 'beratung' as const },
      { validFrom: '2026-02-30' },
      { validFrom: '2026-10-19', validTo: '2026-10-18' },
      { validFrom: '' },
      { validTo: '2000-01-01' },
    ]) expect((await saveTenantServiceCatalogItem('tenant-a', { ...input, ...patch }, 'business_admin')).ok).toBe(false);
    expect(f.queries).toHaveLength(0);
  });
  it('saves an explicit validity end and can remove a previous end date', async () => {
    for (const validTo of ['2027-12-31', null]) {
      f.queries = []; f.replies = [success(), success({ ...oldPrice, valid_to: '2026-12-31' }), success(), success(), success([])];
      expect((await saveTenantServiceCatalogItem('tenant-a', { ...input, validFrom: '2026-01-01', validTo }, 'business_admin')).ok).toBe(true);
      expect(f.queries.find(query => query.table === 'tenant_service_prices' && query.action === 'update')?.payload).toMatchObject({ valid_from: '2026-01-01', valid_to: validTo });
    }
  });
  it('reports multiple default prices instead of choosing one arbitrarily', async () => {
    f.replies = [success([catalogRow()]), success([priceRow('item-a', 'price-a'), priceRow('item-a', 'price-b')])];
    expect(await fetchTenantServiceCatalog('tenant-a', 'business_admin')).toMatchObject({ ok: false, error: expect.stringContaining('mehrere Standardpreise') });
  });
  it('scopes the editor read to its module so unrelated prices cannot block it', async () => {
    f.replies = [success([])];
    expect((await fetchTenantServiceCatalog('tenant-a', 'business_admin', 'assist')).ok).toBe(true);
    expect(f.queries[0].filters).toContainEqual(['module_key', 'assist']);
  });
  it('keeps the tax choice open when no saved price or tax mode exists', async () => {
    for (const prices of [[], [{ ...priceRow(), tax_mode: null }]]) {
      f.replies = [success([catalogRow()]), success(prices)];
      const result = await fetchTenantServiceCatalog('tenant-a', 'business_admin', 'assist');
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      expect(result.data.items[0].defaultTaxMode).toBeNull();
      expect(result.data.items[0].defaultPriceNet).toBe(prices.length ? 30 : null);
    }
  });
});

describe('company catalogue loads complete web inventories', () => {
  it('loads later catalog pages and scopes every 150-id price batch to the tenant', async () => {
    const rows = Array.from({ length: 251 }, (_, index) => catalogRow(`item-${String(index).padStart(3, '0')}`, 251 - index));
    const prices = rows.map((row) => priceRow(row.id));
    f.replies = [success(rows.slice(0, 250), 251), success(rows.slice(250), 251), success(prices.slice(0, 150)), success(prices.slice(150))];
    const result = await fetchTenantServiceCatalog('tenant-a', 'business_admin', 'assist');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.items).toHaveLength(251);
    expect(result.data.prices).toHaveLength(251);
    expect(result.data.items[0].id).toBe('item-250');
    expect(result.data.items.every((item) => item.defaultPriceNet === 30)).toBe(true);
    const catalogs = f.queries.filter((query) => query.table === 'tenant_service_catalog');
    expect(catalogs.map((query) => query.range)).toEqual([[0, 249], [250, 499]]);
    for (const query of catalogs) expect(query.filters).toContainEqual(['module_key', 'assist']);
    const priceQueries = f.queries.filter((query) => query.table === 'tenant_service_prices');
    expect(priceQueries.map((query) => query.inFilters[0])).toEqual([
      ['catalog_id', rows.slice(0, 150).map((row) => row.id)],
      ['catalog_id', rows.slice(150).map((row) => row.id)],
    ]);
    for (const query of f.queries) {
      expect(query.filters).toContainEqual(['tenant_id', 'tenant-a']);
      expect(query.count).toBe('exact');
      expect(query.orders).toEqual(['id']);
    }
    for (const query of priceQueries) expect(query.filters).toContainEqual(['is_default', true]);
  });

  it('returns no partial inventory when a later catalog page fails', async () => {
    f.replies = [success(Array.from({ length: 250 }, (_, index) => catalogRow(`item-${index}`)), 251), failure];
    const result = await fetchTenantServiceCatalog('tenant-a', 'business_admin', 'assist');
    expect(result).toEqual({ ok: false, error: expect.stringContaining('nicht vollständig geladen') });
    expect(f.queries).toHaveLength(2);
    expect(f.queries.every((query) => query.table === 'tenant_service_catalog')).toBe(true);
  });

  it('returns no partially priced inventory when a later price batch fails', async () => {
    const rows = Array.from({ length: 151 }, (_, index) => catalogRow(`item-${index}`));
    f.replies = [success(rows), success(rows.slice(0, 150).map((row) => priceRow(row.id))), failure];
    expect(await fetchTenantServiceCatalog('tenant-a', 'business_admin', 'assist')).toEqual({ ok: false, error: expect.stringContaining('nicht vollständig geladen') });
    expect(f.queries.filter((query) => query.table === 'tenant_service_prices')).toHaveLength(2);
  });

  it.each(['catalog', 'prices'])('rejects missing, invalid and incomplete counts for %s', async (table) => {
    for (const count of [undefined, null, -1, 0.5, 0, 2]) {
      f.queries = [];
      const page: Result = { data: table === 'catalog' ? [catalogRow()] : [priceRow()], error: null, count };
      f.replies = table === 'catalog' ? [page] : [success([catalogRow()]), page];
      expect(await fetchTenantServiceCatalog('tenant-a', 'business_admin', 'assist')).toEqual({ ok: false, error: expect.stringContaining('nicht vollständig geladen') });
    }
  });

  it('rejects changed counts, missing pages and duplicate ids across catalog pages', async () => {
    const firstPage = Array.from({ length: 250 }, (_, index) => catalogRow(`item-${index}`));
    for (const nextPage of [success([catalogRow('last')], 252), success([], 251), success([firstPage[0]], 251)]) {
      f.queries = [];
      f.replies = [success(firstPage, 251), nextPage];
      expect(await fetchTenantServiceCatalog('tenant-a', 'business_admin', 'assist')).toEqual({ ok: false, error: expect.stringContaining('nicht vollständig geladen') });
    }
  });

  it('reads later price pages before reporting multiple saved default prices', async () => {
    const prices = Array.from({ length: 251 }, (_, index) => priceRow('item-a', `price-${index}`));
    f.replies = [success([catalogRow()]), success(prices.slice(0, 250), 251), success(prices.slice(250), 251)];
    expect(await fetchTenantServiceCatalog('tenant-a', 'business_admin', 'assist')).toMatchObject({ ok: false, error: expect.stringContaining('mehrere Standardpreise') });
    expect(f.queries.filter((query) => query.table === 'tenant_service_prices').map((query) => query.range)).toEqual([[0, 249], [250, 499]]);
  });

  it('does not accept incomplete or repeated later price pages', async () => {
    const firstPage = Array.from({ length: 250 }, (_, index) => priceRow('item-a', `price-${index}`));
    for (const nextPage of [failure, success([], 251), success([priceRow('item-a', 'last')], 252), success([firstPage[0]], 251)]) {
      f.queries = [];
      f.replies = [success([catalogRow()]), success(firstPage, 251), nextPage];
      expect(await fetchTenantServiceCatalog('tenant-a', 'business_admin', 'assist')).toEqual({ ok: false, error: expect.stringContaining('nicht vollständig geladen') });
    }
  });

  it('rejects rows outside the selected tenant, module or price batch', async () => {
    for (const row of [{ ...catalogRow(), tenant_id: 'tenant-other' }, { ...catalogRow(), module_key: 'pflege' }]) {
      f.replies = [success([row])];
      expect((await fetchTenantServiceCatalog('tenant-a', 'business_admin', 'assist')).ok).toBe(false);
    }
    for (const row of [{ ...priceRow(), tenant_id: 'tenant-other' }, priceRow('foreign-item'), { ...priceRow(), is_default: false }]) {
      f.replies = [success([catalogRow()]), success([row])];
      expect((await fetchTenantServiceCatalog('tenant-a', 'business_admin', 'assist')).ok).toBe(false);
    }
  });

  it('requires complete module-scoped native catalogue and price reads', async () => {
    f.platform = 'android';
    f.replies = [success([catalogRow()]), success([priceRow()])];
    expect((await fetchTenantServiceCatalog('tenant-a', 'business_admin', 'assist')).ok).toBe(true);
    expect(f.queries).toHaveLength(2);
    expect(f.queries[0].orders).toEqual(['id']);
    expect(f.queries[0].filters).toEqual([['tenant_id', 'tenant-a'], ['module_key', 'assist']]);
    expect(f.queries[1].orders).toEqual(['id']);
    expect(f.queries[1].inFilters).toEqual([['catalog_id', ['item-a']]]);
    for (const query of f.queries) {
      expect(query.count).toBe('exact');
      expect(query.range).toEqual([0, 249]);
    }
  });
});

describe.each(['android', 'ios'])('native company catalogue integrity on %s', (platform) => {
  beforeEach(() => { f.platform = platform; });

  it('loads all catalogue pages before returning a priced snapshot', async () => {
    const rows = Array.from({ length: 251 }, (_, index) => catalogRow(`item-${index}`));
    f.replies = [success(rows.slice(0, 250), 251), success(rows.slice(250), 251), success(rows.slice(0, 150).map(row => priceRow(row.id))), success(rows.slice(150).map(row => priceRow(row.id)))];
    const result = await fetchTenantServiceCatalog('tenant-a', 'business_admin', 'assist');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.items).toHaveLength(251);
    expect(result.data.items.every(row => row.defaultPriceNet === 30)).toBe(true);
  });

  it('returns no truncated catalogue or ambiguous default price', async () => {
    f.replies = [success([catalogRow()], 2)];
    expect((await fetchTenantServiceCatalog('tenant-a', 'business_admin', 'assist')).ok).toBe(false);
    f.replies = [success([catalogRow()]), success([priceRow('item-a', 'a'), priceRow('item-a', 'b')])];
    expect(await fetchTenantServiceCatalog('tenant-a', 'business_admin', 'assist')).toMatchObject({ ok: false, error: expect.stringContaining('mehrere Standardpreise') });
  });

  it('preserves an explicit price validity end when saving from native', async () => {
    f.replies = [success(), success(oldPrice), success(), success(), success([])];
    expect((await saveTenantServiceCatalogItem('tenant-a', { ...input, validFrom: '2026-01-01', validTo: '2027-12-31' }, 'business_admin')).ok).toBe(true);
    expect(f.queries.find(query => query.table === 'tenant_service_prices' && query.action === 'update')?.payload).toMatchObject({ valid_to: '2027-12-31' });
    expect(f.queries.find(query => query.table === 'tenant_service_catalog' && query.action === 'select')?.filters).toContainEqual(['module_key', 'assist']);
  });
});
