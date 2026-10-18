import { describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { createEInvoiceValidationHandler, type EInvoiceValidationResponse } from '../../../api/_lib/einvoice-validation-handler';
import { createEmptyOfficeEInvoiceMetadata } from '@/lib/office/eInvoiceModel.web';

const tenant = '11111111-1111-4111-8111-111111111111'; const invoiceId = '22222222-2222-4222-8222-222222222222';
const lineId = '33333333-3333-4333-8333-333333333333'; const userId = '44444444-4444-4444-8444-444444444444';
const updated = '2026-10-18T08:00:00.000Z'; const revision = 'a'.repeat(32);
const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const env = { EXPO_PUBLIC_SUPABASE_URL: 'https://project.supabase.co', EXPO_PUBLIC_SUPABASE_ANON_KEY: 'anon-test' };
const outgoing = { tenantId: tenant, invoiceId, expectedUpdatedAt: updated, sourceRevision: revision, invoiceNumber: 'RE-2026-00001' };
const incoming = { tenantId: tenant, documentId: invoiceId };
function canonical() {
  const metadata = createEmptyOfficeEInvoiceMetadata(); metadata.format = 'xrechnung'; metadata.buyerConfirmed = true;
  metadata.buyer = { name: 'Einkauf GmbH', street: 'Testweg', houseNumber: '2', postalCode: '10115', city: 'Berlin', country: 'Deutschland', email: '' };
  metadata.buyerCountryCode = 'DE'; metadata.sellerCountryCode = 'DE'; metadata.buyerReference = 'BESTELLUNG-TEST';
  metadata.sellerEndpoint = { schemeId: 'EM', value: 'seller@example.test' }; metadata.buyerEndpoint = { schemeId: 'EM', value: 'buyer@example.test' };
  metadata.sellerContact = { name: 'Ansprechpartner', phone: '+49 30 123456', email: 'seller@example.test' };
  const company = { legalName: 'Lieferant GmbH', street: 'Testweg', houseNumber: '1', postalCode: '10115', city: 'Berlin', country: 'Deutschland', vatId: 'DE123456789', taxNumber: '', iban: 'DE89370400440532013000' };
  return { invoice_number: outgoing.invoiceNumber, source_revision: revision, company_snapshot: company,
    snapshot: { invoice: { id: invoiceId, tenant_id: tenant, office_managed: true, status: 'draft', updated_at: updated,
      invoice_date: '2026-10-18', due_date: '2026-11-01', service_period_from: '2026-10-01', service_period_to: '2026-10-18', total_amount: 119,
      notes: '', footer_text: '', include_service_proofs: false, selected_proof_ids: [] as string[], e_invoice_metadata: metadata },
    lines: [{ id: lineId, tenant_id: tenant, invoice_id: invoiceId, quantity: 1, unit: 'Stunde', unit_price: 100, vat_rate: 19,
      net_amount: 100, vat_amount: 19, gross_amount: 119, product_key: 'assist', description: 'Leistung', e_invoice_tax: { category: 'S', unitCode: 'HUR', exemptionReason: '', exemptionReasonCode: '', legalBasis: 'none' } }],
    proofs: [] as Array<{ id: string; path: string; sha256: string; service_date: string }> } };
}
function stored() {
  const bytes = new TextEncoder().encode('<test>Exact original bytes</test>');
  return { id: invoiceId, tenant_id: tenant, original_base64: Buffer.from(bytes).toString('base64'), extracted_xml_base64: Buffer.from(bytes).toString('base64'),
    original_sha256: digest(bytes), extracted_xml_sha256: digest(bytes) };
}
function setup(options: { auth?: boolean; item?: ReturnType<typeof stored>; source?: ReturnType<typeof canonical>; changed?: boolean; validationStatus?: string; validationHash?: string; storage?: Uint8Array; extractedPdfXml?: Uint8Array } = {}) {
  let previews = 0;
  const fetchMock = vi.fn(async (url: string | URL | Request, request?: RequestInit) => {
    const path = String(url);
    if (path.endsWith('/auth/v1/user')) return new Response(JSON.stringify({ id: userId }), { status: options.auth === false ? 401 : 200 });
    if (path.endsWith('/rpc/office_einvoice_inbox_read')) return new Response(JSON.stringify({ items: [options.item || stored()] }));
    if (path.endsWith('/rpc/office_invoice_issue_preview')) {
      previews += 1; const source = structuredClone(options.source || canonical()); if (options.changed && previews > 1) source.source_revision = 'b'.repeat(32);
      return new Response(JSON.stringify(source));
    }
    if (path.includes('/storage/v1/object/authenticated/')) return new Response(new Uint8Array(options.storage || []));
    throw new Error(`Unexpected network path ${path}`);
  });
  const validate = vi.fn(async ({ xml }: { xml: Uint8Array; expectedProfileId?: string }) => ({ source: 'server', status: options.validationStatus || 'valid', documentSha256: options.validationHash || digest(xml) }));
  const extractPdfXml = vi.fn(async () => { if (!options.extractedPdfXml) throw new Error('No embedded XML'); return options.extractedPdfXml; });
  const handler = createEInvoiceValidationHandler({ fetch: fetchMock as typeof fetch, validate, extractPdfXml, env });
  const reply = { code: 200, body: {} as Record<string, unknown>, headers: {} as Record<string, string> };
  const response: EInvoiceValidationResponse = { status(code) { reply.code = code; return response; }, setHeader(name, value) { reply.headers[name] = value; }, json(body) { reply.body = body as Record<string, unknown>; return body; } };
  const run = async (body: unknown = incoming, authorization: string | undefined = 'Bearer user.jwt.token', method = 'POST') => {
    await handler({ method, headers: { authorization }, body }, response); return reply;
  };
  return { run, fetchMock, validate, extractPdfXml, reply };
}

describe('authenticated authoritative e-invoice validation endpoint', () => {
  it('requires POST and a bearer identity before reading any data', async () => {
    const state = setup(); expect((await state.run(incoming, 'Bearer user.jwt.token', 'GET')).code).toBe(405);
    expect((await state.run(incoming, '')).code).toBe(401); expect(state.fetchMock).not.toHaveBeenCalled();
  });
  it('rejects untrusted XML, validation reports and custom URLs in the request', async () => {
    for (const key of ['xml', 'xmlBase64', 'validation', 'url', 'supabaseUrl']) {
      const state = setup(); expect((await state.run({ ...incoming, [key]: 'untrusted' })).code).toBe(400); expect(state.fetchMock).not.toHaveBeenCalled();
    }
  });
  it('does not read invoices when getUser rejects the token', async () => {
    const state = setup({ auth: false }); expect((await state.run()).code).toBe(401); expect(state.fetchMock).toHaveBeenCalledTimes(1); expect(state.validate).not.toHaveBeenCalled();
  });
  it('uses the caller bearer and tenant-filtered RPC, verifies exact hashes, then validates stored XML', async () => {
    const state = setup(); const result = await state.run(); expect(result.code).toBe(200); expect(result.body.ok).toBe(true);
    const request = state.fetchMock.mock.calls[1][1]!;
    expect(request.headers).toMatchObject({ Authorization: 'Bearer user.jwt.token', apikey: 'anon-test' });
    expect(JSON.parse(String(request.body))).toMatchObject({ p_tenant_id: tenant, p_document_id: invoiceId, p_include_original: true });
    expect(result.body.xmlSha256).toBe(stored().extracted_xml_sha256); expect(result.body.originalSha256).toBe(stored().original_sha256);
    expect(state.validate).toHaveBeenCalledTimes(1); expect(result.headers['Cache-Control']).toContain('no-store');
  });
  it('rejects cross-tenant results and changed original bytes before invoking the validator', async () => {
    for (const item of [{ ...stored(), tenant_id: userId }, { ...stored(), original_sha256: '0'.repeat(64) }, { ...stored(), extracted_xml_base64: 'AAAA!' }]) {
      const state = setup({ item }); expect((await state.run()).body.ok).toBe(false); expect(state.validate).not.toHaveBeenCalled();
    }
  });
  it('accepts PostgreSQL line-wrapped base64 without changing the original bytes', async () => {
    const bytes = new TextEncoder().encode('<test>' + 'Exact original bytes. '.repeat(20) + '</test>');
    const wrapped = Buffer.from(bytes).toString('base64').match(/.{1,76}/g)!.join('\n');
    const item = { ...stored(), original_base64: wrapped, extracted_xml_base64: wrapped, original_sha256: digest(bytes), extracted_xml_sha256: digest(bytes) };
    const state = setup({ item }); expect((await state.run()).code).toBe(200); expect(Array.from(state.validate.mock.calls[0][0].xml)).toEqual(Array.from(bytes));
  });
  it('rejects client-substituted XML that is not the uploaded original or its actual PDF attachment', async () => {
    const item = stored(); const altered = new TextEncoder().encode('<test>Substituted XML</test>');
    item.extracted_xml_base64 = Buffer.from(altered).toString('base64'); item.extracted_xml_sha256 = digest(altered);
    const direct = setup({ item }); expect((await direct.run()).code).toBe(422); expect(direct.validate).not.toHaveBeenCalled();
    const pdf = new TextEncoder().encode('%PDF-1.7\nActual container'); item.original_base64 = Buffer.from(pdf).toString('base64'); item.original_sha256 = digest(pdf);
    const mismatch = setup({ item, extractedPdfXml: new TextEncoder().encode('<test>Actual embedded XML</test>') });
    expect((await mismatch.run()).code).toBe(422); expect(mismatch.extractPdfXml).toHaveBeenCalledOnce(); expect(mismatch.validate).not.toHaveBeenCalled();
    const matching = setup({ item, extractedPdfXml: altered }); expect((await matching.run()).code).toBe(200); expect(matching.validate).toHaveBeenCalledOnce();
  });
  it('retains a real failed validation outcome without upgrading it to valid', async () => {
    const state = setup({ validationStatus: 'invalid' }); const result = await state.run();
    expect(result.body).toMatchObject({ ok: true, validation: { status: 'invalid' } });
  });
  it('rejects a validator that did not confirm the exact original XML', async () => {
    const state = setup({ validationHash: '0'.repeat(64) }); expect((await state.run()).code).toBe(502);
  });
  it('serializes the fresh server snapshot and rechecks its revision after validation', async () => {
    const state = setup(); const result = await state.run(outgoing);
    expect(result.code).toBe(200); expect(result.body).toMatchObject({ ok: true, invoiceNumber: outgoing.invoiceNumber, sourceRevision: revision });
    const xml = Buffer.from(String(result.body.xmlBase64), 'base64'); expect(xml.toString()).toContain(outgoing.invoiceNumber); expect(xml.toString()).toContain('Lieferant GmbH');
    expect(result.body.xmlSha256).toBe(digest(xml)); expect(state.fetchMock).toHaveBeenCalledTimes(3);
    expect(state.validate.mock.calls[0][0].expectedProfileId).toContain('xrechnung_3.0');
  });
  it('rejects stale source snapshots before serialization and changes made during validation', async () => {
    const first = setup(); expect((await first.run({ ...outgoing, sourceRevision: 'b'.repeat(32) })).code).toBe(409); expect(first.validate).not.toHaveBeenCalled();
    const changed = setup({ changed: true }); expect((await changed.run(outgoing)).code).toBe(409); expect(changed.validate).toHaveBeenCalledOnce();
  });
  it('does not silently correct saved financial amounts', async () => {
    const source = canonical(); source.snapshot.lines[0].gross_amount = 118;
    const state = setup({ source }); expect((await state.run(outgoing)).code).toBe(422); expect(state.validate).not.toHaveBeenCalled();
  });
  it('rejects cross-tenant or traversal proof paths instead of fetching arbitrary files', async () => {
    for (const path of [`tenant/${userId}/proof.pdf`, `tenant/${tenant}/../proof.pdf`, `https://attacker.test/proof.pdf`, `tenant/${tenant}/%2e%2e/proof.pdf`]) {
      const source = canonical(); source.snapshot.invoice.include_service_proofs = true; source.snapshot.invoice.selected_proof_ids = [`record:${lineId}`];
      source.snapshot.proofs = [{ id: `record:${lineId}`, path, sha256: '0'.repeat(64), service_date: '2026-10-18' }];
      const state = setup({ source }); expect((await state.run(outgoing)).code).toBe(422); expect(state.fetchMock).toHaveBeenCalledTimes(2); expect(state.validate).not.toHaveBeenCalled();
    }
  });
  it('embeds only selected attested original PDF bytes and rejects substituted bytes', async () => {
    const storage = new TextEncoder().encode('%PDF-1.7\nOriginal signed proof\n%%EOF');
    const source = canonical(); source.snapshot.invoice.include_service_proofs = true; source.snapshot.invoice.selected_proof_ids = [`record:${lineId}`];
    source.snapshot.proofs = [{ id: `record:${lineId}`, path: `tenant/${tenant}/signed/proof.pdf`, sha256: digest(storage), service_date: '2026-10-18' }];
    const state = setup({ source, storage }); const result = await state.run(outgoing);
    expect(result.code).toBe(200); expect(Buffer.from(String(result.body.xmlBase64), 'base64').toString()).toContain(Buffer.from(storage).toString('base64'));
    const tampered = setup({ source, storage: new TextEncoder().encode('%PDF-1.7\nchanged') }); expect((await tampered.run(outgoing)).code).toBe(422); expect(tampered.validate).not.toHaveBeenCalled();
    expect(state.fetchMock.mock.calls.every(([, request]) => request?.method === 'GET' || !/mutation|finalize|save|insert/.test(String(request?.body)))).toBe(true);
  });
});
