import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Uses the project's existing PGlite dev dependency. Hosted Auth/Storage are
// explicit fixture adapters; the two application migrations execute unchanged.
// Validator reports here are synthetic trust-boundary fixtures, not evidence of
// real XML conformance. The validator engine has its own official-rule tests.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packageRoot = process.env.OFFICE_EINVOICE_PGLITE_ROOT;
const { PGlite } = await import(packageRoot ? pathToFileURL(resolve(packageRoot, 'dist/index.js')).href : '@electric-sql/pglite');
const { pgcrypto } = await import(packageRoot ? pathToFileURL(resolve(packageRoot, 'dist/contrib/pgcrypto.js')).href : '@electric-sql/pglite/contrib/pgcrypto');
const db = new PGlite({ extensions: { pgcrypto } });
const TENANT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const USER = '11111111-1111-4111-8111-111111111111';
const USER2 = '22222222-2222-4222-8222-222222222222';
const VIEWER = '33333333-3333-4333-8333-333333333333';
const PROFILE = '44444444-4444-4444-8444-444444444444';
const CLIENT = '55555555-5555-4555-8555-555555555555';
const ADMIN_ROLE = '66666666-6666-4666-8666-666666666666';
const VIEW_ROLE = '77777777-7777-4777-8777-777777777777';
const XML = Buffer.from('<?xml version="1.0"?><Invoice><ID>isolated-fixture</ID></Invoice>');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const payload = bytes => ({ file_name: 'rechnung.xml', mime_type: 'application/xml', original_base64: bytes.toString('base64'), original_sha256: hash(bytes), inspection: { syntax: 'ubl_invoice', invoiceNumber: 'isolated-fixture' } });
let checks = 0;
async function pass(name, task) { await task(); checks += 1; console.log(`[office-einvoice-db] PASS ${name}`); }
async function denied(sql, values = [], code = '42501') {
  await assert.rejects(db.query(sql, values), error => { assert.equal(error.code, code, error.message); return true; });
}
async function actor({ user = USER, tenant = TENANT, role = 'authenticated', portal = 'business' } = {}) {
  assert.ok(['authenticated', 'anon', 'service_role'].includes(role));
  await db.exec('RESET ROLE');
  await db.query("SELECT set_config('test.uid',$1,false),set_config('test.tenant',$2,false),set_config('test.portal',$3,false),set_config('test.jwt_role',$4,false)", [role === 'service_role' || role === 'anon' ? '' : user, tenant, portal, role]);
  await db.exec(`SET ROLE ${role}`);
}
async function result(sql, args = []) { return (await db.query(sql, args)).rows[0].result; }
const mutation = (operation, body, id = null, expected = null, request = randomUUID(), tenant = TENANT) => result('SELECT public.office_einvoice_inbox_mutation($1,$2,$3,$4,$5,$6::jsonb) AS result', [tenant, request, id, expected, operation, JSON.stringify(body)]);
const read = (id = null, original = false, tenant = TENANT) => result('SELECT public.office_einvoice_inbox_read($1,$2,50,0,$3) AS result', [tenant, id, original]);
const invoiceMutation = (operation, body, id = null, expected = null, request = randomUUID()) => result('SELECT public.office_invoice_mutation($1,$2,$3,$4,$5,$6::jsonb) AS result', [TENANT, request, id, expected, operation, JSON.stringify(body)]);
const report = (bytes = XML, overrides = {}) => ({ schemaVersion: 1, status: 'valid', documentSha256: hash(bytes), syntax: 'ubl_invoice', scope: 'structured_xml',
  profileId: 'urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0', standard: 'xrechnung_3.0', source: 'server',
  engine: { name: 'libxml2-wasm+saxon-js', version: '0.7.2+2.7.0' }, ruleSet: { name: 'KoSIT XRechnung', version: '2026-08-31', sha256: 'cd4e642f4957a95fd17006afced517dc58526a17e6bd9f3097bf596d54d575c2' },
  checks: ['syntax', 'xsd', 'business_rules'].map(kind => ({ kind, status: 'passed' })), businessRuleSets: ['en16931-1.3.16', 'xrechnung-2.6.0'], findings: [], checkedAt: '2026-10-18T00:00:00Z', durationMs: 1, ...overrides });
