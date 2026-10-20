import { beforeEach, describe, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import type { OfficeInvoice } from '@/lib/office/invoiceWorkspaceTypes.web';
import { createEmptyOfficeEInvoiceMetadata } from '@/lib/office/eInvoiceModel.web';
const f = vi.hoisted(() => ({ fresh: vi.fn(), preview: vi.fn(), finalize: vi.fn(), render: vi.fn(), upload: vi.fn(), annex: vi.fn(), actor: vi.fn(), calls: [] as string[] }));
vi.mock('@/lib/permissions', () => ({ enforcePermission: (role: string) => role === 'denied' ? { ok: false, error: 'Kein Zugriff.' } : null }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => ({ auth: { getUser: f.actor } }) }));
vi.mock('@/lib/supabase/edgeFunctions', () => ({ invokeEdgeFunction: f.upload }));
vi.mock('@/lib/office/invoiceWorkspaceService.web', () => ({ fetchOfficeInvoice: f.fresh, fetchOfficeInvoiceIssuePreview: f.preview, finalizeOfficeInvoiceIssue: f.finalize }));
vi.mock('@/lib/office/invoiceProofAttachments.web', () => ({ loadInvoiceProofPages: f.annex }));
vi.mock('@/lib/office/invoicePdfService.web', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/office/invoicePdfService.web')>();
  return { generateInvoicePdf: f.render, normalizeInvoiceCompanySnapshot: (value: unknown) => value,
    officeInvoiceToPdfInvoice: actual.officeInvoiceToPdfInvoice,
    hasInvoicePdfZeroTaxReasons: actual.hasInvoicePdfZeroTaxReasons,
    validateInvoicePdf: () => ({ errors: [], warnings: [] }) };
});
import { issueOfficeInvoicePdf } from '@/lib/office/invoiceIssuePdf.web';

