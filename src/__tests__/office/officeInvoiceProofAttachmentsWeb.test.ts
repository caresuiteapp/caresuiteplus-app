import { beforeEach, describe, expect, it, vi } from 'vitest';
const f = vi.hoisted(() => ({ rows: [] as Record<string, unknown>[], error: null as { message: string } | null, download: vi.fn(), scopes: [] as Array<[string, unknown]> }));
vi.mock('@/lib/permissions', () => ({ enforcePermission: (role: string) => role === 'denied' ? { ok: false, error: 'Kein Zugriff.' } : null }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => ({ storage: { from: () => ({ download: f.download }) } }) }));
vi.mock('@/lib/supabase/untypedTable', () => ({ fromUnknownTable: () => {
  const chain: Record<string, unknown> = {};
  for (const method of ['select', 'order']) chain[method] = () => chain;
  for (const method of ['eq', 'gte', 'lte']) chain[method] = (column: string, value: unknown) => { f.scopes.push([column, value]); return chain; };
  chain.range = () => Promise.resolve({ data: f.rows, error: f.error, count: f.rows.length });
  return chain;
} }));
import { downloadInvoiceProofAttachment, listInvoiceProofAttachments, loadInvoiceProofPages, validateInvoicePdfBytes } from '@/lib/office/invoiceProofAttachments.web';

const tenant = '11111111-1111-4111-8111-111111111111', client = '22222222-2222-4222-8222-222222222222';
const source = () => ({ id: '33333333-3333-4333-8333-333333333333', tenant_id: tenant, client_id: client, record_number: 'LN-1', service_date: '2026-10-17',
  status: 'billable', pdf_url: `tenant/${tenant}/proofs/one.pdf`, source_receipt: {}, billed_invoice_id: null });
const input = () => ({ tenantId: tenant, clientId: client, start: '2026-10-01', end: '2026-10-31', invoiceId: 'invoice-1', proofIds: [`record:${source().id}`], actorRoleKey: 'business_admin' as const });
beforeEach(() => { vi.clearAllMocks(); f.rows = [source()]; f.error = null; f.scopes = []; });
describe('Invoice proof attachments retain source identity', () => {
  it('lists only tenant/client/period scoped original PDFs and omits private storage keys', async () => {
    const result = await listInvoiceProofAttachments(tenant, client, '2026-10-01', '2026-10-31', 'business_admin');
    expect(result.ok && result.data[0]).toMatchObject({ id: `record:${source().id}`, available: true });
    expect(result.ok && result.data[0]).not.toHaveProperty('storagePath');
    expect(f.scopes).toEqual(expect.arrayContaining([['tenant_id', tenant], ['client_id', client], ['service_date', '2026-10-01'], ['service_date', '2026-10-31']]));
    expect(f.download).not.toHaveBeenCalled();
  });
  it('does not mark an unsigned record or a record without stored PDF as available', async () => {
    f.rows = [{ ...source(), status: 'draft' }, { ...source(), id: 'second', pdf_url: null }];
    const result = await listInvoiceProofAttachments(tenant, client, '2026-10-01', '2026-10-31', 'business_admin');
    expect(result.ok && result.data.every(row => !row.available)).toBe(true);
  });
  it('rejects cross-tenant, traversal and unrelated invoiced sources before download', async () => {
    f.rows = [{ ...source(), tenant_id: 'other' }];
    await expect(loadInvoiceProofPages(input())).rejects.toThrow('Zuordnung');
    f.rows = [{ ...source(), pdf_url: `tenant/${tenant}/../other/one.pdf` }];
    await expect(loadInvoiceProofPages(input())).rejects.toThrow('ungültig');
    f.rows = [{ ...source(), billed_invoice_id: 'another-invoice' }];
    await expect(loadInvoiceProofPages(input())).rejects.toThrow('anderen Rechnung');
    expect(f.download).not.toHaveBeenCalled();
  });
  it('does not substitute another proof when a selected record disappeared', async () => {
    f.rows = [];
    await expect(loadInvoiceProofPages(input())).rejects.toThrow('nicht mehr');
    expect(f.download).not.toHaveBeenCalled();
  });
  it('propagates unavailable original files rather than silently dropping annexes', async () => {
    f.download.mockResolvedValue({ data: null, error: { message: 'RLS' } });
    await expect(loadInvoiceProofPages(input())).rejects.toThrow('nicht zugänglich');
  });
  it('returns the exact original bytes when downloaded separately', async () => {
    const bytes = new TextEncoder().encode('%PDF-1.7\noriginal signature bytes');
    f.download.mockResolvedValue({ data: new Blob([bytes], { type: 'application/pdf' }), error: null });
    const result = await downloadInvoiceProofAttachment(tenant, client, '2026-10-01', '2026-10-31', 'business_admin', `record:${source().id}`);
    expect(result.ok && result.data.bytes).toEqual(bytes);
  });
  it('verifies signed source hashes and rejects non-PDF content', async () => {
    await expect(validateInvoicePdfBytes(new TextEncoder().encode('<html>denied</html>'))).rejects.toThrow('keine gültige PDF');
    await expect(validateInvoicePdfBytes(new TextEncoder().encode('%PDF-1.7\nchanged'), 'sha256:' + '0'.repeat(64))).rejects.toThrow('stimmt nicht');
  });
  it('makes an invoice with no attachments independent of proof-table availability', async () => {
    f.error = { message: 'not available' };
    expect(await loadInvoiceProofPages({ ...input(), proofIds: [] })).toEqual([]);
    expect(f.scopes).toEqual([]);
  });
});
