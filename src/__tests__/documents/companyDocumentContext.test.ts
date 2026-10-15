import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = Record<string, unknown>;
const fixture = vi.hoisted(() => ({ rows: {} as Record<string, Row[]>, errors: {} as Record<string, string>, denied: new Set<string>(), queries: [] as { table: string; filters: [string, unknown][]; columns: string }[] }));
vi.mock('@/lib/services/mode', () => ({ getServiceMode: () => 'supabase' }));
vi.mock('@/lib/services/liveServiceGuard', () => ({ guardServiceTenant: () => null, isLiveServiceMode: () => true }));
vi.mock('@/lib/permissions/actorPermissions', () => ({ enforceWithActor: async (_role: unknown, _tenant: unknown, _profile: unknown, permission: string) => fixture.denied.has(permission) ? { ok: false, error: 'Berechtigung fehlt' } : null }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => ({}) }));
vi.mock('@/lib/supabase/untypedTable', () => ({ fromUnknownTable: (_client: unknown, table: string) => {
  const query = { table, filters: [] as [string, unknown][], columns: '' }; fixture.queries.push(query);
  const result = () => ({ data: fixture.errors[table] ? null : (fixture.rows[table] ?? []).filter(row => query.filters.every(([key, value]) => Array.isArray(value) ? value.includes(row[key]) : row[key] === value)), error: fixture.errors[table] ? { code: fixture.errors[table], message: 'source unavailable' } : null });
  const request = {
    select: (columns: string) => { query.columns = columns; return request; },
    eq: (key: string, value: unknown) => { query.filters.push([key, value]); return request; },
    in: (key: string, value: unknown[]) => { query.filters.push([key, value]); return request; },
    order: () => request, limit: () => request,
    maybeSingle: async () => { const value = result(); return { data: value.data?.[0] ?? null, error: value.error }; },
    then: (resolve: (value: ReturnType<typeof result>) => unknown) => Promise.resolve(result()).then(resolve),
  }; return request;
} }));
import { loadCentralContext } from '@/lib/documents/centralCatalogService';
import { createCentralSnapshot, refreshCentralSnapshot } from '@/lib/documents/centralCatalogModel';
import { loadCompanyDocumentCustomValues, selectCompanyDocumentPrimary } from '@/lib/documents/companyDocumentContext.web';
import { CENTRAL_DOCUMENT_CATALOG } from '@/data/seeds/documentCatalog/centralCatalog';
import { getSupabaseClient } from '@/lib/supabase/client';

const T = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const actor = { roleKey: 'business_admin' as const };
const load = () => loadCentralContext(T, 'company', T, actor);
const customDefinition = () => ({ ...CENTRAL_DOCUMENT_CATALOG.find(entry => entry.target === 'company')!, fields: [{ key: 'own', label: 'Eigene Angabe', type: 'text' as const, required: false, sourcePath: 'tenant.custom.office_number' }] });
beforeEach(() => {
  fixture.errors = {}; fixture.queries = []; fixture.denied.clear();
  fixture.rows = {
    tenants: [{ id: T, name: 'Firma', legal_name: 'Neue Firma GmbH', street: 'Neue Straße', house_number: '1', postal_code: '44623', city: 'Herne', representative_name: 'Alte Vertretung' }],
    tenant_document_settings: [{ tenant_id: T, logo_url: 'https://old.test/logo.png' }],
    tenant_addresses: [{ tenant_id: T, street: 'Alte Straße', zip: '10000', city: 'Altstadt' }],
    tenant_branding: [{ tenant_id: T, logo_url: 'https://new.test/logo.png' }],
    tenant_representatives: [{ id: 'rep-1', tenant_id: T, first_name: 'Neue', last_name: 'Vertretung', is_primary: true }],
    tenant_bank_accounts: [
      { id: 'bank-other', tenant_id: OTHER, iban: 'FOREIGN', is_primary: true },
      { id: 'bank-1', tenant_id: T, iban: 'SECONDARY', is_primary: false },
      { id: 'bank-2', tenant_id: T, iban: 'PRIMARY', bic: 'BIC', bank_name: 'Hausbank', account_holder: 'Kontoinhaber', is_primary: true },
    ],
    tenant_custom_field_definitions: [{ id: 'def-1', tenant_id: T, field_key: 'office_number', data_type: 'text', visibility: { office: true }, function_key: 'documents', is_active: true }],
    tenant_custom_field_values: [{ tenant_id: T, definition_id: 'def-1', value: 'HV-123' }, { tenant_id: OTHER, definition_id: 'def-1', value: 'FOREIGN VALUE' }],
  };
});

