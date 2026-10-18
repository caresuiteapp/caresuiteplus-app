import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash, webcrypto } from 'node:crypto';
import type { OfficeInvoice } from '@/lib/office/invoiceWorkspaceTypes.web';

const f = vi.hoisted(() => ({ fresh: vi.fn(), preview: vi.fn(), proof: vi.fn(), prepare: vi.fn(), rpc: vi.fn(), denied: false, tenantDenied: false, connected: true }));
vi.mock('@/lib/permissions', () => ({ enforcePermission: () => f.denied ? { ok: false, error: 'Zugriff verweigert' } : null }));
vi.mock('@/lib/services/liveServiceGuard', () => ({ guardServiceTenant: () => f.tenantDenied ? { ok: false, error: 'Falscher Mandant' } : null }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => f.connected ? { rpc: f.rpc } : null }));
vi.mock('@/lib/office/invoiceWorkspaceService.web', () => ({ fetchOfficeInvoice: f.fresh, fetchOfficeInvoiceIssuePreview: f.preview }));
vi.mock('@/lib/office/invoiceProofAttachments.web', () => ({ downloadInvoiceProofAttachment: f.proof }));
vi.mock('@/lib/office/eInvoiceUbl.web', () => ({ prepareOfficeInvoiceUbl: f.prepare }));
import { downloadOfficeIssuedEInvoice, prepareOfficeEInvoiceDraft } from '@/lib/office/eInvoiceExportService.web';
import { createEmptyOfficeEInvoiceMetadata } from '@/lib/office/eInvoiceModel.web';

const tenantId = '11111111-1111-4111-8111-111111111111';
const invoiceId = '22222222-2222-4222-8222-222222222222';
const clientId = '33333333-3333-4333-8333-333333333333';
const otherId = '44444444-4444-4444-8444-444444444444';
const updatedAt = '2026-10-18T09:00:00.000Z';
const role = 'business_admin' as const;
const xml = '<?xml version="1.0"?><test>ä &amp; €</test>\r\n';
const bytes = new TextEncoder().encode(xml);
const hash = (data: Uint8Array) => createHash('sha256').update(data).digest('hex');
function invoice(extra: Partial<OfficeInvoice> = {}): OfficeInvoice {
  return { id: invoiceId, tenantId, clientId, clientName: 'Fiktive Testperson', clientNumber: 'TEST-K1', insuranceNumber: '', invoiceNumber: '', status: 'draft', invoiceDate: '2026-10-18', dueDate: '2026-11-01', servicePeriodStart: '2026-10-01', servicePeriodEnd: '2026-10-31', amountCents: 11900, paidCents: 0, openCents: 11900, billingModule: 'assist', updatedAt, createdAt: updatedAt,
    recipient: { name: 'Fiktives Testunternehmen', street: 'Teststraße', houseNumber: '1', postalCode: '12345', city: 'Teststadt', country: 'Deutschland', email: 'test@example.invalid' }, recipientType: 'company', billingParty: 'self_payer', officeManaged: true, notes: '', footerText: '', includeProofs: false, selectedProofIds: [],
    lines: [{ id: 'line-1', description: 'Testleistung', quantity: 1, unit: 'hour', unitPriceCents: 10000, taxRatePercent: 19, productKey: 'assist', netCents: 10000, taxCents: 1900, totalCents: 11900 }], issues: [], pdfFilePath: null, cancellationReason: null, companySnapshot: null,
    eInvoice: { ...createEmptyOfficeEInvoiceMetadata(), format: 'xrechnung' }, ...extra };
}
const issuePreview = { invoiceNumber: 'TEST-2026-1', sourceRevision: 'revision-1', companySnapshot: { legalName: 'Fiktiver Testbetrieb' } };
function artifact(data = bytes, overrides: Record<string, unknown> = {}) {
  const sha256 = hash(data);
  return { file_name: 'TEST-2026-1.xml', xml_base64: Buffer.from(data).toString('base64'), xml_sha256: sha256,
    report: { status: 'valid', source: 'server', documentSha256: sha256 }, ...overrides };
}
beforeEach(() => {
  f.fresh.mockReset(); f.preview.mockReset(); f.proof.mockReset(); f.prepare.mockReset(); f.rpc.mockReset();
  f.denied = false; f.tenantDenied = false; f.connected = true; vi.stubGlobal('crypto', webcrypto);
  f.fresh.mockResolvedValue({ ok: true, data: invoice() }); f.preview.mockResolvedValue({ ok: true, data: issuePreview });
  f.proof.mockResolvedValue({ ok: true, data: { bytes: new Uint8Array([37, 80, 68, 70, 10, 255, 0]), fileName: 'Leistungsnachweis.pdf' } });
  f.prepare.mockReturnValue({ xml, bytes, fileName: 'TEST-2026-1.xml', validation: { message: 'Lokaler Entwurf, noch keine Serverfreigabe.' } });
  f.rpc.mockResolvedValue({ data: artifact(), error: null });
});

