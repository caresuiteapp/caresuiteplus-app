import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {employeeFixture} from './monthly-employees-fixture.mjs';
import {readMonthlyProof} from '../../src/lib/gkvExchange/monthlyProof.ts';
import {readEmployeeRegistration,readEmployeeWorkspace,readEmployeeCommand,readEmployeeRequestStatus,employeeValidUntil,EmployeeWriter,EmployeeWriteError} from '../../src/lib/gkvExchange/monthlyEmployees.ts';

test('GKV employee registrations and original capture execute the real SQL drafts',async t=>{
 const x=await employeeFixture(),{f}=x;
 try{
  let registration;
  await t.test('personal submission derives employee and actor, never internal personnel number',async()=>{
   registration=await x.submit();const r=readEmployeeRegistration(registration,f.tenant);
   assert.equal(r.state,'pending');assert.equal(r.actor_id,f.actorId);assert.equal(r.employee_id,x.employee);assert.equal(r.reviewed_by,null);
   assert.equal(readEmployeeWorkspace(await x.workspace(),f.tenant,f.actorId).items.length,1);
   await assert.rejects(x.command({action:'submit',input:{id:randomUUID(),employeeNumber:'123456789',evidenceReference:'test',actorId:f.otherActor}}),e=>e.code==='22023');
   await assert.rejects(x.submit('123456789'),e=>e.code==='23505');
  });
  await t.test('expired/anonymous/removed sessions, foreign tenants and blocked portals cannot register',async()=>{
   for(const identity of [x.claims({exp:0}),x.claims({is_anonymous:true}),x.claims({session_id:randomUUID()}),x.claims({role:'service_role'}),x.claims({blocked:true}),x.claims({portal:'family'})])
    await assert.rejects(x.workspace(identity),e=>e.code==='42501');
   await assert.rejects(x.command({action:'submit',input:{id:randomUUID(),employeeNumber:'123456789',evidenceReference:'Test'}},undefined,x.claims(),randomUUID()),e=>e.code==='42501');
   await f.db.query('DELETE FROM auth.sessions WHERE id=$1',[f.sessionId]);await assert.rejects(x.workspace(),e=>e.code==='42501');
   await f.db.query('INSERT INTO auth.sessions VALUES($1,$2,NULL)',[f.sessionId,f.actorId]);
  });
  await t.test('no self-review, forged approval flag or unassigned reviewer',async()=>{
   const c={action:'approve',input:{id:registration.id,revision:1,reviewReference:'Geprüft',reviewNote:'Person abgeglichen',validUntil:new Date(Date.now()+86400000).toISOString(),reviewed:true}};
   await assert.rejects(x.command(c),e=>e.code==='42501');
   await assert.rejects(x.command({...c,input:{...c.input,reviewed:false}},undefined,x.reviewClaims()),e=>e.code==='22023');
   await f.db.query('UPDATE fixture_access SET can_review=false WHERE actor_id=$1',[f.otherActor]);
   await assert.rejects(x.command(c,undefined,x.reviewClaims()),e=>e.code==='42501');
   await f.db.query('UPDATE fixture_access SET can_review=true WHERE actor_id=$1',[f.otherActor]);
   registration=await x.approve(registration);readEmployeeRegistration(registration,f.tenant);assert.equal(registration.state,'approved');
   assert.equal(registration.reviewed_by,f.otherActor);
  });
  await t.test('private tables and helper functions are closed to browser and service role',async()=>{
   for(const table of ['registrations','captures','events','requests']){
    await assert.rejects(f.as(x.claims(),`SELECT * FROM care_security.gkv_employee_${table}`),e=>e.code==='42501');
    const r=(await f.db.query(`SELECT has_table_privilege('service_role','care_security.gkv_employee_${table}','INSERT') allowed`)).rows[0];assert.equal(r.allowed,false);
   }
   await assert.rejects(f.as(x.claims(),'SELECT care_security.gkv_employee_source($1,$2)',[f.tenant,{}]),e=>e.code==='42501');
   assert.equal((await f.db.query("SELECT has_function_privilege('anon','public.gkv_employee_command(uuid,uuid,text,jsonb)','EXECUTE') allowed")).rows[0].allowed,false);
  });
  let v,captured;
  await t.test('new personal proof freezes approved number into source, monthly facts and PDF content',async()=>{
   v=await x.setup();captured=await x.capture(v);await x.freeze(v);
   const p=readMonthlyProof(v.p,f.tenant),facts=p.payload.xmlFacts,source=facts.sources[0];
   assert.equal(facts.captureProvenance,'personally-bound');assert.equal(source.employeeNumber,registration.employee_number);
   assert.equal(source.personalCapture.proofId,captured.id);assert.equal(source.personalCapture.actorId,f.actorId);
   assert.deepEqual(facts.content.days[0].visits[0].lines[0].employeeNumbers,[registration.employee_number]);
   assert.equal((await f.db.query('SELECT count(*)::int n FROM care_security.gkv_employee_captures')).rows[0].n,1);
   await x.prepare(v);assert.ok(v.original.bytes.length>500);
  });
  await t.test('origin and audit cannot be edited or removed; existing proof has no retrofit API',async()=>{
   await assert.rejects(f.db.query('UPDATE care_security.gkv_employee_captures SET employee_number=$1',['666666666']),e=>e.code==='42501');
   await assert.rejects(f.db.exec('DELETE FROM care_security.gkv_employee_events'),e=>e.code==='42501');
   await assert.rejects(x.command({action:'capture',input:{id:captured.id}}),e=>e.code==='22023');
   const old=await x.setup();await x.freeze(old);assert.equal(old.p.payload.xmlFacts.captureProvenance,'not-attested');
  });
  await t.test('wrong caregiver, stale time, future time and false original hash roll back insertion',async()=>{
   const v=await x.setup(),before=(await f.db.query('SELECT count(*)::int n FROM assist_visit_proofs')).rows[0].n;
   for(const options of [{employee:randomUUID()},{end:new Date(Date.now()-3600000).toISOString()},{end:new Date(Date.now()+3600000).toISOString()},{hash:'sha256:'+'0'.repeat(64)}])
    await assert.rejects(x.capture(v,x.claims(),options),e=>e.code==='40001');
   assert.equal((await f.db.query('SELECT count(*)::int n FROM assist_visit_proofs')).rows[0].n,before);
  });
  await t.test('employee portal uses its own active account; swapped or disabled links fail closed',async()=>{
   const identity=x.claims({portal:'employee',account_id:x.account});assert.equal((await x.workspace(identity)).employeeId,x.employee);
   await assert.rejects(x.workspace({...identity,account_id:randomUUID()}),e=>e.code==='42501');
   await f.db.query("UPDATE employee_portal_accounts SET status='disabled' WHERE id=$1",[x.account]);
   await assert.rejects(x.workspace(identity),e=>e.code==='42501');
   await f.db.query("UPDATE employee_portal_accounts SET status='active' WHERE id=$1",[x.account]);
  });
  await t.test('current source changes and browser provenance mutations cannot retain a frozen origin',async()=>{
   for(const mutate of [p=>p.payload.xmlFacts.sources[0].personalCapture.employeeId=randomUUID(),p=>p.payload.xmlFacts.captureProvenance='not-attested',
     p=>p.payload.xmlFacts.sources[0].personalCapture.actorId=f.otherActor,p=>p.payload.xmlFacts.sources[0].personalCapture.capturedAt='2020-01-01T00:00:00Z']){
    const p=structuredClone(v.p);mutate(p);assert.throws(()=>readMonthlyProof(p,f.tenant));
   }
   await f.db.query("UPDATE service_records SET source_receipt=jsonb_set(source_receipt,'{service_ended_at}',to_jsonb('2026-10-03T08:45:00Z'::text)) WHERE id=$1",[v.p.payload.records[0].recordId]);
   await assert.rejects(x.freeze(v),e=>e.code==='40001');
  });
  await t.test('review/revocation retries return current state and cannot resurrect an approval',async()=>{
   const id=randomUUID(),command={action:'revoke',input:{id:registration.id,revision:registration.revision,reason:'Nummer nach Dokumentenabgleich gesperrt'}};
   const revoked=await x.command(command,id,x.reviewClaims());assert.equal(revoked.state,'revoked');readEmployeeRegistration(revoked,f.tenant);
   assert.deepEqual(await x.command(command,id,x.reviewClaims()),revoked);
   const status=readEmployeeRequestStatus(await x.status(id,x.reviewClaims()),f.tenant,id);assert.equal(status.registration.state,'revoked');
   await assert.rejects(x.command({...command,input:{...command.input,reason:'Anderer Grund'}},id,x.reviewClaims()),e=>e.code==='40001');
   const ready=await x.setup();await f.db.query('UPDATE service_records SET source_receipt=$2 WHERE id=$1',[ready.p.payload.records[0].recordId,{...captured.receipt,client_id:ready.p.payload.clientId}]);
   await x.refresh(ready);
   await f.db.query("UPDATE care_security.gkv_monthly_fact_sources SET source_receipt_sha256=encode(sha256(convert_to($2::jsonb::text,'UTF8')),'hex') WHERE record_id=$1",[ready.p.payload.records[0].recordId,JSON.stringify({...captured.receipt,client_id:ready.p.payload.clientId})]);
   await assert.rejects(x.freeze(ready),e=>e.code==='40001');
  });
  await t.test('withdraw and rejection have reasons and preserve event history',async()=>{
   const p=await x.submit(),w=await x.command({action:'withdraw',input:{id:p.id,revision:p.revision,reason:'Eigene Meldung berichtigen'}});assert.equal(readEmployeeRegistration(w,f.tenant).state,'withdrawn');
   const r=await x.submit(),rejected=await x.command({action:'reject',input:{id:r.id,revision:r.revision,reason:'Beleg passt nicht zur Person'}},undefined,x.reviewClaims());
   assert.equal(readEmployeeRegistration(rejected,f.tenant).state,'rejected');assert.equal((await x.workspace()).items.length,3);
  });
 }finally{await x.close();}
});

