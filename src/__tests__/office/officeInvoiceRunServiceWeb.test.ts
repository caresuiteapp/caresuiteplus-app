import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildInvoiceRunPreview, executeInvoiceRun, loadInvoiceRunPreview, type InvoiceRunPreview } from '@/lib/office/invoiceRunService.web';

const state = vi.hoisted(() => ({ denied: false, foreign: false, pages: {} as Record<string, Record<string, unknown>[]>, queries: [] as { table: string; filters: Record<string, unknown>; from: number; to: number }[], save: vi.fn() }));
vi.mock('@/lib/permissions', () => ({ enforcePermission: () => state.denied ? { ok: false, error: 'Keine Berechtigung.' } : null }));
vi.mock('@/lib/services/liveServiceGuard', () => ({ guardServiceTenant: () => state.foreign ? { ok: false, error: 'Fremder Mandant.' } : null }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => ({}) }));
vi.mock('@/lib/supabase/errors', () => ({ toGermanSupabaseError: () => 'Datenbankfehler.' }));
vi.mock('@/lib/office/invoiceWorkspaceService.web', () => ({ saveOfficeInvoiceDraft: (...args: unknown[]) => state.save(...args) }));
vi.mock('@/lib/supabase/untypedTable', () => ({ fromUnknownTable: (_: unknown, table: string) => {
  const filters: Record<string, unknown> = {};
  const query = { select: () => query, order: () => query,
    eq: (key: string, val: unknown) => { filters[key] = val; return query; },
    gte: (key: string, val: unknown) => { filters[`gte:${key}`] = val; return query; },
    lte: (key: string, val: unknown) => { filters[`lte:${key}`] = val; return query; },
    in: (key: string, val: unknown) => { filters[`in:${key}`] = val; return query; },
    range: async (from: number, to: number) => {
      state.queries.push({ table, filters: { ...filters }, from, to });
      return { data: (state.pages[table] ?? []).slice(from, to + 1), error: null };
    } };
  return query;
} }));

const tenant = '11111111-1111-4111-8111-111111111111';
const client = '22222222-2222-4222-8222-222222222222';
const request = '33333333-3333-4333-8333-333333333333';
const source = '44444444-4444-4444-8444-444444444444';
function fixture(): InvoiceRunPreview {
  const result = buildInvoiceRunPreview(tenant, { month: '2026-09', includeProofs: false, invoiceDate: '2026-10-01' }, {
    sources: [{ id: source, tenant_id: tenant, client_id: client, product_key: 'assist', service_date: '2026-09-15', status: 'approved', signature_id: '77777777-7777-4777-8777-777777777777', documentation_entry_id: '88888888-8888-4888-8888-888888888888',
      actual_minutes: 60, billable_minutes: 60, hourly_rate: 30, total_amount: 30, updated_at: '2026-09-16T12:00:00Z' }],
    clients: [{ id: client, tenant_id: tenant, first_name: 'Test', last_name: 'Person', street: 'Weg 1', postal_code: '12345', city: 'Ort', country: 'Deutschland' }],
    billingProfiles: [{ id: 'profile', tenant_id: tenant, client_id: client, billing_type: 'selbstzahler', payment_terms_days: 14 }],
    recipients: [], settings: [{ id: 'settings', tenant_id: tenant, self_payer_vat_rate: 0 }],
  }, new Date('2026-10-18T12:00:00Z'), () => request);
  if (!result.ok) throw new Error(result.error);
  return result.data;
}
beforeEach(() => { state.denied = false; state.foreign = false; state.queries = []; state.pages = {}; state.save.mockReset(); });

