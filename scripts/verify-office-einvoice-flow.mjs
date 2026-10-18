import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Isolated integration, not a hosted/browser E2E test. The actual application
// handlers, UBL serializer, pinned XML validators and PostgreSQL functions run
// together. Only Auth, HTTP transport and Storage use explicit local fixtures.
// No network listener, hosted request, real user or business record is used.
// Run with Node >=22.15 (verified on the existing Node 24 runtime) and the
// project's locked dependencies. No separate test server or installation.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('.') && context.parentURL?.startsWith(pathToFileURL(root + '/').href)) {
      const candidate = new URL(specifier + '.ts', context.parentURL);
      if (existsSync(candidate)) return nextResolve(candidate.href, context);
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.startsWith(pathToFileURL(root + '/').href) && url.endsWith('.ts')) {
      return { format: 'module', shortCircuit: true, source: stripTypeScriptTypes(readFileSync(new URL(url), 'utf8'), { mode: 'transform', sourceUrl: url }) };
    }
    return nextLoad(url, context);
  },
});
const packageRoot = process.env.OFFICE_EINVOICE_PGLITE_ROOT;
const { PGlite } = await import(packageRoot ? pathToFileURL(resolve(packageRoot, 'dist/index.js')).href : '@electric-sql/pglite');
const { pgcrypto } = await import(packageRoot ? pathToFileURL(resolve(packageRoot, 'dist/contrib/pgcrypto.js')).href : '@electric-sql/pglite/contrib/pgcrypto');
const { createEInvoiceValidationHandler: createApi } = await import('../api/_lib/einvoice-validation-handler.ts');
const { createEInvoiceValidationHandler: createEdge } = await import('../supabase/functions/_shared/eInvoiceValidationHandler.ts');
const { validateEInvoiceXml } = await import('../api/_lib/einvoice-validator.mjs');
const { extractEInvoicePdfXml } = await import('../api/_lib/einvoice-pdf-extract.mjs');
const db = new PGlite({ extensions: { pgcrypto } });
const TENANT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const USER = '11111111-1111-4111-8111-111111111111';
const PROFILE = '44444444-4444-4444-8444-444444444444';
const CLIENT = '55555555-5555-4555-8555-555555555555';
const ROLE = '66666666-6666-4666-8666-666666666666';
const AUTHORIZATION = 'Bearer isolated-fixture-token';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const scalar = async (sql, values = []) => (await db.query(sql, values)).rows[0].result;
const storage = new Map();
let checks = 0, engineCalls = 0, afterValidation = null;
async function pass(name, task) { await task(); checks++; console.log(`[office-einvoice-flow] PASS ${name}`); }
async function actor(role = 'authenticated', tenant = TENANT) {
  assert.ok(['authenticated', 'service_role'].includes(role));
  await db.exec('RESET ROLE');
  await db.query("SELECT set_config('test.uid',$1,false),set_config('test.tenant',$2,false),set_config('test.portal','business',false),set_config('test.jwt_role',$3,false)", [role === 'authenticated' ? USER : '', tenant, role]);
  await db.exec(`SET ROLE ${role}`);
}
async function rpc(name, args, role = 'authenticated') {
  const definitions = {
    has_permission: ['SELECT care_security.office_actor(public.current_tenant_id(),$1) AS result', ['p_permission_key']],
    office_invoice_issue_preview: ['SELECT public.office_invoice_issue_preview($1,$2,$3) AS result', ['p_tenant_id','p_invoice_id','p_expected_updated_at']],
    office_einvoice_inbox_read: ['SELECT public.office_einvoice_inbox_read($1,$2,$3,$4,$5) AS result', ['p_tenant_id','p_document_id','p_limit','p_offset','p_include_original']],
    office_einvoice_record_validation: ['SELECT public.office_einvoice_record_validation($1,$2,$3,$4,$5,$6,$7::jsonb,$8) AS result', ['p_tenant_id','p_invoice_id','p_expected_updated_at','p_source_revision','p_invoice_number','p_xml_base64','p_report','p_actor_id']],
    office_einvoice_inbox_validation: ['SELECT public.office_einvoice_inbox_validation($1,$2,$3,$4::jsonb,$5) AS result', ['p_tenant_id','p_document_id','p_original_sha256','p_report','p_actor_id']],
  };
  assert.ok(Object.hasOwn(definitions, name), `Unexpected RPC ${name}`);
  await actor(role);
  const [sql, keys] = definitions[name];
  try { return { data: await scalar(sql, keys.map(key => typeof args[key] === 'object' && args[key] !== null ? JSON.stringify(args[key]) : args[key])), error: null }; }
  catch (error) { return { data: null, error: { code: error.code, message: error.message } }; }
}
const client = role => ({
  rpc: (name, args) => rpc(name, args, role),
  from(table) {
    assert.equal(role, 'service_role'); assert.ok(['profiles', 'roles'].includes(table));
    let selectedRole;
    const query = {
      select() { return query; },
      or(filter) { assert.equal(filter, `auth_user_id.eq.${USER},and(auth_user_id.is.null,id.eq.${USER})`); return query; },
      eq(column, value) { assert.equal(column, 'id'); selectedRole = value; return query; },
      async maybeSingle() { await actor(role); return { data: (await db.query('SELECT * FROM public.profiles WHERE auth_user_id=$1', [USER])).rows[0], error: null }; },
      async single() { await actor(role); return { data: (await db.query('SELECT * FROM public.roles WHERE id=$1', [selectedRole])).rows[0], error: null }; },
    };
    return query;
  },
});
const api = createApi({
  env: { EXPO_PUBLIC_SUPABASE_URL: 'https://isolated.example.invalid', EXPO_PUBLIC_SUPABASE_ANON_KEY: 'isolated-anon-fixture' },
  validate: async input => { engineCalls++; const report = await validateEInvoiceXml(input); if (afterValidation) { const task = afterValidation; afterValidation = null; await task(); } return report; },
  extractPdfXml: extractEInvoicePdfXml,
  fetch: async (input, options) => {
    const url = new URL(input); assert.equal(url.origin, 'https://isolated.example.invalid');
    assert.equal(options.headers.Authorization, AUTHORIZATION); assert.equal(options.redirect, 'error');
    if (url.pathname === '/auth/v1/user') return json({ id: USER });
    if (url.pathname.startsWith('/rest/v1/rpc/')) {
      const result = await rpc(url.pathname.split('/').at(-1), JSON.parse(options.body));
      return result.error ? json({ error: result.error }, result.error.code === '42501' ? 403 : 409) : json(result.data);
    }
    if (url.pathname.startsWith('/storage/v1/object/authenticated/office-documents/')) {
      const path = decodeURIComponent(url.pathname.split('/office-documents/')[1]);
      return storage.has(path) ? new Response(storage.get(path), { headers: { 'Content-Type': 'application/pdf' } }) : json({}, 404);
    }
    assert.fail(`Unexpected local transport path: ${url.pathname}`);
  },
});
const edge = createEdge({ serviceClient: () => client('service_role'), respond: json, fetch: async (url, options) => {
  assert.equal(url, 'https://www.caresuiteplus.app/api/einvoice/validate'); assert.equal(options.headers.Authorization, AUTHORIZATION); assert.equal(options.redirect, 'error');
  let status = 200, output; const headers = {};
  await api({ method: options.method, headers: { authorization: options.headers.Authorization }, body: JSON.parse(options.body) }, {
    setHeader(name, value) { headers[name] = value; }, status(value) { status = value; return this; }, json(body) { output = body; },
  });
  assert.equal(headers['Cache-Control'], 'private, no-store, max-age=0');
  return json(output, status);
} });
async function validate(input, expectedStatus = 200) {
  const response = await edge(input, AUTHORIZATION, USER, client('authenticated'));
  const body = await response.json(); assert.equal(response.status, expectedStatus, JSON.stringify(body)); return body;
}
async function mutate(operation, payload, id = null, expected = null, request = randomUUID()) {
  await actor(); return scalar('SELECT public.office_invoice_mutation($1,$2,$3,$4,$5,$6::jsonb) AS result', [TENANT, request, id, expected, operation, JSON.stringify(payload)]);
}
async function preview(saved) { const result = await rpc('office_invoice_issue_preview', { p_tenant_id: TENANT, p_invoice_id: saved.invoice_id, p_expected_updated_at: saved.updated_at }); assert.equal(result.error, null, JSON.stringify(result.error)); return result.data; }
const issueInput = (saved, view) => ({ action: 'validate_einvoice_issue', tenantId: TENANT, invoiceId: saved.invoice_id, expectedUpdatedAt: saved.updated_at, sourceRevision: view.source_revision, invoiceNumber: view.invoice_number });
const draft = () => ({ client_id: CLIENT, invoice_date: '2026-10-18', due_date: '2026-11-01', service_period_from: '2026-10-01', service_period_to: '2026-10-18', recipient_type: 'company', billing_party: 'self_payer',
  recipient_name: 'Synthetic Buyer', recipient_street: 'Testweg', recipient_house_number: '1', recipient_postal_code: '00000', recipient_city: 'Testort', recipient_country: 'Deutschland', recipient_email: 'fixture@example.invalid', notes: 'PRIVATE NOTE MUST NOT LEAVE OFFICE', footer_text: '',
  include_service_proofs: false, selected_proof_ids: [],
  e_invoice_metadata: { version: 1, format: 'xrechnung', buyer: { name: 'Synthetic Buyer', street: 'Testweg', houseNumber: '1', postalCode: '00000', city: 'Testort', country: 'Deutschland', email: 'fixture@example.invalid' },
    buyerConfirmed: true, buyerCountryCode: 'DE', buyerVatId: '', buyerLegalRegistrationId: '', buyerReference: 'FIXTURE', buyerEndpoint: { schemeId: 'EM', value: 'fixture@example.invalid' }, sellerCountryCode: 'DE', sellerIdentifier: 'SYNTHETIC-SELLER', sellerEndpoint: { schemeId: 'EM', value: 'sender@example.invalid' }, sellerContact: { name: 'Fixture', phone: '+490000', email: 'sender@example.invalid' },
    legal: { recipientKind: 'b2b', buyerBusinessUse: 'yes', sellerDomestic: 'yes', buyerDomestic: 'yes', sellerSmallBusiness: 'no', smallAmountRuleEligible: 'no', passengerTicket: 'no', transmissionDate: '2026-10-18', priorYearRevenueCents: null, priorYearRevenueYear: null, pdfConsent: 'yes' } },
  lines: [{ description: 'Synthetic service', quantity: 2, unit: 'Stunde', unit_price_cents: 1000, vat_rate: 19, product_key: 'assist', service_date: '2026-10-18', e_invoice_tax: { category: 'S', unitCode: 'HUR', exemptionReason: '', exemptionReasonCode: '', legalBasis: 'none' } }],
});
async function importOriginal(original, xml = original, mimeType = 'application/xml') {
  await actor();
  return scalar('SELECT public.office_einvoice_inbox_mutation($1,$2,NULL,NULL,\'import\',$3::jsonb) AS result', [TENANT, randomUUID(), JSON.stringify({ file_name: mimeType === 'application/pdf' ? 'synthetic.pdf' : 'synthetic.xml', mime_type: mimeType,
    original_base64: Buffer.from(original).toString('base64'), original_sha256: hash(original), ...(mimeType === 'application/pdf' ? { extracted_xml_base64: Buffer.from(xml).toString('base64') } : {}), inspection: { syntax: 'ubl_invoice', invoiceNumber: 'synthetic' } })]);
}
async function incoming(id) { const result = await rpc('office_einvoice_inbox_read', { p_tenant_id: TENANT, p_document_id: id, p_limit: 1, p_offset: 0, p_include_original: true }); assert.equal(result.error, null); return result.data.items[0]; }
function embeddedPdf(xmls = []) {
  const names = xmls.map((_, index) => `(invoice-${index}.xml) ${6 + index * 2} 0 R`).join(' ');
  const objects = [`<< /Type /Catalog /Pages 2 0 R /Names << /EmbeddedFiles << /Names [${names}] >> >> >>`, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] /Resources << >> /Contents 4 0 R >>', '<< /Length 0 >>\nstream\n\nendstream',
    ...xmls.flatMap((xml, index) => [`<< /Type /EmbeddedFile /Subtype /text#2Fxml /Length ${Buffer.byteLength(xml)} >>\nstream\n${xml}\nendstream`, `<< /Type /Filespec /F (invoice-${index}.xml) /UF (invoice-${index}.xml) /EF << /F ${5 + index * 2} 0 R >> >>`])];
  let content = '%PDF-1.7\n'; const offsets = [];
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(content)); content += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(content); content += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(content);
}
async function finalize(saved, view, validation) {
  // PDF rendering/upload is a declared external fixture boundary. The real
  // finalizer still checks its completed render job and Storage object record.
  const pdf = embeddedPdf(), sha = hash(pdf), path = `tenant/${TENANT}/generated/invoice-${saved.invoice_id}/${sha}.pdf`;
  await db.exec('RESET ROLE');
  await db.query("INSERT INTO public.document_render_jobs(tenant_id,related_entity_table,related_entity_id,job_status,pdf_path,created_by) VALUES($1,'invoices',$2,'completed',$3,$4)", [TENANT, saved.invoice_id, path, PROFILE]);
  await db.query("INSERT INTO storage.objects(bucket_id,name,metadata) VALUES('office-documents',$1,$2::jsonb)", [path, JSON.stringify({ mimetype: 'application/pdf', size: pdf.length })]); storage.set(path, pdf);
  const body = { status: 'ready', invoice_number: view.invoice_number, company_snapshot: view.company_snapshot, source_revision: view.source_revision, pdf_sha256: sha, pdf_file_path: path, e_invoice_xml_sha256: validation.xmlSha256 };
  const request = randomUUID(); const issued = await mutate('set_status', body, saved.invoice_id, saved.updated_at, request);
  assert.deepEqual(await mutate('set_status', body, saved.invoice_id, saved.updated_at, request), issued);
  await actor(); const original = await scalar('SELECT public.office_einvoice_artifact_read($1,$2) AS result', [TENANT, saved.invoice_id]);
  const bytes = Buffer.from(original.xml_base64, 'base64');
  assert.equal(hash(bytes), validation.xmlSha256); assert.equal(original.report.status, 'valid'); assert.equal(original.report.documentSha256, hash(bytes));
  const invoice = (await db.query('SELECT status,invoice_number,issued_snapshot,e_invoice_xml_sha256 FROM public.invoices WHERE id=$1', [saved.invoice_id])).rows[0];
  assert.equal(invoice.status, 'ready'); assert.equal(invoice.invoice_number, view.invoice_number); assert.equal(invoice.e_invoice_xml_sha256, hash(bytes)); assert.deepEqual(invoice.issued_snapshot, view.snapshot);
  assert.ok(!bytes.includes('PRIVATE NOTE MUST NOT LEAVE OFFICE'));
  return bytes;
}
async function proofFixture() {
  await db.exec('RESET ROLE');
  const id = randomUUID(), assignment = randomUUID(), document = randomUUID(), signature = randomUUID();
  const pdf = Buffer.concat([embeddedPdf(), Buffer.from(`\n% synthetic proof ${id}\n`)]), path = `tenant/${TENANT}/synthetic-proofs/${id}.pdf`;
  await db.query("INSERT INTO public.assignments(id,tenant_id,client_id,employee_id,status,actual_start_at,actual_end_at) VALUES($1,$2,$3,$4,'completed','2026-10-17T08:00:00Z','2026-10-17T09:00:00Z')", [assignment, TENANT, CLIENT, USER]);
  await db.query("INSERT INTO public.documentation_entries(id,tenant_id,assignment_id,client_id,employee_id,status,free_text,updated_at) VALUES($1,$2,$3,$4,$5,'completed','Synthetic service description','2026-10-17T09:01:00Z')", [document, TENANT, assignment, CLIENT, USER]);
  await db.query("INSERT INTO public.signatures(id,tenant_id,assignment_id,documentation_entry_id,client_id,employee_id,status,signature_data,signer_name,signed_at) VALUES($1,$2,$3,$4,$5,$6,'signed','synthetic signature bytes','Synthetic signer','2026-10-17T09:02:00Z')", [signature, TENANT, assignment, document, CLIENT, USER]);
  await db.query(`INSERT INTO public.workflow_proof_attestations(id,tenant_id,assignment_id,legacy_documentation_id,legacy_signature_id,documentation_updated_at,signed_at,
    proof_payload_hash,signature_hash,service_started_at,service_ended_at,actual_minutes,pdf_storage_path,pdf_sha256,verified_at,producer_contract)
    VALUES($1,$2,$3,$4,$5,'2026-10-17T09:01:00Z','2026-10-17T09:02:00Z',$6,$7,'2026-10-17T08:00:00Z','2026-10-17T09:00:00Z',60,$8,$9,'2026-10-17T09:03:00Z','verified-original-bytes-v1')`,
    [randomUUID(), TENANT, assignment, document, signature, `sha256:${hash(Buffer.from('Synthetic service description'))}`, `sha256:${hash(Buffer.from('synthetic signature bytes'))}`, path, hash(pdf)]);
  await db.query(`INSERT INTO public.service_records(id,tenant_id,assignment_id,client_id,employee_id,service_date,status,actual_minutes,source_receipt)
    SELECT $1,a.tenant_id,a.id,a.client_id,a.employee_id,'2026-10-17','signed',60,
    jsonb_build_object('version','workflow-assignment-record-v1','tenant_id',a.tenant_id,'assignment_id',a.id,'client_id',a.client_id,'employee_id',a.employee_id,
      'service_started_at',a.actual_start_at,'service_ended_at',a.actual_end_at,'actual_minutes',60,'documentation_entry_id',d.id,'legacy_signature_id',s.id,
      'documentation_updated_at',d.updated_at,'signed_at',s.signed_at,'pdf_storage_path',att.pdf_storage_path,'pdf_sha256',att.pdf_sha256,'attested_at',att.verified_at)
    FROM public.assignments a JOIN public.documentation_entries d ON d.assignment_id=a.id JOIN public.signatures s ON s.documentation_entry_id=d.id
    JOIN public.workflow_proof_attestations att ON att.assignment_id=a.id WHERE a.id=$2`, [id, assignment]);
  await db.query("INSERT INTO storage.objects(bucket_id,name,metadata) VALUES('office-documents',$1,$2::jsonb)", [path, JSON.stringify({ mimetype: 'application/pdf', size: pdf.length })]);
  storage.set(path, pdf); return { id: `record:${id}`, path, pdf };
}