describe('XML-Entwurf: konsistente Rechnungsgrundlage und unveränderte Anlagen', () => {
  it('uses the fresh saved invoice and stable issue preview, and hashes exactly the prepared XML bytes', async () => {
    const source = invoice(); const result = await prepareOfficeEInvoiceDraft(tenantId, source, role);
    expect(result.ok).toBe(true); if (!result.ok) return;
    expect(result.data.xml).toBe(xml); expect(result.data.sha256).toBe(hash(bytes));
    expect(f.fresh).toHaveBeenCalledWith(tenantId, invoiceId, role);
    expect(f.preview).toHaveBeenCalledTimes(2);
    expect(f.prepare).toHaveBeenCalledWith(source, issuePreview, source.eInvoice, []);
    expect(f.rpc).not.toHaveBeenCalled(); expect(f.proof).not.toHaveBeenCalled();
  });
  it('does not prepare a foreign, issued or unmanaged invoice', async () => {
    for (const source of [invoice({ tenantId: otherId }), invoice({ status: 'sent' }), invoice({ officeManaged: false })]) {
      expect((await prepareOfficeEInvoiceDraft(tenantId, source, role)).ok).toBe(false);
    }
    expect(f.fresh).not.toHaveBeenCalled(); expect(f.prepare).not.toHaveBeenCalled();
  });
  it('rejects fresh data for another tenant, another invoice or an unmanaged document', async () => {
    for (const fresh of [invoice({ tenantId: otherId }), invoice({ id: otherId }), invoice({ officeManaged: false })]) {
      f.fresh.mockResolvedValue({ ok: true, data: fresh });
      expect((await prepareOfficeEInvoiceDraft(tenantId, invoice(), role)).ok).toBe(false);
    }
    expect(f.prepare).not.toHaveBeenCalled();
  });
  it('stops before rendering when the invoice version, state or selected format changed', async () => {
    for (const fresh of [invoice({ updatedAt: '2026-10-18T10:00:00Z' }), invoice({ status: 'sent' }), invoice({ eInvoice: { ...createEmptyOfficeEInvoiceMetadata(), format: 'pdf' } })]) {
      f.fresh.mockResolvedValue({ ok: true, data: fresh }); expect((await prepareOfficeEInvoiceDraft(tenantId, invoice(), role)).ok).toBe(false);
    }
    expect(f.prepare).not.toHaveBeenCalled();
  });
  it('propagates a failed current read instead of using stale screen data', async () => {
    f.fresh.mockResolvedValue({ ok: false, error: 'Keine Berechtigung' });
    expect(await prepareOfficeEInvoiceDraft(tenantId, invoice(), role)).toEqual({ ok: false, error: 'Keine Berechtigung' });
    expect(f.preview).not.toHaveBeenCalled(); expect(f.prepare).not.toHaveBeenCalled();
  });
  it('rejects changed source revisions and invoice numbers after preparation', async () => {
    for (const current of [{ ...issuePreview, sourceRevision: 'revision-2' }, { ...issuePreview, invoiceNumber: 'TEST-2026-2' }]) {
      f.preview.mockReset().mockResolvedValueOnce({ ok: true, data: issuePreview }).mockResolvedValueOnce({ ok: true, data: current });
      const result = await prepareOfficeEInvoiceDraft(tenantId, invoice(), role);
      expect(result.ok).toBe(false); if (!result.ok) expect(result.error).toContain('während der Vorschau geändert');
    }
  });
  it('rejects a second preflight failure even when XML has already been created', async () => {
    f.preview.mockResolvedValueOnce({ ok: true, data: issuePreview }).mockResolvedValueOnce({ ok: false, error: 'Rechnung zwischenzeitlich geändert' });
    expect(await prepareOfficeEInvoiceDraft(tenantId, invoice(), role)).toEqual({ ok: false, error: 'Rechnung zwischenzeitlich geändert' });
  });
  it('embeds only explicitly selected proof originals byte for byte', async () => {
    const proofIds = [`record:${clientId}`, `record:${otherId}`]; const source = invoice({ includeProofs: true, selectedProofIds: proofIds });
    f.fresh.mockResolvedValue({ ok: true, data: source });
    const result = await prepareOfficeEInvoiceDraft(tenantId, source, role); expect(result.ok).toBe(true);
    expect(f.proof).toHaveBeenCalledTimes(2);
    for (const [index, id] of proofIds.entries()) expect(f.proof.mock.calls[index]).toEqual([tenantId, clientId, '2026-10-01', '2026-10-31', role, id, invoiceId]);
    const attachments = f.prepare.mock.calls[0][3]; expect(attachments).toHaveLength(2);
    expect(attachments[0].mimeType).toBe('application/pdf');
    expect(Buffer.from(attachments[0].base64, 'base64')).toEqual(Buffer.from([37, 80, 68, 70, 10, 255, 0]));
  });
  it('does not silently omit a failed selected proof', async () => {
    const source = invoice({ includeProofs: true, selectedProofIds: [`record:${clientId}`] }); f.fresh.mockResolvedValue({ ok: true, data: source });
    f.proof.mockResolvedValue({ ok: false, error: 'Originalnachweis fehlt' });
    expect(await prepareOfficeEInvoiceDraft(tenantId, source, role)).toEqual({ ok: false, error: 'Originalnachweis fehlt' });
    expect(f.prepare).not.toHaveBeenCalled();
  });
  it('does not embed stale selected proof IDs when attachments are disabled', async () => {
    const source = invoice({ includeProofs: false, selectedProofIds: [`record:${clientId}`] }); f.fresh.mockResolvedValue({ ok: true, data: source });
    expect((await prepareOfficeEInvoiceDraft(tenantId, source, role)).ok).toBe(true); expect(f.proof).not.toHaveBeenCalled();
  });
});

