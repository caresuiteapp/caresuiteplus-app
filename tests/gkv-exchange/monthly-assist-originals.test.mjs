import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {assistOriginalFixture} from './monthly-assist-fixture.mjs';
import {ensureAssistOriginal,readAssistOriginalContext} from '../../src/lib/gkvExchange/assistOriginal.ts';
const conflict=e=>e.code==='40001';
const forbidden=e=>e.code==='42501';

test('Assist originals: working draft, personal final copy and existing byte/monthly handoff',async t=>{
 const x=await assistOriginalFixture(),{f}=x;let registration,v,ready,sealed;
 try{
  await t.test('approved employee can save documentation before end and later update signature without capturing a draft',async()=>{
   registration=await x.approve(await x.submit());v=await x.start();assert.equal((await x.context(v)).phase,'working');
   assert.equal((await f.db.query('SELECT count(*)::int n FROM care_security.gkv_employee_captures')).rows[0].n,0);
   await x.finish(v);ready=await x.context(v);assert.equal(ready.phase,'ready');
   assert.equal((await f.db.query('SELECT count(*)::int n FROM care_security.gkv_employee_captures')).rows[0].n,0);
  });
  const request=randomUUID();
  await t.test('finalization copies exact signed payload into a different original and captures it once',async()=>{
   sealed=await x.seal(v,ready.draft,request);assert.equal(sealed.phase,'sealed');assert.notEqual(sealed.original.proofId,v.draft);
   const rows=(await f.db.query('SELECT * FROM assist_visit_proofs WHERE visit_id=$1 ORDER BY created_at',[v.visit])).rows;
   assert.equal(rows.length,2);assert.deepEqual(rows[0].payload_snapshot,rows[1].payload_snapshot);
   assert.equal(rows[1].pdf_hash,null);assert.equal(rows[1].approved_at,null);assert.equal(rows[1].storage_path,null);
   const captures=(await f.db.query('SELECT * FROM care_security.gkv_employee_captures')).rows;
   assert.equal(captures.length,1);assert.equal(captures[0].proof_id,sealed.original.proofId);
   assert.equal(captures[0].actor_id,f.actorId);assert.equal(captures[0].employee_number,registration.employee_number);
  });
  await t.test('same request, new identical request and parallel retries resolve one final original',async()=>{
   assert.deepEqual(await x.seal(v,ready.draft,request),sealed);
   const results=await Promise.all([x.seal(v,ready.draft),x.seal(v,ready.draft)]); // PGlite serializes connections; not a live concurrency proof.
   assert.ok(results.every(r=>r.original.proofId===sealed.original.proofId));
   await assert.rejects(x.seal(v,{...ready.draft,payloadHash:'sha256:'+'0'.repeat(64)},request),conflict);
   await assert.rejects(x.seal(v,{...ready.draft,employeeNumber:'987654321'}),conflict);
   assert.equal((await f.db.query('SELECT count(*)::int n FROM care_security.gkv_assist_originals')).rows[0].n,1);
  });
  await t.test('late unsigned projections, changed final payload and history deletion cannot replace the original',async()=>{
   await assert.rejects(f.as(x.claims(),'UPDATE assist_visit_proofs SET signature_id=NULL WHERE id=$1',[v.draft]),conflict);
   await assert.rejects(f.as(x.claims(),'INSERT INTO assist_visit_proofs(id,tenant_id,visit_id,payload_snapshot) VALUES($1,$2,$3,$4)',[randomUUID(),f.tenant,v.visit,'{}']),conflict);
   await assert.rejects(f.as(x.claims(),"UPDATE assist_visit_proofs SET payload_snapshot='{}' WHERE id=$1",[sealed.original.proofId]),forbidden);
   await assert.rejects(f.as(x.claims(),'UPDATE assist_visit_proofs SET visit_id=$2 WHERE id=$1',[sealed.original.proofId,randomUUID()]),forbidden);
   await assert.rejects(f.as(x.claims(),'DELETE FROM assist_visit_proofs WHERE id=$1',[v.draft]),forbidden);
   await assert.rejects(f.db.exec('DELETE FROM care_security.gkv_assist_originals'),forbidden);
  });
  await t.test('service record stays blocked until real handler verifies signature and stored PDF bytes',async()=>{
   const unready=await x.rpc('workflow_prepare_assignment_service_record',{p_tenant_id:f.tenant,p_assignment_id:v.assignment});assert.ok(unready.error);
   x.storage.set(v.signaturePath,Buffer.from('bad signature'));
   assert.equal((await x.complete(v)).status,409);
   x.storage.set(v.signaturePath,v.png);
   const response=await x.complete(v);assert.equal(response.status,200,await response.clone().text());
   const reply=await response.json();assert.equal(reply.data.proofId,sealed.original.proofId);
   assert.equal((await x.complete(v)).status,200);
   assert.equal((await f.db.query('SELECT count(*)::int n FROM workflow_proof_attestations')).rows[0].n,1);
  });
  let monthly;
  await t.test('monthly facts use final proof and personally captured number; month confirmation remains separate',async()=>{
   monthly=await x.monthly(v);await x.freeze(monthly);const facts=monthly.p.payload.xmlFacts;
   assert.equal(monthly.receipt.proof_id,sealed.original.proofId);assert.equal(facts.captureProvenance,'personally-bound');
   assert.equal(facts.sources[0].personalCapture.proofId,sealed.original.proofId);
   assert.deepEqual(facts.content.days[0].visits[0].lines[0].employeeNumbers,[registration.employee_number]);
   await x.prepare(monthly);assert.ok(monthly.original.bytes.length>500);assert.equal(monthly.p.status,'open');
   assert.equal(monthly.p.confirmation,null);
   await assert.rejects(f.db.query("SELECT care_security.gkv_employee_source($1,$2::jsonb)",[f.tenant,JSON.stringify({employeeId:x.employee,sourceReceipt:{...monthly.receipt,proof_id:v.draft}})]),conflict);
  });
  await t.test('revoked approval prevents replay and source use; no fallback to unbound',async()=>{
   await x.command({action:'revoke',input:{id:registration.id,revision:registration.revision,reason:'Synthetischer Widerruf'}},undefined,x.reviewClaims());
   await assert.rejects(x.context(v),conflict);await assert.rejects(x.seal(v,ready.draft,request),conflict);
   await assert.rejects(x.freeze(monthly),conflict);
  });
 }finally{await x.close();}
});

