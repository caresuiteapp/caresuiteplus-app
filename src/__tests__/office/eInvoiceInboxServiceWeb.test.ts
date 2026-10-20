import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash, webcrypto } from 'node:crypto';
import type { OfficeEInvoiceImportInspection, OfficeEInvoiceXmlPreview } from '@/lib/office/eInvoiceImport.web';

const f = vi.hoisted(() => ({ rpc: vi.fn(), edge: vi.fn(), denied: false, tenantDenied: false, connected: true, live: true, permissions: [] as string[] }));
vi.mock('@/lib/permissions', () => ({ enforcePermission: (_role: unknown, permission: string) => { f.permissions.push(permission); return f.denied ? { ok: false, error: 'Zugriff verweigert' } : null; } }));
vi.mock('@/lib/services/liveServiceGuard', () => ({ guardServiceTenant: () => f.tenantDenied ? { ok: false, error: 'Falscher Mandant' } : null }));
vi.mock('@/lib/services/mode', () => ({ getServiceMode: () => f.live ? 'supabase' : 'demo' }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => f.connected ? { rpc: f.rpc } : null }));
vi.mock('@/lib/supabase/edgeFunctions', () => ({ invokeEdgeFunction: f.edge }));
import { downloadOfficeEInvoiceOriginal, fetchOfficeEInvoiceInbox, reviewOfficeEInvoiceInbox, saveOfficeEInvoiceImport, validateOfficeEInvoiceInbox } from '@/lib/office/eInvoiceInboxService.web';

const tenantId = '11111111-1111-4111-8111-111111111111';
const documentId = '22222222-2222-4222-8222-222222222222';
const foreignTenantId = '33333333-3333-4333-8333-333333333333';
const updatedAt = '2026-10-18T09:00:00.000Z';
const role = 'business_admin' as const;
const original = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 55, 10, 0, 255, 128, 13, 10]);
const xml = new TextEncoder().encode('<?xml version="1.0"?><test>ä &amp; €</test>\r\n');
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const base64 = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64');
function preview(): OfficeEInvoiceXmlPreview {
  const party = { name: 'Fiktiver Testbetrieb', addressLines: ['Teststraße 1'], postalCode: '12345', city: 'Teststadt', country: 'DE', taxId: '', vatId: '', endpointId: 'test@example.invalid', endpointScheme: 'EM' };
  return { syntax: 'ubl_invoice', rootNamespace: 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2', profileId: 'urn:cen.eu:en16931:2017', profileLabel: 'EN 16931 (deklariert)', profileSupport: 'supported', processId: '', invoiceNumber: 'TEST-1', invoiceTypeCode: '380', issueDate: '2026-10-18', currency: 'EUR', seller: { ...party }, buyer: { ...party },
    dueDate: '2026-11-01', buyerReference: 'TEST', paymentReference: 'TEST-1',
    totals: { payable: '119.00', taxExclusive: '100.00', taxInclusive: '119.00', tax: '19.00' },
    lines: [{ id: '1', name: 'Testleistung', quantity: '100', unitCode: 'C62', unitPrice: '100.00', priceBaseQuantity: '100', priceBaseUnitCode: 'C62', lineTotal: '100.00', taxCategory: 'S', taxRate: '19' }], warnings: [] };
}
function inspection(): OfficeEInvoiceImportInspection {
  return { originalBytes: original.slice(), xmlBytes: xml.slice(), originalSha256: hash(original), xmlSha256: hash(xml), sourceKind: 'hybrid_pdf', originalFileName: 'test.pdf', xmlFileName: 'factur-x.xml', preview: preview(), warnings: [], extractionProvenance: { method: 'pdfjs_embedded_attachment', attachmentName: 'factur-x.xml', attachmentCount: 1, originalPreserved: true, containerConformityChecked: false } };
}
function rawRecord(overrides: Record<string, unknown> = {}) {
  const { originalBytes: _original, xmlBytes: _xml, ...metadata } = inspection();
  return { id: documentId, tenant_id: tenantId, created_at: updatedAt, updated_at: updatedAt, file_name: 'test.pdf', mime_type: 'application/pdf', original_sha256: hash(original), original_size: original.byteLength,
    extracted_xml_sha256: hash(xml), extracted_xml_size: xml.byteLength, inspection: metadata, business_status: 'unreviewed', review_note: '', format_status: 'pending_validation', validation_report: null,
    original_base64: base64(original), extracted_xml_base64: base64(xml), ...overrides };
}
function reply(items: unknown[], total = items.length) { return { data: { items, total }, error: null }; }
function idAt(index: number) { return `22222222-2222-4222-8222-${String(index).padStart(12, '0')}`; }