describe('Web Rechnungslauf – Lesen und atomare Einzelentwürfe', () => {
  it('blockiert fehlende Berechtigung vor jedem Lesen und Schreiben', async () => {
    state.denied = true;
    expect((await loadInvoiceRunPreview(tenant, { month: '2026-09', includeProofs: false, invoiceDate: '2026-10-01' }, 'business_admin')).ok).toBe(false);
    expect((await executeInvoiceRun(tenant, fixture(), [client], 'business_admin')).ok).toBe(false);
    expect(state.queries).toHaveLength(0); expect(state.save).not.toHaveBeenCalled();
  });
  it('liest Quellen monatsbegrenzt, mandantenbezogen und vollständig über die 1000er-Grenze', async () => {
    state.pages.service_records = Array.from({ length: 1001 }, (_, i) => ({ id: `source-${i}`, tenant_id: tenant, client_id: client,
      service_date: '2026-09-15', product_key: 'assist', status: 'billed', billed_invoice_id: 'invoice' }));
    const result = await loadInvoiceRunPreview(tenant, { month: '2026-09', includeProofs: false, invoiceDate: '2026-10-01', productKey: 'assist' }, 'business_admin');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.alreadyBilledCount).toBe(1001);
    expect(state.queries.filter(query => query.table === 'service_records').map(query => [query.from, query.to])).toEqual([[0, 999], [1000, 1999]]);
    expect(state.queries.every(query => query.filters.tenant_id === tenant)).toBe(true);
    expect(state.queries[0].filters).toMatchObject({ 'gte:service_date': '2026-09-01', 'lte:service_date': '2026-09-30', product_key: 'assist' });
    expect(state.queries.some(query => query.table === 'billing_recipient_profiles')).toBe(false);
  });
  it('bricht bei fremden Quelldaten ab und liest keine weiteren Klienten', async () => {
    state.pages.service_records = [{ id: source, tenant_id: 'foreign', client_id: client }];
    const result = await loadInvoiceRunPreview(tenant, { month: '2026-09', includeProofs: false, invoiceDate: '2026-10-01' }, 'business_admin');
    expect(result.ok).toBe(false); expect(state.queries).toHaveLength(1);
  });
  it('weist fremde Vorschauen und veraltete Auswahlen vor der Speicherung zurück', async () => {
    const preview = fixture();
    expect((await executeInvoiceRun('other', preview, [client], 'business_admin')).ok).toBe(false);
    expect((await executeInvoiceRun(tenant, preview, ['missing'], 'business_admin')).ok).toBe(false);
    expect(state.save).not.toHaveBeenCalled();
  });
  it('verarbeitet Teilerfolge weiter und meldet jede Gruppe getrennt', async () => {
    const preview = fixture(); const first = preview.groups[0];
    preview.groups.push({ ...first, id: 'second', clientName: 'Zweite Person', draft: { ...first.draft, requestId: '55555555-5555-4555-8555-555555555555' } },
      { ...first, id: 'blocked', clientName: 'Gesperrte Person', eligible: false, blockers: ['Nachweis noch offen.'], draft: { ...first.draft, requestId: '66666666-6666-4666-8666-666666666666' } });
    state.save.mockResolvedValueOnce({ ok: false, error: 'Quelle wurde inzwischen abgerechnet.' }).mockResolvedValueOnce({ ok: true, data: { id: 'saved', updatedAt: 'now' } });
    const progress = vi.fn();
    const result = await executeInvoiceRun(tenant, preview, [client, 'second', 'blocked'], 'business_admin', { onProgress: progress });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toMatchObject({ createdCount: 1, failedCount: 1, skippedCount: 1 });
      expect(result.data.results.map(item => item.status)).toEqual(['failed', 'created', 'skipped']);
    }
    expect(state.save).toHaveBeenCalledTimes(2); expect(progress).toHaveBeenCalledTimes(3);
  });
  it('behält die Speicherkennung bei unklarer Antwort und Wiederholung bei', async () => {
    const preview = fixture();
    state.save.mockRejectedValueOnce(new Error('connection lost')).mockResolvedValueOnce({ ok: true, data: { id: 'saved', updatedAt: 'now' } });
    const first = await executeInvoiceRun(tenant, preview, [client], 'business_admin');
    expect(first.ok && first.data.failedCount).toBe(1);
    const retry = await executeInvoiceRun(tenant, preview, [client, client], 'business_admin');
    expect(retry.ok && retry.data.createdCount).toBe(1);
    expect(state.save.mock.calls.map(args => args[1].requestId)).toEqual([request, request]);
  });
  it('blockiert parallele Doppelklicks und lässt Fortschrittsfehler die Speicherung nicht umdeuten', async () => {
    const preview = fixture(); let complete!: (value: unknown) => void;
    state.save.mockImplementation(() => new Promise(resolve => { complete = resolve; }));
    const pending = executeInvoiceRun(tenant, preview, [client], 'business_admin', { onProgress: () => { throw new Error('render'); } });
    expect((await executeInvoiceRun(tenant, preview, [client], 'business_admin')).ok).toBe(false);
    complete({ ok: true, data: { id: 'saved', updatedAt: 'now' } });
    const result = await pending;
    expect(result.ok && result.data.createdCount).toBe(1);
    expect(state.save).toHaveBeenCalledTimes(1);
  });
  it('speichert nach einem Ansichtswechsel keine weiteren Gruppen', async () => {
    const preview = fixture(); const first = preview.groups[0];
    preview.groups.push({ ...first, id: 'next', draft: { ...first.draft, requestId: '55555555-5555-4555-8555-555555555555' } });
    let active = true;
    state.save.mockImplementation(async () => { active = false; return { ok: true, data: { id: 'saved', updatedAt: 'now' } }; });
    const result = await executeInvoiceRun(tenant, preview, [client, 'next'], 'business_admin', { isActive: () => active });
    expect(result.ok && result.data.createdCount).toBe(1);
    expect(result.ok && result.data.skippedCount).toBe(1);
    expect(state.save).toHaveBeenCalledTimes(1);
  });

});
