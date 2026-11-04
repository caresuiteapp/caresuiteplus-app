import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {assistDeferredFixture} from './monthly-assist-deferred-fixture.mjs';
import {ensureAssistOriginal,readAssistOriginalContext} from '../../src/lib/gkvExchange/assistOriginal.ts';
import {readPersonalEmployeeCapture,deferredCaptureSummary} from '../../src/lib/gkvExchange/monthlyEmployees.ts';
const conflict=e=>e.code==='40001';
const forbidden=e=>e.code==='42501';

test('Deferred Assist: real portal RPCs preserve timely employee content through late signature, bytes and monthly original',async t=>{
 const x=await assistDeferredFixture(),{f}=x;let v,source,ready,sealed,monthly;
 try{
  const registration=await x.approve(await x.submit());
  await t.test('employee release atomically captures unsigned content before the separate completed transition',async()=>{
   v=await x.prepareDeferred();assert.equal(await x.releaseDeferred(v),v.draft);source=await x.captured(v);
   assert.equal(source.actor_id,f.actorId);assert.equal(source.employee_number,registration.employee_number);
   assert.equal(source.payload_hash,await x.jsonHash(v.snapshot));assert.deepEqual(source.payload_snapshot,v.snapshot);
   assert.equal((await f.db.query('SELECT count(*)::int n FROM care_security.gkv_employee_captures')).rows[0].n,0);
   assert.equal((await f.db.query('SELECT signature_required FROM client_documents WHERE id=$1',[v.draft])).rows[0].signature_required,true);
   await x.closeVisit(v);
   const scope={tenantId:f.tenant,assignmentId:v.assignment,actorId:f.actorId,employeeId:x.employee};
   assert.equal(readAssistOriginalContext(await x.context(v),scope).phase,'awaiting_signature');
   await assert.rejects(ensureAssistOriginal(x.rpc,scope,randomUUID()),/Unterschrift.*steht noch aus/);
   assert.equal((await x.complete(v)).status,409);
  });
  await t.test('repeated release keeps the first content hash and timestamp with one portal document',async()=>{
   const snapshot={...v.snapshot,signatureDeferredAt:await x.clock()};
   assert.equal(await x.releaseDeferred(v,{snapshot}),v.draft);
   assert.deepEqual(await x.captured(v),source);
   assert.equal((await f.db.query('SELECT payload_hash FROM assist_visit_proofs WHERE id=$1',[v.draft])).rows[0].payload_hash,source.payload_hash);
   assert.equal((await f.db.query('SELECT count(*)::int n FROM client_documents WHERE id=$1',[v.draft])).rows[0].n,1);
  });
  await t.test('late client signature is appended to the recorded content without rewriting its origin',async()=>{
   await x.ageDeferred(v);source=await x.captured(v); // Explicit isolated historical fixture, not production backdating.
   const signed=await x.signDeferred(v);assert.equal(signed.proofPersisted,true);assert.equal(signed.proofId,v.draft);
   assert.ok(Date.parse(signed.signedAt)-Date.parse(source.captured_at)>15*60_000);
   const before=(await f.db.query('SELECT * FROM assist_visit_proofs WHERE id=$1',[v.draft])).rows[0];
   const again=await x.signDeferred(v);assert.deepEqual(again,signed);
   assert.deepEqual((await f.db.query('SELECT * FROM assist_visit_proofs WHERE id=$1',[v.draft])).rows[0],before);
   assert.deepEqual(await x.captured(v),source);ready=await x.context(v);assert.equal(ready.phase,'ready');
  });
  await t.test('new final original references the captured source; capture, signing and sealing times remain distinct',async()=>{
   const newSession=randomUUID();await f.db.query('INSERT INTO auth.sessions VALUES($1,$2,NULL)',[newSession,f.actorId]);
   sealed=await x.seal(v,ready.draft,randomUUID(),x.claims({session_id:newSession}));assert.equal(sealed.phase,'sealed');assert.notEqual(sealed.original.proofId,v.draft);
   const c=(await f.db.query('SELECT * FROM care_security.gkv_employee_captures WHERE proof_id=$1',[sealed.original.proofId])).rows[0];
   assert.equal(new Date(c.captured_at).getTime(),new Date(source.captured_at).getTime());assert.equal(c.session_id,source.session_id);assert.equal(c.policy,'personal-deferred-source-15m-v1');
   assert.equal((await f.db.query('SELECT session_id FROM care_security.gkv_assist_originals WHERE proof_id=$1',[sealed.original.proofId])).rows[0].session_id,newSession);
   assert.equal(c.proof_payload_hash,sealed.original.payloadHash);assert.notEqual(c.proof_payload_hash,source.payload_hash);
   assert.deepEqual(await x.seal(v,ready.draft),sealed);
   const p=(await f.db.query('SELECT * FROM assist_visit_proofs WHERE id=$1',[sealed.original.proofId])).rows[0];
   assert.equal(p.pdf_hash,null);assert.equal(p.portal_visible,false);assert.equal(p.billing_released,false);
  });
  await t.test('real byte handler rejects changed signature bytes and then attests the new original',async()=>{
   x.storage.set(v.signaturePath,Buffer.from('corrupt'));assert.equal((await x.complete(v)).status,409);x.storage.set(v.signaturePath,v.png);
   const response=await x.complete(v);assert.equal(response.status,200,await response.clone().text());
   assert.equal((await response.json()).data.proofId,sealed.original.proofId);
   assert.equal((await x.complete(v)).status,200);
  });
  await t.test('monthly facts and actual PDF disclose deferred signing without replacing the separate monthly confirmation',async()=>{
   monthly=await x.monthly(v);await x.freeze(monthly);await x.prepare(monthly);
   const facts=monthly.p.payload.xmlFacts,c=readPersonalEmployeeCapture(facts.sources[0].personalCapture);
   assert.equal(facts.captureProvenance,'personally-bound');assert.equal(c.policy,'personal-deferred-source-15m-v1');
   assert.equal(c.deferredSource.proofId,v.draft);assert.equal(c.deferredSource.payloadHash,source.payload_hash);
   assert.equal(new Date(c.capturedAt).getTime(),new Date(source.captured_at).getTime());assert.equal(monthly.p.confirmation,null);
   const pdf=await getDocument({data:new Uint8Array(monthly.original.bytes),useSystemFonts:true,disableFontFace:true}).promise;
   try{let text='';for(let i=1;i<=pdf.numPages;i++)text+=(await(await pdf.getPage(i)).getTextContent()).items.map(x=>x.str).join(' ')+' ';
    const normalize=s=>s.replace(/\s+/g,' ').trim();assert.ok(normalize(text).includes(normalize(deferredCaptureSummary(c))),text);
   }finally{await pdf.destroy();}
  });
  await t.test('revocation still blocks stored final sources and replay after client signing',async()=>{
   await x.command({action:'revoke',input:{id:registration.id,revision:registration.revision,reason:'Synthetischer Widerruf'}},undefined,x.reviewClaims());
   await assert.rejects(x.context(v),conflict);await assert.rejects(x.seal(v,ready.draft),conflict);await assert.rejects(x.freeze(monthly),conflict);
  });
 }finally{await x.close();}
});

