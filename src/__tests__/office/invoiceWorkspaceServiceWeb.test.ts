import { beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({
  rows: {} as Record<string, Record<string, unknown>[]>, errors: {} as Record<string, unknown>, reads: [] as { table: string; from: number; filters: Record<string, string> }[],
  rpcCalls: [] as { name: string; payload: Record<string, unknown> }[], rpcData: null as unknown, rpcError: null as unknown,
  roleDenied: false, tenantDenied: false, connected: true, live: true, ignoreFilters: false, rpcThrow: false,
}));
vi.mock('@/lib/permissions', () => ({ enforcePermission: () => state.roleDenied ? { ok: false, error: 'Kein Schreibrecht' } : null }));
vi.mock('@/lib/services/liveServiceGuard', () => ({ guardServiceTenant: () => state.tenantDenied ? { ok: false, error: 'Mandant gesperrt' } : null }));
vi.mock('@/lib/services/mode', () => ({ getServiceMode: () => state.live ? 'supabase' : 'demo' }));
vi.mock('@/lib/supabase/errors', () => ({ toGermanSupabaseError: (error: { message?: string }) => error.message || 'Datenfehler' }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => state.connected ? { rpc: async (name: string, payload: Record<string, unknown>) => {
  state.rpcCalls.push({ name, payload }); if (state.rpcThrow) throw new Error('network'); return { data: state.rpcData, error: state.rpcError };
} } : null }));
vi.mock('@/lib/supabase/untypedTable', () => ({ fromUnknownTable: (_client: unknown, table: string) => {
  const filters: Record<string, string> = {}; let ids: string[] | null = null;
  const chain = { select: () => chain, eq: (key: string, value: string) => { filters[key] = value; return chain; }, order: () => chain, in: (_key: string, values: string[]) => { ids = values; return chain; },
    range: async (from: number, to: number) => {
      state.reads.push({ table, from, filters: { ...filters } });
      const rows = (state.rows[table] ?? []).filter(row => state.ignoreFilters || ((!ids || ids.includes(String(row.id))) && Object.entries(filters).every(([key, value]) => row[key] === value)));
      return { data: rows.slice(from, to + 1), error: state.errors[`${table}:${from}`] ?? state.errors[table] ?? null };
    } };
  return chain;
} }));
import {
  fetchOfficeInvoice, fetchOfficeInvoices, fetchOfficeInvoiceEditorOptions, saveOfficeInvoiceDraft, deleteOfficeInvoiceDraft,
  transitionOfficeInvoice, recordOfficeInvoicePayment, fetchOfficeInvoiceIssuePreview, finalizeOfficeInvoiceIssue,
} from '@/lib/office/invoiceWorkspaceService.web';
import type { InvoiceOfficeDraft, OfficeInvoicePaymentInput } from '@/lib/office/invoiceWorkspaceTypes.web';