test('Assist originals: adversarial source, identity and stale revision checks',async t=>{
 const x=await assistOriginalFixture(),{f}=x;
 try{
  await t.test('without approved provenance the existing source is explicitly legacy',async()=>{
   const v=await x.start();await x.finish(v);const c=await x.context(v);assert.equal(c.phase,'legacy');
   await assert.rejects(x.seal(v,{proofId:v.draft}),conflict);
  });
  const registration=await x.approve(await x.submit());
  const newReady=async()=>{const v=await x.start();await x.finish(v);return {v,c:await x.context(v)};};
  await t.test('changed unsigned draft revision cannot consume an old read',async()=>{
   const {v,c}=await newReady();await f.as(x.claims(),'UPDATE assist_visit_proofs SET updated_at=clock_timestamp() WHERE id=$1',[v.draft]);
   await assert.rejects(x.seal(v,c.draft),conflict);
  });
  await t.test('canonical validation rejects changed tasks, invalid signature, missing start event and false snapshot hash',async()=>{
   for(const mutation of [
    async v=>f.db.query("UPDATE assist_visit_tasks SET status='not_done' WHERE visit_id=$1",[v.visit]),
    async v=>f.db.query('UPDATE assist_visit_signatures SET is_valid=false WHERE id=$1',[v.signature]),
    async v=>f.db.query("DELETE FROM assist_time_events WHERE visit_id=$1 AND event_type='service_start'",[v.visit]),
    async v=>f.db.query("UPDATE assist_visit_proofs SET payload_hash=$2 WHERE id=$1",[v.draft,'sha256:'+'0'.repeat(64)])]){
    const {v}=await newReady();await mutation(v);const c=await x.context(v);
    await assert.rejects(x.seal(v,c.draft));
   }
   assert.equal((await f.db.query('SELECT count(*)::int n FROM care_security.gkv_assist_originals')).rows[0].n,0);
  });
  await t.test('inactive sessions, foreign tenants, other users and client portal cannot personally seal',async()=>{
   const {v,c}=await newReady();
   for(const identity of [x.claims({session_id:randomUUID()}),x.reviewClaims(),x.claims({portal:'client'}),x.claims({tenant_id:randomUUID()})])
    await assert.rejects(x.seal(v,c.draft,randomUUID(),identity),forbidden);
   await assert.rejects(f.as(x.claims(),'SELECT * FROM care_security.gkv_assist_originals'),forbidden);
   await assert.rejects(f.as(x.claims(),'SELECT care_security.gkv_employee_capture_proof(p) FROM assist_visit_proofs p LIMIT 1'),forbidden);
  });
  await t.test('active employee portal uses the same final-original path; no copied actor identity',async()=>{
   const {v,c}=await newReady();const personal=x.claims({portal:'employee',account_id:x.account});
   const r=await x.seal(v,c.draft,undefined,personal);assert.equal(r.actorId,f.actorId);assert.equal(r.phase,'sealed');
   await assert.rejects(x.context(v,{...personal,account_id:randomUUID()}),forbidden);
  });
  await t.test('deferred portal release cannot be relabeled as personally sealed original',async()=>{
   const {v}=await newReady();await f.db.query('UPDATE assist_visit_proofs SET portal_visible=true WHERE id=$1',[v.draft]);
   await assert.rejects(x.context(v),conflict);
  });
  await t.test('late personal completion rolls back both original marker and capture under the internal 15-minute policy',async()=>{
   const v=await x.start();await x.finish(v,{endedAt:new Date(Date.now()-16*60_000).toISOString()});const c=await x.context(v);
   await assert.rejects(x.seal(v,c.draft),conflict);
   assert.equal((await f.db.query('SELECT count(*)::int n FROM care_security.gkv_assist_originals WHERE visit_id=$1',[v.visit])).rows[0].n,0);
   assert.equal((await f.db.query('SELECT count(*)::int n FROM care_security.gkv_employee_captures WHERE visit_id=$1',[v.visit])).rows[0].n,0);
  });
  await t.test('uncaptured signed source cannot downgrade to legacy at the monthly handoff',async()=>{
   const {v}=await newReady();const r=await x.rpc('workflow_assignment_proof_source',{p_tenant_id:f.tenant,p_assignment_id:v.assignment});assert.equal(r.error,null);
   await assert.rejects(f.db.query('SELECT care_security.gkv_employee_source($1,$2::jsonb)',[f.tenant,JSON.stringify({employeeId:x.employee,sourceReceipt:r.data.receipt})]),conflict);
  });
  await t.test('a previously derived service record cannot be retrofitted with personal provenance',async()=>{
   const {v,c}=await newReady();assert.equal((await x.complete(v)).status,200);
   const record=await x.rpc('workflow_prepare_assignment_service_record',{p_tenant_id:f.tenant,p_assignment_id:v.assignment});assert.equal(record.error,null);
   // The now-attested draft may still be pending review, but its prior handoff is final.
   const current=await x.context(v);assert.notDeepEqual(current.draft.updatedAt,c.draft.updatedAt);
   await assert.rejects(x.seal(v,current.draft),conflict);
  });
  await t.test('expired registration before seal cannot silently return legacy or create a capture',async()=>{
   const {v,c}=await newReady();
   await f.db.query("UPDATE care_security.gkv_employee_registrations SET valid_until=clock_timestamp()-interval '1 microsecond' WHERE id=$1",[registration.id]);
   await assert.rejects(x.seal(v,c.draft),conflict);
   assert.equal((await f.db.query('SELECT count(*)::int n FROM care_security.gkv_assist_originals WHERE visit_id=$1',[v.visit])).rows[0].n,0);
  });
 }finally{await x.close();}
});