test('Deferred Assist: changed content, identity, clocks, permissions and older clients cannot bypass origin',async t=>{
 const x=await assistDeferredFixture(),{f}=x;
 try{
  await t.test('uncaptured legacy portal sources never acquire invented employee provenance',async()=>{
   const v=await x.prepareDeferred();await x.releaseDeferred(v);await x.closeVisit(v);await x.signDeferred(v);
   assert.equal(await x.captured(v),undefined);assert.equal((await x.context(v)).phase,'legacy');
  });
  await x.approve(await x.submit());
  const pending=async()=>{const v=await x.prepareDeferred();await x.releaseDeferred(v);await x.closeVisit(v);return v;};
  await t.test('failed client-document write rolls back the new source and portal visibility',async()=>{
   const v=await x.prepareDeferred();await f.db.query("INSERT INTO client_documents(id,tenant_id,client_id,source) VALUES($1,$2,$3,'other')",[v.draft,f.tenant,v.client]);
   await assert.rejects(x.releaseDeferred(v),/document id conflict/);assert.equal(await x.captured(v),undefined);
   assert.equal((await f.db.query('SELECT portal_visible FROM assist_visit_proofs WHERE id=$1',[v.draft])).rows[0].portal_visible,false);
  });
  await t.test('no late, premature or cross-account personal capture is invented',async()=>{
   const v=await x.prepareDeferred();
   for(const identity of [x.reviewClaims(),{...x.personal(),session_id:randomUUID()},x.clientClaims(v),{...x.personal(),account_id:randomUUID()}])
    await assert.rejects(x.releaseDeferred(v,{identity}));
   await f.db.query("UPDATE assist_visits SET actual_end_at=clock_timestamp()-interval '16 minutes' WHERE id=$1",[v.visit]);
   await assert.rejects(x.releaseDeferred(v),conflict);assert.equal(await x.captured(v),undefined);
   await f.db.query('UPDATE assist_visits SET actual_end_at=NULL WHERE id=$1',[v.visit]);await assert.rejects(x.releaseDeferred(v),conflict);
  });
  await t.test('full tasks, documentation, pause duration and real events are required before capture',async()=>{
   for(const change of [
    v=>f.db.query("UPDATE assist_visit_tasks SET status='not_done' WHERE visit_id=$1",[v.visit]),
    v=>f.db.query('UPDATE assist_visit_documentation SET submitted_at=NULL WHERE visit_id=$1',[v.visit]),
    v=>f.db.query("DELETE FROM assist_time_events WHERE visit_id=$1 AND event_type='service_start'",[v.visit]),
    v=>f.db.query("INSERT INTO assist_time_events(tenant_id,visit_id,event_type,occurred_at) VALUES($1,$2,'pause_start',$3::timestamptz+interval '1 minute')",[f.tenant,v.visit,v.start])]){
    const v=await x.prepareDeferred();await change(v);await assert.rejects(x.releaseDeferred(v),conflict);assert.equal(await x.captured(v),undefined);
   }
  });
  await t.test('late projections, content edits, forged hashes, deletion and source replacement are blocked',async()=>{
   const v=await pending();
   await assert.rejects(x.releaseDeferred(v,{snapshot:{...v.snapshot,documentationNote:'Changed'}}),conflict);
   for(const sql of ["UPDATE assist_visit_proofs SET payload_hash='sha256:bad' WHERE id=$1",
    "UPDATE assist_visit_proofs SET portal_visible=false WHERE id=$1","DELETE FROM assist_visit_proofs WHERE id=$1"])
    await assert.rejects(f.as(x.personal(),sql,[v.draft]));
   await assert.rejects(f.as(x.personal(),'INSERT INTO assist_visit_proofs(id,tenant_id,visit_id,payload_snapshot) VALUES($1,$2,$3,$4)',[randomUUID(),f.tenant,v.visit,'{}']),conflict);
   await assert.rejects(f.db.exec('DELETE FROM care_security.gkv_assist_deferred_sources'),forbidden);
   await assert.rejects(f.as(x.personal(),'SELECT * FROM care_security.gkv_assist_deferred_sources'),forbidden);
   await assert.rejects(f.as(x.personal(),'SELECT care_security.gkv_assist_deferred_state($1,$2)',[f.tenant,v.assignment]),forbidden);
  });
  await t.test('client must match source, active session, exact signed hash and capture time',async()=>{
   for(const option of [v=>({identity:{...x.clientClaims(v),client_id:randomUUID()}}),
    v=>({identity:{...x.clientClaims(v),session_id:randomUUID()}}),
    ()=>({signatureMetadata:{proofPayloadHash:'sha256:'+'0'.repeat(64)}}),
    v=>({signedAt:new Date(Date.parse(v.end)-1000).toISOString()})]){
    const v=await pending();await assert.rejects(x.signDeferred(v,option(v)));
    assert.equal((await f.db.query('SELECT signature_id FROM assist_visit_proofs WHERE id=$1',[v.draft])).rows[0].signature_id,null);
    assert.equal((await f.db.query('SELECT signature_required FROM client_documents WHERE id=$1',[v.draft])).rows[0].signature_required,true);
   }
  });
  await t.test('a copied client signature cannot be attached by the employee',async()=>{
   const v=await pending();await assert.rejects(x.signDeferred(v,{identity:x.personal()}));
   await assert.rejects(f.as(x.personal(),'UPDATE assist_visit_proofs SET signature_id=$2 WHERE id=$1',[v.draft,v.signature]),forbidden);
  });
  await t.test('changes to canonical source after capture block signing and final use',async()=>{
   for(const change of [v=>f.db.query("UPDATE assist_visit_documentation SET short_description='Changed' WHERE visit_id=$1",[v.visit]),
    v=>f.db.query("UPDATE assist_visit_tasks SET title='Changed' WHERE visit_id=$1",[v.visit]),
    v=>f.db.query("UPDATE assist_visit_documentation SET submitted_at=submitted_at+interval '1 second' WHERE visit_id=$1",[v.visit])]){
    const v=await pending();await change(v);await assert.rejects(x.signDeferred(v),conflict);await assert.rejects(x.context(v),conflict);
   }
  });
  await t.test('a signed portal proof remains blocked from direct worker/record handoff until personal sealing',async()=>{
   const v=await pending();await x.signDeferred(v);
   assert.equal((await x.complete(v)).status,409);
   const r=await x.rpc('workflow_prepare_assignment_service_record',{p_tenant_id:f.tenant,p_assignment_id:v.assignment});assert.ok(r.error);
   assert.equal((await f.db.query('SELECT count(*)::int n FROM service_records WHERE assignment_id=$1',[v.assignment])).rows[0].n,0);
   await assert.rejects(f.as(x.clientClaims(v),"UPDATE assist_visit_proofs SET payload_snapshot='{}' WHERE id=$1",[v.draft]),conflict);
   const c=await x.context(v);await x.seal(v,c.draft);assert.equal((await x.complete(v)).status,200);
  });
 }finally{await x.close();}
});

