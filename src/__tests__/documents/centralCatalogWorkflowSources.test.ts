import { beforeEach, describe, expect, it, vi } from 'vitest';
const fixture = vi.hoisted(() => ({ rows: {} as Record<string, Record<string, unknown>[]>, denied: new Set<string>(), queries: [] as { table: string; filters: [string, unknown][]; columns: string; range?: [number, number] }[] }));
vi.mock('@/lib/services/mode', () => ({ getServiceMode: () => 'supabase' }));
vi.mock('@/lib/services/liveServiceGuard', () => ({ guardServiceTenant: () => null }));
vi.mock('@/lib/permissions/actorPermissions', () => ({ enforceWithActor: async (_role: unknown, _tenant: unknown, _profile: unknown, permission: string) => fixture.denied.has(permission) ? { ok: false, error: 'Berechtigung fehlt' } : null }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => ({}) }));
vi.mock('@/lib/supabase/untypedTable', () => ({ fromUnknownTable: (_client: unknown, table: string) => {
  const query = { table, filters: [] as [string, unknown][], columns: '', range: undefined as [number, number] | undefined }; fixture.queries.push(query);
  const result = () => { let rows = (fixture.rows[table] ?? []).filter((row) => query.filters.every(([key, value]) => row[key] === value)); if (query.range) rows = rows.slice(query.range[0], query.range[1] + 1); return { data: rows, error: null }; };
  const request = {
    select: (columns: string) => { query.columns = columns; return request; },
    eq: (key: string, value: unknown) => { query.filters.push([key, value]); return request; },
    order: () => request, limit: () => request,
    range: (start: number, end: number) => { query.range = [start, end]; return request; },
    maybeSingle: async () => { const value = result(); return { data: value.data[0] ?? null, error: value.error }; },
    then: (resolve: (value: ReturnType<typeof result>) => unknown) => Promise.resolve(result()).then(resolve),
  }; return request;
} }));
import { loadCentralContext, listCentralDocuments } from '@/lib/documents/centralCatalogService';
import { CENTRAL_DOCUMENT_CATALOG } from '@/data/seeds/documentCatalog/centralCatalog';
import { createCentralSnapshot } from '@/lib/documents/centralCatalogModel';