describe('canonical company document data', () => {
  it('uses the primary account, current representatives and company branding', async () => {
    const result = await load(); expect(result.ok).toBe(true); if (!result.ok) return;
    expect(result.data.company).toMatchObject({ iban: 'PRIMARY', bic: 'BIC', bankName: 'Hausbank', accountHolder: 'Kontoinhaber', representativeName: 'Neue Vertretung', logoUrl: 'https://new.test/logo.png' });
    expect(JSON.stringify(result.data)).not.toContain('FOREIGN');
    for (const query of fixture.queries.filter(entry => ['tenant_branding', 'tenant_representatives', 'tenant_bank_accounts'].includes(entry.table))) expect(query.filters).toContainEqual(['tenant_id', T]);
  });
  it('keeps deliberately cleared canonical fields empty instead of restoring legacy data', async () => {
    fixture.rows.tenant_branding[0].logo_url = null;
    fixture.rows.tenant_representatives = [];
    fixture.rows.tenant_bank_accounts = [];
    Object.assign(fixture.rows.tenants[0], { street: '', house_number: '', postal_code: '', city: '' });
    const result = await load(); expect(result.ok).toBe(true); if (!result.ok) return;
    expect(result.data.company).toMatchObject({ logoUrl: '', representativeName: '', iban: '', address: '' });
  });
  it('uses legacy representative/logo only for missing canonical schema', async () => {
    fixture.errors.tenant_branding = '42P01'; fixture.errors.tenant_representatives = 'PGRST205'; fixture.errors.tenant_bank_accounts = '42P01';
    const result = await load(); expect(result.ok).toBe(true); if (!result.ok) return;
    expect(result.data.company).toMatchObject({ logoUrl: 'https://old.test/logo.png', representativeName: 'Alte Vertretung', iban: '' });
  });
  it('does not hide canonical permission or network errors behind old values', async () => {
    fixture.errors.tenant_bank_accounts = '42501'; expect((await load()).ok).toBe(false);
    fixture.errors = { tenant_branding: 'NETWORK' }; expect((await load()).ok).toBe(false);
  });
  it('does not require the old logo table when canonical branding exists', async () => {
    fixture.errors.tenant_document_settings = '42P01'; fixture.errors.tenant_addresses = '42P01'; const result = await load();
    expect(result.ok).toBe(true); if (result.ok) expect(result.data.company.logoUrl).toBe('https://new.test/logo.png');
  });
  it('never picks arbitrarily among multiple primary or unmarked accounts', () => {
    expect(selectCompanyDocumentPrimary([{ isPrimary: false }, { isPrimary: false }])).toBeUndefined();
    expect(selectCompanyDocumentPrimary([{ isPrimary: true }, { isPrimary: true }])).toBeUndefined();
    expect(selectCompanyDocumentPrimary([{ isPrimary: false, iban: 'ONLY' }])?.iban).toBe('ONLY');
  });
  it('loads only referenced visible custom values and supplies the actual snapshot value', async () => {
    const definition = customDefinition(); const result = await loadCentralContext(T, 'company', T, actor, { definition });
    expect(result.ok).toBe(true); if (!result.ok) return;
    expect(result.data.custom).toEqual({ office_number: 'HV-123' });
    const snapshot = createCentralSnapshot(definition, result.data, 'Autor', T);
    expect(snapshot.values.own).toBe('HV-123'); expect(snapshot.fieldOrigins.own).toBe('stored');
    expect(fixture.queries.find(query => query.table === 'tenant_custom_field_values')?.filters).toContainEqual(['tenant_id', T]);
  });
  it('does not query values without company-management permission or without a template reference', async () => {
    fixture.denied.add('business.tenant.manage');
    const denied = await loadCentralContext(T, 'company', T, actor, { definition: customDefinition() });
    expect(denied.ok).toBe(true); if (denied.ok) expect(denied.data.custom).toBeUndefined();
    expect(fixture.queries.some(query => query.table === 'tenant_custom_field_values')).toBe(false);
    fixture.denied.clear(); fixture.queries = []; await load();
    expect(fixture.queries.some(query => query.table === 'tenant_custom_field_definitions')).toBe(false);
  });
  it('excludes inactive, hidden, protected, unrelated-purpose and foreign-module custom fields', async () => {
    const base = fixture.rows.tenant_custom_field_definitions[0];
    fixture.rows.tenant_custom_field_definitions = [
      { ...base, is_active: false }, { ...base, id: 'hidden', visibility: { office: false } },
      { ...base, id: 'private', visibility: { office: true, protected: true } },
      { ...base, id: 'billing', function_key: 'billing' }, { ...base, id: 'module', module_key: 'pflege' },
    ];
    const result = await loadCompanyDocumentCustomValues(getSupabaseClient()!, T, ['office_number'], ['assist']);
    expect(result).toEqual({ ok: true, data: {} });
    expect(fixture.queries.some(query => query.table === 'tenant_custom_field_values')).toBe(false);
  });
  it('uses new values after refresh while retaining manual edits and rejecting foreign tenant refresh', async () => {
    const definition = customDefinition(); const first = await loadCentralContext(T, 'company', T, actor, { definition });
    expect(first.ok).toBe(true); if (!first.ok) return;
    const snapshot = createCentralSnapshot(definition, first.data, 'Autor', T);
    fixture.rows.tenant_custom_field_values[0].value = 'UPDATED';
    const next = await loadCentralContext(T, 'company', T, actor, { definition }); expect(next.ok).toBe(true); if (!next.ok) return;
    expect(refreshCentralSnapshot(snapshot, next.data, 'Autor').values.own).toBe('UPDATED');
    snapshot.values.own = 'Manuell'; snapshot.fieldOrigins.own = 'manual';
    expect(refreshCentralSnapshot(snapshot, next.data, 'Autor').values.own).toBe('Manuell');
    expect(() => refreshCentralSnapshot(snapshot, { ...next.data, tenantId: OTHER }, 'Autor')).toThrow();
  });
});
