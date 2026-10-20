import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Profile } from '@/types';

const state = vi.hoisted(() => ({
  tenantId: '9cfd7a8a-48c8-49da-aec3-d79d79da0870',
  queries: [] as { table: string; filters: [string, unknown][]; range: [number, number] }[],
  rows: [] as Record<string, unknown>[], prices: [] as Record<string, unknown>[],
  scopeLimited: false, canEdit: true, office: true, assist: true, priceError: false, effective: true,
}));
vi.mock('@/lib/services/liveServiceGuard', () => ({ guardServiceTenant: () => null, isLiveServiceMode: () => true }));
vi.mock('@/lib/modules/moduleAccessService', () => ({ hasEffectiveModuleGateAccess: (module: string) => module === 'office' ? state.office : module === 'assist' ? state.assist : true }));
vi.mock('@/lib/tenant/companyAccessService.web', () => ({ loadCompanyAccess: async () => ({ ok: true, data: { scopeLimited: state.scopeLimited, permissions: state.canEdit ? ['business.tenant.manage'] : [], canManageScopes: false } }) }));
vi.mock('@/lib/supabase/permissionRepository', () => ({ fetchRuntimePermissions: async () => ['office.catalogs.view', 'business.tenant.manage'] }));
vi.mock('@/lib/permissions/rbacService', () => ({ resolveEffectivePermissions: async () => ({ ok: true, data: { permissions: state.effective ? ['office.catalogs.view', 'business.tenant.manage'] : [] } }) }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => ({}) }));
vi.mock('@/lib/supabase/untypedTable', () => ({
  fromUnknownTable: (_client: unknown, table: string) => {
    const request = { table, filters: [] as [string, unknown][], range: [0, 249] as [number, number] };
    const chain = {
      select: () => chain,
      eq: (field: string, value: unknown) => { request.filters.push([field, value]); return chain; },
      in: (field: string, value: unknown[]) => { request.filters.push([field, value]); return chain; },
      order: () => chain,
      range: (from: number, to: number) => { request.range = [from, to]; return chain; },
      then: (resolve: (value: unknown) => unknown) => {
        state.queries.push(request);
        if (table === 'tenant_service_prices' && state.priceError) return Promise.resolve(resolve({ data: null, error: { code: '42501' }, count: null }));
        // Tenant matching deliberately remains the service's responsibility in
        // this fixture so a malformed/foreign server response is exercised.
        const data = (table === 'tenant_service_catalog' ? state.rows : state.prices).filter(row => request.filters.every(([field, value]) => field === 'tenant_id' || (Array.isArray(value) ? value.includes(row[field]) : value === row[field])));
        return Promise.resolve(resolve({ data: data.slice(request.range[0], request.range[1] + 1), error: null, count: data.length }));
      },
    };
    return chain;
  },
}));

import { fetchCatalogWorkspace } from '@/lib/catalog/catalogWorkspace.web';

const actor = (): Profile => ({ id: 'profile', tenantId: state.tenantId, roleKey: 'business_admin', roleId: null,
  firstName: null, lastName: null, displayName: null, email: null, phone: null, avatarUrl: null, createdAt: '', updatedAt: '' });
const item = (id = 'item') => ({ id, tenant_id: state.tenantId, module_key: 'assist', service_key: `assist.${id}`, name: 'Leistung',
  description: null, unit: 'hour', category: 'service', is_active: true, sort_order: 1, created_at: null, updated_at: null });
const price = () => ({ id: 'price', tenant_id: state.tenantId, catalog_id: 'item', price_net: '38.00', tax_mode: 'exempt_4_16', valid_from: '2020-01-01', valid_to: null, is_default: true });

beforeEach(() => {
  state.queries = []; state.rows = [item()]; state.prices = [price()]; state.scopeLimited = false;
  state.canEdit = true; state.office = true; state.assist = true; state.priceError = false; state.effective = true;
});