const metadata = (format = 'xrechnung') => ({ version: 1, format, buyer: { name: 'Isolated Buyer', street: 'Testweg', houseNumber: '1', postalCode: '00000', city: 'Testort', country: 'Deutschland', email: 'fixture@example.invalid' },
  buyerConfirmed: true, buyerCountryCode: 'DE', buyerVatId: '', buyerLegalRegistrationId: '', buyerReference: 'fixture', buyerEndpoint: { schemeId: 'EM', value: 'fixture@example.invalid' },
  sellerCountryCode: 'DE', sellerIdentifier: '', sellerEndpoint: { schemeId: 'EM', value: 'sender@example.invalid' }, sellerContact: { name: 'Fixture', phone: '+490000', email: 'sender@example.invalid' },
  legal: { recipientKind: 'b2b', buyerBusinessUse: 'yes', sellerDomestic: 'yes', buyerDomestic: 'yes', sellerSmallBusiness: 'no', smallAmountRuleEligible: 'no', passengerTicket: 'no', transmissionDate: '2026-10-18', priorYearRevenueCents: null, priorYearRevenueYear: null, pdfConsent: 'yes' } });
const draft = (format = 'xrechnung') => ({ client_id: CLIENT, invoice_date: '2026-10-18', due_date: '2026-11-01', service_period_from: '2026-10-01', service_period_to: '2026-10-18', recipient_type: 'company', billing_party: 'self_payer',
  recipient_name: 'Isolated Buyer', recipient_street: 'Testweg', recipient_house_number: '1', recipient_postal_code: '00000', recipient_city: 'Testort', recipient_country: 'Deutschland', recipient_email: 'fixture@example.invalid', notes: '', footer_text: '',
  include_service_proofs: false, selected_proof_ids: [], e_invoice_metadata: metadata(format),
  lines: [{ description: 'Synthetic test service', quantity: 2, unit: 'Stunde', unit_price_cents: 1000, vat_rate: 19, product_key: 'assist', service_date: '2026-10-18', e_invoice_tax: { category: 'S', unitCode: 'HUR', exemptionReason: '', exemptionReasonCode: '', legalBasis: 'none' } }] });
const preview = (id, revision) => result('SELECT public.office_invoice_issue_preview($1,$2,$3) AS result', [TENANT, id, revision]);
const attest = (id, revision, view, bytes = XML, validation = report(bytes)) => result('SELECT public.office_einvoice_record_validation($1,$2,$3,$4,$5,$6,$7::jsonb,$8) AS result', [TENANT, id, revision, view.source_revision, view.invoice_number, bytes.toString('base64'), JSON.stringify(validation), USER]);
const incomingValidation = (id, validation) => result('SELECT public.office_einvoice_inbox_validation($1,$2,$3,$4::jsonb,$5) AS result', [TENANT, id, hash(XML), JSON.stringify(validation), USER]);