test('Assist original transport checks ownership and recovers only an exact committed version',async t=>{
 const scope={tenantId:randomUUID(),assignmentId:randomUUID(),actorId:randomUUID(),employeeId:randomUUID()};
 const draft={proofId:randomUUID(),updatedAt:'2026-11-01T10:00:00+00:00',payloadHash:'sha256:'+'a'.repeat(64),signatureId:randomUUID()};
 const ready={...scope,visitId:randomUUID(),version:'gkv-assist-original-v1',phase:'ready',draft,original:null};
 const sealed={...ready,phase:'sealed',draft:null,original:{proofId:randomUUID(),draftId:draft.proofId,draftUpdatedAt:draft.updatedAt,
  payloadHash:draft.payloadHash,signatureId:draft.signatureId,sealedAt:'2026-11-01T10:00:01+00:00'}};
 await t.test('malformed, unknown-version, wrong actor/employee and same-id original replies fail closed',()=>{
  for(const mutate of [x=>x.actorId=randomUUID(),x=>x.employeeId=randomUUID(),x=>x.version='v2',x=>x.original.proofId=draft.proofId,x=>x.extra='unexpected']){
   const c=structuredClone(sealed);mutate(c);assert.throws(()=>readAssistOriginalContext(c,scope));
  }
 });
 await t.test('only a definite absent optional RPC preserves existing legacy preparation',async()=>{
  const rpc=async()=>({data:null,error:{code:'PGRST202',message:'Could not find public.gkv_assist_original_context'}});
  assert.equal(await ensureAssistOriginal(rpc,scope,randomUUID()),null);
  for(const error of [{code:'PGRST202',message:'other function'},{code:'42501'},{code:'42P01'},new Error('Network')])
   await assert.rejects(ensureAssistOriginal(async()=>({data:null,error}),scope,randomUUID()));
 });
 await t.test('lost write reply reads matching final original without a second mutation',async()=>{
  const calls=[];let reads=0;
  const result=await ensureAssistOriginal(async(name,args)=>{calls.push({name,args});if(name.endsWith('_seal'))throw Error('Reply lost');return {data:++reads===1?ready:sealed,error:null};},scope,randomUUID());
  assert.deepEqual(result,sealed);assert.equal(calls.filter(c=>c.name.endsWith('_seal')).length,1);
  assert.deepEqual(calls[1].args.p_expected,draft);
 });
 await t.test('lost reply cannot recover a different draft, signature, visit, owner or revoked source',async()=>{
  for(const mutation of [c=>c.original.draftId=randomUUID(),c=>c.original.signatureId=randomUUID(),c=>c.visitId=randomUUID(),c=>c.actorId=randomUUID(),c=>c.original.draftUpdatedAt='2026-11-01T09:59:00+00:00']){
   const changed=structuredClone(sealed);mutation(changed);let reads=0;
   await assert.rejects(ensureAssistOriginal(async name=>{if(name.endsWith('_seal'))throw Error('lost');return {data:++reads===1?ready:changed,error:null};},scope,randomUUID()));
  }
  let reads=0;await assert.rejects(ensureAssistOriginal(async name=>name.endsWith('_seal')?{data:null,error:{code:'40001'}}:++reads===1?{data:ready,error:null}:{data:null,error:{code:'40001'}},scope,randomUUID()));
 });
});