beforeEach(() => {
  f.rpc.mockReset(); f.edge.mockReset(); f.denied = false; f.tenantDenied = false; f.connected = true; f.live = true; f.permissions = [];
  vi.stubGlobal('crypto', webcrypto);
  f.rpc.mockResolvedValue(reply([rawRecord()]));
  f.edge.mockResolvedValue({ ok: true, data: { documentId } });
});

describe('E-Rechnungseingang: vollständige und mandantenbezogene Daten', () => {
  it('loads every page with an explicit tenant and never requests original bytes for the list', async () => {
    const entries = Array.from({ length: 101 }, (_, index) => rawRecord({ id: idAt(index) }));
    f.rpc.mockImplementation(async (_name: string, args: { p_offset: number }) => reply(entries.slice(args.p_offset, args.p_offset + 100), 101));
    const result = await fetchOfficeEInvoiceInbox(tenantId, role);
    expect(result.ok).toBe(true); if (!result.ok) return;
    expect(result.data).toHaveLength(101);
    expect(f.rpc).toHaveBeenCalledTimes(2);
    for (const [, payload] of f.rpc.mock.calls) expect(payload).toMatchObject({ p_tenant_id: tenantId, p_include_original: false });
  });
  it('fails instead of exposing a partial result after a later-page error', async () => {
    f.rpc.mockResolvedValueOnce(reply(Array.from({ length: 100 }, (_, index) => rawRecord({ id: idAt(index) })), 101));
    f.rpc.mockResolvedValueOnce({ data: null, error: { message: 'Seite 2 nicht erreichbar' } });
    expect(await fetchOfficeEInvoiceInbox(tenantId, role)).toEqual({ ok: false, error: 'Seite 2 nicht erreichbar' });
  });
  it('rejects inconsistent totals, short pages and duplicate records across pages', async () => {
    const page = Array.from({ length: 100 }, (_, index) => rawRecord({ id: idAt(index) }));
    for (const second of [reply([rawRecord()], 102), reply([], 101), reply([page[0]], 101)]) {
      f.rpc.mockReset().mockResolvedValueOnce(reply(page, 101)).mockResolvedValueOnce(second);
      expect((await fetchOfficeEInvoiceInbox(tenantId, role)).ok).toBe(false);
    }
  });
  it('rejects foreign-tenant rows even if a faulty transport returns them', async () => {
    f.rpc.mockResolvedValue(reply([rawRecord({ tenant_id: foreignTenantId })]));
    expect((await fetchOfficeEInvoiceInbox(tenantId, role)).ok).toBe(false);
    expect((await downloadOfficeEInvoiceOriginal(tenantId, documentId, 'original', role)).ok).toBe(false);
  });
  it('does not read with denied permissions, a blocked tenant, a demo connection or no database', async () => {
    f.denied = true; expect((await fetchOfficeEInvoiceInbox(tenantId, role)).ok).toBe(false);
    f.denied = false; f.tenantDenied = true; expect((await fetchOfficeEInvoiceInbox(tenantId, role)).ok).toBe(false);
    f.tenantDenied = false; f.live = false; expect((await fetchOfficeEInvoiceInbox(tenantId, role)).ok).toBe(false);
    f.live = true; f.connected = false; expect((await fetchOfficeEInvoiceInbox(tenantId, role)).ok).toBe(false);
    expect(f.rpc).not.toHaveBeenCalled();
  });
  it('rejects malformed required preview fields before React can receive them', async () => {
    const broken = [
      (p: OfficeEInvoiceXmlPreview) => { (p.seller as unknown as Record<string, unknown>).name = {}; },
      (p: OfficeEInvoiceXmlPreview) => { (p.buyer as unknown as Record<string, unknown>).addressLines = 'invalid'; },
      (p: OfficeEInvoiceXmlPreview) => { (p.totals as unknown as Record<string, unknown>).payable = {}; },
      (p: OfficeEInvoiceXmlPreview) => { (p.lines[0] as unknown as Record<string, unknown>).name = {}; },
      (p: OfficeEInvoiceXmlPreview) => { (p as unknown as Record<string, unknown>).warnings = [{}]; },
    ];
    for (const corrupt of broken) {
      const record = rawRecord(); corrupt(record.inspection.preview); f.rpc.mockResolvedValue(reply([record]));
      expect((await fetchOfficeEInvoiceInbox(tenantId, role)).ok).toBe(false);
    }
  });
  it.each(['dueDate', 'buyerReference', 'paymentReference'])('rejects a non-string optional %s before display', async key => {
    const record = rawRecord(); (record.inspection.preview as unknown as Record<string, unknown>)[key] = { invalid: true };
    f.rpc.mockResolvedValue(reply([record])); expect((await fetchOfficeEInvoiceInbox(tenantId, role)).ok).toBe(false);
  });
  it.each(['priceBaseQuantity', 'priceBaseUnitCode'])('rejects a non-string optional line %s before display', async key => {
    const record = rawRecord(); (record.inspection.preview.lines[0] as unknown as Record<string, unknown>)[key] = { invalid: true };
    f.rpc.mockResolvedValue(reply([record])); expect((await fetchOfficeEInvoiceInbox(tenantId, role)).ok).toBe(false);
  });
  it('does not elevate client inspection metadata into a validated format status', async () => {
    const record = rawRecord(); Object.assign(record.inspection, { validationStatus: 'valid', validation_report: { status: 'valid', source: 'server' } });
    f.rpc.mockResolvedValue(reply([record])); const result = await fetchOfficeEInvoiceInbox(tenantId, role);
    expect(result.ok).toBe(true); if (result.ok) expect(result.data[0].validationStatus).toBe('pending_validation');
  });
});