let sequence = 0;
function invoice(): OfficeInvoice {
  sequence++;
  return { id: `11111111-1111-4111-8111-${String(sequence).padStart(12, '0')}`, tenantId: '22222222-2222-4222-8222-222222222222', clientId: '33333333-3333-4333-8333-333333333333',
    clientName: 'Testperson', clientNumber: 'K-1', insuranceNumber: '', invoiceNumber: '', status: 'draft', invoiceDate: '2026-10-18', dueDate: '2026-10-31', servicePeriodStart: '2026-10-01', servicePeriodEnd: '2026-10-31',
    amountCents: 3275, paidCents: 0, openCents: 3275, billingModule: 'assist', updatedAt: '2026-10-18T08:00:00Z', createdAt: '2026-10-18T08:00:00Z',
    recipient: { name: 'Testperson', street: 'Weg', houseNumber: '1', postalCode: '44623', city: 'Herne', country: 'Deutschland', email: '' },
    recipientType: 'client', billingParty: 'self_payer', officeManaged: true, notes: null, footerText: 'Bestätigter Steuerhinweis', includeProofs: false, selectedProofIds: [],
    lines: [{ id: 'line-1', description: 'Leistung', quantity: 1, unit: 'hour', unitPriceCents: 3275, taxRatePercent: 0, productKey: 'assist', netCents: 3275, taxCents: 0, totalCents: 3275 }],
    issues: [], pdfFilePath: null, cancellationReason: null, companySnapshot: null };
}
beforeEach(() => {
  vi.clearAllMocks(); vi.stubGlobal('crypto', webcrypto); f.calls = [];
  f.actor.mockResolvedValue({ data: { user: { id: 'actor-1' } }, error: null });
  f.preview.mockImplementation(async () => { f.calls.push('preflight'); return { ok: true, data: { invoiceNumber: 'RE-100', sourceRevision: 'revision-1', companySnapshot: { legalName: 'Frozen company' } } }; });
  f.annex.mockResolvedValue([]);
  f.render.mockImplementation(async () => { f.calls.push('render'); return { bytes: new TextEncoder().encode('%PDF-1.7\nfinal'), fileName: 'final.pdf', validation: { errors: [], warnings: [] } }; });
  f.upload.mockImplementation(async (_name: string, input: { tenantId: string; documentId: string; pdfBase64: string }) => {
    f.calls.push('upload'); const digest = await webcrypto.subtle.digest('SHA-256', Uint8Array.from(atob(input.pdfBase64), character => character.charCodeAt(0)));
    const hash = Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
    return { ok: true, data: { pdfPath: `tenant/${input.tenantId}/generated/${input.documentId}/${hash}.pdf`, sha256: hash } };
  });
  f.finalize.mockImplementation(async (_tenant: string, id: string) => { f.calls.push('finalize'); return { ok: true, data: { id, updatedAt: 'new' } }; });
});
describe('Invoice issuance commits the exact prepared archive', () => {
  it('uses frozen preflight company and number, then uploads before atomic finalization', async () => {
    const source = invoice(); f.fresh.mockResolvedValue({ ok: true, data: source });
    const result = await issueOfficeInvoicePdf(source.tenantId, source, 'business_admin');
    expect(result.ok).toBe(true); expect(f.calls).toEqual(['preflight', 'render', 'upload', 'finalize']);
    expect(f.render).toHaveBeenCalledWith(expect.objectContaining({ invoice: expect.objectContaining({ invoiceNumber: 'RE-100', status: 'ready' }), company: { legalName: 'Frozen company' } }));
    expect(f.upload).toHaveBeenCalledWith('render-document-pdf', expect.objectContaining({ expectedUpdatedAt: source.updatedAt, documentId: `invoice-${source.id}`, storeOnly: true }));
    expect(source.invoiceNumber).toBe('');
  });
  it('does not issue if a draft changed before rendering', async () => {
    const source = invoice(); f.fresh.mockResolvedValue({ ok: true, data: { ...source, updatedAt: 'newer' } });
    expect((await issueOfficeInvoicePdf(source.tenantId, source, 'business_admin')).ok).toBe(false);
    expect(f.render).not.toHaveBeenCalled(); expect(f.finalize).not.toHaveBeenCalled();
  });
  it('does not finalize when the stored PDF checksum differs', async () => {
    const source = invoice(); f.fresh.mockResolvedValue({ ok: true, data: source });
    f.upload.mockResolvedValue({ ok: true, data: { pdfPath: 'wrong', sha256: 'wrong' } });
    expect((await issueOfficeInvoicePdf(source.tenantId, source, 'business_admin')).ok).toBe(false);
    expect(f.finalize).not.toHaveBeenCalled();
  });
  it('requires a tax reason and selected proofs when attachments are enabled', async () => {
    const source = invoice(); f.fresh.mockResolvedValue({ ok: true, data: { ...source, footerText: '' } });
    expect((await issueOfficeInvoicePdf(source.tenantId, source, 'business_admin')).ok).toBe(false);
    f.fresh.mockResolvedValue({ ok: true, data: { ...source, includeProofs: true } });
    expect((await issueOfficeInvoicePdf(source.tenantId, source, 'business_admin')).ok).toBe(false);
    expect(f.render).not.toHaveBeenCalled(); expect(f.upload).not.toHaveBeenCalled();
  });
  it('retries an ambiguous finalization with the same request and uploaded bytes', async () => {
    const source = invoice(); f.fresh.mockResolvedValue({ ok: true, data: source });
    f.finalize.mockResolvedValueOnce({ ok: false, error: 'Verbindungsunterbrechung' }).mockResolvedValueOnce({ ok: true, data: { id: source.id, updatedAt: 'new' } });
    expect((await issueOfficeInvoicePdf(source.tenantId, source, 'business_admin')).ok).toBe(false);
    expect((await issueOfficeInvoicePdf(source.tenantId, source, 'business_admin')).ok).toBe(true);
    expect(f.upload).toHaveBeenCalledTimes(1); expect(f.finalize.mock.calls[0][3]).toEqual(f.finalize.mock.calls[1][3]);
  });
  it('validates XRechnung before PDF and binds the exact XML receipt to finalization', async () => {
    const source = invoice(); source.eInvoice = { ...createEmptyOfficeEInvoiceMetadata(), format: 'xrechnung' };
    f.fresh.mockResolvedValue({ ok: true, data: source });
    const uploadPdf = f.upload.getMockImplementation()!;
    f.upload.mockImplementation(async (name: string, input: Record<string, unknown>) => {
      if (input.action === 'validate_einvoice_issue') {
        f.calls.push('validate-xml');
        return { ok: true, data: { invoiceId: source.id, xmlSha256: 'a'.repeat(64), invoiceNumber: 'RE-100', sourceRevision: 'revision-1' } };
      }
      return uploadPdf(name, input);
    });
    expect((await issueOfficeInvoicePdf(source.tenantId, source, 'business_admin')).ok).toBe(true);
    expect(f.calls).toEqual(['preflight', 'validate-xml', 'render', 'upload', 'finalize']);
    expect(f.finalize.mock.calls[0][3]).toMatchObject({ eInvoiceXmlSha256: 'a'.repeat(64), sourceRevision: 'revision-1', invoiceNumber: 'RE-100' });
  });
  it('does not render or issue when XML validation fails or belongs to a different revision', async () => {
    for (const checked of [{ ok: false, error: 'BR-CO-10: Die Summe stimmt nicht.' },
      { ok: true, data: { xmlSha256: 'a'.repeat(64), invoiceNumber: 'RE-100', sourceRevision: 'changed' } }]) {
      const source = invoice(); source.eInvoice = { ...createEmptyOfficeEInvoiceMetadata(), format: 'xrechnung' };
      f.fresh.mockResolvedValue({ ok: true, data: source }); f.upload.mockResolvedValue(checked);
      expect((await issueOfficeInvoicePdf(source.tenantId, source, 'business_admin')).ok).toBe(false);
      expect(f.render).not.toHaveBeenCalled(); expect(f.finalize).not.toHaveBeenCalled();
    }
  });
});