test('Deferred capture contract rejects fabricated history and incomplete policy upgrades',()=>{
 const c={id:randomUUID(),registrationId:randomUUID(),actorId:randomUUID(),employeeId:randomUUID(),employeeNumber:'234567890',
  proofId:randomUUID(),proofPayloadHash:'sha256:'+'a'.repeat(64),capturedAt:'2026-10-30T10:00:00Z',reviewedBy:randomUUID(),reviewedAt:'2026-10-29T10:00:00Z',
  policy:'personal-deferred-source-15m-v1',deferredSource:{proofId:randomUUID(),payloadHash:'sha256:'+'b'.repeat(64),signedAt:'2026-11-01T10:00:00Z',sealedAt:'2026-11-02T10:00:00Z'}};
 assert.deepEqual(readPersonalEmployeeCapture(c),c);
 for(const bad of [{...c,deferredSource:undefined},{...c,policy:'personal-proof-insert-15m-v1'},
  {...c,deferredSource:{...c.deferredSource,proofId:c.proofId}},{...c,deferredSource:{...c.deferredSource,payloadHash:'bad'}},
  {...c,deferredSource:{...c.deferredSource,signedAt:'2026-10-29T10:00:00Z'}},{...c,deferredSource:{...c.deferredSource,sealedAt:'2026-10-31T10:00:00Z'}}])
  assert.throws(()=>readPersonalEmployeeCapture(bad));
});