const T = '11111111-1111-4111-8111-111111111111'; const C = '22222222-2222-4222-8222-222222222222'; const I = '33333333-3333-4333-8333-333333333333';
const definition = (key: string) => CENTRAL_DOCUMENT_CATALOG.find((entry) => entry.key === key)!;
beforeEach(() => {
  fixture.denied.clear(); fixture.queries = [];
  fixture.rows = {
    tenants: [{ id: T, name: 'Unternehmen', legal_name: 'Pflege GmbH', street: 'Parkstraße', house_number: '12', postal_code: '10115', city: 'Berlin' }],
    tenant_document_settings: [{ tenant_id: T, logo_url: '' }], tenant_addresses: [],
    clients: [{ id: C, tenant_id: T, first_name: 'Mara', last_name: 'Muster', street: 'Weg', house_number: '4', postal_code: '10115', city: 'Berlin' }],
    invoices: [{ id: I, tenant_id: T, client_id: C, invoice_number: 'RE-2026-1', service_period_from: '2026-10-01', service_period_to: '2026-10-31' }],
    invoice_items: [{ tenant_id: T, invoice_id: I, service_date: '2026-10-13', description: 'Betreuung', quantity: 2, unit: 'Stunden', gross_amount: 80 }],
  };
});
describe('trusted procedure sources and paginated archive scope', () => {
  it('takes stored invoice period and lines only from the linked client and tenant', async () => {
    const d = definition('csdc_abrechnung_004');
    const result = await loadCentralContext(T, 'client', C, { roleKey: 'business_admin' }, { definition: d, invoiceId: I });
    expect(result.ok).toBe(true); if (!result.ok) return;
    const snapshot = createCentralSnapshot(d, result.data, 'Anna', I);
    expect(snapshot.values.f0_leistungszeitraum_und_abrechnungsgrundlage).toBe('2026-10-01 bis 2026-10-31');
    expect(snapshot.tableRows[0]).toEqual(['2026-10-13', 'Betreuung', '2 Stunden · 80,00 €', 'Rechnung RE-2026-1', '']);
    expect(fixture.queries.filter((query) => ['invoices', 'invoice_items'].includes(query.table)).every((query) => query.filters.some(([key, value]) => key === 'tenant_id' && value === T))).toBe(true);
  });
  it('rejects foreign client invoices and permission failures before exposing their contents', async () => {
    fixture.rows.invoices[0].client_id = 'foreign-client';
    const request = { definition: definition('csdc_abrechnung_004'), invoiceId: I };
    const foreign = await loadCentralContext(T, 'client', C, { roleKey: 'business_admin' }, request);
    expect(foreign.ok).toBe(false);
    fixture.queries = []; fixture.denied.add('office.invoices.view');
    expect((await loadCentralContext(T, 'client', C, { roleKey: 'business_admin' }, request)).ok).toBe(false);
    expect(fixture.queries.some((query) => query.table === 'invoices')).toBe(false);
  });
  it('reads a selected wound and recorded measurement without inventing missing dimensions', async () => {
    fixture.rows.clinical_wound_cases = [{ id: I, tenant_id: T, client_id: C, body_location: 'Linker Unterschenkel', wound_type: 'Ulcus' }];
    fixture.rows.clinical_wound_assessments = [{ tenant_id: T, client_id: C, wound_case_id: I, assessed_at: '2026-10-13T08:00:00Z', length_cm: 2, depth_cm: 0, pain_score: 0 }];
    const d = definition('csdc_wunden_002'); const result = await loadCentralContext(T, 'client', C, { roleKey: 'business_admin' }, { definition: d, woundId: I });
    expect(result.ok).toBe(true); if (!result.ok) return;
    const snapshot = createCentralSnapshot(d, result.data, 'Anna', I);
    expect(snapshot.values.f1_laenge_breite_tiefe_und_messverfahren).toContain('Länge: 2 cm');
    expect(snapshot.values.f1_laenge_breite_tiefe_und_messverfahren).toContain('Tiefe: 0 cm');
    expect(snapshot.values.f1_laenge_breite_tiefe_und_messverfahren).not.toContain('Breite:');
    expect(snapshot.values.f3_exsudat_geruch_schmerz_und_infektionszeichen).toContain('Schmerzscore: 0');
    expect(snapshot.values.f4_versorgung_material_und_anordnung).toBe('');
  });
  it('does not copy clinical data to a different subject or a different document purpose', async () => {
    fixture.rows.medications = [{ id: I, tenant_id: T, client_id: 'foreign-client', name: 'Nicht übernehmen' }];
    expect((await loadCentralContext(T, 'client', C, { roleKey: 'business_admin' }, { definition: definition('csdc_medikamente_003'), medicationId: I })).ok).toBe(false);
    fixture.queries = [];
    const other = await loadCentralContext(T, 'client', C, { roleKey: 'business_admin' }, { definition: definition('csdc_einsatz_006'), medicationId: I });
    expect(other.ok).toBe(true); expect(fixture.queries.some((query) => query.table === 'medications')).toBe(false);
  });
  it('limits each history page and filters the entity before pagination', async () => {
    const result = await listCentralDocuments(T, { roleKey: 'business_admin' }, { target: 'client', entityId: C }, 100);
    expect(result.ok).toBe(true);
    const query = fixture.queries.find((entry) => entry.table === 'central_document_records')!;
    expect(query.filters).toContainEqual(['tenant_id', T]); expect(query.filters).toContainEqual(['entity_id', C]); expect(query.filters).toContainEqual(['target', 'client']);
    expect(query.range).toEqual([100, 199]);
    expect((await listCentralDocuments(T, { roleKey: 'business_admin' }, undefined, -1)).ok).toBe(false);
  });
});
