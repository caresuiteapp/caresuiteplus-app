import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createCompletionFixture,fixtureIds as id,png,version } from './workflow_completion_fixture.mjs';
const {db,actor}=await createCompletionFixture(['profiles','cs_document_requests','cs_document_request_signatures'],['workflow-server-signature-completion-draft.sql']);
const call=(role='employee',name='Unterzeichner',image=png,v=version)=>db.query('SELECT public.workflow_sign_cs_document_request($1,$2,$3,$4,$5,$6) AS receipt',[id.tenant,id.document,role,name,image,v]);
async function seed(scope='employee',role='employee'){
  await db.exec('RESET ROLE; TRUNCATE cs_document_request_signatures,cs_document_requests,profiles;');
  await db.query('INSERT INTO profiles(id,tenant_id,auth_user_id) VALUES($1,$2,$3)',[id.profile,id.tenant,id.auth]);
  await db.query('INSERT INTO cs_document_requests(id,owner_tenant_id,title,recipient_scope,employee_id,client_id,status,portal_visible,rendered_html,updated_at) VALUES($1,$2,\'Vorlage\',$3,$4,$5,\'opened\',true,$6,$7)',[id.document,id.tenant,scope,id.employee,id.client,'<p>Unverändertes Original mit allen Absätzen</p><span data-signature-anchor="'+role+'_signature">[SIGNATURE:'+role+']</span>',version]);
  await db.query('INSERT INTO cs_document_request_signatures(id,request_id,signer_role,status) VALUES($1,$2,$3,\'pending\')',[id.signature,id.document,role]);
  await actor();
}
await test('employee completion atomically preserves original and binds actual profile (different from auth UID)',async()=>{
  await seed();const {receipt}= (await call()).rows[0];
  assert.equal(receipt.status,'completed');assert.equal(receipt.actorProfileId,id.profile);
  const row=(await db.query('SELECT rendered_html,status FROM cs_document_requests')).rows[0];
  assert.match(row.rendered_html,/Unverändertes Original mit allen Absätzen/);assert.match(row.rendered_html,/data:image\/png/);
  assert.equal(row.status,'completed');
  assert.equal((await db.query('SELECT audit_payload FROM cs_document_request_signatures')).rows[0].audit_payload.actorAuthUserId,id.auth);
});
await test('lost-reply and concurrent delivery replay exactly the same receipt with no duplicate signature',async()=>{
  await seed();const replies=await Promise.all([call(),call()]);
  assert.equal(replies[0].rows[0].receipt.signatureId,replies[1].rows[0].receipt.signatureId);
  assert.equal(replies[1].rows[0].receipt.replayed,true);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM cs_document_request_signatures')).rows[0].n,1);
});
await test('different capture/name/version or unbound legacy partial capture cannot masquerade as own replay',async()=>{
  await seed();await call();
  await assert.rejects(call('employee','Andere Person'));
  await assert.rejects(call('employee','Unterzeichner',png+'AA'));
  await assert.rejects(call('employee','Unterzeichner',png,'2026-10-11T10:00:00Z'));
  await db.exec("RESET ROLE; UPDATE cs_document_request_signatures SET audit_payload='{}'; SET ROLE authenticated;");
  await assert.rejects(call());
});
await test('request-update failure rolls back capture write rather than leaving a partial signature',async()=>{
  await seed();await db.exec("RESET ROLE; CREATE FUNCTION public.fixture_reject_cs_update() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'forced request failure'; END$$; CREATE TRIGGER fixture_cs_failure BEFORE UPDATE ON cs_document_requests FOR EACH ROW EXECUTE FUNCTION fixture_reject_cs_update(); SET ROLE authenticated;");
  await assert.rejects(call());
  assert.equal((await db.query('SELECT status FROM cs_document_request_signatures')).rows[0].status,'pending');
  await db.exec('RESET ROLE; DROP TRIGGER fixture_cs_failure ON cs_document_requests; DROP FUNCTION fixture_reject_cs_update();');
});
await test('foreign employee/tenant and spoofed profile cannot write a signature',async()=>{
  await seed();await actor('employee_portal',{employee:id.otherEmployee});await assert.rejects(call());
  await actor('employee_portal',{tenant:id.otherTenant});await assert.rejects(call());
  await actor('employee_portal',{profile:id.otherProfile});await assert.rejects(call());
});
await test('family signs its representative slot and cannot take a client role',async()=>{
  await seed('client','representative');await actor('family_portal');
  await assert.rejects(call('client'));
  assert.equal((await call('representative')).rows[0].receipt.status,'completed');
});
await test('Office signs its own role while stale review or duplicate role slots are refused',async()=>{
  await seed('office','office');await actor('office_staff');
  await assert.rejects(call('employee'));
  await assert.rejects(call('office','Unterzeichner',png,'2026-10-11T08:00:00Z'));
  assert.equal((await call('office')).rows[0].receipt.status,'completed');
  await seed();await db.exec("RESET ROLE; INSERT INTO cs_document_request_signatures(request_id,signer_role) SELECT id,'employee' FROM cs_document_requests; SET ROLE authenticated;");
  await assert.rejects(call(),/nicht eindeutig/);
});
await test('new privileged functions are not executable by PUBLIC/anonymous users',async()=>{
  await db.exec('RESET ROLE; SET ROLE anon;');
  await assert.rejects(call(),/permission denied/);
});
await db.close();