describe('Office-Kataloge: sicherer vollständiger Leseablauf', () => {
  it('liest Katalog und Preise mit demselben Mandantenfilter', async () => {
    const result = await fetchCatalogWorkspace(state.tenantId, actor());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.catalogs[0].items[0].priceNet).toBe(38);
    expect(state.queries).toHaveLength(2);
    expect(state.queries.every(query => query.filters.some(([field, value]) => field === 'tenant_id' && value === state.tenantId))).toBe(true);
  });

  it('blockiert einen fremden Profilmandanten vor Datenabfragen', async () => {
    const result = await fetchCatalogWorkspace(state.tenantId, { ...actor(), tenantId: 'other' });
    expect(result.ok).toBe(false);
    expect(state.queries).toHaveLength(0);
  });

  it('beachtet explizit entzogene Berechtigungen und Mitarbeiter-Overrides', async () => {
    expect((await fetchCatalogWorkspace(state.tenantId, actor(), [])).ok).toBe(false);
    state.effective = false;
    expect((await fetchCatalogWorkspace(state.tenantId, { ...actor(), employeeId: 'employee' })).ok).toBe(false);
    expect(state.queries).toHaveLength(0);
  });

  it('blockiert bereichsbeschränkte Konten und gesperrtes Office', async () => {
    state.scopeLimited = true;
    expect((await fetchCatalogWorkspace(state.tenantId, actor())).ok).toBe(false);
    state.scopeLimited = false; state.office = false;
    expect((await fetchCatalogWorkspace(state.tenantId, actor())).ok).toBe(false);
    expect(state.queries).toHaveLength(0);
  });

  it('zeigt keine Kataloge eines gesperrten Fachmoduls', async () => {
    state.assist = false;
    const result = await fetchCatalogWorkspace(state.tenantId, actor());
    expect(result).toMatchObject({ ok: true, data: { catalogs: [] } });
    expect(state.queries).toHaveLength(0);
  });

  it('erteilt Bearbeitungsrechte nur nach positiver Unternehmensprüfung', async () => {
    state.canEdit = false;
    const result = await fetchCatalogWorkspace(state.tenantId, actor());
    expect(result).toMatchObject({ ok: true, data: { canEdit: false } });
  });

  it('meldet fehlgeschlagene Preise als Fehler statt einer scheinbar vollständigen Übersicht', async () => {
    state.priceError = true;
    expect((await fetchCatalogWorkspace(state.tenantId, actor())).ok).toBe(false);
  });

  it('weist eine unerwartete fremde Katalog- oder Preiszeile zurück', async () => {
    state.rows = [{ ...item(), tenant_id: 'foreign' }];
    expect((await fetchCatalogWorkspace(state.tenantId, actor())).ok).toBe(false);
    state.rows = [item()]; state.prices = [{ ...price(), tenant_id: 'foreign' }];
    expect((await fetchCatalogWorkspace(state.tenantId, actor())).ok).toBe(false);
  });

  it('unterscheidet ungültige Preise von kostenlosen Leistungen', async () => {
    state.prices = [{ ...price(), price_net: '' }];
    expect((await fetchCatalogWorkspace(state.tenantId, actor())).ok).toBe(false);
    state.prices = [{ ...price(), price_net: 0 }];
    const result = await fetchCatalogWorkspace(state.tenantId, actor());
    expect(result).toMatchObject({ ok: true, data: { catalogs: [{ missingPriceCount: 0 }] } });
  });

  it('lädt weitere Seiten und begrenzt die Preis-ID-Filterlänge', async () => {
    state.rows = Array.from({ length: 251 }, (_, index) => item(`item-${index}`)); state.prices = [];
    const result = await fetchCatalogWorkspace(state.tenantId, actor());
    expect(result).toMatchObject({ ok: true, data: { catalogs: [{ itemCount: 251, missingPriceCount: 251 }] } });
    expect(state.queries.filter(query => query.table === 'tenant_service_catalog').map(query => query.range)).toEqual([[0, 249], [250, 499]]);
    expect(state.queries.filter(query => query.table === 'tenant_service_prices')).toHaveLength(2);
  });
});
