/** Isolated integration of the existing Office SQL, GKV SQL and export API.
 * Auth claims, HTTP routing, PDF production and object storage are explicit local
 * fixtures. The Office source/signature/attestation checkers run unchanged.
 * No network listener, hosted business row, provider or additional installation.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createGkvTestExportHandler } from '../../api/_lib/gkv-test-export.ts';
import { importInvoiceCase, readSourceSnapshot } from '../../src/lib/gkvExchange/sources.ts';
import { validateDraft } from '../../src/lib/gkvExchange/model.ts';
import { fixture, tenantId as TENANT, userId as USER, pdfBytes } from './fixtures.mjs';

const packageRoot = process.argv[2];
const { PGlite } = await import(packageRoot ? pathToFileURL(resolve(packageRoot, 'dist/index.js')).href : '@electric-sql/pglite');
const { pgcrypto } = await import(packageRoot ? pathToFileURL(resolve(packageRoot, 'dist/contrib/pgcrypto.js')).href : '@electric-sql/pglite/contrib/pgcrypto');
const db = new PGlite({ extensions: { pgcrypto } });
const PROFILE = randomUUID(), ROLE = randomUUID(), CLIENT = randomUUID(), OTHER = randomUUID();
const recordId = randomUUID(), assignmentId = randomUUID(), documentId = randomUUID(), signatureId = randomUUID();
const proofPath = `tenant/${TENANT}/proofs/${recordId}.pdf`;
const storage = new Map([[proofPath, pdfBytes]]);
const hash = value => createHash('sha256').update(value).digest('hex');
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const scalar = async (sql, args = []) => (await db.query(sql, args)).rows[0].result;
let scope = { tenant: TENANT, portal: 'business', role: 'authenticated' }, afterPdf = null;

async function actor(next = scope) {
  scope = next;
  await db.exec('RESET ROLE');
  await db.query("SELECT set_config('test.uid',$1,false),set_config('test.tenant',$2,false),set_config('test.portal',$3,false),set_config('test.jwt_role',$4,false)", [USER, scope.tenant, scope.portal, scope.role]);
  assert.ok(['authenticated', 'anon'].includes(scope.role));
  await db.exec(`SET ROLE ${scope.role}`);
}
async function admin(sql, args = []) {
  await db.exec('RESET ROLE');
  try { return await db.query(sql, args); } finally { await actor(); }
}
const command = (action, input, request = randomUUID()) => scalar('SELECT public.gkv_exchange_command($1,$2,$3,$4::jsonb) AS result', [TENANT, request, action, JSON.stringify(input)]);
const snapshot = id => scalar('SELECT public.gkv_invoice_source_snapshot($1,$2::uuid[]) AS result', [TENANT, [id]]);
const invoiceCommand = (operation, input, id = null, updated = null) => scalar('SELECT public.office_invoice_mutation($1,$2,$3,$4,$5,$6::jsonb) AS result', [TENANT, randomUUID(), id, updated, operation, JSON.stringify(input)]);
const api = createGkvTestExportHandler({
  env: { EXPO_PUBLIC_SUPABASE_URL: 'https://gkv-fixture.invalid', EXPO_PUBLIC_SUPABASE_ANON_KEY: 'synthetic-anon-key' },
  fetch: async (input, options) => {
    const url = new URL(input);
    assert.equal(url.origin, 'https://gkv-fixture.invalid');
    assert.equal(options.headers.Authorization, 'Bearer synthetic-token');
    assert.equal(options.redirect, 'error');
    await actor();
    try {
      if (url.pathname === '/auth/v1/user') return json({ id: USER });
      if (url.pathname === '/rest/v1/rpc/gkv_exchange_export_allowed') {
        const args = JSON.parse(options.body);
        return json(await scalar('SELECT public.gkv_exchange_export_allowed($1) AS result', [args.p_tenant_id]));
      }
      if (url.pathname === '/rest/v1/rpc/gkv_invoice_source_snapshot') {
        const args = JSON.parse(options.body);
        return json(await scalar('SELECT public.gkv_invoice_source_snapshot($1,$2::uuid[]) AS result', [args.p_tenant_id, args.p_invoice_ids]));
      }
      if (url.pathname === '/rest/v1/gkv_exchange_batches') {
        assert.equal(url.searchParams.get('select'), 'id,tenant_id,revision,status,draft');
        const tenant = url.searchParams.get('tenant_id'), id = url.searchParams.get('id');
        assert.ok(tenant.startsWith('eq.') && id.startsWith('eq.'));
        return json((await db.query('SELECT id,tenant_id,revision,status,draft FROM public.gkv_exchange_batches WHERE tenant_id=$1 AND id=$2', [tenant.slice(3), id.slice(3)])).rows);
      }
      if (url.pathname.startsWith('/storage/v1/object/authenticated/office-documents/')) {
        const path = decodeURIComponent(url.pathname.split('/office-documents/')[1]);
        if (!storage.has(path)) return json({}, 404);
        const bytes = storage.get(path);
        if (afterPdf) { const action = afterPdf; afterPdf = null; await action(); }
        return new Response(bytes, { headers: { 'Content-Type': 'application/pdf' } });
      }
      assert.fail(`Unexpected route ${url.pathname}`);
    } catch (error) {
      if (!error.code) throw error;
      return json({ code: error.code, message: error.message }, error.code === '42501' ? 403 : 409);
    }
  },
});
async function exportBatch(batch, expected = 200) {
  let status, body; const headers = {};
  await api({ method: 'POST', headers: { authorization: 'Bearer synthetic-token' }, body: { tenantId: TENANT, batchId: batch.id, revision: batch.revision } }, {
    setHeader(name, value) { headers[name] = value; }, status(value) { status = value; return this; }, json(value) { body = value; },
  });
  assert.equal(status, expected, JSON.stringify(body));
  assert.equal(headers['Cache-Control'], 'private, no-store');
  if (expected !== 200) { assert.equal(body.ok, false); assert.equal(body.dataBase64, undefined); assert.equal(body.orderBase64, undefined); }
  return body;
}

try {
  for (const file of ['scripts/fixtures/office-einvoice-test-schema.sql', 'scripts/fixtures/office-einvoice-flow-proofs.sql', 'scripts/sql/office-invoice-workspace.sql', 'scripts/sql/office-einvoice-workspace.sql',
    'supabase/migrations/20261019214752_gkv_exchange_workspace.sql', 'supabase/migrations/20261019214757_gkv_invoice_source_snapshot.sql', 'supabase/migrations/20261019214802_gkv_revision_history.sql']) {
    await db.exec(await readFile(new URL(`../../${file}`, import.meta.url), 'utf8'));
  }
  await db.query("INSERT INTO public.tenants(id,name,legal_name,street,postal_code,city,country,tax_number) VALUES($1,'Synthetic care','Synthetic care','Testweg','00000','Testort','Deutschland','TEST'),($2,'Other fixture','Other fixture','Testweg','00000','Testort','Deutschland','TEST')", [TENANT, OTHER]);
  await db.query("INSERT INTO public.roles(id,key,is_admin_role,tenant_id) VALUES($1,'owner',true,$2)", [ROLE, TENANT]);
  await db.query("INSERT INTO public.profiles(id,auth_user_id,tenant_id,role_id,is_active,status) VALUES($1,$2,$3,$4,true,'active')", [PROFILE, USER, TENANT, ROLE]);
  await db.query("INSERT INTO public.clients(id,tenant_id,first_name,last_name,date_of_birth,care_level,insurance_number,billing_party) VALUES($1,$2,'Erika','Mustermann','1950-01-01','2','A123456789','care_insurance')", [CLIENT, TENANT]);
  await db.query("INSERT INTO public.tenant_billing_settings(tenant_id,invoice_prefix,next_invoice_number,bank_name,iban) VALUES($1,'CS',1,'Fixture bank','DE89370400440532013000')", [TENANT]);
  await db.query("INSERT INTO public.assignments VALUES($1,$2,$3,$4,'completed','2026-10-17T08:00:00Z','2026-10-17T09:00:00Z')", [assignmentId, TENANT, CLIENT, USER]);
  await db.query("INSERT INTO public.documentation_entries(id,tenant_id,assignment_id,client_id,employee_id,status,free_text,updated_at) VALUES($1,$2,$3,$4,$5,'completed','Synthetic care notes','2026-10-17T09:01:00Z')", [documentId, TENANT, assignmentId, CLIENT, USER]);
  await db.query("INSERT INTO public.signatures(id,tenant_id,assignment_id,documentation_entry_id,client_id,employee_id,status,signature_data,signer_name,signed_at) VALUES($1,$2,$3,$4,$5,$6,'signed','synthetic signature','Synthetic signer','2026-10-17T09:02:00Z')", [signatureId, TENANT, assignmentId, documentId, CLIENT, USER]);
  await db.query(`INSERT INTO public.workflow_proof_attestations(id,tenant_id,assignment_id,legacy_documentation_id,legacy_signature_id,documentation_updated_at,signed_at,
    proof_payload_hash,signature_hash,service_started_at,service_ended_at,actual_minutes,pdf_storage_path,pdf_sha256,verified_at,producer_contract)
    VALUES($1,$2,$3,$4,$5,'2026-10-17T09:01:00Z','2026-10-17T09:02:00Z',$6,$7,'2026-10-17T08:00:00Z','2026-10-17T09:00:00Z',60,$8,$9,'2026-10-17T09:03:00Z','verified-original-bytes-v1')`,
  [randomUUID(), TENANT, assignmentId, documentId, signatureId, `sha256:${hash('Synthetic care notes')}`, `sha256:${hash('synthetic signature')}`, proofPath, hash(pdfBytes)]);
  await db.query(`INSERT INTO public.service_records(id,tenant_id,assignment_id,client_id,employee_id,service_date,product_key,status,actual_minutes,billable_minutes,hourly_rate,total_amount,source_receipt)
    SELECT $1,a.tenant_id,a.id,a.client_id,a.employee_id,'2026-10-17','beratung','billable',60,60,80,80,
      jsonb_build_object('version','workflow-assignment-record-v1','tenant_id',a.tenant_id,'assignment_id',a.id,'client_id',a.client_id,'employee_id',a.employee_id,
        'service_started_at',a.actual_start_at,'service_ended_at',a.actual_end_at,'actual_minutes',60,'documentation_entry_id',d.id,'legacy_signature_id',s.id,
        'documentation_updated_at',d.updated_at,'signed_at',s.signed_at,'pdf_storage_path',att.pdf_storage_path,'pdf_sha256',att.pdf_sha256,'attested_at',att.verified_at)
    FROM public.assignments a JOIN public.documentation_entries d ON d.assignment_id=a.id JOIN public.signatures s ON s.documentation_entry_id=d.id
    JOIN public.workflow_proof_attestations att ON att.assignment_id=a.id WHERE a.id=$2`, [recordId, assignmentId]);
  await db.query("INSERT INTO storage.objects(bucket_id,name,metadata) VALUES('office-documents',$1,$2::jsonb)", [proofPath, JSON.stringify({ mimetype: 'application/pdf', size: pdfBytes.length })]);
  await actor();
  let saved, current, source;
  await test('actual Office issue → verified GKV import → saved revision → API bytes and hash', async () => {
    const updated = await scalar('SELECT updated_at::text AS result FROM public.service_records WHERE id=$1', [recordId]);
    saved = await invoiceCommand('save_draft', { client_id: CLIENT, invoice_date: '2026-10-18', due_date: '2026-11-01', service_period_from: '2026-10-01', service_period_to: '2026-10-18',
      recipient_type: 'client', billing_party: 'care_insurance', recipient_name: 'Erika Mustermann', recipient_street: 'Testweg', recipient_postal_code: '00000', recipient_city: 'Testort', recipient_country: 'Deutschland',
      footer_text: 'Synthetischer steuerbefreiter Testfall', include_service_proofs: true, selected_proof_ids: [`record:${recordId}`],
      lines: [{ description: 'Synthetic visit', quantity: 1, unit: 'Stunde', unit_price_cents: 8000, vat_rate: 0, product_key: 'beratung', service_date: '2026-10-17', service_record_id: recordId, source_updated_at: updated }] });
    await assert.rejects(snapshot(saved.invoice_id), error => error.code === '40001');
    const view = await scalar('SELECT public.office_invoice_issue_preview($1,$2,$3) AS result', [TENANT, saved.invoice_id, saved.updated_at]);
    const path = `tenant/${TENANT}/generated/invoice-${saved.invoice_id}/${hash(pdfBytes)}.pdf`;
    await admin("INSERT INTO public.document_render_jobs(tenant_id,related_entity_table,related_entity_id,job_status,pdf_path,created_by) VALUES($1,'invoices',$2,'completed',$3,$4)", [TENANT, saved.invoice_id, path, PROFILE]);
    await admin("INSERT INTO storage.objects(bucket_id,name,metadata) VALUES('office-documents',$1,$2::jsonb)", [path, JSON.stringify({ mimetype: 'application/pdf', size: pdfBytes.length })]);
    await invoiceCommand('set_status', { status: 'ready', invoice_number: view.invoice_number, company_snapshot: view.company_snapshot, source_revision: view.source_revision, pdf_sha256: hash(pdfBytes), pdf_file_path: path }, saved.invoice_id, saved.updated_at);
    source = readSourceSnapshot(await snapshot(saved.invoice_id), TENANT, [saved.invoice_id])[0];
    const draft = fixture(); draft.cases = [importInvoiceCase(source, '2026-10')];
    Object.assign(draft.cases[0], { documentNumber: 'BELEG1', proofConfirmed: true });
    Object.assign(draft.cases[0].lines[0], { remuneration: '08', qualification: '0', code: '1', employeeNumber: '123456789' });
    assert.deepEqual(validateDraft(draft), []);
    current = await command('save', { new_id: randomUUID(), draft });
    const result = await exportBatch(current);
    assert.equal(hash(Buffer.from(result.dataBase64, 'base64')), result.sha256);
    assert.equal(Buffer.from(result.orderBase64, 'base64').length, 348);
    assert.equal(result.sourceReport.checkedInvoices, 1); assert.equal(result.sourceReport.checkedServiceRecords, 1); assert.equal(result.sourceReport.checkedPdfFiles, 1);
    assert.ok(Buffer.from(result.dataBase64, 'base64').includes(view.invoice_number));
  });
  await test('changed documentation, signature, pause, assignment and attestation are rejected by actual Office checks', async () => {
    const cases = [
      ["UPDATE documentation_entries SET free_text='changed' WHERE id=$1", "UPDATE documentation_entries SET free_text='Synthetic care notes' WHERE id=$1", documentId],
      ["UPDATE signatures SET signature_data='changed' WHERE id=$1", "UPDATE signatures SET signature_data='synthetic signature' WHERE id=$1", signatureId],
      ["UPDATE signatures SET signed_at='2026-10-17T09:00:00Z' WHERE id=$1", "UPDATE signatures SET signed_at='2026-10-17T09:02:00Z' WHERE id=$1", signatureId],
      ["UPDATE assignments SET status='planned' WHERE id=$1", "UPDATE assignments SET status='completed' WHERE id=$1", assignmentId],
      ["UPDATE workflow_proof_attestations SET producer_contract='unverified' WHERE assignment_id=$1", "UPDATE workflow_proof_attestations SET producer_contract='verified-original-bytes-v1' WHERE assignment_id=$1", assignmentId],
    ];
    for (const [change, restore, id] of cases) {
      await admin(change, [id]); await assert.rejects(snapshot(saved.invoice_id)); await exportBatch(current, 409); await admin(restore, [id]);
    }
    await admin("INSERT INTO time_entries VALUES($1,$2,$3,'paused','2026-10-17T08:30:00Z'),($4,$2,$3,'resumed','2026-10-17T08:40:00Z')", [randomUUID(), TENANT, assignmentId, randomUUID()]);
    await exportBatch(current, 409); await admin('DELETE FROM time_entries WHERE assignment_id=$1', [assignmentId]);
    await exportBatch(current);
  });
  await test('missing object, different PDF bytes and changes during streaming return no file', async () => {
    await admin("UPDATE storage.objects SET metadata='{}' WHERE name=$1", [proofPath]); await exportBatch(current, 409);
    await admin("UPDATE storage.objects SET metadata=$1::jsonb WHERE name=$2", [JSON.stringify({ mimetype: 'application/pdf', size: pdfBytes.length }), proofPath]);
    storage.set(proofPath, Buffer.from('%PDF-1.7\nchanged')); await exportBatch(current, 409); storage.set(proofPath, pdfBytes);
    afterPdf = () => admin("UPDATE documentation_entries SET free_text='changed during export' WHERE id=$1", [documentId]);
    await exportBatch(current, 409); await admin("UPDATE documentation_entries SET free_text='Synthetic care notes' WHERE id=$1", [documentId]);
    afterPdf = async () => { current = await command('save', { id: current.id, revision: current.revision, draft: { ...current.draft, sequence: 2 } }); };
    const old = current; await exportBatch(old, 409); await exportBatch(current);
  });
  await test('role, active-profile, portal and tenant revocation block the integrated API', async () => {
    await admin("UPDATE roles SET key='viewer',is_admin_role=false WHERE id=$1", [ROLE]);
    await admin("INSERT INTO role_permissions(role_id,tenant_id,permission_key,can_view) VALUES($1,$2,'office.invoices.view',true)", [ROLE, TENANT]);
    await exportBatch(current, 403);
    await admin("UPDATE roles SET key='owner',is_admin_role=true WHERE id=$1", [ROLE]);
    await admin('UPDATE profiles SET is_active=false WHERE id=$1', [PROFILE]); await exportBatch(current, 403); await admin('UPDATE profiles SET is_active=true WHERE id=$1', [PROFILE]);
    for (const change of [{ tenant: OTHER }, { portal: 'client' }, { portal: 'employee' }, { role: 'anon' }]) {
      await actor({ tenant: TENANT, portal: 'business', role: 'authenticated', ...change }); await exportBatch(current, 403);
    }
    await actor({ tenant: TENANT, portal: 'business', role: 'authenticated' }); await exportBatch(current);
  });
  await test('history copy keeps the issued source, resets proof confirmation and requires a fresh export check', async () => {
    const input = { batch_id: current.id, expected_revision: current.revision, source_revision: 1, new_id: randomUUID(), reason: 'Synthetic historical copy' };
    const copied = await scalar('SELECT public.gkv_exchange_copy_revision($1,$2,$3::jsonb) AS result', [TENANT, randomUUID(), JSON.stringify(input)]);
    assert.equal(copied.origin_batch_id, current.id); assert.equal(copied.origin_revision, 1);
    assert.equal(copied.draft.cases[0].sourceInvoiceId, saved.invoice_id); assert.equal(copied.draft.cases[0].proofConfirmed, false);
    await exportBatch(copied, 422);
    copied.draft.cases[0].proofConfirmed = true;
    const checked = await command('save', { id: copied.id, revision: copied.revision, draft: copied.draft });
    await exportBatch(checked);
  });
} finally { await db.close(); }
