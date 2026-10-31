/** Web-build tests: SQL drafts, frozen facts and PDF display; no Python host. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {readMonthlyProof} from '../../src/lib/gkvExchange/monthlyProof.ts';
import {monthlyFactsFixture,lines} from './monthly-facts-fixture.mjs';
test('monthly facts: SQL binding, displayed content and permissions',async t=>{
 const fixture=await monthlyFactsFixture();
 const {f,store,worker,setup,freeze,refresh,prepare,confirm}=fixture;let ink=20;
 try{
  await t.test('browser cannot submit replacements, write private mappings or call private helpers',async()=>{
   const v=await setup();await assert.rejects(f.command('freeze_facts',{id:v.p.id,revision:v.p.revision,employeeNumber:'666666666'}));
   for(const table of ['gkv_monthly_fact_profiles','gkv_monthly_fact_sources','gkv_monthly_fact_employee_locks']){
    await assert.rejects(f.as(f.claims(),`SELECT * FROM care_security.${table}`),e=>e.code==='42501');
    await assert.rejects(f.as(f.claims(),`DELETE FROM care_security.${table}`),e=>e.code==='42501');
   }
   const grants=(await f.db.query("SELECT has_function_privilege('authenticated','care_security.gkv_monthly_freeze_facts(public.gkv_monthly_proofs)','EXECUTE') a, has_function_privilege('service_role','care_security.gkv_monthly_build_facts(public.gkv_monthly_proofs,uuid,timestamptz)','EXECUTE') b")).rows[0];assert.deepEqual(grants,{a:false,b:false});
   await assert.rejects(f.command('freeze_facts',{id:v.p.id,revision:v.p.revision},randomUUID(),f.claims({sub:f.otherActor,session_id:f.otherSession})),e=>e.code==='42501');
  });
  await t.test('distinct actual visits keep chronological numbers in PDF/XML and duplicate source visits fail closed',async()=>{
   const v=await setup(),r=v.p.payload.records[0],record='00000000-0000-4000-8000-000000000001',visit=randomUUID();
   const receipt={...r.sourceReceipt,proof_id:visit,visit_id:visit,service_started_at:'2026-10-03T11:00:00Z',service_ended_at:'2026-10-03T11:45:00Z'};
   await f.db.query('INSERT INTO assist_visit_proofs SELECT $1,tenant_id,$1,payload_hash,payload_snapshot FROM assist_visit_proofs WHERE id=$2',[visit,r.sourceReceipt.proof_id]);
   await f.db.query('INSERT INTO service_records SELECT $1,tenant_id,client_id,employee_id,updated_at,service_date,status,actual_minutes,$3,true FROM service_records WHERE id=$2',[record,r.recordId,receipt]);
   await f.db.query("INSERT INTO care_security.gkv_monthly_fact_sources SELECT tenant_id,id,updated_at,encode(sha256(convert_to(source_receipt::text,'UTF8')),'hex'),'123123123',$2,'SYNTHETISCHER zweiter Einsatz' FROM service_records WHERE id=$1",[record,JSON.stringify(lines)]);
   v.p=await f.command('replace_sources',{id:v.p.id,revision:v.p.revision,source_ids:[record,r.recordId],reason:'Zweiter getrennter Einsatz'});await freeze(v);
   assert.deepEqual(v.p.payload.xmlFacts.content.days[0].visits.map(v=>[v.sequence,v.startTime]),[[1,'1000'],[2,'1300']]);
   await prepare(v);const task=getDocument({data:new Uint8Array(v.original.bytes),isEvalSupported:false,verbosity:0});
   try{let text='';const pdf=await task.promise;for(let n=1;n<=pdf.numPages;n++)text+=(await (await pdf.getPage(n)).getTextContent()).items.map(i=>i.str).join(' ');
    assert.ok(text.indexOf('Einsatz 1')<text.indexOf('Einsatz 2'));assert.ok(text.includes('13:00'));
   }finally{await task.destroy();}
   await f.db.query('UPDATE service_records SET source_receipt=$2 WHERE id=$1',[record,r.sourceReceipt]);await refresh(v);
   await f.db.query("UPDATE care_security.gkv_monthly_fact_sources SET source_receipt_sha256=(SELECT encode(sha256(convert_to(source_receipt::text,'UTF8')),'hex') FROM service_records WHERE id=$1) WHERE record_id=$1",[record]);
   await assert.rejects(freeze(v),e=>e.code==='22023');
  });
  await t.test('missing mapping does not consume request, alter version or make up employee numbers',async()=>{
   const v=await setup({mapped:false}),before=structuredClone(v.p),id=randomUUID();
   await assert.rejects(f.command('freeze_facts',{id:v.p.id,revision:v.p.revision},id),e=>e.code==='22023');
   const actual=(await f.db.query('SELECT * FROM gkv_monthly_proofs WHERE id=$1',[v.p.id])).rows[0];assert.equal(actual.revision,before.revision);assert.equal(actual.content_sha256,before.content_sha256);
   assert.equal((await f.db.query('SELECT count(*)::int n FROM care_security.gkv_monthly_requests WHERE request_id=$1',[id])).rows[0].n,0);
  });
  await t.test('response loss reuses one request, one revision and one event; conflicting retry fails',async()=>{
   const v=await setup(),input={id:v.p.id,revision:v.p.revision},id=randomUUID();await freeze(v,id);
   const replay=await f.command('freeze_facts',input,id);assert.equal(replay.replayed,true);assert.equal(replay.revision,v.p.revision);
   assert.equal((await f.db.query("SELECT count(*)::int n FROM gkv_monthly_proof_events WHERE proof_id=$1 AND action='freeze_facts'",[v.p.id])).rows[0].n,1);
   await assert.rejects(f.command('freeze_facts',{...input,revision:input.revision+1},id));
  });
  await t.test('a source receipt change is detected even with an unchanged source timestamp',async()=>{
   const v=await setup();await freeze(v);await f.db.query("UPDATE service_records SET source_receipt=source_receipt||'{\"service_started_at\":\"2026-10-03T08:05:00Z\"}'::jsonb WHERE id=$1",[v.p.payload.records[0].recordId]);
   await assert.rejects(freeze(v),e=>e.code==='40001');await refresh(v);await assert.rejects(freeze(v),e=>e.code==='22023');
  });
  await t.test('contract rejects unbound visits, source dates, original employees and extra fields',async()=>{
   const v=await setup();await freeze(v);
   for(const mutate of [p=>p.payload.xmlFacts.sources[0].employeeId=randomUUID(),p=>p.payload.xmlFacts.content.days[0].visits[0].startTime='1100',
    p=>p.payload.xmlFacts.content.days[0].visits[0].lines[0].employeeNumbers=['555555555'],p=>p.payload.xmlFacts.content.insuranceNumber='',
    p=>p.payload.xmlFacts.content.days[0].visits[0].lines[1].minutes=46,p=>p.payload.xmlFacts.extra=true,
    p=>p.payload.xmlFacts.content.firstName='Fremde',p=>p.payload.xmlFacts.captureProvenance='verified']){
    const changed=structuredClone(v.p);mutate(changed);assert.throws(()=>readMonthlyProof(changed,f.tenant));
   }
  });
  await t.test('SQL prevents wrong profile, amount/minute mismatch, manual employee override and source-time omission',async()=>{
   const v=await setup(),id=v.p.payload.records[0].recordId;
   for(const invalid of [[{...lines[0],employeeNumbers:['555555555']}],[{...lines[0],code:'0701101'}],[{...lines[0],quantity:'0.00'}],[{...lines[1],minutes:46}],[{...lines[1],quantity:'1.00'}]]){
    await f.db.query('UPDATE care_security.gkv_monthly_fact_sources SET lines=$2 WHERE record_id=$1',[id,JSON.stringify(invalid)]);await assert.rejects(freeze(v),e=>e.code==='22023');
   }
   await f.db.query('UPDATE care_security.gkv_monthly_fact_sources SET lines=$2 WHERE record_id=$1',[id,JSON.stringify(lines)]);
   await f.db.query("UPDATE service_records SET source_receipt=source_receipt-'service_started_at' WHERE id=$1",[id]);await refresh(v);
   await f.db.query("UPDATE care_security.gkv_monthly_fact_sources SET source_receipt_sha256=(SELECT encode(sha256(convert_to(source_receipt::text,'UTF8')),'hex') FROM service_records WHERE id=$1) WHERE record_id=$1",[id]);
   await assert.rejects(freeze(v),e=>e.code==='22023');
  });
 }finally{await fixture.close();}
});