const tenantId = '11111111-1111-4111-8111-111111111111';
const invoiceId = '22222222-2222-4222-8222-222222222222';
const clientId = '33333333-3333-4333-8333-333333333333';
const requestId = '44444444-4444-4444-8444-444444444444';
const updatedAt = '2026-10-18T07:30:00.000Z';
const role = 'business_admin' as const;
function draft(extra: Partial<InvoiceOfficeDraft> = {}): InvoiceOfficeDraft {
  return { requestId, clientId, invoiceNumber: '', invoiceDate: '2026-10-18', dueDate: '2026-11-01', servicePeriodStart: '2026-10-01', servicePeriodEnd: '2026-10-31',
    recipient: { name: 'Ada Muster', street: 'Musterstraße', houseNumber: '1', postalCode: '44623', city: 'Herne', country: 'Deutschland', email: '' },
    recipientType: 'client', billingParty: 'self_payer', notes: '', footerText: '', includeProofs: false,
    lines: [{ description: 'Leistung', quantity: 2, unit: 'Stunde', unitPriceCents: 2000, taxRatePercent: 0, productKey: 'assist' }], ...extra };
}
function seedInvoice(extra: Record<string, unknown> = {}) {
  state.rows.invoices = [{ id: invoiceId, tenant_id: tenantId, client_id: clientId, invoice_number: 'RE-2026-1', status: 'draft', invoice_date: '2026-10-18', due_date: '2026-11-01',
    service_period_from: '2026-10-01', service_period_to: '2026-10-31', total_amount: '40.00', paid_amount: '0.00', open_amount: '40.00',
    created_at: updatedAt, updated_at: updatedAt, recipient_name: 'Versicherung', recipient_street: 'Kassenweg', recipient_postal_code: '44623', recipient_city: 'Herne',
    include_service_proofs: false, office_managed: true, recipient_type: 'care_insurance', billing_party: 'care_insurance', ...extra }];
  state.rows.clients = [{ id: clientId, tenant_id: tenantId, first_name: 'Ada', last_name: 'Muster', street: 'Wohnstraße', client_number: 'K-1', status: 'active' }];
  state.rows.invoice_items = [{ id: 'item-1', tenant_id: tenantId, invoice_id: invoiceId, description: 'Leistung', quantity: '2', unit: 'Stunde', unit_price: '20', net_amount: '40', vat_amount: '0', vat_rate: '0', gross_amount: '40', product_key: 'assist', sort_order: 1 }];
}
function payment(extra: Partial<OfficeInvoicePaymentInput> = {}): OfficeInvoicePaymentInput {
  return { requestId, amountCents: 1000, paymentDate: '2026-10-18', method: 'bank_transfer', reference: 'Kontoauszug 18.10.2026', notes: '', ...extra };
}
beforeEach(() => {
  state.rows = {}; state.errors = {}; state.reads = []; state.rpcCalls = []; state.rpcData = { invoice_id: invoiceId, updated_at: updatedAt };
  state.rpcError = null; state.roleDenied = false; state.tenantDenied = false; state.connected = true; state.live = true; state.ignoreFilters = false; state.rpcThrow = false;
});
describe('Office invoice complete scoped reads', () => {
  it('keeps the saved payer address separate from the client identity', async () => {
    seedInvoice(); const result = await fetchOfficeInvoice(tenantId, invoiceId, role); expect(result.ok).toBe(true); if (!result.ok) return;
    expect(result.data.clientName).toBe('Ada Muster'); expect(result.data.recipient.name).toBe('Versicherung'); expect(result.data.recipient.street).toBe('Kassenweg');
    expect(result.data.amountCents).toBe(4000); expect(result.data.paidCents).toBe(0); expect(result.data.openCents).toBe(4000);
    expect(result.data.recipientType).toBe('care_insurance'); expect(result.data.billingParty).toBe('care_insurance');
  });
  it('does not turn missing amounts into zero or missing due dates into updated_at', async () => {
    seedInvoice({ total_amount: null, paid_amount: null, open_amount: null, due_date: null });
    const result = await fetchOfficeInvoices(tenantId, role); expect(result.ok).toBe(true); if (!result.ok) return;
    expect(result.data[0].amountCents).toBeNull(); expect(result.data[0].paidCents).toBeNull(); expect(result.data[0].openCents).toBeNull(); expect(result.data[0].dueDate).toBeNull();
    expect(result.data[0].issues.join(' ')).toMatch(/Rechnungssumme.*Zahlungsstand.*Fälligkeitsdatum/);
  });
  it('preserves no period rather than making a month-start date the full service period', async () => {
    seedInvoice({ service_period_from: null, service_period_to: null, service_month: '2026-10-01' });
    const result = await fetchOfficeInvoices(tenantId, role); if (!result.ok) throw new Error(result.error);
    expect(result.data[0].servicePeriodStart).toBeNull(); expect(result.data[0].servicePeriodEnd).toBeNull();
  });
  it('hides internal draft identifiers and keeps selected proof IDs', async () => {
    seedInvoice({ invoice_number: `DRAFT-${invoiceId}`, include_service_proofs: true, selected_proof_ids: [`record:${clientId}`] });
    const result = await fetchOfficeInvoices(tenantId, role); if (!result.ok) throw new Error(result.error);
    expect(result.data[0].invoiceNumber).toBe(''); expect(result.data[0].selectedProofIds).toEqual([`record:${clientId}`]);
  });
  it('loads beyond the default page size and scopes each request', async () => {
    seedInvoice(); const base = state.rows.invoices[0]; state.rows.invoices = Array.from({ length: 501 }, (_, i) => ({ ...base, id: `invoice-${i}` }));
    const result = await fetchOfficeInvoices(tenantId, role); if (!result.ok) throw new Error(result.error);
    expect(result.data).toHaveLength(501); expect(state.reads.some(read => read.table === 'invoices' && read.from === 500)).toBe(true);
    expect(state.reads.every(read => read.filters.tenant_id === tenantId)).toBe(true);
  });
  it('fails instead of returning a partial financial list when a later page fails', async () => {
    seedInvoice(); const base = state.rows.invoices[0]; state.rows.invoices = Array.from({ length: 501 }, (_, i) => ({ ...base, id: `invoice-${i}` }));
    state.errors['invoices:500'] = { message: 'Spätere Seite nicht erreichbar' };
    expect(await fetchOfficeInvoices(tenantId, role)).toEqual({ ok: false, error: 'Spätere Seite nicht erreichbar' });
  });
  it('does not swallow recipient or position enrichment errors', async () => {
    seedInvoice(); state.errors.clients = { message: 'Klienten fehlen' }; expect(await fetchOfficeInvoices(tenantId, role)).toEqual({ ok: false, error: 'Klienten fehlen' });
    state.errors = { invoice_items: { message: 'Positionen fehlen' } }; expect(await fetchOfficeInvoices(tenantId, role)).toEqual({ ok: false, error: 'Positionen fehlen' });
  });
  it('rejects foreign tenant rows even if a query implementation returns them', async () => {
    seedInvoice({ tenant_id: 'foreign' }); state.ignoreFilters = true;
    const result = await fetchOfficeInvoices(tenantId, role); expect(result.ok).toBe(false);
  });
  it('flags mismatched line totals and ledger balances', async () => {
    seedInvoice({ total_amount: 45, paid_amount: 10, open_amount: 40 });
    const result = await fetchOfficeInvoices(tenantId, role); if (!result.ok) throw new Error(result.error);
    expect(result.data[0].issues.join(' ')).toMatch(/Zahlungen.*Positionssumme/);
  });
  it('flags impossible dates, invalid VAT, and paid states with an open balance', async () => {
    seedInvoice({ status: 'paid', invoice_date: '2026-02-30', due_date: '2026-02-29', service_period_from: '2026-11-01', service_period_to: '2026-10-01' });
    state.rows.invoice_items[0].vat_rate = null;
    const result = await fetchOfficeInvoices(tenantId, role); if (!result.ok) throw new Error(result.error);
    expect(result.data[0].issues.join(' ')).toMatch(/als bezahlt.*ungültige Beträge.*Rechnungsdatum.*Fälligkeitsdatum.*Leistungszeitraum/);
  });
  it('never substitutes a client home address for a missing issued payer snapshot', async () => {
    seedInvoice({ status: 'sent', recipient_name: null });
    const result = await fetchOfficeInvoices(tenantId, role); if (!result.ok) throw new Error(result.error);
    expect(result.data[0].recipient.name).toBe(''); expect(result.data[0].recipient.street).toBe('');
    expect(result.data[0].clientName).toBe('Ada Muster');
  });
  it('uses issued customer snapshots and does not require live client/source permissions to display them', async () => {
    seedInvoice({ status: 'sent', customer_snapshot: { id: clientId, name: 'Gespeicherter Name', clientNumber: 'ALT-1', insuranceNumber: 'A12345' } });
    state.rows.invoice_items[0].service_record_id = clientId;
    state.errors.clients = { message: 'Aktuelle Klientenakte nicht sichtbar' }; state.errors.service_records = { message: 'Quelle gesperrt' };
    const result = await fetchOfficeInvoice(tenantId, invoiceId, role); if (!result.ok) throw new Error(result.error);
    expect(result.data.clientName).toBe('Gespeicherter Name'); expect(result.data.clientNumber).toBe('ALT-1'); expect(result.data.insuranceNumber).toBe('A12345');
    expect(state.reads.some(read => ['clients', 'service_records'].includes(read.table))).toBe(false);
  });
  it('loads current source versions for safely editing linked drafts', async () => {
    seedInvoice(); state.rows.invoice_items[0].service_record_id = clientId; state.rows.service_records = [{ id: clientId, tenant_id: tenantId, updated_at: updatedAt }];
    const result = await fetchOfficeInvoice(tenantId, invoiceId, role); if (!result.ok) throw new Error(result.error);
    expect(result.data.lines[0].sourceUpdatedAt).toBe(updatedAt);
  });
  it('does not read without permission, without tenant scope, or on a demo connection', async () => {
    state.roleDenied = true; expect((await fetchOfficeInvoices(tenantId, role)).ok).toBe(false);
    state.roleDenied = false; state.tenantDenied = true; expect((await fetchOfficeInvoices(tenantId, role)).ok).toBe(false);
    state.tenantDenied = false; state.live = false; expect((await fetchOfficeInvoices(tenantId, role)).ok).toBe(false); expect(state.reads).toHaveLength(0);
  });
  it('reports a missing invoice instead of a successful empty detail', async () => {
    const result = await fetchOfficeInvoice(tenantId, invoiceId, role); expect(result.ok).toBe(false);
  });
  it('blocks catalog ambiguity instead of arbitrarily choosing a default price', async () => {
    state.rows.tenant_service_catalog = [{ id: 'catalog-1', tenant_id: tenantId, name: 'Leistung', unit: 'hour', module_key: 'assist', category: 'service', is_active: true }];
    state.rows.tenant_service_prices = ['p1', 'p2'].map(id => ({ id, tenant_id: tenantId, catalog_id: 'catalog-1', is_default: true, valid_from: '2020-01-01', valid_to: null, price_net: 20, tax_rate: 0 }));
    const result = await fetchOfficeInvoiceEditorOptions(tenantId, role); expect(result.ok).toBe(false); if (!result.ok) expect(result.error).toContain('mehrere aktuelle Standardpreise');
  });
});
describe('Office invoice atomic mutation contract', () => {
  it('sends all positions and recipient fields in one save operation with idempotency', async () => {
    const result = await saveOfficeInvoiceDraft(tenantId, draft(), role); expect(result).toEqual({ ok: true, data: { id: invoiceId, updatedAt } });
    expect(state.rpcCalls).toHaveLength(1); expect(state.rpcCalls[0]).toMatchObject({ name: 'office_invoice_mutation', payload: {
      p_tenant_id: tenantId, p_request_id: requestId, p_invoice_id: null, p_expected_updated_at: null, p_operation: 'save_draft',
      p_payload: { client_id: clientId, invoice_number: '', recipient_type: 'client', billing_party: 'self_payer', include_service_proofs: false, selected_proof_ids: [], lines: [{ quantity: 2, unit_price_cents: 2000 }] },
    } });
  });
  it('sends the exact version when editing and deleting, without pre-releasing service records', async () => {
    await saveOfficeInvoiceDraft(tenantId, draft({ id: invoiceId, expectedUpdatedAt: updatedAt }), role);
    await deleteOfficeInvoiceDraft(tenantId, invoiceId, updatedAt, requestId, role);
    expect(state.rpcCalls.map(call => call.payload.p_expected_updated_at)).toEqual([updatedAt, updatedAt]);
    expect(state.rpcCalls[1].payload.p_operation).toBe('delete_draft'); expect(state.reads).toHaveLength(0);
  });
  it('does not send invalid draft values or denied actions to the database', async () => {
    expect((await saveOfficeInvoiceDraft(tenantId, draft({ lines: [] }), role)).ok).toBe(false);
    state.roleDenied = true; expect((await deleteOfficeInvoiceDraft(tenantId, invoiceId, updatedAt, requestId, role)).ok).toBe(false);
    expect(state.rpcCalls).toHaveLength(0);
  });
  it('propagates stale-source conflicts and does not fall back to non-atomic writes', async () => {
    state.rpcError = { message: 'Der Leistungsnachweis wurde bereits abgerechnet.', code: '40001' };
    expect(await saveOfficeInvoiceDraft(tenantId, draft(), role)).toEqual({ ok: false, error: 'Der Leistungsnachweis wurde bereits abgerechnet.' });
    expect(state.rpcCalls).toHaveLength(1);
  });
  it('does not show success for absent, malformed, or wrong-invoice mutation receipts', async () => {
    for (const data of [null, {}, { invoice_id: clientId, updated_at: updatedAt }, { invoice_id: invoiceId, updated_at: '' }]) {
      state.rpcData = data; expect((await deleteOfficeInvoiceDraft(tenantId, invoiceId, updatedAt, requestId, role)).ok).toBe(false);
    }
  });
  it('explains uncertain network results without claiming a write failed or retrying with a new ID', async () => {
    state.rpcThrow = true; const result = await saveOfficeInvoiceDraft(tenantId, draft(), role);
    expect(result.ok).toBe(false); if (!result.ok) expect(result.error).toContain('gespeicherten Stand prüfen'); expect(state.rpcCalls).toHaveLength(1);
  });
  it('never marks ready with the generic status action or paid without an actual payment', async () => {
    expect((await transitionOfficeInvoice(tenantId, invoiceId, updatedAt, 'ready', '', requestId, role)).ok).toBe(false);
    expect((await transitionOfficeInvoice(tenantId, invoiceId, updatedAt, 'paid' as 'ready', '', requestId, role)).ok).toBe(false); expect(state.rpcCalls).toHaveLength(0);
  });
  it('requires recorded evidence for an externally completed delivery', async () => {
    expect((await transitionOfficeInvoice(tenantId, invoiceId, updatedAt, 'sent', '', requestId, role)).ok).toBe(false);
    expect((await transitionOfficeInvoice(tenantId, invoiceId, updatedAt, 'sent', '', requestId, role, { channel: 'post', date: '2026-10-18', reference: 'Einlieferungsbeleg 42' })).ok).toBe(true);
    expect(state.rpcCalls[0].payload.p_payload).toMatchObject({ status: 'sent', delivery_channel: 'post', delivery_reference: 'Einlieferungsbeleg 42' });
  });
  it('requires a cancellation reason before any mutation', async () => {
    expect((await transitionOfficeInvoice(tenantId, invoiceId, updatedAt, 'cancelled', '', requestId, role)).ok).toBe(false); expect(state.rpcCalls).toHaveLength(0);
  });
  it('records a positive real payment with method/date/reference as one operation', async () => {
    expect((await recordOfficeInvoicePayment(tenantId, invoiceId, updatedAt, payment(), role)).ok).toBe(true);
    expect(state.rpcCalls[0].payload).toMatchObject({ p_operation: 'record_payment', p_payload: { amount_cents: 1000, payment_method: 'bank_transfer', reference: 'Kontoauszug 18.10.2026' } });
  });
  it('rejects zero/future/unreferenced payment entries', async () => {
    for (const input of [payment({ amountCents: 0 }), payment({ paymentDate: '2999-01-01' }), payment({ reference: '' })]) expect((await recordOfficeInvoicePayment(tenantId, invoiceId, updatedAt, input, role)).ok).toBe(false);
    expect(state.rpcCalls).toHaveLength(0);
  });
  it('returns the authoritative proposed number and company snapshot without issuing', async () => {
    state.rpcData = { invoice_number: 'RE-2026-42', company_snapshot: { legalName: 'Firma' }, source_revision: 'revision-42' };
    const result = await fetchOfficeInvoiceIssuePreview(tenantId, invoiceId, updatedAt, role);
    expect(result).toEqual({ ok: true, data: { invoiceNumber: 'RE-2026-42', companySnapshot: { legalName: 'Firma' }, sourceRevision: 'revision-42' } });
    expect(state.rpcCalls[0].name).toBe('office_invoice_issue_preview');
  });
  it('finalizes only with archived PDF, hash, and revision', async () => {
    const input = { requestId, invoiceNumber: 'RE-2026-42', companySnapshot: { legalName: 'Firma' }, sourceRevision: 'revision-42', pdfFilePath: `${tenantId}/${invoiceId}.pdf`, pdfSha256: 'a'.repeat(64) };
    expect((await finalizeOfficeInvoiceIssue(tenantId, invoiceId, updatedAt, { ...input, pdfSha256: '' }, role)).ok).toBe(false);
    expect((await finalizeOfficeInvoiceIssue(tenantId, invoiceId, updatedAt, input, role)).ok).toBe(true);
    expect(state.rpcCalls[0].payload.p_payload).toMatchObject({ status: 'ready', invoice_number: 'RE-2026-42', source_revision: 'revision-42', pdf_sha256: 'a'.repeat(64) });
  });
});
