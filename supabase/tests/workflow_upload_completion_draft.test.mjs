import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createCompletionFixture,fixtureIds as id,version } from './workflow_completion_fixture.mjs';
const {db,actor}=await createCompletionFixture(['profiles','clients','employees','portal_uploads','portal_requests','employee_documents','client_documents','storage.objects','cs_document_requests','cs_document_request_signatures'],['workflow-server-signature-completion-draft.sql','workflow-server-upload-completion-draft.sql']);
let path='';
const register=(context='mitarbeiter',employee=id.employee,client=null,p=path)=>db.query('SELECT workflow_register_portal_upload($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) AS receipt',[id.tenant,id.upload,context,employee,client,p,'Original.pdf','application/pdf',120,'qualification','Bitte prüfen']);
const review=(decision='approve',v=version,category='qualification')=>db.query('SELECT workflow_review_portal_upload($1,$2,$3,$4,$5,$6,$7) AS receipt',[id.tenant,id.upload,v,decision,'Original',category,'Grund']);
async function seed(context='mitarbeiter'){
  await db.exec('RESET ROLE; TRUNCATE profiles,portal_uploads,portal_requests,employee_documents,client_documents,storage.objects,clients,employees;');
  await db.query('INSERT INTO profiles(id,tenant_id,auth_user_id) VALUES($1,$2,$3)',[id.profile,id.tenant,id.auth]);
  await db.query('INSERT INTO clients(id,tenant_id,first_name,last_name) VALUES($1,$2,\'Test\',\'Fixture\')',[id.client,id.tenant]);
  await db.query('INSERT INTO employees(id,tenant_id) VALUES($1,$2)',[id.employee,id.tenant]);
  path='tenant/'+id.tenant+'/'+(context==='mitarbeiter'?'employees/'+id.employee:'clients/'+id.client)+'/portal-uploads/'+id.upload+'/Original.pdf';
  await db.query('INSERT INTO storage.objects(bucket_id,name,owner_id,version,metadata) VALUES(\'office-documents\',$1,$2,\'immutable-object-v1\',$3)',[path,id.auth,{mimetype:'application/pdf',size:120}]);
  await actor();
}
await test('own personal upload returns an actual-profile/object receipt and exact retry is idempotent',async()=>{
  await seed();const first=(await register()).rows[0].receipt;
  assert.equal(first.actorProfileId,id.profile);assert.equal(first.requestId,null);assert.equal(first.objectVersion,'immutable-object-v1');
  assert.equal((await register()).rows[0].receipt.replayed,true);
  assert.equal((await db.query('SELECT count(*)::int n FROM portal_uploads')).rows[0].n,1);
});
await test('client and family upload atomically create one request and one upload with the same stable UUID',async()=>{
  for(const role of ['client_portal','family_portal']){
    await seed('klient');await actor(role);const receipt=(await register('klient',null,id.client)).rows[0].receipt;
    assert.equal(receipt.requestId,id.upload);assert.equal((await db.query('SELECT portal_user_id FROM portal_requests')).rows[0].portal_user_id,id.profile);
    assert.equal((await register('klient',null,id.client)).rows[0].receipt.replayed,true);
  }
});
await test('metadata failure rolls the newly created request back while retaining the uploaded original',async()=>{
  await seed('klient');await actor('client_portal');
  await db.exec("RESET ROLE; CREATE FUNCTION fixture_reject_upload_insert() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'metadata insert failed'; END$$; CREATE TRIGGER fixture_upload_failure BEFORE INSERT ON portal_uploads FOR EACH ROW EXECUTE FUNCTION fixture_reject_upload_insert(); SET ROLE authenticated;");
  await assert.rejects(register('klient',null,id.client));
  assert.equal((await db.query('SELECT count(*)::int n FROM portal_requests')).rows[0].n,0);
  assert.equal((await db.query('SELECT count(*)::int n FROM storage.objects')).rows[0].n,1);
  await db.exec('RESET ROLE; DROP TRIGGER fixture_upload_failure ON portal_uploads; DROP FUNCTION fixture_reject_upload_insert();');
});
await test('foreign owner/tenant/path and employee-to-client without a current access contract are denied',async()=>{
  await seed();await actor('employee_portal',{employee:id.otherEmployee});await assert.rejects(register('mitarbeiter',id.otherEmployee));
  await actor('employee_portal',{tenant:id.otherTenant});await assert.rejects(register());
  await actor();await assert.rejects(register('mitarbeiter',id.employee,null,path+'/../foreign.pdf'));
  await assert.rejects(register('klient',id.employee,id.client));
  await db.exec("RESET ROLE; UPDATE storage.objects SET owner_id='20000000-0000-4000-8000-000000000002'; SET ROLE authenticated;");await assert.rejects(register());
});
await test('Office approval archives and confirms status together, exact retry never duplicates the archive',async()=>{
  await seed();await register();await db.exec("RESET ROLE; UPDATE portal_uploads SET updated_at='2026-10-11T09:00:00Z';");await actor('office_staff');
  const receipt=(await review()).rows[0].receipt;assert.equal(receipt.documentId,id.upload);assert.equal(receipt.status,'freigegeben');
  assert.equal((await db.query('SELECT storage_path,released_to_portal FROM employee_documents')).rows[0].storage_path,path);
  assert.equal((await review()).rows[0].receipt.replayed,true);
  assert.equal((await db.query('SELECT count(*)::int n FROM employee_documents')).rows[0].n,1);
  await assert.rejects(review('reject'));
});
await test('failed final status rolls back released archive; a following rejection has no orphan released document',async()=>{
  await seed();await register();await db.exec("RESET ROLE; UPDATE portal_uploads SET updated_at='2026-10-11T09:00:00Z'; CREATE FUNCTION fixture_reject_review_update() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'review failure'; END$$; CREATE TRIGGER fixture_review_failure BEFORE UPDATE ON portal_uploads FOR EACH ROW EXECUTE FUNCTION fixture_reject_review_update();");await actor('office_staff');
  await assert.rejects(review());assert.equal((await db.query('SELECT count(*)::int n FROM employee_documents')).rows[0].n,0);
  await db.exec('RESET ROLE; DROP TRIGGER fixture_review_failure ON portal_uploads; DROP FUNCTION fixture_reject_review_update();');await actor('office_staff');
  assert.equal((await review('reject')).rows[0].receipt.status,'abgelehnt');
  assert.equal((await db.query('SELECT count(*)::int n FROM employee_documents')).rows[0].n,0);
});
await test('sensitive category, stale review and unauthorized portal approval are rejected before archival',async()=>{
  await seed();await register();await db.exec("RESET ROLE; UPDATE portal_uploads SET updated_at='2026-10-11T09:00:00Z';");await actor('office_staff');
  await assert.rejects(review('approve',version,'warning'));await assert.rejects(review('approve','2026-10-11T08:00:00Z'));
  await actor();await assert.rejects(review());assert.equal((await db.query('SELECT count(*)::int n FROM employee_documents')).rows[0].n,0);
});
await test('client approval creates its archive and closes its linked request in the same transaction',async()=>{
  await seed('klient');await actor('client_portal');await register('klient',null,id.client);
  await db.exec("RESET ROLE; UPDATE portal_uploads SET updated_at='2026-10-11T09:00:00Z';");await actor('office_staff');
  assert.equal((await review('approve',version,'sonstige')).rows[0].receipt.status,'freigegeben');
  assert.equal((await db.query('SELECT storage_path,client_id FROM client_documents')).rows[0].storage_path,path);
  assert.equal((await db.query('SELECT status FROM portal_requests')).rows[0].status,'erledigt');
});
await db.close();