try {
  for (const file of ['scripts/fixtures/office-einvoice-test-schema.sql', 'scripts/sql/office-invoice-workspace.sql', 'scripts/sql/office-einvoice-workspace.sql']) await db.exec(readFileSync(resolve(root, file), 'utf8'));
  await db.query("INSERT INTO public.tenants(id,name,legal_name,street,postal_code,city,country,tax_number) VALUES($1,'Synthetic tenant','Synthetic tenant','Testweg','00000','Testort','Deutschland','TEST'),($2,'Other synthetic tenant','Other synthetic tenant','Testweg','00000','Testort','Deutschland','TEST')", [TENANT, OTHER]);
  await db.query("INSERT INTO public.roles(id,key,is_admin_role) VALUES($1,'owner',true),($2,'viewer',false)", [ADMIN_ROLE, VIEW_ROLE]);
  await db.query("INSERT INTO public.profiles(id,auth_user_id,tenant_id,role_id,is_active,status) VALUES($1,$2,$3,$4,true,'active'),($5,$5,$6,$4,true,'active'),($7,$7,$3,$8,true,'active')", [PROFILE, USER, TENANT, ADMIN_ROLE, USER2, OTHER, VIEWER, VIEW_ROLE]);
  await db.query("INSERT INTO public.role_permissions(role_id,permission_key,can_view) VALUES($1,'office.invoices.view',true)", [VIEW_ROLE]);
  await db.query("INSERT INTO public.clients(id,tenant_id,first_name,last_name,billing_party) VALUES($1,$2,'Synthetic','Client','self_payer')", [CLIENT, TENANT]);
  await db.query("INSERT INTO public.tenant_billing_settings(tenant_id,invoice_prefix,next_invoice_number,bank_name,iban) VALUES($1,'TEST',1,'Fixture bank','DE00000000000000000000')", [TENANT]);
  await actor();
  let imported, current;
  const request = randomUUID(), importPayload = payload(XML);
  await pass('imports exact bytes, computes both hashes, and keeps format/factual review separate', async () => {
    imported = await mutation('import', importPayload, null, null, request);
    const detail = (await read(imported.document_id, true)).items[0];
    assert.equal(detail.original_sha256, hash(XML)); assert.equal(detail.extracted_xml_sha256, hash(XML));
    assert.deepEqual(Buffer.from(detail.original_base64, 'base64'), XML); assert.deepEqual(Buffer.from(detail.extracted_xml_base64, 'base64'), XML);
    assert.equal(detail.format_status, 'pending_validation'); assert.equal(detail.business_status, 'unreviewed');
    assert.equal((await read()).items[0].original_base64, undefined);
  });
  await pass('retries are idempotent and byte duplicates keep the original receipt', async () => {
    assert.deepEqual(await mutation('import', importPayload, null, null, request), imported);
    const duplicate = await mutation('import', { ...importPayload, file_name: 'renamed.xml' });
    assert.equal(duplicate.document_id, imported.document_id); assert.equal(duplicate.duplicate, true);
    assert.equal((await read(imported.document_id)).items[0].file_name, 'rechnung.xml'); assert.equal((await read()).total, 1);
    await assert.rejects(mutation('import', { ...importPayload, file_name: 'changed.xml' }, null, null, request), error => error.code === '22023');
  });
  await pass('rejects mismatched bytes, spoofed validation, XML replacement, and oversized input', async () => {
    for (const body of [{ ...importPayload, original_sha256: '0'.repeat(64) }, { ...importPayload, format_status: 'valid' }, { ...importPayload, extracted_xml_base64: Buffer.from('other').toString('base64') }, { ...importPayload, original_base64: 'A'.repeat(13981020) }]) await assert.rejects(mutation('import', body), error => error.code === '22023');
  });
  await pass('auth, portal, permission, tenant and service-only boundaries reject invalid callers', async () => {
    await denied('SELECT * FROM care_security.office_einvoice_documents');
    await denied('SELECT public.office_einvoice_record_validation($1,$2,now(),$3,$4,$5,$6::jsonb,$7)', [TENANT, randomUUID(), 'a'.repeat(32), 'TEST', XML.toString('base64'), JSON.stringify(report()), USER]);
    await actor({ user: VIEWER }); await assert.rejects(mutation('import', importPayload), error => error.code === '42501');
    await actor({ portal: 'employee' }); await assert.rejects(read(), error => error.code === '42501');
    await actor({ user: USER2, tenant: OTHER }); assert.equal((await read(null, false, OTHER)).total, 0); await assert.rejects(read(imported.document_id, false, OTHER), error => error.code === 'P0002');
    await actor({ role: 'anon' }); await assert.rejects(read(), error => error.code === '42501');
    await actor();
  });
  await pass('reviews reject stale writes and do not change original or format status', async () => {
    current = await mutation('review', { business_status: 'reviewed', review_note: 'Synthetic review' }, imported.document_id, imported.updated_at);
    await assert.rejects(mutation('review', { business_status: 'rejected', review_note: '' }, imported.document_id, imported.updated_at), error => error.code === '40001');
    const detail = (await read(imported.document_id)).items[0]; assert.equal(detail.business_status, 'reviewed'); assert.equal(detail.format_status, 'pending_validation'); assert.equal(detail.original_sha256, hash(XML));
    await db.exec('RESET ROLE');
    await denied('UPDATE care_security.office_einvoice_documents SET original_bytes=$1 WHERE id=$2', [Buffer.from('changed'), imported.document_id]);
    await denied('DELETE FROM care_security.office_einvoice_documents WHERE id=$1', [imported.document_id]);
    await actor();
  });
  await pass('server reports bind to the stored XML and cannot masquerade as PDF/A approval', async () => {
    await actor({ role: 'service_role' });
    await assert.rejects(incomingValidation(imported.document_id, report(Buffer.from('different'))), error => error.code === '22023');
    await assert.rejects(incomingValidation(imported.document_id, report(XML, { scope: 'full_pdfa' })), error => error.code === '55000');
    await incomingValidation(imported.document_id, report());
    await actor(); const detail = (await read(imported.document_id)).items[0];
    assert.equal(detail.format_status, 'valid'); assert.equal(detail.business_status, 'reviewed'); assert.equal(detail.validation_report.scope, 'structured_xml');
    assert.equal((await read()).items[0].validation_report.status, 'valid');
  });
  await pass('incoming base EN 16931 uses its own rules and is not accepted as outgoing XRechnung', async () => {
    await actor({ role: 'service_role' });
    const base = report(XML, { standard: 'en16931', profileId: 'urn:cen.eu:en16931:2017', businessRuleSets: ['en16931-1.3.16'] });
    await incomingValidation(imported.document_id, base);
    await assert.rejects(result('SELECT care_security.office_einvoice_check_report($1::jsonb,$2,true) AS result', [JSON.stringify(base), hash(XML)]), error => error.code === '55000');
    await actor();
  });
  let saved, view, receipt;
  await pass('saves invoice and line metadata atomically through the existing financial lifecycle', async () => {
    saved = await invoiceMutation('save_draft', draft()); view = await preview(saved.invoice_id, saved.updated_at);
    assert.equal(view.snapshot.invoice.e_invoice_metadata.sellerIdentifier, ''); assert.equal(view.snapshot.invoice.e_invoice_metadata.format, 'xrechnung');
    assert.equal(view.snapshot.lines[0].e_invoice_tax.category, 'S'); assert.equal(view.snapshot.invoice.total_amount, 23.8);
    await assert.rejects(invoiceMutation('save_draft', { ...draft(), e_invoice_metadata: { ...metadata(), validatorPassed: true } }), error => error.code === '22023');
  });
  await pass('zero-VAT release accepts per-line reasons or the legacy footer and blocks every uncovered line', async () => {
    const zero = draft('pdf'); zero.lines[0].vat_rate = 0;
    zero.lines[0].e_invoice_tax = { ...zero.lines[0].e_invoice_tax, category: 'E', legalBasis: 'ustg_4_8_29', exemptionReason: 'Steuerfrei nach § 4 Nr. 16 UStG (synthetische Testangabe)' };
    const covered = await invoiceMutation('save_draft', zero);
    const coveredView = await preview(covered.invoice_id, covered.updated_at);
    assert.equal(coveredView.snapshot.invoice.total_amount, 20); assert.equal(coveredView.snapshot.invoice.footer_text, null);
    const codeOnly = { ...zero, lines: [{ ...zero.lines[0], e_invoice_tax: { ...zero.lines[0].e_invoice_tax, exemptionReason: '', exemptionReasonCode: 'VATEX-EU-132-1B' } }] };
    const coded = await invoiceMutation('save_draft', codeOnly);
    assert.equal((await preview(coded.invoice_id, coded.updated_at)).snapshot.invoice.total_amount, 20);
    const incomplete = { ...zero, lines: [...zero.lines, { ...zero.lines[0], e_invoice_tax: { ...zero.lines[0].e_invoice_tax, exemptionReason: '  ' } }] };
    const missing = await invoiceMutation('save_draft', incomplete);
    await assert.rejects(preview(missing.invoice_id, missing.updated_at), /Grundlage für Rechnungspositionen ohne Umsatzsteuer/);
    const fallback = await invoiceMutation('save_draft', { ...incomplete, footer_text: 'Gemeinsamer Steuerhinweis für diese Testrechnung' });
    assert.equal((await preview(fallback.invoice_id, fallback.updated_at)).snapshot.invoice.total_amount, 40);
  });
  const pdfSha = 'a'.repeat(64);
  const issuePayload = () => ({ status: 'ready', invoice_number: view.invoice_number, company_snapshot: view.company_snapshot, source_revision: view.source_revision,
    pdf_sha256: pdfSha, pdf_file_path: `tenant/${TENANT}/generated/invoice-${saved.invoice_id}/${pdfSha}.pdf`, e_invoice_xml_sha256: hash(XML) });
  await pass('missing, failed, unpinned or incomplete validation cannot reserve a final invoice number', async () => {
    await assert.rejects(invoiceMutation('set_status', issuePayload(), saved.invoice_id, saved.updated_at), error => error.code === '55000');
    await actor({ role: 'service_role' });
    for (const bad of [report(XML, { status: 'invalid' }), report(XML, { checks: [{ kind: 'xsd', status: 'passed' }] }), report(XML, { ruleSet: { name: 'KoSIT XRechnung', version: '2026-08-31', sha256: '0'.repeat(64) } }), report(XML, { findings: [{ severity: 'error', code: 'TEST', message: 'fixture' }] })]) await assert.rejects(attest(saved.invoice_id, saved.updated_at, view, XML, bad), error => error.code === '55000');
    receipt = await attest(saved.invoice_id, saved.updated_at, view); assert.deepEqual(await attest(saved.invoice_id, saved.updated_at, view), receipt);
    await actor(); assert.equal((await db.query('SELECT next_invoice_number FROM public.tenant_billing_settings WHERE tenant_id=$1', [TENANT])).rows[0].next_invoice_number, 1);
    await assert.rejects(result('SELECT public.office_einvoice_artifact_read($1,$2) AS result', [TENANT, saved.invoice_id]), error => error.code === 'P0002');
  });
  await pass('finalization atomically freezes PDF, XML, data snapshot and final number', async () => {
    await db.exec('RESET ROLE');
    await db.query("INSERT INTO public.document_render_jobs(tenant_id,related_entity_table,related_entity_id,job_status,pdf_path,created_by) VALUES($1,'invoices',$2,'completed',$3,$4)", [TENANT, saved.invoice_id, issuePayload().pdf_file_path, PROFILE]);
    await db.query("INSERT INTO storage.objects(bucket_id,name,metadata) VALUES('office-documents',$1,'{\"mimetype\":\"application/pdf\",\"size\":123}')", [issuePayload().pdf_file_path]);
    await actor();
    const issued = await invoiceMutation('set_status', issuePayload(), saved.invoice_id, saved.updated_at);
    assert.ok(issued.updated_at); const original = await result('SELECT public.office_einvoice_artifact_read($1,$2) AS result', [TENANT, saved.invoice_id]);
    assert.deepEqual(Buffer.from(original.xml_base64, 'base64'), XML); assert.equal(original.xml_sha256, hash(XML)); assert.equal(original.report.status, 'valid');
    const invoice = (await db.query('SELECT status,invoice_number,e_invoice_xml_sha256,e_invoice_validation_id,issued_snapshot FROM public.invoices WHERE id=$1', [saved.invoice_id])).rows[0];
    assert.equal(invoice.status, 'ready'); assert.equal(invoice.invoice_number, view.invoice_number); assert.equal(invoice.e_invoice_validation_id, receipt.validation_id); assert.equal(invoice.e_invoice_xml_sha256, hash(XML));
    assert.deepEqual(invoice.issued_snapshot, view.snapshot); assert.equal((await db.query('SELECT next_invoice_number FROM public.tenant_billing_settings WHERE tenant_id=$1', [TENANT])).rows[0].next_invoice_number, 2);
    await denied('UPDATE public.invoices SET e_invoice_xml_sha256=$1 WHERE id=$2', ['b'.repeat(64), saved.invoice_id]);
    await assert.rejects(invoiceMutation('save_draft', draft(), saved.invoice_id, issued.updated_at));
  });
  await pass('changes after validation require a new current-revision receipt', async () => {
    let change = await invoiceMutation('save_draft', draft()); const prior = await preview(change.invoice_id, change.updated_at);
    await actor({ role: 'service_role' }); await attest(change.invoice_id, change.updated_at, prior); await actor();
    const updated = await invoiceMutation('save_draft', { ...draft(), notes: 'Changed after validation' }, change.invoice_id, change.updated_at);
    const latest = await preview(updated.invoice_id, updated.updated_at);
    assert.notEqual(latest.source_revision, prior.source_revision);
    await assert.rejects(invoiceMutation('set_status', { ...issuePayload(), invoice_number: latest.invoice_number, company_snapshot: latest.company_snapshot, source_revision: latest.source_revision }, updated.invoice_id, updated.updated_at), error => error.code === '55000');
    await actor({ role: 'service_role' }); await assert.rejects(attest(change.invoice_id, change.updated_at, prior), error => error.code === '40001'); await actor();
  });
  await pass('confirmed mandatory B2B facts block PDF while unknown and exempt cases remain distinct', async () => {
    const required = draft('pdf'); required.invoice_date = '2028-01-18'; required.due_date = '2028-02-01'; required.service_period_from = '2028-01-01'; required.service_period_to = '2028-01-18'; required.lines[0].service_date = '2028-01-18'; required.e_invoice_metadata.legal.transmissionDate = '2028-01-18';
    const req = await invoiceMutation('save_draft', required); const reqView = await preview(req.invoice_id, req.updated_at);
    await assert.rejects(invoiceMutation('set_status', { status: 'ready', invoice_number: reqView.invoice_number, source_revision: reqView.source_revision, company_snapshot: reqView.company_snapshot }, req.invoice_id, req.updated_at), error => error.code === '55000');
    await db.exec('RESET ROLE'); assert.equal(await result('SELECT care_security.office_einvoice_pdf_explicitly_blocked(i) AS result FROM public.invoices i WHERE id=$1', [req.invoice_id]), true);
    await actor(); const unknown = { ...required, e_invoice_metadata: { ...required.e_invoice_metadata, buyerConfirmed: false } }; const unk = await invoiceMutation('save_draft', unknown);
    await db.exec('RESET ROLE'); assert.equal(await result('SELECT care_security.office_einvoice_pdf_explicitly_blocked(i) AS result FROM public.invoices i WHERE id=$1', [unk.invoice_id]), false);
  });
  console.log(`[office-einvoice-db] ${checks} isolated PostgreSQL scenarios passed. No hosted database or business records were used.`);
} finally { await db.close(); }
