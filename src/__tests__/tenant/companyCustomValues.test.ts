import { beforeEach, describe, expect, it, vi } from 'vitest';
type Row = Record<string, unknown>;
const h = vi.hoisted(() => ({ definitions: [] as Row[], values: [] as Row[], writes: [] as Row[], readFilters: [] as [string, string, unknown][], denied: false, zeroUpdate: false }));
vi.mock('@/lib/services/liveServiceGuard', () => ({ guardServiceTenant: () => null, isLiveServiceMode: () => true }));
vi.mock('@/lib/permissions', () => ({ enforcePermission: () => h.denied ? { ok: false, error: 'Berechtigung fehlt' } : null }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => ({}) }));
vi.mock('@/lib/supabase/untypedTable', () => ({ fromUnknownTable: (_client: unknown, table: string) => {
  const filters: [string, unknown][] = []; let write: Row | null = null;
  const result = () => {
    if (write) { h.writes.push(write); return { data: h.zeroUpdate ? [] : [{ definition_id: 'field-1', value: write.value, updated_at: 'v2' }], error: null }; }
    return { data: (table === 'tenant_custom_field_definitions' ? h.definitions : h.values).filter(row => filters.every(([key, value]) => Array.isArray(value) ? value.includes(row[key]) : row[key] === value)), error: null };
  };
  const request = {
    select: () => request, in: (key: string, value: unknown[]) => { filters.push([key, value]); h.readFilters.push([table, key, value]); return request; },
    eq: (key: string, value: unknown) => { filters.push([key, value]); h.readFilters.push([table, key, value]); return request; },
    update: (value: Row) => { write = value; return request; }, insert: (value: Row) => { write = value; return request; },
    maybeSingle: async () => { const value = result(); return { data: value.data[0] ?? null, error: value.error }; },
    then: (resolve: (value: ReturnType<typeof result>) => unknown) => Promise.resolve(result()).then(resolve),
  }; return request;
} }));
import { loadCompanyCustomValues, saveCompanyCustomValue, parseCompanyCustomValue, companyCustomValueOptions } from '@/lib/tenant/companyCustomValues.web';
import type { TenantCustomFieldDefinition } from '@/types/tenant/tenantCenter';
const scope = { tenantId: 'tenant-1', roleKey: 'business_admin' as const };
const field = (extra: Partial<TenantCustomFieldDefinition> = {}): TenantCustomFieldDefinition => ({ id: 'field-1', fieldKey: 'own', label: 'Angabe', groupId: null, dataType: 'text', moduleKey: null, functionKey: 'documents', visibility: { office: true }, validation: {}, isActive: true, sortOrder: 0, ...extra });
beforeEach(() => { h.denied = false; h.zeroUpdate = false; h.writes = []; h.readFilters = []; h.definitions = [{ id: 'field-1', tenant_id: 'tenant-1', field_key: 'own', label: 'Angabe', data_type: 'text', visibility: { office: true }, validation: {}, is_active: true }]; h.values = [{ tenant_id: 'tenant-1', definition_id: 'field-1', value: 'Gespeichert', updated_at: 'v1' }]; });
describe('company custom values', () => {
  it('loads only authorized definitions and values of the active tenant', async () => {
    h.values.push({ tenant_id: 'foreign', definition_id: 'field-1', value: 'SECRET' });
    expect(await loadCompanyCustomValues(scope, ['field-1'])).toEqual({ ok: true, data: [{ definitionId: 'field-1', value: 'Gespeichert', updatedAt: 'v1' }] });
    expect(h.readFilters).toContainEqual(['tenant_custom_field_values', 'tenant_id', 'tenant-1']);
  });
  it('does not read protected values or access any table without permission', async () => {
    h.definitions[0].visibility = { office: true, protected: true };
    expect(await loadCompanyCustomValues(scope, ['field-1'])).toEqual({ ok: true, data: [] });
    expect(h.readFilters.some(([table]) => table === 'tenant_custom_field_values')).toBe(false);
    h.denied = true; h.readFilters = []; expect((await saveCompanyCustomValue(scope, 'field-1', 'neu', 'v1')).ok).toBe(false); expect(h.readFilters).toEqual([]);
  });
  it('uses compare-and-swap and reports stale writes for reload', async () => {
    const result = await saveCompanyCustomValue(scope, 'field-1', 'Neu', 'v1'); expect(result.ok).toBe(true);
    expect(h.readFilters).toContainEqual(['tenant_custom_field_values', 'updated_at', 'v1']);
    h.zeroUpdate = true; expect(await saveCompanyCustomValue(scope, 'field-1', 'Neu', 'old')).toMatchObject({ ok: false, reloadRequired: true });
  });
  it('rejects unknown or foreign definitions before a write', async () => {
    h.definitions[0].tenant_id = 'foreign'; expect((await saveCompanyCustomValue(scope, 'field-1', 'Neu', null)).ok).toBe(false); expect(h.writes).toEqual([]);
  });
  it('validates actual latest select values and serializes booleans/numbers distinctly', async () => {
    h.definitions[0].data_type = 'select'; h.definitions[0].validation = { options: [{ value: 'a', label: 'Auswahl A' }] };
    expect((await saveCompanyCustomValue(scope, 'field-1', 'Frei erfunden', null)).ok).toBe(false); expect(h.writes).toEqual([]);
    expect(companyCustomValueOptions(field({ validation: { options: [{ value: 'a', label: 'Auswahl A' }] } }))).toEqual([{ value: 'a', label: 'Auswahl A' }]);
    expect(parseCompanyCustomValue(field({ dataType: 'boolean' }), 'false')).toEqual({ ok: true, data: false });
    expect(parseCompanyCustomValue(field({ dataType: 'number' }), '0,5')).toEqual({ ok: true, data: 0.5 });
  });
  it('rejects impossible dates, missing required entries, and invalid ranges', () => {
    expect(parseCompanyCustomValue(field({ dataType: 'date' }), '2026-02-30').ok).toBe(false);
    expect(parseCompanyCustomValue(field({ validation: { required: true } }), '  ').ok).toBe(false);
    expect(parseCompanyCustomValue(field({ dataType: 'number', validation: { min: 2 } }), '1').ok).toBe(false);
    expect(parseCompanyCustomValue(field(), '')).toEqual({ ok: true, data: null });
  });
});