test('Staging portal: explicit employee role, atomic audit and scoped Storage access',async t=>{
 const x=await assistDeferredFixture(),{f}=x,db=f.db;let v;
 try{
  await x.approve(await x.submit());
  v=await x.prepareDeferred();
  await t.test('an unknown portal role fails before even an assigned employee can release the proof',async()=>{
   await db.exec("CREATE OR REPLACE FUNCTION public.is_employee_portal_rls_context(t uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT NULL::boolean $$");
   try {
    await assert.rejects(x.releaseDeferred(v),/employee portal role required/);
    assert.equal(await x.captured(v),undefined);
    assert.equal((await db.query('SELECT count(*)::int n FROM public.client_documents WHERE id=$1',[v.draft])).rows[0].n,0);
   } finally {
    await db.exec("CREATE OR REPLACE FUNCTION public.is_employee_portal_rls_context(t uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT public.current_tenant_id()=t AND public.current_portal_type()='employee' $$");
   }
   await x.releaseDeferred(v);await x.closeVisit(v);
  });
  await t.test('failed audit insert rolls back the PDF link and signature; retry writes one typed event',async()=>{
   await db.exec("ALTER TABLE public.audit_logs ADD CONSTRAINT synthetic_audit_failure CHECK (action <> 'signature')");
   try {
    await assert.rejects(x.signDeferred(v),/synthetic_audit_failure/);
    const proof=(await db.query('SELECT signature_id,pdf_storage_path,portal_release_status FROM public.assist_visit_proofs WHERE id=$1',[v.draft])).rows[0];
    assert.equal(proof.signature_id,null);assert.equal(proof.pdf_storage_path,null);assert.equal(proof.portal_release_status,'pending_client_signature');
    assert.equal((await db.query('SELECT signature_required FROM public.client_documents WHERE id=$1',[v.draft])).rows[0].signature_required,true);
   } finally {await db.exec('ALTER TABLE public.audit_logs DROP CONSTRAINT synthetic_audit_failure');}
   await x.signDeferred(v,{signedAt:v.signed});
   await x.signDeferred(v,{signedAt:v.signed});
   const events=(await db.query('SELECT tenant_id,action,new_data FROM public.audit_logs WHERE record_id=$1',[v.draft])).rows;
   assert.equal(events.length,1);assert.equal(events[0].tenant_id,f.tenant);assert.equal(events[0].action,'signature');
   assert.equal(events[0].new_data.signature_id,v.signature);assert.equal(events[0].new_data.actor_user_id,x.clientActor);
  });
  await t.test('Storage exposes the captured signature only for this client, tenant and bucket',async()=>{
   const identity=x.clientClaims(v),path=v.signaturePath;
   // One row per object in Storage; the transport double allows retries to insert duplicate names.
   const exists=async(actor,bucket)=>(await f.as(actor,'SELECT EXISTS(SELECT FROM storage.objects WHERE bucket_id=$1 AND name=$2) ok',[bucket,path])).rows[0].ok;
   await db.query('INSERT INTO storage.objects VALUES($1,$2)',['synthetic-other-bucket',path]);
   assert.equal(await exists(identity,'office-documents'),true);
   assert.equal(await exists({...identity,client_id:randomUUID()},'office-documents'),false);
   assert.equal(await exists({...identity,tenant_id:randomUUID()},'office-documents'),false);
   assert.equal(await exists(x.personal(),'office-documents'),false);
   assert.equal(await exists(identity,'synthetic-other-bucket'),false);
   const extraPath=path.replace('/signatures/','/proofs/');
   await assert.rejects(f.as(identity,'INSERT INTO storage.objects(bucket_id,name) VALUES($1,$2)',['office-documents',extraPath]),e=>e.code==='42501');
  });
  await t.test('service, anonymous and authenticated roles have no direct rights on the audit table',async()=>{
   const grants=(await db.query(`SELECT r,p,has_table_privilege(r,'public.audit_logs',p) ok
     FROM unnest(ARRAY['anon','authenticated','service_role']) r
     CROSS JOIN unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN']) p`)).rows;
   assert.equal(grants.length,24);assert.equal(grants.some(r=>r.ok),false);
   await assert.rejects(f.as(x.personal(),'SELECT action FROM public.audit_logs'),e=>e.code==='42501');
   await assert.rejects(f.as(x.clientClaims(v),"INSERT INTO public.audit_logs(action) VALUES('signature')"),e=>e.code==='42501');
  });
 }finally{await x.close();}
});