try {
  for (const file of ['scripts/fixtures/office-einvoice-test-schema.sql', 'scripts/fixtures/office-einvoice-flow-proofs.sql', 'scripts/sql/office-invoice-workspace.sql', 'scripts/sql/office-einvoice-workspace.sql']) await db.exec(readFileSync(resolve(root, file), 'utf8'));
  await db.query("INSERT INTO public.tenants(id,name,legal_name,street,postal_code,city,country,tax_number) VALUES($1,'Synthetic tenant','Synthetic tenant','Testweg','00000','Testort','Deutschland','TEST'),($2,'Other synthetic tenant','Other synthetic tenant','Testweg','00000','Testort','Deutschland','TEST')", [TENANT, OTHER]);
  await db.query("INSERT INTO public.roles(id,key,is_admin_role) VALUES($1,'owner',true)", [ROLE]);
  await db.query("INSERT INTO public.profiles(id,auth_user_id,tenant_id,role_id,is_active,status) VALUES($1,$2,$3,$4,true,'active')", [PROFILE, USER, TENANT, ROLE]);
  await db.query("INSERT INTO public.clients(id,tenant_id,first_name,last_name,billing_party) VALUES($1,$2,'Synthetic','Client','self_payer')", [CLIENT, TENANT]);
  await db.query("INSERT INTO public.tenant_billing_settings(tenant_id,invoice_prefix,next_invoice_number,bank_name,iban) VALUES($1,'TEST',1,'Fixture bank','DE89370400440532013000')", [TENANT]);
  let outgoing;
  await pass('outgoing: actual saved snapshot → UBL → XSD/Schematron → Edge receipt → atomic issue → exact original', async () => {
    const saved = await mutate('save_draft', draft()), view = await preview(saved);
    const checked = await validate(issueInput(saved, view));
    assert.equal(checked.validation.status, 'valid'); assert.ok(checked.validation.checks.every(check => check.status === 'passed'));
    outgoing = await finalize(saved, view, checked);
    assert.ok(outgoing.includes(view.invoice_number)); assert.ok(outgoing.includes('23.80'));
    assert.equal(await scalar('SELECT next_invoice_number AS result FROM public.tenant_billing_settings WHERE tenant_id=$1', [TENANT]), 2);
  });
  await pass('incoming XML: immutable import → actual API/rules → Edge receipt → exact redownload, distinct factual review', async () => {
    const imported = await importOriginal(outgoing), before = await incoming(imported.document_id);
    assert.equal(before.format_status, 'pending_validation');
    const checked = await validate({ action: 'validate_einvoice_inbox', tenantId: TENANT, documentId: imported.document_id });
    const after = await incoming(imported.document_id);
    assert.equal(checked.validation.status, 'valid'); assert.equal(after.format_status, 'valid'); assert.equal(after.business_status, 'unreviewed');
    assert.deepEqual(Buffer.from(after.original_base64, 'base64'), outgoing); assert.equal(after.validation_report.documentSha256, hash(outgoing));
    assert.equal((await importOriginal(outgoing)).document_id, imported.document_id);
  });
  await pass('incoming hybrid: actual PDF worker re-extracts XML before real format validation, original preserved', async () => {
    const pdf = embeddedPdf([outgoing.toString()]), imported = await importOriginal(pdf, outgoing, 'application/pdf');
    const checked = await validate({ action: 'validate_einvoice_inbox', tenantId: TENANT, documentId: imported.document_id });
    const stored = await incoming(imported.document_id);
    assert.equal(checked.validation.status, 'valid'); assert.equal(stored.validation_report.scope, 'structured_xml');
    assert.deepEqual(Buffer.from(stored.original_base64, 'base64'), pdf); assert.deepEqual(Buffer.from(stored.extracted_xml_base64, 'base64'), outgoing);
  });
  await pass('incoming mismatched hybrid XML cannot receive a server report', async () => {
    const changed = Buffer.from(outgoing.toString().replace('Synthetic Buyer', 'Different Buyer'));
    const imported = await importOriginal(embeddedPdf([changed.toString()]), outgoing, 'application/pdf'), calls = engineCalls;
    await validate({ action: 'validate_einvoice_inbox', tenantId: TENANT, documentId: imported.document_id }, 422);
    assert.equal(engineCalls, calls); assert.equal((await incoming(imported.document_id)).format_status, 'pending_validation');
  });
  await pass('incoming invalid totals retain real rule errors and never become valid', async () => {
    const invalid = Buffer.from(outgoing.toString().replace('<cbc:PayableAmount currencyID="EUR">23.80', '<cbc:PayableAmount currencyID="EUR">24.80'));
    assert.notEqual(hash(invalid), hash(outgoing)); const imported = await importOriginal(invalid);
    const checked = await validate({ action: 'validate_einvoice_inbox', tenantId: TENANT, documentId: imported.document_id });
    assert.equal(checked.validation.status, 'invalid'); assert.ok(checked.validation.findings.some(finding => finding.code === 'BR-CO-16'));
    assert.equal((await incoming(imported.document_id)).format_status, 'invalid');
  });
  await pass('a draft changed while actual validation runs has no trusted receipt or reserved invoice number', async () => {
    const saved = await mutate('save_draft', draft()), view = await preview(saved);
    afterValidation = () => mutate('save_draft', { ...draft(), notes: 'Concurrent synthetic edit' }, saved.invoice_id, saved.updated_at);
    await validate(issueInput(saved, view), 409);
    await db.exec('RESET ROLE');
    assert.equal(await scalar('SELECT count(*)::int AS result FROM care_security.office_einvoice_validations WHERE invoice_id=$1', [saved.invoice_id]), 0);
    assert.equal(await scalar('SELECT next_invoice_number AS result FROM public.tenant_billing_settings WHERE tenant_id=$1', [TENANT]), 2);
  });
  await pass('outgoing real business-rule failure cannot create a receipt or reserve a number', async () => {
    const data = draft(); data.e_invoice_metadata.buyerVatId = '12345';
    const saved = await mutate('save_draft', data), view = await preview(saved), calls = engineCalls;
    const checked = await validate(issueInput(saved, view), 422);
    assert.equal(engineCalls, calls + 1); assert.equal(checked.validation.status, 'invalid');
    assert.ok(checked.validation.findings.some(finding => finding.severity === 'error'));
    await db.exec('RESET ROLE');
    assert.equal(await scalar('SELECT count(*)::int AS result FROM care_security.office_einvoice_validations WHERE invoice_id=$1', [saved.invoice_id]), 0);
    assert.equal(await scalar('SELECT next_invoice_number AS result FROM public.tenant_billing_settings WHERE tenant_id=$1', [TENANT]), 2);
  });
  for (const proofCount of [1, 2]) await pass(`outgoing with ${proofCount} selected original PDF proof(s) preserves every embedded byte through final issue`, async () => {
    const selected = []; for (let index = 0; index < proofCount; index++) selected.push(await proofFixture());
    const data = { ...draft(), include_service_proofs: true, selected_proof_ids: selected.map(proof => proof.id) };
    const saved = await mutate('save_draft', data), view = await preview(saved);
    assert.equal(view.snapshot.proofs.length, proofCount);
    const checked = await validate(issueInput(saved, view)), bytes = await finalize(saved, view, checked);
    const embedded = [...bytes.toString().matchAll(/<cbc:EmbeddedDocumentBinaryObject[^>]*>([^<]+)<\/cbc:EmbeddedDocumentBinaryObject>/g)];
    assert.equal(embedded.length, proofCount);
    embedded.forEach((match, index) => assert.deepEqual(Buffer.from(match[1], 'base64'), selected[index].pdf));
  });
  await pass('a changed selected proof prevents validation and cannot be silently omitted', async () => {
    const selected = await proofFixture(), data = { ...draft(), include_service_proofs: true, selected_proof_ids: [selected.id] };
    const saved = await mutate('save_draft', data), view = await preview(saved), calls = engineCalls;
    storage.set(selected.path, Buffer.concat([selected.pdf, Buffer.from('\nchanged')]));
    await validate(issueInput(saved, view), 422); assert.equal(engineCalls, calls);
    await db.exec('RESET ROLE'); assert.equal(await scalar('SELECT count(*)::int AS result FROM care_security.office_einvoice_validations WHERE invoice_id=$1', [saved.invoice_id]), 0);
  });
  console.log(`[office-einvoice-flow] ${checks} isolated integration scenarios passed; ${engineCalls} actual pinned-rule engine executions. Auth/HTTP/Storage/PDF rendering and prior proof attestation remain fixture boundaries. No hosted/browser E2E or production-data test is claimed.`);
} catch (error) {
  console.error(`[office-einvoice-flow] FAIL ${error.message}`);
  if (error.where) console.error(error.where);
  process.exitCode = 1;
} finally { await db.close(); }