test('employee client contracts and recovery reject unknown ownership and preserve exact requests',async t=>{
 await t.test('German validity dates follow both daylight-saving transitions',()=>{
  assert.equal(employeeValidUntil('2026-03-29'),'2026-03-29T21:59:59.999Z');
  assert.equal(employeeValidUntil('2026-10-25'),'2026-10-25T22:59:59.999Z');
  assert.throws(()=>employeeValidUntil('2026-02-30'));
 });
 await t.test('unknown fields and copied actor identifiers are rejected before transport',()=>{
  for(const input of [{id:randomUUID(),employeeNumber:'123',evidenceReference:'Test'},{id:randomUUID(),employeeNumber:'123456789',evidenceReference:'Test',employeeId:randomUUID()}])
   assert.throws(()=>readEmployeeCommand({action:'submit',input}));
 });
 await t.test('response loss requires read-only status before retry',async()=>{
  const id=randomUUID(),command={action:'submit',input:{id,employeeNumber:'123456789',evidenceReference:'Belegreferenz'}},calls=[];
  const w=new EmployeeWriter({execute:async(c,request)=>{calls.push({c,request});throw Error('Antwort verloren');},status:async()=>({state:'not-found'})},()=>randomUUID());
  await assert.rejects(w.submit(command));await assert.rejects(w.retry());assert.equal(calls.length,1);
  await w.check();await assert.rejects(w.retry());assert.deepEqual(calls[0],calls[1]);
  const denial=new EmployeeWriter({execute:async()=>{throw new EmployeeWriteError('Abgewiesen',false);},status:async()=>{}},()=>randomUUID());
  await assert.rejects(denial.submit(command));assert.equal(denial.pending,null);
 });
});

