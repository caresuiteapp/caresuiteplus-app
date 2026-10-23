/** Executes the reviewed SQL draft in the EXISTING PGlite runtime.
 * Canonical Office source verification is an explicit contract double. Receipt
 * fixtures model a trusted byte verifier; they do not prove capture or rendering.
 * node tests/gkv-exchange/monthly-proofs.database.mjs /existing/pglite/dist/index.js
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {readMonthlyProof, executeMonthlyProofCommand} from '../../src/lib/gkvExchange/monthlyProof.ts';
import {readMonthlyClients,readMonthlyWorkspace,readMonthlySources,readMonthlyRequestStatus} from '../../src/lib/gkvExchange/monthlyWorkspace.ts';
import {orderedId} from './monthly-fixtures.mjs';
const {PGlite}=await import(process.argv[2] || '@electric-sql/pglite');
const db=new PGlite();
const tenant=randomUUID(), foreign=randomUUID(), user=randomUUID(), otherUser=randomUUID(), client=randomUUID(), otherClient=randomUUID();
const employee=randomUUID(), employee2=randomUUID(), record=randomUUID(), record2=randomUUID(), proof=randomUUID(), proof2=randomUUID();
await db.exec(`
 CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role BYPASSRLS;
 CREATE SCHEMA auth; CREATE SCHEMA care_security;
 GRANT USAGE ON SCHEMA public,auth,care_security TO authenticated,anon,service_role;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.user',true),'')::uuid $$;
 CREATE FUNCTION care_security.gkv_exchange_actor(t uuid,p text) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT coalesce(auth.uid() IS NOT NULL AND t::text=current_setting('test.tenant',true)
   AND current_setting('test.portal',true)='business' AND p=ANY(string_to_array(current_setting('test.permissions',true),',')),false) $$;
 CREATE TABLE tenants(id uuid PRIMARY KEY);
 CREATE TABLE clients(id uuid PRIMARY KEY,tenant_id uuid,first_name text,last_name text);
 CREATE TABLE employees(id uuid PRIMARY KEY,tenant_id uuid,first_name text,last_name text);
 CREATE TABLE service_records(id uuid PRIMARY KEY,tenant_id uuid,client_id uuid,employee_id uuid,updated_at timestamptz,
  service_date date,status text,actual_minutes integer,source_receipt jsonb,verified_fixture boolean);
 CREATE TABLE assist_visit_proofs(id uuid PRIMARY KEY,tenant_id uuid,visit_id uuid,payload_hash text,payload_snapshot jsonb);
 CREATE FUNCTION care_security.office_invoice_assert_source(s public.service_records,b boolean) RETURNS void LANGUAGE plpgsql AS $$
  BEGIN IF s.verified_fixture IS DISTINCT FROM true OR b IS DISTINCT FROM true THEN RAISE EXCEPTION 'Source verifier rejected'; END IF; END $$;
`);
await db.query('INSERT INTO tenants VALUES($1),($2)',[tenant,foreign]);
await db.query("INSERT INTO clients VALUES($1,$2,'Test','Patient'),($3,$4,'Fremd','Patient')",[client,tenant,otherClient,foreign]);
await db.query("INSERT INTO employees VALUES($1,$2,'Test','Pflegekraft'),($3,$2,'Zweite','Pflegekraft')",[employee,tenant,employee2]);
const recordsByType=new Map([['01',[record,record2]]]);
const sources=[[record,employee,proof],[record2,employee2,proof2]];
for(let n=2;n<=15;n++){const ids=[randomUUID(),randomUUID()];recordsByType.set(String(n).padStart(2,'0'),ids);sources.push([ids[0],employee,randomUUID()],[ids[1],employee2,randomUUID()]);}
for(const [id,e,p]of sources){
 const receipt={tenant_id:tenant,client_id:client,employee_id:e,proof_id:p,proof_payload_hash:'sha256:'+'a'.repeat(64),visit_id:p};
 await db.query("INSERT INTO service_records VALUES($1,$2,$3,$4,'2026-10-03T12:00Z','2026-10-03','approved',30,$5,true)",[id,tenant,client,e,JSON.stringify(receipt)]);
 await db.query('INSERT INTO assist_visit_proofs VALUES($1,$2,$1,$3,$4)',[p,tenant,receipt.proof_payload_hash,JSON.stringify({documentationNote:'Durchgeführte Unterstützung bei der Körperpflege.',tasks:[{id:randomUUID(),title:'Waschen',status:'done',note:'Durchgeführt'}],signature:{storagePath:'MUST NOT COPY'},gps:{latitude:1}})]);
}
await db.exec(await readFile(new URL('../../docs/gkv/sql/monthly-proofs-draft.sql',import.meta.url),'utf8'));
await db.exec(await readFile(new URL('../../docs/gkv/sql/monthly-workspace-draft.sql',import.meta.url),'utf8'));
await db.query("INSERT INTO care_security.gkv_monthly_responsibilities VALUES($1,$2,now()+interval '1 day',NULL,$2,'Fiktive PDL-Zuweisung')",[tenant,user]);
async function actor(o={}){
 await db.exec('RESET ROLE');
 for(const[k,v]of Object.entries({user,tenant,portal:'business',permissions:'office.invoices.view,office.invoices.create',...o}))if(k!=='role')await db.query('SELECT set_config($1,$2,false)',['test.'+k,v]);
 await db.exec('SET ROLE '+(o.role==='anon'?'anon':o.role==='service_role'?'service_role':'authenticated'));
}
async function admin(sql,args=[]){await db.exec('RESET ROLE');try{return await db.query(sql,args);}finally{await actor();}}
async function cmd(action,input,request=randomUUID(),t=tenant){return(await db.query('SELECT public.gkv_monthly_proof_command($1,$2,$3,$4::jsonb) result',[t,request,action,JSON.stringify(input)])).rows[0].result;}
const createInput=(type='01')=>({new_id:randomUUID(),client_id:client,month:'2026-10',service_type:type,source_ids:recordsByType.get(type)});
const finalizeInput=p=>({id:p.id,revision:p.revision,content_sha256:p.content_sha256,reason:'Patient konnte heute nicht unterzeichnen; Sachverhalt dokumentiert.'});
const correction=p=>({id:p.id,revision:p.revision,new_id:randomUUID(),reason:'Fachliche Korrektur nach Rückfrage.'});
async function receiptFixture(p,overrides={}){
 const capture=randomUUID();const value={id:randomUUID(),tenant_id:tenant,proof_id:p.id,proof_revision:p.revision,content_sha256:p.content_sha256,
  capture_id:capture,actor_id:user,signer_role:'patient',signer_name:'Test Patient',authority_reference:null,
  original_path:`tenant/${tenant}/gkv/monthly/${p.id}/captures/${capture}/original.pdf`,original_version:'v1',original_sha256:'a'.repeat(64),
  signature_path:`tenant/${tenant}/gkv/monthly/${p.id}/captures/${capture}/signature.png`,signature_version:'v1',signature_sha256:randomUUID().replaceAll('-','').repeat(2),
  captured_at:new Date().toISOString(),verified_at:new Date().toISOString(),consumed_at:null,...overrides};
 await admin('INSERT INTO care_security.gkv_monthly_confirmation_receipts SELECT * FROM jsonb_populate_record(NULL::care_security.gkv_monthly_confirmation_receipts,$1::jsonb)',[JSON.stringify(value)]);
 return value;
}
const confirm=(p,r,request)=>cmd('confirm',{id:p.id,revision:p.revision,content_sha256:p.content_sha256,receipt_id:r.id},request);
try{await test('monthly proof persistence, isolation and immutable version chain',async t=>{
 await actor();let p;
 await t.test('canonical source assembly preserves both caregivers and descriptions without copying signatures',async()=>{
  p=await cmd('create',createInput());assert.equal(p.status,'open');assert.equal(p.confirmation,null);
  assert.deepEqual(new Set(p.payload.records.map(r=>r.employeeId)),new Set([employee,employee2]));
  assert.ok(p.payload.records.every(r=>r.description.includes('Körperpflege')&&r.tasks[0].title==='Waschen'));
  assert.ok(!JSON.stringify(p.payload).includes('MUST NOT COPY'));assert.ok(!JSON.stringify(p.payload).includes('latitude'));
  assert.equal((await db.query('SELECT count(*)::int n FROM gkv_monthly_proof_events')).rows[0].n,1);
 });
 await t.test('duplicate logical document and concurrent-style competing create roll back',async()=>{
  await assert.rejects(cmd('create',createInput()),e=>e.code==='40001');
  const inputs=[createInput('02'),createInput('02')];const results=await Promise.allSettled(inputs.map(i=>cmd('create',i)));
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected').length,1);
  // PGlite serializes execution: this exercises uniqueness/conflicting requests, not multi-connection scheduling.
 });
 await t.test('idempotency does not duplicate events and rejects different body or actor',async()=>{
  const input=createInput('03'),request=randomUUID(),r=await cmd('create',input,request);
  const replay=await cmd('create',input,request);assert.equal(replay.id,r.id);assert.equal(replay.replayed,true);
  await assert.rejects(cmd('create',{...input,service_type:'04'},request));
  await admin("INSERT INTO care_security.gkv_monthly_responsibilities VALUES($1,$2,now()+interval '1 day',NULL,$3,'Fiktive Vertretung')",[tenant,otherUser,user]);
  await actor({user:otherUser});await assert.rejects(cmd('create',input,request),/anders verwendet/);await actor();
  assert.equal((await db.query('SELECT count(*)::int n FROM gkv_monthly_proof_events WHERE proof_id=$1',[r.id])).rows[0].n,1);
 });
 await t.test('foreign tenant, inactive delegation, anonymous and portal sessions cannot write',async()=>{
  for(const scope of [{tenant:foreign},{user:''},{user:randomUUID()},{portal:'employee'},{portal:'client'},{permissions:'office.invoices.view'},{role:'anon'},{role:'service_role'}]){
   await actor(scope);await assert.rejects(cmd('create',createInput('04')),e=>e.code==='42501');
  }await actor();
  await admin('UPDATE care_security.gkv_monthly_responsibilities SET revoked_at=now() WHERE actor_id=$1',[user]);
  await assert.rejects(cmd('create',createInput('04')),e=>e.code==='42501');
  await admin('UPDATE care_security.gkv_monthly_responsibilities SET revoked_at=NULL,valid_until=now()-interval \'1 second\' WHERE actor_id=$1',[user]);
  await assert.rejects(cmd('create',createInput('04')),e=>e.code==='42501');
  await admin('UPDATE care_security.gkv_monthly_responsibilities SET valid_until=now()+interval \'1 day\' WHERE actor_id=$1',[user]);
 });
 await t.test('RLS hides foreign rows and all direct mutations or receipt injection are denied',async()=>{
  for(const table of ['gkv_monthly_proofs','gkv_monthly_proof_series','gkv_monthly_proof_events']){
   await assert.rejects(db.query(`DELETE FROM public.${table}`),e=>e.code==='42501');
   await assert.rejects(db.query(`INSERT INTO public.${table} SELECT * FROM public.${table}`),e=>e.code==='42501');
   await actor({tenant:foreign});assert.equal((await db.query(`SELECT count(*)::int n FROM public.${table}`)).rows[0].n,0);await actor();
  }
  await assert.rejects(db.query("UPDATE gkv_monthly_proofs SET status='final'"),e=>e.code==='42501');
  for(const table of ['gkv_monthly_responsibilities','gkv_monthly_requests','gkv_monthly_confirmation_receipts','gkv_monthly_source_claims'])await assert.rejects(db.query(`SELECT * FROM care_security.${table}`),e=>e.code==='42501');
 });
 await t.test('invalid input and missing, duplicate, foreign or unverified sources leave no partial series',async()=>{
  const before=(await db.query('SELECT count(*)::int n FROM gkv_monthly_proof_series')).rows[0].n;
  for(const change of [{source_ids:[]},{source_ids:[record,record]},{source_ids:[null]},{source_ids:[randomUUID()]},{client_id:otherClient},{month:'2026-09'},{month:'2026-13'},{service_type:'99'},{source_ids:[record],employee_id:employee2},{new_id:null}])await assert.rejects(cmd('create',{...createInput('04'),...change}));
  await admin('UPDATE service_records SET verified_fixture=false WHERE id=$1',[record]);
  await assert.rejects(cmd('create',{...createInput('04'),source_ids:[record]}),/Source verifier rejected/);
  await admin('UPDATE service_records SET verified_fixture=true WHERE id=$1',[record]);
  assert.equal((await db.query('SELECT count(*)::int n FROM gkv_monthly_proof_series')).rows[0].n,before);
 });
 await t.test('a canonical record cannot be double-counted under another service type',async()=>{
  await assert.rejects(cmd('create',{...createInput('04'),source_ids:[record]}),e=>e.code==='40001');
 });
 await t.test('original caregiver binding cannot be replaced by another employee name',async()=>{
  await admin('UPDATE service_records SET employee_id=$1 WHERE id=$2',[employee2,record]);
  await assert.rejects(cmd('create',{...createInput('04'),source_ids:[record]}),/Personenbindung/);
  await admin('UPDATE service_records SET employee_id=$1 WHERE id=$2',[employee,record]);
 });
 await t.test('missing original descriptions and legacy receipts are not treated as monthly proof evidence',async()=>{
  await admin("UPDATE assist_visit_proofs SET payload_snapshot=jsonb_set(payload_snapshot,'{documentationNote}','null') WHERE id=$1",[proof]);
  await assert.rejects(cmd('create',{...createInput('04'),source_ids:[record]}),/Leistungsbeschreibung/);
  await admin("UPDATE assist_visit_proofs SET payload_snapshot=jsonb_set(payload_snapshot,'{documentationNote}',to_jsonb('Durchgeführte Unterstützung bei der Körperpflege.'::text)) WHERE id=$1",[proof]);
 });
 await t.test('source changes block finalization and responsible edits record full before/after snapshots',async()=>{
  await admin("UPDATE service_records SET updated_at=updated_at+interval '1 second' WHERE id=$1",[record]);
  await assert.rejects(cmd('finalize_missing',finalizeInput(p)),e=>e.code==='40001');
  const old=p;
  p=await cmd('replace_sources',{id:p.id,revision:p.revision,source_ids:[record,record2],reason:'Quellfassung nach dokumentierter Korrektur übernommen.'});
  assert.notEqual(p.content_sha256,old.content_sha256);assert.equal(p.revision,old.revision+1);
  const event=(await db.query("SELECT * FROM gkv_monthly_proof_events WHERE proof_id=$1 AND action='replace_sources'",[p.id])).rows[0];
  assert.equal(event.before_state.content_sha256,old.content_sha256);assert.equal(event.after_state.content_sha256,p.content_sha256);
  await assert.rejects(cmd('replace_sources',{id:p.id,revision:old.revision,source_ids:[record],reason:'Veraltete Anfrage'}),e=>e.code==='40001');
 });
 await t.test('confirmation needs exact current original and a private verified receipt',async()=>{
  await assert.rejects(confirm(p,{id:randomUUID()}),/Bestätigung fehlt/);
  await assert.rejects(cmd('finalize_missing',{...finalizeInput(p),content_sha256:'f'.repeat(64)}),e=>e.code==='40001');
  await assert.rejects(cmd('finalize_missing',{...finalizeInput(p),reason:''}),/Begründung/);
  await assert.rejects(cmd('finalize_missing',{...finalizeInput(p),signatureDeferredToClientPortal:true}),/unbekannt/);
  const wrong=await receiptFixture(p,{proof_revision:p.revision-1});await assert.rejects(confirm(p,wrong),/Bestätigung fehlt/);
 });
 await t.test('missing signature is an explicit final exception, distinct from pending confirmation',async()=>{
  p=await cmd('finalize_missing',finalizeInput(p));assert.equal(p.status,'final');assert.equal(p.confirmation.kind,'missing_signature');
  assert.ok(p.confirmation.reason);assert.ok(p.finalized_at);
  await assert.rejects(cmd('replace_sources',{id:p.id,revision:p.revision,source_ids:[record],reason:'Direkter Eingriff'}),/gesperrt/);
 });
 await t.test('correction invalidates original immediately, archives evidence and resets all confirmation',async()=>{
  const old=p;const input=correction(p);p=await cmd('correct',input);assert.equal(p.version,2);assert.equal(p.predecessor_id,old.id);
  assert.equal(p.status,'open');assert.equal(p.confirmation,null);assert.equal(p.finalized_at,null);assert.deepEqual(p.payload,old.payload);
  assert.notEqual(p.content_sha256,old.content_sha256);
  const archived=(await db.query('SELECT * FROM gkv_monthly_proofs WHERE id=$1',[old.id])).rows[0];
  assert.equal(archived.status,'invalidated');assert.deepEqual(archived.confirmation,old.confirmation);assert.deepEqual(archived.payload,old.payload);
  assert.equal((await db.query("SELECT count(*)::int n FROM gkv_monthly_proofs WHERE series_id=$1 AND status='final'",[p.series_id])).rows[0].n,0);
  await assert.rejects(cmd('correct',input),e=>e.code==='40001');
  await assert.rejects(cmd('correct',correction(p)),/Nur endgültige/);
 });
 await t.test('correction failure atomically restores original validity and writes no misleading history',async()=>{
  const q=await cmd('finalize_missing',finalizeInput(p));p=q;
  await assert.rejects(cmd('correct',{...correction(q),new_id:q.id}));
  assert.equal((await db.query('SELECT status FROM gkv_monthly_proofs WHERE id=$1',[q.id])).rows[0].status,'final');
  assert.equal((await db.query("SELECT count(*)::int n FROM gkv_monthly_proof_events WHERE proof_id=$1 AND action='invalidate_for_correction'",[q.id])).rows[0].n,0);
 });
 await t.test('fresh distinct receipt finalizes each type; old receipt and identical image cannot be reused',async()=>{
  let q=await cmd('create',createInput('05'));const r=await receiptFixture(q);const request=randomUUID();
  q=await confirm(q,r,request);assert.equal(q.confirmation.kind,'signature');assert.equal(q.status,'final');
  const next=await cmd('correct',correction(q));await assert.rejects(confirm(next,r),/Bestätigung fehlt/);
  const replay=await cmd('confirm',{id:q.id,revision:q.revision-1,content_sha256:q.content_sha256,receipt_id:r.id},request);
  assert.equal(replay.status,'invalidated');assert.equal(replay.replayed,true);
  const type6=await cmd('create',createInput('06'));
  await assert.rejects(receiptFixture(type6,{signature_sha256:r.signature_sha256}),e=>e.code==='23505');await actor();
  const fresh=await receiptFixture(type6);assert.equal((await confirm(type6,fresh)).status,'final');
 });
 await t.test('wrong actor, expired/future verification, foreign original path and old capture fail closed',async()=>{
  const q=await cmd('create',createInput('07'));
  for(const delta of [{actor_id:otherUser},{original_path:'tenant/foreign/original.pdf'},
   {captured_at:'2026-01-01T00:00:00Z'},{verified_at:'2099-01-01T00:00:00Z'},
   {captured_at:'2026-01-01T00:00:00Z',verified_at:'2026-01-01T00:01:00Z'}]){
   const r=await receiptFixture(q,delta);await assert.rejects(confirm(q,r),/Bestätigung fehlt/);
  }
  await assert.rejects(receiptFixture(q,{signer_role:'representative',authority_reference:null}),e=>e.code==='23514');await actor();
  const r=await receiptFixture(q,{signer_role:'representative',authority_reference:'Fiktiv geprüfte Vollmacht V-1'});
  assert.equal((await confirm(q,r)).confirmation.signerRole,'representative');
 });
 await t.test('web command contract executes against SQL and reads actual immutable history',async()=>{
  const input=createInput('08'),request=randomUUID();
  const rpc=async(name,args)=>{assert.equal(name,'gkv_monthly_proof_command');
   try{return {data:await cmd(args.p_action,args.p_input,args.p_request_id,args.p_tenant_id),error:null};}
   catch(error){return {data:null,error:{code:error.code}};}};
  const r=await executeMonthlyProofCommand(rpc,tenant,{action:'create',input},request);
  assert.equal(r.id,input.new_id);assert.equal(r.status,'open');
  const rows=(await db.query('SELECT to_jsonb(p) proof FROM gkv_monthly_proofs p WHERE tenant_id=$1',[tenant])).rows;
  for(const {proof:row} of rows)assert.equal(readMonthlyProof(row,tenant).id,row.id);
 });
 await t.test('SQL security surface has RLS, private helpers, invoker-only public entry and fixed search paths',async()=>{
  const funcs=(await db.query("SELECT n.nspname,p.proname,p.prosecdef,p.proconfig,has_function_privilege('anon',p.oid,'EXECUTE') anon,has_function_privilege('service_role',p.oid,'EXECUTE') service FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE p.proname LIKE 'gkv_monthly_%'")).rows;
  assert.ok(funcs.every(f=>!f.anon&&!f.service&&f.proconfig.includes('search_path=pg_catalog')));
  assert.ok(funcs.filter(f=>f.nspname==='public').every(f=>!f.prosecdef));
  const tables=(await db.query("SELECT relrowsecurity FROM pg_class WHERE relname IN ('gkv_monthly_proofs','gkv_monthly_proof_series','gkv_monthly_proof_events','gkv_monthly_responsibilities','gkv_monthly_requests','gkv_monthly_confirmation_receipts','gkv_monthly_source_claims')")).rows;
  assert.equal(tables.length,7);assert.ok(tables.every(r=>r.relrowsecurity));
 });
 await t.test('workspace reads only the current version and separates view permission from active delegation',async()=>{
  const read=async()=>(await db.query('SELECT public.gkv_monthly_workspace($1,$2,$3) v',[tenant,client,'2026-10'])).rows[0].v;
  const ws=readMonthlyWorkspace(await read(),tenant,client,'2026-10');assert.equal(ws.canWrite,true);
  assert.equal(ws.proofs.find(row=>row.serviceType==='01').status,'final');assert.equal(ws.proofs.find(row=>row.serviceType==='01').version,2);
  await actor({permissions:'office.invoices.view'});assert.equal(readMonthlyWorkspace(await read(),tenant,client,'2026-10').canWrite,false);
  await assert.rejects(cmd('create',createInput('09')),e=>e.code==='42501');await actor();
  await admin('UPDATE care_security.gkv_monthly_responsibilities SET revoked_at=now() WHERE actor_id=$1',[user]);
  assert.equal((await read()).canWrite,false);await admin('UPDATE care_security.gkv_monthly_responsibilities SET revoked_at=NULL WHERE actor_id=$1',[user]);
 });
 await t.test('all read RPCs enforce office tenant and portal boundaries without requiring write access',async()=>{
  const calls=[['gkv_monthly_clients($1,$2)',[tenant,'2026-10']],['gkv_monthly_workspace($1,$2,$3)',[tenant,client,'2026-10']],
   ['gkv_monthly_sources($1,$2,$3)',[tenant,client,'2026-10']],['gkv_monthly_request_status($1,$2)',[tenant,randomUUID()]]];
  for(const denied of [{tenant:foreign},{user:''},{portal:'client'},{portal:'employee'},{permissions:''},{role:'anon'},{role:'service_role'}]){
   await actor(denied);for(const[call,args]of calls)await assert.rejects(db.query('SELECT public.'+call,args),e=>e.code==='42501');
  }await actor({permissions:'office.invoices.view'});for(const[call,args]of calls)await db.query('SELECT public.'+call,args);await actor();
  await assert.rejects(db.query('SELECT public.gkv_monthly_sources($1,$2,$3)',[tenant,otherClient,'2026-10']),e=>e.code==='42501');
  await assert.rejects(db.query('SELECT public.gkv_monthly_workspace($1,$2,$3)',[tenant,otherClient,'2026-10']),e=>e.code==='42501');
 });
 await t.test('source candidates carry claims but omit signature/GPS data and reject changed receipt binding',async()=>{
  const read=async()=>(await db.query('SELECT public.gkv_monthly_sources($1,$2,$3) v',[tenant,client,'2026-10'])).rows[0].v;
  const page=readMonthlySources(await read(),tenant,client,'2026-10',null);
  assert.equal(page.items.length,30);assert.ok(page.items.some(s=>s.assignedSeriesId));assert.ok(page.items.some(s=>s.assignedSeriesId===null));
  assert.ok(!JSON.stringify(page).includes('MUST NOT COPY'));assert.ok(!JSON.stringify(page).includes('latitude'));
  await admin('UPDATE service_records SET employee_id=$1 WHERE id=$2',[employee2,record]);
  assert.ok(!(await read()).sources.some(s=>s.id===record));await admin('UPDATE service_records SET employee_id=$1 WHERE id=$2',[employee,record]);
 });
 await t.test('read-only request recovery returns current invalidated state, never replays a mutation or reveals another actor request',async()=>{
  const request=randomUUID(),input=createInput('09');let q=await cmd('create',input,request);
  q=await cmd('finalize_missing',finalizeInput(q));await cmd('correct',correction(q));
  const before=(await db.query('SELECT count(*)::int n FROM gkv_monthly_proof_events')).rows[0].n;
  const read=async(id=request,t=tenant)=>(await db.query('SELECT public.gkv_monthly_request_status($1,$2) v',[t,id])).rows[0].v;
  await actor({permissions:'office.invoices.view'});assert.equal(readMonthlyRequestStatus(await read(),tenant,request).proof.status,'invalidated');
  const missing=randomUUID();assert.deepEqual(readMonthlyRequestStatus(await read(missing),tenant,missing),{state:'not_found',proof:null});
  await actor({user:otherUser});await assert.rejects(read(),e=>e.code==='42501');
  await actor({tenant:foreign});assert.equal((await read(request,foreign)).state,'not_found');await actor();
  assert.equal((await db.query('SELECT count(*)::int n FROM gkv_monthly_proof_events')).rows[0].n,before);
 });
 await t.test('client and source keyset pagination is deterministic, scoped, literal-searchable and complete',async()=>{
  for(let n=1;n<=52;n++){
   await admin("INSERT INTO clients VALUES($1,$2,'Paging','Patient')",[orderedId(n),tenant]);
   await admin("INSERT INTO service_records VALUES($1,$2,$3,$4,'2026-10-03T12:00Z','2026-10-03','approved',30,$5,true)",[
    orderedId(100+n),tenant,orderedId(n),employee,JSON.stringify({tenant_id:tenant,client_id:orderedId(n),employee_id:employee,proof_id:proof,proof_payload_hash:'sha256:'+'a'.repeat(64),visit_id:proof})]);
  }
  const clients=async(after=null)=>(await db.query('SELECT public.gkv_monthly_clients($1,$2,$3,$4) v',[tenant,'2026-10','Paging',after])).rows[0].v;
  const first=readMonthlyClients(await clients(),tenant,'2026-10','Paging',null);assert.equal(first.items.length,50);assert.equal(first.nextCursor,orderedId(50));
  const last=readMonthlyClients(await clients(first.nextCursor),tenant,'2026-10','Paging',first.nextCursor);assert.equal(last.items.length,2);assert.equal(last.nextCursor,null);
  assert.equal(new Set([...first.items,...last.items].map(c=>c.id)).size,52);
  const noWildcard=(await db.query('SELECT public.gkv_monthly_clients($1,$2,$3) v',[tenant,'2026-10','%'])).rows[0].v;assert.equal(noWildcard.clients.length,0);
  const noMonth=(await db.query('SELECT public.gkv_monthly_clients($1,$2) v',[tenant,'2026-09'])).rows[0].v;assert.equal(noMonth.clients.length,0);
  await assert.rejects(db.query('SELECT public.gkv_monthly_clients($1,$2)',[tenant,'2026-13']));
  await assert.rejects(db.query('SELECT public.gkv_monthly_clients($1,$2,$3)',[tenant,'2026-10','x'.repeat(101)]));
  // Give a single client 52 separate canonical rows to exercise the second source page.
  await admin("UPDATE service_records SET client_id=$1,source_receipt=jsonb_set(source_receipt,'{client_id}',to_jsonb($1::text)) WHERE id>=$2 AND id<=$3",[orderedId(1),orderedId(101),orderedId(152)]);
  const read=async(after=null)=>(await db.query('SELECT public.gkv_monthly_sources($1,$2,$3,$4) v',[tenant,orderedId(1),'2026-10',after])).rows[0].v;
  const a=readMonthlySources(await read(),tenant,orderedId(1),'2026-10',null);
  const b=readMonthlySources(await read(a.nextCursor),tenant,orderedId(1),'2026-10',a.nextCursor);
  assert.equal(a.items.length,50);assert.equal(b.items.length,2);assert.equal(b.nextCursor,null);assert.equal(new Set([...a.items,...b.items].map(s=>s.id)).size,52);
 });
});}finally{await db.close();}
