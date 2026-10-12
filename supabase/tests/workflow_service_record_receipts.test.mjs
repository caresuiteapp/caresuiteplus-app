// Synthetic isolated PostgreSQL only. No business rows or production connection.
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
 await db.exec('RESET ROLE; TRUNCATE workflow_proof_attestations,client_billing_candidates,service_records,assist_visit_proofs,assist_visit_signatures,assist_visit_documentation,assist_visit_tasks,assist_time_events,assist_visits,assignments,employee_portal_accounts,documentation_entries,signatures,time_entries CASCADE');
 await db.query('INSERT INTO employee_portal_accounts VALUES($1,$2,$3,$4,$5)',[account,t,employee,user,'active']);
 await db.query('INSERT INTO assignments VALUES($1,$2,$3,$4,$5,$6,$7)',[assignment,t,client,employee,'completed',begin,actualEnd]);
 if(canonicalVisit){
  await db.query('INSERT INTO assist_visits VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[visit,t,assignment,client,employee,'completed',begin,actualEnd,begin,end]);
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
await test('canonical proof, every pause and retries create one stored receipt without the legacy signature FK',async()=>{
 await reset();const first=(await prepare()).rows[0].receipt;assert.equal(first.actual_minutes,50);assert.equal(first.proof_payload_hash.slice(0,7),'sha256:');
 for(const r of await Promise.all([prepare(),prepare(),prepare()]))assert.deepEqual(r.rows[0].receipt,first);
 const [record]=await rows('SELECT * FROM service_records');assert.equal(record.signature_id,null);assert.equal(record.documentation_entry_id,null);
 assert.equal(record.assist_visit_id,visit);assert.equal(record.actual_minutes,50);assert.equal(record.service_date.toISOString().slice(0,10),'2026-09-18');
 assert.equal((await rows('SELECT count(*)::int n FROM service_records'))[0].n,1);
});
await test('real zero survives without a fabricated minimum minute',async()=>{await reset({seconds:0,actualEnd:begin});assert.equal((await prepare()).rows[0].receipt.actual_minutes,0);});
await test('legacy proof binds exact current documentation/signature and never canonical signature FK',async()=>{
 await reset({canonicalVisit:false});assert.equal((await prepare()).rows[0].receipt.legacy_signature_id,legacySig);
 assert.equal((await rows('SELECT signature_id FROM service_records'))[0].signature_id,legacySig);
});
await test('legacy document/signature bytes cannot change underneath the trusted source attestation',async()=>{
 await reset({canonicalVisit:false});await db.exec("RESET ROLE;UPDATE signatures SET signature_data='changed';SET ROLE authenticated");await assert.rejects(prepare,/Bytebestätigung/);
 await reset({canonicalVisit:false});await db.exec("RESET ROLE;UPDATE documentation_entries SET free_text='changed';SET ROLE authenticated");await assert.rejects(prepare,/Bytebestätigung/);
});
await test('unauthenticated, foreign tenant/employee, client portal and inactive employee cannot prepare',async()=>{
 for(const c of [{uid:''},{tenant:id(50)},{employee:id(51)},{portal:'client'},{portal:'relative'}]){await reset();await config(c);await assert.rejects(prepare);assert.equal((await rows('SELECT count(*)::int n FROM service_records'))[0].n,0);}
 await reset();await db.exec("RESET ROLE; UPDATE employee_portal_accounts SET status='disabled'; SET ROLE authenticated");await assert.rejects(prepare);
});
await test('business preparation needs verified actor and explicit records permission',async()=>{
 await reset();await config({portal:'business',internal:'false',permissions:'assist.records.create'});await assert.rejects(prepare);
 await config({portal:'business',internal:'true',permissions:''});await assert.rejects(prepare);await office();assert.ok((await prepare()).rows[0].receipt.id);
});
await test('missing/reversed pair, incomplete canonical status and bad snapshot/hash/signature are never ready',async()=>{
 for(const sql of ["UPDATE assignments SET actual_start_at=NULL","UPDATE assignments SET actual_end_at=actual_start_at-interval '1 minute'",
  "UPDATE assist_visits SET canonical_status='finished'","UPDATE assist_visit_signatures SET is_valid=FALSE",
  "UPDATE assist_visit_signatures SET payload_hash='sha256:wrong'","UPDATE assist_visit_documentation SET short_description='changed'"]){
  await reset();await db.exec('RESET ROLE; '+sql+'; SET ROLE authenticated');await assert.rejects(prepare);assert.equal((await rows('SELECT count(*)::int n FROM service_records'))[0].n,0);
 }
 await reset({seconds:3600});await assert.rejects(prepare,/Leistungsdauer/);
});
await test('missing trusted byte attestation and ordinary actor attempts stay failclosed',async()=>{
 await reset();await db.exec('RESET ROLE;TRUNCATE workflow_proof_attestations;SET ROLE authenticated');
 await assert.rejects(prepare,/Bytebestätigung/);await office();await assert.rejects(verify,/Bytebestätigung/);
 await assert.rejects(()=>db.query('INSERT INTO workflow_proof_attestations(tenant_id,assignment_id) VALUES($1,$2)',[t,assignment]),/permission denied/);
 assert.equal((await rows('SELECT count(*)::int n FROM service_records'))[0].n,0);
});
await test('record INSERT failure rolls back and retries do not report a stored record',async()=>{
 await reset();await db.exec("RESET ROLE; ALTER TABLE service_records ADD CONSTRAINT fail_fixture CHECK(actual_minutes<>50); SET ROLE authenticated");
 await assert.rejects(prepare);assert.equal((await rows('SELECT count(*)::int n FROM service_records'))[0].n,0);
 await db.exec('RESET ROLE; ALTER TABLE service_records DROP CONSTRAINT fail_fixture; SET ROLE authenticated');assert.ok((await prepare()).rows[0].receipt.id);
});
await test('existing unbound or changed records require review; approved records are not overwritten',async()=>{
 await reset();await prepare();await db.exec("RESET ROLE; UPDATE service_records SET status='billed'; SET ROLE authenticated");assert.ok((await prepare()).rows[0].receipt.id);
 await db.exec('RESET ROLE');await assert.rejects(()=>db.exec("UPDATE service_records SET source_receipt='{}'"),/unveränderlich/);await db.exec('SET ROLE authenticated');
 await reset();await db.exec('RESET ROLE');await db.query('INSERT INTO service_records(tenant_id,assignment_id,client_id,employee_id,actual_minutes) VALUES($1,$2,$3,$4,$5)',[t,assignment,client,employee,50]);await db.exec('SET ROLE authenticated');await assert.rejects(prepare,/abgeglichen/);
});
await test('billing receipt requires approved proof, immutable signed version and actual time pair',async()=>{
 await reset();await assert.rejects(verify,/Abrechnungsberechtigung/);await office();const receipt=(await verify()).rows[0].receipt;assert.equal(receipt.actual_minutes,50);
 await db.exec('RESET ROLE');await db.query('INSERT INTO client_billing_candidates(tenant_id,proof_id,visit_id,client_id,billing_period_start,billing_period_end,duration_minutes,source_snapshot) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[t,proof,visit,client,begin,end,50,JSON.stringify({confirmedSource:receipt})]);await db.exec('SET ROLE authenticated');
 await db.exec('RESET ROLE');await assert.rejects(()=>db.query("UPDATE assist_visit_proofs SET payload_hash='sha256:changed'"),/unveränderlich/);
 await assert.rejects(()=>db.query('DELETE FROM assist_visit_proofs'),/gelöscht/);await db.exec('SET ROLE authenticated');
});
await test('billing candidate cannot substitute planned time or spoof a proof version/client',async()=>{
 await reset();await office();const receipt=(await verify()).rows[0].receipt;
 for(const changed of [{...receipt,proof_payload_hash:'sha256:fake'},{...receipt,client_id:id(60)}])await assert.rejects(()=>db.query('INSERT INTO client_billing_candidates(tenant_id,proof_id,visit_id,client_id,billing_period_start,billing_period_end,duration_minutes,source_snapshot) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[t,proof,visit,client,begin,end,50,JSON.stringify({confirmedSource:changed})]),/Nachweisfassung/);
 assert.equal((await rows('SELECT count(*)::int n FROM client_billing_candidates'))[0].n,0);
});
await test('direct Portal INSERT/UPDATE cannot weaken legacy permissive policies; business can review status only',async()=>{
 await reset();await prepare();await assert.rejects(()=>db.query('INSERT INTO service_records(tenant_id,assignment_id) VALUES($1,$2)',[t,id(99)]),/row-level security|foreign key/);
 assert.equal((await db.query("UPDATE service_records SET status='billed' RETURNING id")).rows.length,0);
 await office();assert.equal((await db.query("UPDATE service_records SET status='approved' RETURNING id")).rows.length,1);
 await assert.rejects(()=>db.query('UPDATE service_records SET actual_minutes=1'),/unveränderlich/);
});
await test('anon and direct helper execution are denied; duplicate preflight does not repair business rows',async()=>{
 await reset();await db.exec('SET ROLE anon');await assert.rejects(()=>prepare(),/permission denied/);await db.exec('SET ROLE authenticated');
 await assert.rejects(()=>db.query('SELECT workflow_signed_proof_source($1,$2,$3,true)',[t,visit,proof]),/permission denied/);
 const otherDb=new PGlite();await otherDb.exec('CREATE TABLE service_records(tenant_id uuid,assignment_id uuid); INSERT INTO service_records SELECT gen_random_uuid(),NULL;');
 await otherDb.exec(`INSERT INTO service_records VALUES('${t}','${assignment}'),('${t}','${assignment}')`);
 await assert.rejects(()=>otherDb.exec(draft),/Preflight/);await otherDb.exec('ROLLBACK');assert.equal((await otherDb.query('SELECT count(*)::int n FROM service_records')).rows[0].n,3);await otherDb.close();
});
await db.close();
