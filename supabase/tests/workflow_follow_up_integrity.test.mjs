// Synthetic isolated PostgreSQL follow-up contract only. No business rows or production connection.
// Trusted attestation fixtures test the contract only; NO real PDF bytes/producer are verified.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
const db = new PGlite();
const id = n => `10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const t=id(1), employee=id(2), user=id(3), account=id(4), assignment=id(5), visit=id(6), client=id(7), proof=id(8), signature=id(9), legacyDoc=id(10), legacySig=id(11);
const canonical = x => Array.isArray(x)?`[${x.map(canonical).join(',')}]`:x&&typeof x==='object'?`{${Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')}}`:JSON.stringify(x);
const hash = x => 'sha256:'+createHash('sha256').update(canonical(x)).digest('hex');
const begin='2026-09-18T08:00:00.000Z',end='2026-09-18T09:00:00.000Z',docAt='2026-09-18T09:02:00.000Z',signedAt='2026-09-18T09:03:00.000Z';
const docText='Tatsächliche Leistung bestätigt.';
await db.exec(`
CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role; CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.uid'),'')::uuid $$;
CREATE FUNCTION current_tenant_id() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.tenant'),'')::uuid $$;
CREATE FUNCTION current_portal_type() RETURNS text LANGUAGE sql AS $$ SELECT nullif(current_setting('test.portal'),'') $$;
CREATE FUNCTION current_portal_account_id() RETURNS uuid LANGUAGE sql AS $$ SELECT '${account}'::uuid $$;
CREATE FUNCTION resolve_current_employee_id() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.employee'),'')::uuid $$;
CREATE FUNCTION has_permission(text) RETURNS boolean LANGUAGE sql AS $$ SELECT $1=ANY(string_to_array(current_setting('test.permissions'),',')) $$;
CREATE FUNCTION is_internal_tenant_actor(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT $1=current_tenant_id() AND current_setting('test.internal')='true' $$;
CREATE TABLE employee_portal_accounts(id uuid,tenant_id uuid,employee_id uuid,auth_user_id uuid,status text);
CREATE TABLE assignments(id uuid PRIMARY KEY,tenant_id uuid,client_id uuid,employee_id uuid,status text,actual_start_at timestamptz,actual_end_at timestamptz);
CREATE TABLE assist_visits(id uuid PRIMARY KEY,tenant_id uuid,legacy_assignment_id uuid,client_id uuid,employee_id uuid,canonical_status text,
 actual_start_at timestamptz,actual_end_at timestamptz,planned_start_at timestamptz,planned_end_at timestamptz);
CREATE TABLE assist_visit_documentation(id uuid DEFAULT gen_random_uuid(),tenant_id uuid,visit_id uuid,short_description text,submitted_at timestamptz);
CREATE TABLE assist_visit_tasks(id uuid,tenant_id uuid,visit_id uuid,status text);
CREATE TABLE assist_time_events(id uuid DEFAULT gen_random_uuid(),tenant_id uuid,visit_id uuid,event_type text,occurred_at timestamptz);
CREATE TABLE assist_visit_signatures(id uuid PRIMARY KEY,tenant_id uuid,visit_id uuid,payload_hash text,signature_hash text,storage_path text,
 signer_name text,signer_role text,signed_at timestamptz,is_valid boolean,invalidated_at timestamptz);
CREATE TABLE assist_visit_proofs(id uuid PRIMARY KEY,tenant_id uuid,visit_id uuid,signature_id uuid REFERENCES assist_visit_signatures(id),status text,
 payload_snapshot jsonb,payload_hash text,pdf_storage_path text,pdf_hash text,approved_at timestamptz,approved_by uuid,created_at timestamptz DEFAULT now());
CREATE TABLE documentation_entries(id uuid PRIMARY KEY,tenant_id uuid,assignment_id uuid,client_id uuid,employee_id uuid,status text,free_text text,updated_at timestamptz);
CREATE TABLE time_entries(id uuid DEFAULT gen_random_uuid(),tenant_id uuid,assignment_id uuid,entry_type text,event_at timestamptz);
CREATE TABLE signatures(id uuid PRIMARY KEY,tenant_id uuid,assignment_id uuid,documentation_entry_id uuid,client_id uuid,employee_id uuid,status text,
 signature_data text,signer_name text,signed_at timestamptz);
CREATE TABLE service_records(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid,assignment_id uuid REFERENCES assignments(id),
 assist_visit_id uuid REFERENCES assist_visits(id),client_id uuid,employee_id uuid,product_key text,service_date date,actual_minutes integer,
 planned_minutes integer,status text,documentation_entry_id uuid REFERENCES documentation_entries(id),signature_id uuid REFERENCES signatures(id));
CREATE TABLE client_billing_candidates(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid,proof_id uuid,visit_id uuid,client_id uuid,
 billing_period_start timestamptz,billing_period_end timestamptz,duration_minutes integer,source_snapshot jsonb,UNIQUE(tenant_id,proof_id));
GRANT SELECT,INSERT,UPDATE,DELETE ON client_billing_candidates,service_records TO authenticated;
CREATE POLICY legacy_permissive_records ON service_records FOR ALL TO authenticated USING(TRUE) WITH CHECK(TRUE);
`);
const draft=readFileSync(new URL('../../docs/workflow-server-service-record-draft.sql',import.meta.url),'utf8');
await db.exec(draft);
async function config(changes={}) {for(const[k,v]of Object.entries({uid:user,tenant:t,portal:'employee',employee,permissions:'',internal:'false',...changes}))await db.query('SELECT set_config($1,$2,false)',['test.'+k,v]);}
async function reset({canonicalVisit=true,seconds=3000,actualEnd=end}={}) {
 await db.exec('RESET ROLE; TRUNCATE assist_visit_admin_audit,assignment_tasks,assist_visit_signature_requests,workflow_proof_attestations,client_billing_candidates,service_records,assist_visit_proofs,assist_visit_signatures,assist_visit_documentation,assist_visit_tasks,assist_time_events,assist_visits,assignments,employee_portal_accounts,documentation_entries,signatures,time_entries CASCADE');
 await db.query('INSERT INTO employee_portal_accounts VALUES($1,$2,$3,$4,$5)',[account,t,employee,user,'active']);
 await db.query('INSERT INTO assignments VALUES($1,$2,$3,$4,$5,$6,$7)',[assignment,t,client,employee,'completed',begin,actualEnd]);
 if(canonicalVisit){
  await db.query('INSERT INTO assist_visits(id,tenant_id,legacy_assignment_id,client_id,employee_id,canonical_status,actual_start_at,actual_end_at,planned_start_at,planned_end_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[visit,t,assignment,client,employee,'completed',begin,actualEnd,begin,end]);
  await db.query('INSERT INTO assist_visit_documentation(tenant_id,visit_id,short_description,submitted_at) VALUES($1,$2,$3,$4)',[t,visit,docText,docAt]);
  const snap={visitId:visit,clientId:client,employeeId:employee,plannedStartAt:begin,plannedEndAt:end,tasks:[],documentationNote:docText,
   visitTimes:{serviceStartedAt:begin,serviceEndedAt:actualEnd,serviceSeconds:seconds},signature:{signerName:'Klient',signedAt},generatedAt:docAt};
  const signedPayload={visitId:visit,clientId:client,employeeId:employee,plannedStartAt:begin,plannedEndAt:end,taskStatuses:[],documentationNote:docText};
  await db.query('INSERT INTO assist_visit_signatures VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',[signature,t,visit,hash(signedPayload),'sha256:'+'cd'.repeat(32),'own/signature.png','Klient','client',signedAt,true,null]);
  await db.query('INSERT INTO assist_visit_proofs(id,tenant_id,visit_id,signature_id,status,payload_snapshot,payload_hash,pdf_storage_path,pdf_hash,approved_at,approved_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',[proof,t,visit,signature,'approved',JSON.stringify(snap),hash(snap),'own/proof-v1.pdf','ab'.repeat(32),signedAt,user]);
  await db.query(`INSERT INTO workflow_proof_attestations(tenant_id,assignment_id,visit_id,proof_id,proof_payload_hash,signature_id,signature_hash,signed_at,service_started_at,service_ended_at,actual_minutes,pdf_storage_path,pdf_sha256,producer_contract) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'verified-original-bytes-v1')`,[t,assignment,visit,proof,hash(snap),signature,'sha256:'+'cd'.repeat(32),signedAt,begin,actualEnd,actualEnd===begin?0:50,'own/proof-v1.pdf','ab'.repeat(32)]);
  if(actualEnd!==begin) await db.query(`INSERT INTO assist_time_events(tenant_id,visit_id,event_type,occurred_at) VALUES($1,$2,'pause_start','2026-09-18T08:10Z'),($1,$2,'pause_end','2026-09-18T08:15Z'),($1,$2,'pause_start','2026-09-18T08:30Z'),($1,$2,'pause_end','2026-09-18T08:35Z')`,[t,visit]);
 }else{
  await db.query('INSERT INTO documentation_entries VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[legacyDoc,t,assignment,client,employee,'saved',docText,docAt]);
  await db.query('INSERT INTO signatures VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[legacySig,t,assignment,legacyDoc,client,employee,'signed','synthetic','Klient',signedAt]);
  await db.query(`INSERT INTO workflow_proof_attestations(tenant_id,assignment_id,legacy_documentation_id,legacy_signature_id,documentation_updated_at,signed_at,service_started_at,service_ended_at,actual_minutes,pdf_storage_path,pdf_sha256,proof_payload_hash,signature_hash,producer_contract) VALUES($1,$2,$3,$4,$5,$6,$7,$8,60,$9,$10,$11,$12,'verified-original-bytes-v1')`,[t,assignment,legacyDoc,legacySig,docAt,signedAt,begin,actualEnd,'own/legacy-v1.pdf','ab'.repeat(32),'sha256:'+createHash('sha256').update(docText).digest('hex'),'sha256:'+createHash('sha256').update('synthetic').digest('hex')]);
 }
 await config();await db.exec('SET ROLE authenticated');
}
const prepare=(tenant=t,assign=assignment)=>db.query('SELECT workflow_prepare_assignment_service_record($1,$2) receipt',[tenant,assign]);
async function rows(sql){await db.exec('RESET ROLE');const result=(await db.query(sql)).rows;await db.exec('SET ROLE authenticated');return result;}
async function office(){await config({portal:'business',employee:'',internal:'true',permissions:'office.clients.edit,assist.records.create'});}
const verify=()=>db.query('SELECT workflow_verify_billing_proof($1,$2) receipt',[t,proof]);

await db.exec(`
CREATE FUNCTION resolve_current_profile_id() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.profile'),'')::uuid $$;
CREATE FUNCTION is_tenant_admin() RETURNS boolean LANGUAGE sql AS $$ SELECT current_setting('test.admin')='true' $$;
CREATE TYPE assignment_task_status AS ENUM ('open','done','partial','not_requested','not_done','cancelled');
ALTER TABLE assignments ADD COLUMN updated_at timestamptz;
ALTER TABLE assist_visits ADD COLUMN execution_status text, ADD COLUMN duration_minutes integer,ADD COLUMN documentation_status text,
 ADD COLUMN proof_status text,ADD COLUMN billing_status text,ADD COLUMN finished_at timestamptz,ADD COLUMN updated_by uuid,ADD COLUMN updated_at timestamptz;
ALTER TABLE assist_visit_tasks ADD COLUMN title text,ADD COLUMN is_required boolean,ADD COLUMN sort_order integer,
 ADD COLUMN not_done_reason text,ADD COLUMN completed_at timestamptz,ADD COLUMN updated_at timestamptz;
CREATE TABLE assignment_tasks(id uuid,tenant_id uuid,assignment_id uuid,title text,status assignment_task_status,is_required boolean,
 sort_order integer,not_done_reason text,updated_at timestamptz);
CREATE TABLE assist_visit_signature_requests(tenant_id uuid,visit_id uuid,status text);
ALTER TABLE assist_visit_proofs ADD COLUMN portal_visible boolean,ADD COLUMN portal_release_status text;
CREATE TABLE assist_visit_admin_audit(id uuid DEFAULT gen_random_uuid(),tenant_id uuid,visit_id uuid,action text,previous_value jsonb,new_value jsonb,
 reason text,actor_user_id uuid,created_at timestamptz DEFAULT now());
`);
const metadata=JSON.parse(readFileSync(new URL('../../docs/workflow-server-follow-up-metadata-20261011.json',import.meta.url),'utf8'));
await db.exec(metadata.functions[0].definition);
const original=JSON.parse(readFileSync(new URL('../../docs/workflow-server-write-rpc-metadata-20261011.json',import.meta.url),'utf8')).functions.find(f=>f.name==='admin_reconcile_complete_assist_visit_follow_up');
await db.exec(original.definition);await db.exec('REVOKE ALL ON FUNCTION admin_reconcile_complete_assist_visit_follow_up(uuid,jsonb,text) FROM PUBLIC;GRANT EXECUTE ON FUNCTION admin_reconcile_complete_assist_visit_follow_up(uuid,jsonb,text) TO authenticated');
const task=id=>`90000000-0000-4000-8000-${String(id).padStart(12,'0')}`;
const follow=(states=[],reason='Berechtigte Abschlussprüfung',visitId=visit)=>db.query('SELECT admin_reconcile_complete_assist_visit_follow_up($1,$2,$3)',[visitId,JSON.stringify(states),reason]);
async function ready({withTask=false,status='finished'}={}){
 await reset();await db.exec('RESET ROLE');
 await db.query("UPDATE assist_visits SET canonical_status=$1,execution_status='finished',duration_minutes=60,documentation_status='complete',proof_status='signed',billing_status='blocked'",[status]);
 await db.query("UPDATE assignments SET status=$1",[status]);
 if(withTask){
  await db.query("INSERT INTO assist_visit_tasks(id,tenant_id,visit_id,status,title,is_required,sort_order,not_done_reason,completed_at) VALUES($1,$2,$3,'done','Aufgabe',TRUE,1,NULL,'2026-09-18T08:55Z')",[task(1),t,visit]);
  await db.query("INSERT INTO assignment_tasks(id,tenant_id,assignment_id,status,title,is_required,sort_order) VALUES($1,$2,$3,'open','Aufgabe',TRUE,9)",[task(2),t,assignment]);
  const snap=(await db.query('SELECT payload_snapshot FROM assist_visit_proofs')).rows[0].payload_snapshot;
  snap.tasks=[{id:task(1),title:'Aufgabe',status:'done',note:null}];
  const signedPayload={visitId:visit,clientId:client,employeeId:employee,plannedStartAt:begin,plannedEndAt:end,taskStatuses:[{taskId:task(1),status:'done'}],documentationNote:docText};
  await db.exec('ALTER TABLE assist_visit_proofs DISABLE TRIGGER workflow_bound_proof_version_guard');
  await db.query('UPDATE assist_visit_proofs SET payload_snapshot=$1,payload_hash=$2',[JSON.stringify(snap),hash(snap)]);
  await db.exec('ALTER TABLE assist_visit_proofs ENABLE TRIGGER workflow_bound_proof_version_guard');
  await db.query('UPDATE assist_visit_signatures SET payload_hash=$1',[hash(signedPayload)]);
  await db.query('UPDATE workflow_proof_attestations SET proof_payload_hash=$1',[hash(snap)]);
 }
 await config({portal:'business',employee:'',internal:'true',permissions:'assist.execution.manage'});
 await db.query("SELECT set_config('test.profile',$1,false),set_config('test.admin','false',false)",[id(77)]);await db.exec('SET ROLE authenticated');
}
async function state(){return rows('SELECT canonical_status,execution_status,billing_status,finished_at FROM assist_visits');}
await test('captured RPC promotes a signed status tag without any proof/byte receipt',async()=>{
 await ready();await db.exec('RESET ROLE;TRUNCATE workflow_proof_attestations,assist_visit_proofs,assist_visit_signatures CASCADE;SET ROLE authenticated');
 await follow();assert.equal((await state())[0].billing_status,'ready');
});
await test('captured RPC resets cancelled/no-show terminal status to completed',async()=>{
 await ready({status:'cancelled'});await follow();assert.equal((await state())[0].canonical_status,'completed');
});
const followDraft=readFileSync(new URL('../../docs/workflow-server-follow-up-integrity-draft.sql',import.meta.url),'utf8');
await db.exec('RESET ROLE');await db.exec(followDraft);
await test('existing header/argument defaults/void return/definer searchpath remain exact and source helper stays private',async()=>{
 const [f]=(await db.query("SELECT pg_get_function_identity_arguments(oid) args,pg_get_function_result(oid) result,pronargdefaults defaults,prosecdef,proconfig FROM pg_proc WHERE proname='admin_reconcile_complete_assist_visit_follow_up'")).rows;
 assert.equal(f.args,original.args);assert.equal(f.result,'void');assert.equal(f.defaults,0);assert.equal(f.prosecdef,true);assert.deepEqual(f.proconfig,['search_path=public, pg_temp']);
 const base=readFileSync(new URL('../../docs/workflow-server-service-record-draft.sql',import.meta.url),'utf8');
 const originalHelper=base.slice(base.indexOf('CREATE OR REPLACE FUNCTION public.workflow_signed_proof_source('),base.indexOf('CREATE OR REPLACE FUNCTION public.workflow_assignment_record_capability()'));
 assert.ok(followDraft.includes(originalHelper.replaceAll('workflow_signed_proof_source','workflow_signed_follow_up_source').replace("v.canonical_status<>'completed'","COALESCE(v.canonical_status,'') NOT IN ('finished','documentation_open','signature_open','completed')")));
 await ready();await assert.rejects(()=>db.query('SELECT workflow_signed_follow_up_source($1,$2,$3,true)',[t,visit,proof]),/permission denied/);
});
await test('verified Office permission or tenant admin retains legitimate completion and stored actor audit',async()=>{
 await ready();await follow();assert.equal((await state())[0].billing_status,'ready');assert.equal((await rows('SELECT status FROM assignments'))[0].status,'completed');
 assert.equal((await rows('SELECT actor_user_id FROM assist_visit_admin_audit'))[0].actor_user_id,user);
 await ready();await config({portal:'business',employee:'',internal:'true',permissions:''});await db.query("SELECT set_config('test.admin','true',false)");await follow();assert.equal((await state())[0].canonical_status,'completed');
});
await test('authorized retries do not rewrite terminal evidence/timestamps or duplicate audit',async()=>{
 await ready();await follow();const first=await state();await follow();assert.deepEqual(await state(),first);assert.equal((await rows('SELECT count(*)::int n FROM assist_visit_admin_audit'))[0].n,1);
});
await test('NULL/unlinked/foreign tenant/portal role/no permission fail before the first write',async()=>{
 for(const c of [{uid:''},{tenant:id(90)},{portal:'employee'},{portal:'client'},{internal:'false'},{permissions:''}]){
  await ready();await config(c);await assert.rejects(()=>follow());assert.equal((await state())[0].canonical_status,'finished');assert.equal((await rows('SELECT count(*)::int n FROM assist_visit_admin_audit'))[0].n,0);
 }
 await ready();await db.query("SELECT set_config('test.profile','',false)");await assert.rejects(()=>follow());
});
await test('missing source, current invalid/stale signature, wrong actual pair or PDF attestation keep all statuses unchanged',async()=>{
 for(const sql of ['TRUNCATE workflow_proof_attestations',"UPDATE assist_visit_signatures SET is_valid=FALSE", "UPDATE assist_visit_signatures SET payload_hash='sha256:wrong'",
  "UPDATE assist_visits SET actual_end_at=actual_end_at-interval '1 minute'","UPDATE workflow_proof_attestations SET pdf_sha256=repeat('0',64)"]){
  await ready();await db.exec('RESET ROLE;'+sql+';SET ROLE authenticated');const before=await state();await assert.rejects(()=>follow());assert.deepEqual(await state(),before);
  assert.equal((await rows('SELECT status FROM assignments'))[0].status,'finished');assert.equal((await rows('SELECT count(*)::int n FROM assist_visit_admin_audit'))[0].n,0);
 }
});
await test('terminal cancelled/no-show or mismatched closed mirror cannot be reset by proof flags',async()=>{
 for(const status of ['cancelled','no_show']){await ready({status});await assert.rejects(()=>follow(),/Stornierter/);assert.equal((await state())[0].canonical_status,status);}
 await ready({status:'completed'});await db.exec("RESET ROLE;UPDATE assignments SET status='finished';SET ROLE authenticated");await assert.rejects(()=>follow(),/Terminale/);assert.equal((await rows('SELECT status FROM assignments'))[0].status,'finished');
});
await test('canonical signed tasks remain immutable while a uniquely mapped legacy counterpart can be reconciled',async()=>{
 await ready({withTask:true});const before=await rows('SELECT * FROM assist_visit_tasks');await follow([{task_id:task(2),status:'done'}]);
 assert.deepEqual(await rows('SELECT * FROM assist_visit_tasks'),before);assert.equal((await rows('SELECT status FROM assignment_tasks'))[0].status,'done');
});
await test('requested new task state, duplicate IDs or foreign task cannot change signed evidence',async()=>{
 for(const states of [[{task_id:task(1),status:'open'}],[{task_id:task(1),status:'done'},{task_id:task(2),status:'done'}],[{task_id:id(99),status:'done'}],[{task_id:task(1),status:null}]]){
  await ready({withTask:true});const before=await rows('SELECT * FROM assist_visit_tasks');await assert.rejects(()=>follow(states));assert.deepEqual(await rows('SELECT * FROM assist_visit_tasks'),before);
  assert.equal((await state())[0].canonical_status,'finished');assert.equal((await rows('SELECT status FROM assignment_tasks'))[0].status,'open');
 }
});
await test('a pending client signature cannot be invented as a trusted signed completion',async()=>{
 await ready();await db.exec("RESET ROLE;UPDATE assist_visit_signatures SET is_valid=FALSE;INSERT INTO assist_visit_signature_requests VALUES('"+t+"','"+visit+"','open');SET ROLE authenticated");
 await assert.rejects(()=>follow());assert.equal((await state())[0].billing_status,'blocked');
});
await test('audit failure rolls back the mirror/status transition atomically',async()=>{
 await ready({withTask:true});await db.exec("RESET ROLE;ALTER TABLE assist_visit_admin_audit ADD CONSTRAINT fixture_audit_failure CHECK(action<>'follow_up_completed_reconciled');SET ROLE authenticated");
 await assert.rejects(()=>follow([{task_id:task(1),status:'done'}]));assert.equal((await state())[0].canonical_status,'finished');assert.equal((await rows('SELECT status FROM assignment_tasks'))[0].status,'open');
 await db.exec('RESET ROLE;ALTER TABLE assist_visit_admin_audit DROP CONSTRAINT fixture_audit_failure;SET ROLE authenticated');
});
await test('anonymous cannot invoke the reconciliation writer',async()=>{await ready();await db.exec('SET ROLE anon');await assert.rejects(()=>follow(),/permission denied/);});
await db.close();
