import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { companyFixture, id } from './company_access_fixture.mjs';

// Isolated Postgres behavior tests with synthetic records and the real company
// permission functions. No network/production database access. PGlite queues
// connections, so concurrent-session lock timing remains a separate E2E check.
const sql = readFileSync(new URL('../migrations/20261016063709_document_workspace_review.sql', import.meta.url), 'utf8');
const f = await companyFixture();
const { db, actor, owner } = f;
const tenant = id(10);
const sourcePath = (upload, person=300, kind='clients') => `tenant/${tenant}/${kind}/${id(person)}/portal-uploads/${id(upload)}/${id(upload)}.pdf`;
const review = async (upload, decision='approve', note=null, scope=tenant) => (await db.query('SELECT public.office_review_portal_upload($1,$2,$3,$4) result',[scope,id(upload),decision,note])).rows[0].result;
try {
  await owner();
  await db.exec(`
    CREATE SCHEMA storage;
    CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text NOT NULL,name text NOT NULL,UNIQUE(bucket_id,name));
    CREATE TABLE clients(id uuid PRIMARY KEY,tenant_id uuid NOT NULL);
    CREATE TYPE portal_upload_status AS ENUM('hochgeladen','wird_geprueft','freigegeben','abgelehnt');
    CREATE TYPE portal_request_status AS ENUM('offen','in_bearbeitung','erledigt','abgelehnt','zurueckgestellt');
    CREATE TABLE portal_requests(id uuid PRIMARY KEY,tenant_id uuid NOT NULL,client_id uuid,request_type text NOT NULL,status portal_request_status NOT NULL DEFAULT 'offen',payload jsonb NOT NULL DEFAULT '{}',updated_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE client_documents(id uuid PRIMARY KEY,tenant_id uuid NOT NULL,client_id uuid NOT NULL REFERENCES clients(id),title text NOT NULL,file_name text NOT NULL,mime_type text NOT NULL,category text NOT NULL,storage_path text,size_bytes bigint,uploaded_by uuid REFERENCES profiles(id),status text NOT NULL,sensitivity text NOT NULL,source text,portal_visible boolean NOT NULL DEFAULT false);
    CREATE TABLE employee_documents(id uuid PRIMARY KEY,tenant_id uuid NOT NULL,employee_id uuid NOT NULL REFERENCES employees(id),title text NOT NULL,category text NOT NULL,file_name text NOT NULL,storage_path text,sensitive boolean NOT NULL DEFAULT false,released_to_portal boolean NOT NULL DEFAULT false);
    CREATE TABLE portal_uploads(id uuid PRIMARY KEY,tenant_id uuid NOT NULL,client_id uuid REFERENCES clients(id),employee_id uuid REFERENCES employees(id),upload_context text NOT NULL DEFAULT 'klient' CHECK(upload_context IN('klient','mitarbeiter')),portal_request_id uuid REFERENCES portal_requests(id),storage_path text NOT NULL,file_name text NOT NULL,mime_type text NOT NULL,size_bytes bigint,category text,status portal_upload_status NOT NULL DEFAULT 'hochgeladen',reviewed_by uuid REFERENCES profiles(id),reviewed_at timestamptz,review_note text,client_document_id uuid REFERENCES client_documents(id),updated_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE tenant_document_settings(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL UNIQUE,bank_name text);
    ALTER TABLE tenant_document_settings ENABLE ROW LEVEL SECURITY;
    CREATE POLICY tenant_document_settings_tenant ON tenant_document_settings FOR ALL TO authenticated USING(tenant_id=public.current_tenant_id()) WITH CHECK(tenant_id=public.current_tenant_id());
    GRANT SELECT,INSERT,UPDATE,DELETE ON tenant_document_settings TO authenticated;
    GRANT USAGE ON SCHEMA storage TO authenticated;
    GRANT SELECT ON storage.objects,clients,portal_uploads,portal_requests,client_documents,employee_documents TO authenticated;
  `);
  await db.query('INSERT INTO clients VALUES($1,$2),($3,$4)',[id(300),tenant,id(301),id(11)]);
  await db.exec(sql);
  async function seed(upload, {employee=false, request=null, path, client=300, category='sonstige', object=true}={}) {
    await owner();
    const storagePath = path ?? sourcePath(upload,employee?40:client,employee?'employees':'clients');
    if(request) await db.query("INSERT INTO portal_requests(id,tenant_id,client_id,request_type,payload) VALUES($1,$2,$3,'upload',$4)",[id(request),tenant,employee?null:id(client),JSON.stringify({uploadId:id(upload)})]);
    await db.query("INSERT INTO portal_uploads(id,tenant_id,client_id,employee_id,upload_context,portal_request_id,storage_path,file_name,mime_type,size_bytes,category) VALUES($1,$2,$3,$4,$5,$6,$7,'Eingang.pdf','application/pdf',128,$8)",[id(upload),tenant,employee?null:id(client),employee?id(40):null,employee?'mitarbeiter':'klient',request?id(request):null,storagePath,category]);
    if(object) await db.query("INSERT INTO storage.objects(bucket_id,name) VALUES('office-documents',$1)",[storagePath]);
    await actor();
  }

  await test('settings persist for verified authorized staff; portal, ordinary and foreign users cannot change them',async()=>{
    await actor();
    await db.query("INSERT INTO tenant_document_settings(tenant_id,bank_name) VALUES($1,'Eigene Bank')",[tenant]);
    assert.equal((await db.query("UPDATE tenant_document_settings SET bank_name='Geprüft' RETURNING bank_name")).rows[0].bank_name,'Geprüft');
    await actor(21);
    assert.equal((await db.query("UPDATE tenant_document_settings SET bank_name='Unberechtigt' RETURNING id")).rows.length,0);
    await assert.rejects(db.query('INSERT INTO tenant_document_settings(tenant_id) VALUES($1)',[tenant]),/row-level security/);
    await actor(22);
    assert.equal((await db.query('DELETE FROM tenant_document_settings RETURNING id')).rows.length,0);
    await actor(24,11);
    assert.equal((await db.query('SELECT id FROM tenant_document_settings')).rows.length,0);
    await assert.rejects(db.query('INSERT INTO tenant_document_settings(tenant_id) VALUES($1)',[tenant]),/row-level security/);
  });

  await test('approval stores the exact source in the correct client file and completes request/status in one call',async()=>{
    await seed(400,{request:500,category:'unknown-category'});
    const result=await review(400);
    assert.deepEqual(result,{id:id(400),status:'freigegeben',target_document_id:id(400),target_kind:'client',replayed:false});
    const document=(await db.query('SELECT * FROM client_documents WHERE id=$1',[id(400)])).rows[0];
    assert.equal(document.storage_path,sourcePath(400));assert.equal(document.client_id,id(300));assert.equal(document.category,'sonstige');
    assert.equal(document.portal_visible,true);assert.equal(document.uploaded_by,id(20));
    assert.equal((await db.query('SELECT status,reviewed_by FROM portal_uploads WHERE id=$1',[id(400)])).rows[0].reviewed_by,id(20));
    assert.equal((await db.query('SELECT status FROM portal_requests WHERE id=$1',[id(500)])).rows[0].status,'erledigt');
  });

  await test('a repeated approval returns the existing document and an opposite decision cannot overturn it',async()=>{
    const repeat=await review(400);assert.equal(repeat.replayed,true);
    assert.equal((await db.query('SELECT count(*)::int n FROM client_documents WHERE id=$1',[id(400)])).rows[0].n,1);
    await assert.rejects(review(400,'reject','Andere Entscheidung'),/anderen Entscheidung/);
    assert.equal((await db.query('SELECT status FROM portal_uploads WHERE id=$1',[id(400)])).rows[0].status,'freigegeben');
  });

  await test('a rejection is idempotent and never creates a target document',async()=>{
    await seed(401,{request:501});
    await assert.rejects(review(401,'reject',' '),/Grund/);
    assert.equal((await review(401,'reject','Falsches Dokument')).status,'abgelehnt');
    assert.equal((await review(401,'reject','Falsches Dokument')).replayed,true);
    await assert.rejects(review(401),/anderen Entscheidung/);
    assert.equal((await db.query('SELECT count(*)::int n FROM client_documents WHERE id=$1',[id(401)])).rows[0].n,0);
    assert.equal((await db.query('SELECT status FROM portal_requests WHERE id=$1',[id(501)])).rows[0].status,'abgelehnt');
  });

  await test('employee approval writes only the matching personnel file',async()=>{
    await seed(402,{employee:true});
    const result=await review(402);assert.equal(result.target_kind,'employee');
    const doc=(await db.query('SELECT * FROM employee_documents WHERE id=$1',[id(402)])).rows[0];
    assert.equal(doc.employee_id,id(40));assert.equal(doc.storage_path,sourcePath(402,40,'employees'));
    assert.equal((await db.query('SELECT count(*)::int n FROM client_documents WHERE id=$1',[id(402)])).rows[0].n,0);
    assert.equal((await review(402)).replayed,true);
  });

  await test('authority comes from the active profile and server permissions rather than provided tenant IDs',async()=>{
    await seed(403);
    await actor(22);await assert.rejects(review(403),/Keine Berechtigung/);
    await actor(21);await assert.rejects(review(403),/Keine Berechtigung/);
    await actor(24,11);await assert.rejects(review(403),/Keine Berechtigung/);
    await actor(null);await assert.rejects(review(403),/permission denied/);
    await owner();await db.query('UPDATE profiles SET is_active=false WHERE id=$1',[id(20)]);
    await actor();await assert.rejects(review(403),/Keine Berechtigung/);
    await owner();await db.query('UPDATE profiles SET is_active=true WHERE id=$1',[id(20)]);
    assert.equal((await db.query('SELECT status FROM portal_uploads WHERE id=$1',[id(403)])).rows[0].status,'hochgeladen');
  });

  await test('source path, target tenant and original object must match before an approval writes anything',async()=>{
    await seed(404,{path:`tenant/${id(11)}/clients/${id(300)}/portal-uploads/${id(404)}/${id(404)}.pdf`});
    await assert.rejects(review(404),/Originaldatei/);
    await seed(405,{path:sourcePath(999)});await assert.rejects(review(405),/Originaldatei/);
    await seed(406,{client:301});await assert.rejects(review(406),/Zielakte/);
    await seed(407,{object:false});await assert.rejects(review(407),/Originaldatei/);
    assert.equal((await db.query('SELECT count(*)::int n FROM client_documents WHERE id=ANY($1::uuid[])',[[404,405,406,407].map(id)])).rows[0].n,0);
  });

  await test('a colliding target ID with another owner cannot be adopted or overwritten',async()=>{
    await seed(408);
    await owner();await db.query("INSERT INTO client_documents(id,tenant_id,client_id,title,file_name,mime_type,category,storage_path,status,sensitivity) VALUES($1,$2,$3,'Bestehend','alt.pdf','application/pdf','sonstige','other','aktiv','care')",[id(408),id(11),id(301)]);
    await actor();await assert.rejects(review(408),/nicht eindeutig/);
    assert.equal((await db.query('SELECT status FROM portal_uploads WHERE id=$1',[id(408)])).rows[0].status,'hochgeladen');
  });

  await test('a failure after target insertion rolls back the document and upload decision',async()=>{
    await seed(409,{request:509});await owner();
    await db.exec(`CREATE FUNCTION reject_fixture_request() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN IF NEW.id='${id(509)}'::uuid THEN RAISE EXCEPTION 'Synthetic request failure';END IF;RETURN NEW;END$$;CREATE TRIGGER fixture_request_failure BEFORE UPDATE ON portal_requests FOR EACH ROW EXECUTE FUNCTION reject_fixture_request();`);
    await actor();await assert.rejects(review(409),/Synthetic request failure/);
    assert.equal((await db.query('SELECT count(*)::int n FROM client_documents WHERE id=$1',[id(409)])).rows[0].n,0);
    assert.equal((await db.query('SELECT status FROM portal_uploads WHERE id=$1',[id(409)])).rows[0].status,'hochgeladen');
    await owner();await db.exec('DROP TRIGGER fixture_request_failure ON portal_requests');
  });

  await test('competing decisions have one winner and cannot leave an approved file behind a rejected status',async()=>{
    await seed(410);
    const results=await Promise.allSettled([review(410,'reject','Korrektur nötig'),review(410)]);
    assert.equal(results.filter(result=>result.status==='fulfilled').length,1);
    const status=(await db.query('SELECT status FROM portal_uploads WHERE id=$1',[id(410)])).rows[0].status;
    const documents=(await db.query('SELECT count(*)::int n FROM client_documents WHERE id=$1',[id(410)])).rows[0].n;
    assert.equal(documents,status==='freigegeben'?1:0);
  });
} finally { await db.close(); }
