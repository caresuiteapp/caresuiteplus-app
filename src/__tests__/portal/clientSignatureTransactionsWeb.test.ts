import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { beforeAll, beforeEach, afterAll, expect, it } from 'vitest';

// Real PostgreSQL transactions with isolated fixtures; no production connection or data.
let db: PGlite;
const tenant = '00000000-0000-0000-0000-000000000001';
const client = '00000000-0000-0000-0000-000000000002';
const visit = '00000000-0000-0000-0000-000000000003';
const proof = '00000000-0000-0000-0000-000000000004';
const signature = '00000000-0000-0000-0000-000000000005';
const request = '00000000-0000-0000-0000-000000000006';
const hash = 'a'.repeat(64);
const pdf = `tenant/${tenant}/assist/visits/${visit}/proofs/${proof}-${signature}-test.pdf`;
const sigPath = `tenant/${tenant}/assist/visits/${visit}/signatures/${signature}.png`;
const schema = `
CREATE ROLE authenticated; CREATE ROLE anon; CREATE SCHEMA auth; CREATE SCHEMA storage;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.user', true), '')::uuid $$;
CREATE FUNCTION current_tenant_id() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.tenant', true), '')::uuid $$;
CREATE FUNCTION current_client_id() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.client', true), '')::uuid $$;
CREATE FUNCTION is_client_portal_rls_context(t uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT t = current_tenant_id() AND current_setting('test.role', true) IN ('client_portal','family_portal') $$;
CREATE TABLE assist_visits(id uuid PRIMARY KEY, tenant_id uuid, client_id uuid, planning_status text DEFAULT 'published', canonical_status text DEFAULT 'completed');
CREATE TABLE assist_visit_signatures(id uuid PRIMARY KEY, tenant_id uuid, visit_id uuid, signer_role text, signer_name text, is_valid boolean, metadata jsonb, signed_at timestamptz, storage_path text);
CREATE TABLE assist_visit_proofs(id uuid PRIMARY KEY, tenant_id uuid, visit_id uuid, signature_id uuid, proof_number text, payload_snapshot jsonb, payload_hash text, pdf_storage_path text, pdf_hash text, portal_visible boolean, portal_release_status text, status text, updated_at timestamptz);
CREATE TABLE client_documents(id uuid PRIMARY KEY, tenant_id uuid, client_id uuid, title text, file_name text, mime_type text, category text, storage_path text, portal_visible boolean, status text, sensitivity text, source text, signed_at timestamptz, signature_required boolean, updated_at timestamptz);
CREATE TABLE assist_visit_execution_state(tenant_id uuid, visit_id uuid, current_step text, assignment_status text, signature_complete boolean, proof_generated boolean, finalized_at timestamptz, updated_at timestamptz, PRIMARY KEY(tenant_id, visit_id));
CREATE TABLE cs_document_requests(id uuid PRIMARY KEY, owner_tenant_id uuid, client_id uuid, portal_visible boolean, recipient_scope text, status text, rendered_html text, updated_at timestamptz, completed_at timestamptz);
CREATE TABLE cs_document_request_signatures(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), request_id uuid, signer_role text, status text, signer_name text, signature_data_url text, signed_at timestamptz, updated_at timestamptz);
CREATE TABLE audit_logs(tenant_id uuid, action text, entity_type text, entity_id uuid, table_name text, metadata jsonb);
CREATE TABLE storage.objects(bucket_id text, name text PRIMARY KEY);
CREATE FUNCTION fail_test_write() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected write failure'; END $$;
`;
beforeAll(async () => {
  db = new PGlite(); await db.exec(schema);
  await db.exec(readFileSync('supabase/migrations/20260911120000_client_portal_signature_completion.sql', 'utf8'));
}, 30000);
afterAll(async () => { await db?.close(); });
beforeEach(async () => {
  await db.exec(`DROP TRIGGER IF EXISTS test_failure ON assist_visit_execution_state; DROP TRIGGER IF EXISTS test_failure ON audit_logs;
    TRUNCATE assist_visits, assist_visit_signatures, assist_visit_proofs, client_documents, assist_visit_execution_state, cs_document_requests, cs_document_request_signatures, audit_logs, storage.objects;
    SELECT set_config('test.user','${client}',false),set_config('test.client','${client}',false),set_config('test.tenant','${tenant}',false),set_config('test.role','client_portal',false);
    INSERT INTO assist_visits(id,tenant_id,client_id) VALUES('${visit}','${tenant}','${client}');
    INSERT INTO assist_visit_signatures VALUES('${signature}','${tenant}','${visit}','client','Testperson',true,'{"proofId":"${proof}","signedVia":"client_portal"}','2026-09-11T10:00:00Z','${sigPath}');
    INSERT INTO assist_visit_proofs(id,tenant_id,visit_id,payload_snapshot,payload_hash,portal_visible,portal_release_status,status) VALUES('${proof}','${tenant}','${visit}','{"title":"Haushalt"}','original',true,'pending_client_signature','draft');
    INSERT INTO client_documents(id,tenant_id,client_id,source,portal_visible,signature_required,status) VALUES('${proof}','${tenant}','${client}','assist_visit_proof',true,true,'aktiv');
    INSERT INTO storage.objects VALUES('office-documents','${sigPath}'),('office-documents','${pdf}');
    INSERT INTO cs_document_requests VALUES('${request}','${tenant}','${client}',true,'client','sent','<p>Originalvertrag</p><span data-signature-anchor="client_signature">[SIGNATURE:client_signature]</span>','2026-09-11T09:00:00Z',NULL);
    INSERT INTO cs_document_request_signatures(request_id,signer_role,status) VALUES('${request}','client','pending');`);
});
const complete = () => db.query('SELECT client_portal_finalize_assist_proof($1,$2,$3,$4,$5,$6,$7) AS receipt', [tenant, proof, signature, 'original', hash, pdf, hash]);
const signDocument = (name = 'Testperson') => db.query('SELECT client_portal_sign_document_request($1,$2,$3,$4,$5,$6)', [tenant, request, 'client', name, 'data:image/png;base64,AAAA', '2026-09-11T09:00:00Z']);
it('commits proof, signed portal document and workflow together', async () => {
  await complete();
  expect((await db.query('SELECT status, signature_id, pdf_storage_path FROM assist_visit_proofs')).rows[0]).toEqual({ status: 'pending_review', signature_id: signature, pdf_storage_path: pdf });
  expect((await db.query('SELECT signature_required, storage_path FROM client_documents')).rows[0]).toEqual({ signature_required: false, storage_path: pdf });
  expect((await db.query('SELECT signature_complete, proof_generated FROM assist_visit_execution_state')).rows[0]).toEqual({ signature_complete: true, proof_generated: true });
});
it('rolls back portal and proof changes if the final workflow write fails', async () => {
  await db.exec('CREATE TRIGGER test_failure BEFORE INSERT ON assist_visit_execution_state FOR EACH ROW EXECUTE FUNCTION fail_test_write()');
  await expect(complete()).rejects.toThrow('injected write failure');
  expect((await db.query('SELECT signature_id, status FROM assist_visit_proofs')).rows[0]).toEqual({ signature_id: null, status: 'draft' });
  expect((await db.query('SELECT signature_required FROM client_documents')).rows[0]).toEqual({ signature_required: true });
});
it('returns the same completion receipt on retry', async () => {
  expect((await complete()).rows).toEqual((await complete()).rows);
});
it.each(['other_client','other_tenant','anonymous','internal_role','revoked','changed_payload','invalid_signature','missing_pdf','wrong_document_owner'])('refuses %s without clearing the open task', async (failure) => {
  const other = '00000000-0000-0000-0000-000000000009';
  if (failure === 'other_client') await db.exec(`SELECT set_config('test.client','${other}',false)`);
  if (failure === 'other_tenant') await db.exec(`SELECT set_config('test.tenant','${other}',false)`);
  if (failure === 'anonymous') await db.exec("SELECT set_config('test.user','',false)");
  if (failure === 'internal_role') await db.exec("SELECT set_config('test.role','employee_portal',false)");
  if (failure === 'revoked') await db.exec("UPDATE assist_visit_proofs SET portal_release_status='revoked'");
  if (failure === 'changed_payload') await db.exec("UPDATE assist_visit_proofs SET payload_hash='changed'");
  if (failure === 'invalid_signature') await db.exec('UPDATE assist_visit_signatures SET is_valid=false');
  if (failure === 'missing_pdf') await db.query('DELETE FROM storage.objects WHERE name=$1',[pdf]);
  if (failure === 'wrong_document_owner') await db.exec(`UPDATE client_documents SET client_id='${other}'`);
  await expect(complete()).rejects.toThrow();
  expect((await db.query('SELECT signature_required FROM client_documents')).rows[0]).toEqual({ signature_required: true });
});
it('preserves original contract text and escapes the signer name when adding the signature', async () => {
  await signDocument('<Test & Person>');
  const row = (await db.query<{ rendered_html: string; status: string }>('SELECT rendered_html,status FROM cs_document_requests')).rows[0];
  expect(row.status).toBe('completed'); expect(row.rendered_html).toContain('<p>Originalvertrag</p>');
  expect(row.rendered_html).toContain('&lt;Test &amp; Person&gt;'); expect(row.rendered_html).not.toContain('[SIGNATURE:');
  await expect(signDocument()).resolves.toBeDefined();
});
it('leaves the office signature pending after the client has signed', async () => {
  await db.exec(`INSERT INTO cs_document_request_signatures(request_id,signer_role,status) VALUES('${request}','office','pending')`);
  await signDocument();
  expect((await db.query('SELECT status FROM cs_document_requests')).rows[0]).toEqual({ status: 'partially_signed' });
  expect((await db.query("SELECT signer_role FROM cs_document_request_signatures WHERE status='pending'")).rows).toEqual([{ signer_role: 'office' }]);
});
it('rolls back a template signature when its audit write fails', async () => {
  await db.exec('CREATE TRIGGER test_failure BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION fail_test_write()');
  await expect(signDocument()).rejects.toThrow('injected write failure');
  expect((await db.query('SELECT status FROM cs_document_request_signatures')).rows[0]).toEqual({ status: 'pending' });
  expect((await db.query('SELECT status FROM cs_document_requests')).rows[0]).toEqual({ status: 'sent' });
});
it('rejects a template that changed after preview', async () => {
  await db.exec("UPDATE cs_document_requests SET updated_at='2026-09-11T09:01:00Z'");
  await expect(signDocument()).rejects.toThrow('geändert');
  expect((await db.query('SELECT status FROM cs_document_request_signatures')).rows[0]).toEqual({ status: 'pending' });
});
it('limits signature image access to the owning client', async () => {
  expect((await db.query('SELECT client_portal_can_read_assist_signature($1) AS allowed',[sigPath])).rows[0]).toEqual({ allowed: true });
  await db.exec("SELECT set_config('test.client','00000000-0000-0000-0000-000000000009',false)");
  expect((await db.query('SELECT client_portal_can_read_assist_signature($1) AS allowed',[sigPath])).rows[0]).toEqual({ allowed: false });
});
it('repairs a historical signed proof with an outdated unsigned PDF', async () => {
  await db.exec(`UPDATE assist_visit_proofs SET signature_id='${signature}', portal_release_status='released', pdf_storage_path='old-unsigned.pdf', payload_snapshot=payload_snapshot || '{"signedViaClientPortal":true,"clientPortalSignedAt":"2026-09-11T10:00:00.000Z"}'`);
  expect((await db.query('SELECT client_portal_can_upload_proof_recovery($1) AS allowed',[pdf])).rows[0]).toEqual({ allowed: true });
  await complete();
  expect((await db.query("SELECT pdf_storage_path, payload_snapshot->>'clientPortalPdfSignatureId' AS pdf_signature FROM assist_visit_proofs")).rows[0]).toEqual({ pdf_storage_path: pdf, pdf_signature: signature });
});
it('does not call a document fully signed when another role declined', async () => {
  await db.exec(`INSERT INTO cs_document_request_signatures(request_id,signer_role,status) VALUES('${request}','office','declined')`);
  await signDocument();
  expect((await db.query('SELECT status FROM cs_document_requests')).rows[0]).toEqual({ status: 'partially_signed' });
});