describe('E-Rechnungseingang: Originalerhalt, Wiederholung und Prüfung', () => {
  it('transmits the exact original and embedded XML bytes in a single import operation', async () => {
    f.rpc.mockResolvedValueOnce({ data: { document_id: documentId, duplicate: false }, error: null }).mockResolvedValueOnce(reply([rawRecord()]));
    const result = await saveOfficeEInvoiceImport(tenantId, inspection(), role); expect(result.ok).toBe(true);
    const [name, args] = f.rpc.mock.calls[0]; expect(name).toBe('office_einvoice_inbox_mutation');
    expect(args).toMatchObject({ p_tenant_id: tenantId, p_document_id: null, p_operation: 'import', p_payload: { original_sha256: hash(original), mime_type: 'application/pdf' } });
    expect(Buffer.from(args.p_payload.original_base64, 'base64')).toEqual(Buffer.from(original));
    expect(Buffer.from(args.p_payload.extracted_xml_base64, 'base64')).toEqual(Buffer.from(xml));
    expect(args.p_payload.inspection).not.toHaveProperty('originalBytes'); expect(args.p_payload.inspection).not.toHaveProperty('xmlBytes');
  });
  it('blocks an import when either byte array changed after inspection', async () => {
    for (const key of ['originalBytes', 'xmlBytes'] as const) {
      const input = inspection(); input[key][0] ^= 1;
      expect((await saveOfficeEInvoiceImport(tenantId, input, role)).ok).toBe(false);
    }
    expect(f.rpc).not.toHaveBeenCalled();
  });
  it('recovers an ambiguous save/read failure using server hash deduplication', async () => {
    f.rpc.mockResolvedValueOnce({ data: { document_id: documentId, duplicate: false }, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'Lesen unterbrochen' } })
      .mockResolvedValueOnce({ data: { document_id: documentId, duplicate: true }, error: null })
      .mockResolvedValueOnce(reply([rawRecord()]));
    expect((await saveOfficeEInvoiceImport(tenantId, inspection(), role)).ok).toBe(false);
    const retry = await saveOfficeEInvoiceImport(tenantId, inspection(), role);
    expect(retry.ok).toBe(true); if (retry.ok) { expect(retry.data.duplicate).toBe(true); expect(retry.data.record.id).toBe(documentId); }
    expect(f.rpc.mock.calls[0][1].p_payload.original_sha256).toBe(f.rpc.mock.calls[2][1].p_payload.original_sha256);
  });
  it('returns exact PDF and XML originals and verifies their separate hashes', async () => {
    const pdf = await downloadOfficeEInvoiceOriginal(tenantId, documentId, 'original', role);
    const embedded = await downloadOfficeEInvoiceOriginal(tenantId, documentId, 'xml', role);
    expect(pdf.ok).toBe(true); expect(embedded.ok).toBe(true);
    if (pdf.ok) { expect(pdf.data.bytes).toEqual(original); expect(pdf.data.mimeType).toBe('application/pdf'); }
    if (embedded.ok) { expect(embedded.data.bytes).toEqual(xml); expect(embedded.data.fileName).toBe('factur-x.xml'); }
    for (const [, args] of f.rpc.mock.calls) expect(args).toMatchObject({ p_tenant_id: tenantId, p_document_id: documentId, p_include_original: true });
  });
  it('blocks a corrupted original, a wrong-record receipt and malformed base64', async () => {
    for (const record of [rawRecord({ original_base64: base64(xml) }), rawRecord({ id: foreignTenantId }), rawRecord({ original_base64: '<script>' })]) {
      f.rpc.mockResolvedValue(reply([record])); expect((await downloadOfficeEInvoiceOriginal(tenantId, documentId, 'original', role)).ok).toBe(false);
    }
  });
  it('sends review revision and a trimmed note without overwriting validation data', async () => {
    f.rpc.mockResolvedValueOnce({ data: { document_id: documentId }, error: null }).mockResolvedValueOnce(reply([rawRecord({ business_status: 'rejected', review_note: 'Betrag falsch' })]));
    const result = await reviewOfficeEInvoiceInbox(tenantId, documentId, { status: 'rejected', note: ' Betrag falsch ', expectedUpdatedAt: updatedAt }, role);
    expect(result.ok).toBe(true); expect(f.permissions).toContain('office.invoices.status_change');
    expect(f.rpc.mock.calls[0][1]).toMatchObject({ p_expected_updated_at: updatedAt, p_operation: 'review', p_payload: { business_status: 'rejected', review_note: 'Betrag falsch' } });
    expect(Object.keys(f.rpc.mock.calls[0][1].p_payload).sort()).toEqual(['business_status', 'review_note']);
  });
  it('rejects a missing rejection reason and propagates revision conflicts', async () => {
    expect((await reviewOfficeEInvoiceInbox(tenantId, documentId, { status: 'rejected', note: ' ', expectedUpdatedAt: updatedAt }, role)).ok).toBe(false);
    expect(f.rpc).not.toHaveBeenCalled();
    f.rpc.mockResolvedValue({ data: null, error: { message: 'Zwischenzeitlich geändert', code: '40001' } });
    expect(await reviewOfficeEInvoiceInbox(tenantId, documentId, { status: 'reviewed', note: '', expectedUpdatedAt: updatedAt }, role)).toEqual({ ok: false, error: 'Zwischenzeitlich geändert' });
  });
  it('starts validation for the selected persisted document and reads back the server result', async () => {
    f.rpc.mockResolvedValue(reply([rawRecord({ format_status: 'invalid', validation_report: { findings: [{ message: 'BR-01: Pflichtangabe fehlt' }] } })]));
    const result = await validateOfficeEInvoiceInbox(tenantId, documentId, role);
    expect(f.edge).toHaveBeenCalledWith('render-document-pdf', { action: 'validate_einvoice_inbox', tenantId, documentId });
    expect(result.ok).toBe(true); if (result.ok) { expect(result.data.validationStatus).toBe('invalid'); expect(result.data.validationFindings).toEqual(['BR-01: Pflichtangabe fehlt']); }
  });
  it('never accepts a validation response for another document or a denied validator action', async () => {
    f.edge.mockResolvedValue({ ok: true, data: { documentId: foreignTenantId } });
    expect((await validateOfficeEInvoiceInbox(tenantId, documentId, role)).ok).toBe(false); expect(f.rpc).not.toHaveBeenCalled();
    f.edge.mockClear(); f.denied = true;
    expect((await validateOfficeEInvoiceInbox(tenantId, documentId, role)).ok).toBe(false); expect(f.edge).not.toHaveBeenCalled();
  });
});