test('employee registration race, stale identity and provenance boundaries',async t=>{
 const x=await employeeFixture(),{f}=x;
 try{
  let r;
  await t.test('same request is idempotent; changed content and stale review revisions cannot overwrite it',async()=>{
   const request=randomUUID(),c={action:'submit',input:{id:randomUUID(),employeeNumber:'234567890',evidenceReference:'Synthetische Originalreferenz'}};
   r=await x.command(c,request);assert.deepEqual(await x.command(c,request),r);
   await assert.rejects(x.command({...c,input:{...c.input,employeeNumber:'345678901'}},request),e=>e.code==='40001');
   r=await x.approve(r);assert.equal((await x.command(c,request)).state,'approved');
   await assert.rejects(x.command({action:'revoke',input:{id:r.id,revision:1,reason:'Veraltete Ansicht'}},undefined,x.reviewClaims()),e=>e.code==='40001');
  });
  await t.test('two personally linked employees cannot receive the same active number',async()=>{
   const e=randomUUID(),p=randomUUID();
   await f.db.query("INSERT INTO profiles VALUES($1,$2,$3,true,'active')",[p,f.tenant,f.otherActor]);
   await f.db.query("INSERT INTO employees(id,tenant_id,first_name,last_name,profile_id,status) VALUES($1,$2,'Andere','Pflegekraft',$3,'aktiv')",[e,f.tenant,p]);
   const second=await x.submit('234567890',x.reviewClaims());
   await assert.rejects(x.command({action:'approve',input:{id:second.id,revision:second.revision,reviewReference:'Unabhängiger Testbeleg',reviewNote:'Gleiche Nummer geprüft',validUntil:new Date(Date.now()+86400000).toISOString(),reviewed:true}}),e=>e.code==='40001');
   await x.command({action:'reject',input:{id:second.id,revision:second.revision,reason:'Nummer gehört bereits zur anderen Person'}});
  });
  await t.test('altered original content is detected even if the stored original hash was left unchanged',async()=>{
   const v=await x.setup(),capture=await x.capture(v);await x.freeze(v);
   await f.db.query("UPDATE assist_visit_proofs SET payload_snapshot=jsonb_set(payload_snapshot,'{documentationNote}',to_jsonb('Nachträglich verändert'::text)) WHERE id=$1",[capture.id]);
   await x.refresh(v);await assert.rejects(x.freeze(v),e=>e.code==='40001'&&e.message.includes('Leistungsinhalt'));
  });
  await t.test('one personal and one legacy source remain explicitly partially bound',async()=>{
   const v=await x.setup(),other=await x.setup();await x.capture(v);
   const a=v.p.payload.records[0],b=other.p.payload.records[0],id=randomUUID();
   const receipt={...b.sourceReceipt,client_id:v.p.payload.clientId};
   await f.db.query('INSERT INTO service_records SELECT $1,tenant_id,$3,employee_id,updated_at,service_date,status,actual_minutes,$4,true FROM service_records WHERE id=$2',[id,b.recordId,v.p.payload.clientId,receipt]);
   await f.db.query("INSERT INTO care_security.gkv_monthly_fact_sources SELECT tenant_id,$1,source_updated_at,encode(sha256(convert_to($3::jsonb::text,'UTF8')),'hex'),employee_number,lines,mapping_reference FROM care_security.gkv_monthly_fact_sources WHERE record_id=$2",[id,b.recordId,JSON.stringify(receipt)]);
   v.p=await f.command('replace_sources',{id:v.p.id,revision:v.p.revision,source_ids:[a.recordId,id],reason:'Gemischte Herkunft im Test'});v.input.revision=v.p.revision;
   await x.freeze(v);assert.equal(readMonthlyProof(v.p,f.tenant).payload.xmlFacts.captureProvenance,'partially-bound');
   assert.equal(v.p.payload.xmlFacts.sources.filter(s=>s.personalCapture).length,1);
  });
  await t.test('server rejects non-string references, inactive target links and invalid validity periods',async()=>{
   await assert.rejects(x.command({action:'submit',input:{id:randomUUID(),employeeNumber:'123456789',evidenceReference:123}}),e=>e.code==='22023');
   const p=await x.submit('345678901');
   const c={action:'approve',input:{id:p.id,revision:p.revision,reviewReference:'Testbeleg',reviewNote:'Person abgeglichen',validUntil:'2020-01-01T00:00:00Z',reviewed:true}};
   await assert.rejects(x.command(c,undefined,x.reviewClaims()),e=>e.code==='22023');
   c.input.validUntil=new Date(Date.now()+86400000).toISOString();
   await f.db.query("UPDATE profiles SET is_active=false WHERE id=$1",[x.profile]);await f.db.query("UPDATE employee_portal_accounts SET status='disabled' WHERE id=$1",[x.account]);
   await assert.rejects(x.command(c,undefined,x.reviewClaims()),e=>e.code==='42501');
  });
 }finally{await x.close();}
});