describe('Ausgestellte XML: ausschließlich gespeichertes Original', () => {
  it('loads the tenant-scoped immutable artifact without regenerating from current data', async () => {
    const result = await downloadOfficeIssuedEInvoice(tenantId, invoiceId, role);
    expect(result.ok).toBe(true); if (result.ok) { expect(result.data.bytes).toEqual(bytes); expect(result.data.fileName).toBe('TEST-2026-1.xml'); }
    expect(f.rpc).toHaveBeenCalledWith('office_einvoice_artifact_read', { p_tenant_id: tenantId, p_invoice_id: invoiceId });
    expect(f.fresh).not.toHaveBeenCalled(); expect(f.preview).not.toHaveBeenCalled(); expect(f.prepare).not.toHaveBeenCalled(); expect(f.proof).not.toHaveBeenCalled();
  });
  it('refuses damaged bytes and reports not bound to the exact archived hash', async () => {
    for (const data of [artifact(bytes, { xml_base64: Buffer.from('changed').toString('base64') }), artifact(bytes, { report: { status: 'valid', source: 'server', documentSha256: '0'.repeat(64) } }), artifact(bytes, { report: { status: 'valid', source: 'browser', documentSha256: hash(bytes) } }), artifact(bytes, { report: null }), artifact(bytes, { report: { status: 'invalid', source: 'server', documentSha256: hash(bytes) } })]) {
      f.rpc.mockResolvedValue({ data, error: null }); expect((await downloadOfficeIssuedEInvoice(tenantId, invoiceId, role)).ok).toBe(false);
    }
  });
  it('accepts a 4 MiB XML artifact within the 5 MiB decoded limit', async () => {
    const large = new Uint8Array(4 * 1024 * 1024).fill(32); large.set(new TextEncoder().encode('<test/>'));
    f.rpc.mockResolvedValue({ data: artifact(large), error: null });
    const result = await downloadOfficeIssuedEInvoice(tenantId, invoiceId, role);
    expect(result.ok).toBe(true); if (result.ok) { expect(result.data.bytes.byteLength).toBe(large.byteLength); expect(hash(result.data.bytes)).toBe(hash(large)); }
  });
  it('rejects malformed archives and a decoded XML beyond the file limit', async () => {
    const oversized = new Uint8Array(5 * 1024 * 1024 + 1).fill(32);
    for (const data of [null, {}, artifact(bytes, { xml_base64: '<not-base64>' }), artifact(oversized)]) {
      f.rpc.mockResolvedValue({ data, error: null }); expect((await downloadOfficeIssuedEInvoice(tenantId, invoiceId, role)).ok).toBe(false);
    }
  });
  it('blocks missing permissions, tenant mismatch and malformed invoice IDs before reading', async () => {
    f.denied = true; expect((await downloadOfficeIssuedEInvoice(tenantId, invoiceId, role)).ok).toBe(false);
    f.denied = false; f.tenantDenied = true; expect((await downloadOfficeIssuedEInvoice(tenantId, invoiceId, role)).ok).toBe(false);
    f.tenantDenied = false; expect((await downloadOfficeIssuedEInvoice(tenantId, 'invalid', role)).ok).toBe(false);
    expect(f.rpc).not.toHaveBeenCalled();
  });
  it('propagates archive read errors without generating replacement XML', async () => {
    f.rpc.mockResolvedValue({ data: null, error: { message: 'Archiv nicht erreichbar' } });
    expect(await downloadOfficeIssuedEInvoice(tenantId, invoiceId, role)).toEqual({ ok: false, error: 'Archiv nicht erreichbar' });
    expect(f.prepare).not.toHaveBeenCalled(); expect(f.fresh).not.toHaveBeenCalled();
  });
});