test('Staging portal before monthly activation: lost response, missing hash and recovery of an old PDF upload',async t=>{
 const x=await assistDeferredFixture({monthlyCapture:false}),{f}=x,db=f.db;
 try{
  await t.test('the read-only deployment smoke rejects use without an authenticated identity',async()=>{
   const sql=await readFile(new URL('../../docs/gkv/checks/staging-portal-smoke.sql',import.meta.url),'utf8');
   const response=await db.exec(sql);
   assert.ok(response.some(r=>r.rows.some(row=>row.staging_portal_acl_and_no_session_check==='passed')));
  });
  const v=await x.prepareDeferred();await x.releaseDeferred(v);await x.closeVisit(v);
  const actor=x.clientClaims(v),initial=(await db.query('SELECT payload_hash FROM public.assist_visit_proofs WHERE id=$1',[v.draft])).rows[0].payload_hash;
  const complete=(signature,hash,path)=>f.as(actor,'SELECT public.client_portal_finalize_assist_proof($1,$2,$3,$4,$5,$6,$7)',[f.tenant,v.draft,signature,hash,'a'.repeat(64),path,'a'.repeat(64)]);
  await t.test('missing hashes on both sides cannot authorize first completion',async()=>{
   await db.query('UPDATE public.assist_visit_proofs SET payload_hash=NULL WHERE id=$1',[v.draft]);
   await assert.rejects(complete(v.signature,null,'synthetic'),/Nachweis wurde geändert/);
   await db.query('UPDATE public.assist_visit_proofs SET payload_hash=$2 WHERE id=$1',[v.draft,initial]);
  });
  const signed=await x.signDeferred(v);
  await t.test('a lost response accepts the original signature and rejects a different signature ID',async()=>{
   assert.equal(signed.signatureId,v.signature);
   assert.equal((await x.signDeferred(v,{signedAt:v.signed})).signatureId,v.signature);
   await assert.rejects(complete(randomUUID(),initial,'synthetic'),/gehört nicht zu diesem Abschluss/);
  });
  await t.test('a client can restore only a missing PDF for the signed proof, with a single filename',async()=>{
   const prefix='tenant/'+f.tenant+'/assist/visits/'+v.visit+'/proofs/'+v.draft+'-'+v.signature+'-';
   const store=(identity,path,bucket='office-documents')=>f.as(identity,'INSERT INTO storage.objects(bucket_id,name) VALUES($1,$2)',[bucket,path]);
   const denied=e=>e.code==='42501';
   await assert.rejects(store(actor,prefix+'copy.pdf'),denied);
   // An old signed proof without the final PDF; created only in this isolated database.
   await db.query('UPDATE public.assist_visit_proofs SET pdf_storage_path=NULL WHERE id=$1',[v.draft]);
   await store(actor,prefix+randomUUID()+'.pdf');
   for(const [identity,path,bucket] of [
    [actor,prefix+'nested/other.pdf'],[actor,prefix+'../other.pdf'],[actor,prefix+'encoded%2Fother.pdf'],[actor,prefix+'.pdf'],
    [actor,prefix+'ok.pdf','other-bucket'],[{...actor,client_id:randomUUID()},prefix+'ok.pdf'],[x.personal(),prefix+'ok.pdf']
   ])await assert.rejects(store(identity,path,bucket),denied);
  });
 }finally{await x.close();}
});
