// Isolated PostgreSQL, synthetic identities only. Never connects to production.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
const db = new PGlite();
const ids = { tenant:'10000000-0000-4000-8000-000000000001', foreignTenant:'10000000-0000-4000-8000-000000000002',
  employee:'20000000-0000-4000-8000-000000000001', otherEmployee:'20000000-0000-4000-8000-000000000002',
  user:'30000000-0000-4000-8000-000000000001', account:'40000000-0000-4000-8000-000000000001',
  assignment:'50000000-0000-4000-8000-000000000001', client:'60000000-0000-4000-8000-000000000001',
  document:'70000000-0000-4000-8000-000000000001' };
await db.exec(`
CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role; CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.uid'),'')::uuid $$;
CREATE FUNCTION current_tenant_id() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.tenant'),'')::uuid $$;
CREATE FUNCTION current_portal_type() RETURNS text LANGUAGE sql AS $$ SELECT nullif(current_setting('test.portal'),'') $$;
CREATE FUNCTION current_portal_account_id() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.account'),'')::uuid $$;
CREATE FUNCTION resolve_current_employee_id() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.employee'),'')::uuid $$;
CREATE FUNCTION has_permission(text) RETURNS boolean LANGUAGE sql AS $$ SELECT $1=ANY(string_to_array(current_setting('test.permissions'),',')) $$;
CREATE FUNCTION is_internal_tenant_actor(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT $1=current_tenant_id() AND current_setting('test.internal')='true' $$;
CREATE TYPE assignment_status AS ENUM ('planned','confirmed','on_the_way','arrived','started','paused','finished','documentation_open','signature_open','completed','cancelled','no_show');
CREATE TYPE time_entry_type AS ENUM ('planned_start','planned_end','on_the_way','arrived','started','paused','resumed','finished','manual_correction','system');
CREATE TYPE payment_method AS ENUM ('bank_transfer'); CREATE TYPE live_tracking_event_type AS ENUM ('status');
CREATE TABLE employee_portal_accounts(id uuid,tenant_id uuid,employee_id uuid,auth_user_id uuid,status text);
CREATE TABLE assignments(id uuid PRIMARY KEY,tenant_id uuid,employee_id uuid,client_id uuid,status assignment_status,
 actual_start_at timestamptz,actual_end_at timestamptz,on_the_way_at timestamptz,arrived_at timestamptz,finished_at timestamptz,updated_at timestamptz);
CREATE TABLE assist_visits(id uuid,tenant_id uuid,legacy_assignment_id uuid);
CREATE TABLE documentation_entries(id uuid,tenant_id uuid,assignment_id uuid,client_id uuid,employee_id uuid,status text,free_text text,updated_at timestamptz);
CREATE TABLE signatures(id uuid DEFAULT gen_random_uuid(),tenant_id uuid,assignment_id uuid,client_id uuid,employee_id uuid,
 documentation_entry_id uuid,status text,signer_name text,signature_data text,signed_at timestamptz);
CREATE TABLE time_entries(id uuid DEFAULT gen_random_uuid(),tenant_id uuid,assignment_id uuid,employee_id uuid,entry_type time_entry_type,event_at timestamptz,
 latitude numeric,longitude numeric,source text,note text CHECK (note IS DISTINCT FROM 'force_insert_failure'));
CREATE FUNCTION create_service_record_from_assignment(uuid) RETURNS uuid LANGUAGE sql AS $$SELECT $1$$;
CREATE FUNCTION create_invoice_from_service_record(uuid) RETURNS uuid LANGUAGE sql AS $$SELECT $1$$;
CREATE FUNCTION book_payment_for_invoice(uuid,numeric,payment_method,text) RETURNS uuid LANGUAGE sql AS $$SELECT $1$$;
CREATE FUNCTION add_live_tracking_event(uuid,live_tracking_event_type,numeric,numeric,numeric,boolean) RETURNS uuid LANGUAGE sql AS $$SELECT $1$$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated,anon,service_role;
`);
await db.exec(readFileSync(new URL('../../docs/workflow-server-assignment-status-draft.sql', import.meta.url),'utf8'));
async function config(changes={}) {
  const values = {uid:ids.user,tenant:ids.tenant,portal:'employee',account:ids.account,employee:ids.employee,permissions:'',internal:'false',...changes};
  for (const [key,value] of Object.entries(values)) await db.query('SELECT set_config($1,$2,false)', ['test.'+key,value]);
}
async function reset(status='planned') {
  await db.exec('RESET ROLE; TRUNCATE assignments,assist_visits,documentation_entries,signatures,time_entries,employee_portal_accounts');
  await db.query('INSERT INTO employee_portal_accounts VALUES($1,$2,$3,$4,$5)',[ids.account,ids.tenant,ids.employee,ids.user,'active']);
  await db.query('INSERT INTO assignments(id,tenant_id,employee_id,client_id,status) VALUES($1,$2,$3,$4,$5)',[ids.assignment,ids.tenant,ids.employee,ids.client,status]);
  await config(); await db.exec('SET ROLE authenticated');
}
const status = (value, options={}) => db.query('SELECT set_assignment_status($1,$2,$3,$4,$5,$6) AS id',
 [options.assignment??ids.assignment,value,options.employee??null,options.latitude??null,options.longitude??null,options.note??null]);
async function rows(query) { await db.exec('RESET ROLE'); const result=(await db.query(query)).rows; await db.exec('SET ROLE authenticated'); return result; }
await test('active own employee transitions, pause/resume and retries produce one event each', async () => {
 await reset(); for (const next of ['on_the_way','arrived','started','paused','started','finished','documentation_open']) {
  assert.equal((await status(next)).rows[0].id,ids.assignment); await status(next);
 }
 const events=await rows('SELECT entry_type,employee_id FROM time_entries ORDER BY event_at,id');
 assert.equal(events.length,7); assert.equal(events.filter(e=>e.entry_type==='resumed').length,1);
 assert.ok(events.every(e=>e.employee_id===ids.employee));
 const [a]=await rows('SELECT status,actual_start_at,actual_end_at FROM assignments');
 assert.equal(a.status,'documentation_open'); assert.ok(a.actual_start_at); assert.ok(a.actual_end_at);
});
await test('absent auth, disabled/pending account, wrong account and nonemployee portal fail without writes', async () => {
 for (const change of [{uid:''},{account:ids.user},{portal:'client'},{portal:'relative'},{employee:ids.otherEmployee}]) {
  await reset(); await config(change); await assert.rejects(()=>status('on_the_way'),/Anmeldung|Konto|Berechtigung|zugeordnet/i);
  assert.equal((await rows('SELECT count(*)::int n FROM time_entries'))[0].n,0);
 }
 for (const accountStatus of ['disabled','pending_first_login','password_reset_required']) {
  await reset(); await db.exec(`RESET ROLE; UPDATE employee_portal_accounts SET status='${accountStatus}'; SET ROLE authenticated`);
  await assert.rejects(()=>status('on_the_way'),/Aktives/);
 }
});
await test('foreign tenant/client assignment or spoofed employee cannot be changed', async () => {
 await reset(); await assert.rejects(()=>status('on_the_way',{employee:ids.otherEmployee}),/zugeordnet/);
 await db.exec(`RESET ROLE; UPDATE assignments SET tenant_id='${ids.foreignTenant}'; SET ROLE authenticated`);
 await assert.rejects(()=>status('on_the_way'),/zugeordnet/);
 assert.equal((await rows('SELECT status FROM assignments'))[0].status,'planned');
});
await test('canonical Visit assignment refuses the legacy writer even for its own employee', async () => {
 await reset(); await db.exec(`RESET ROLE; INSERT INTO assist_visits VALUES(gen_random_uuid(),'${ids.tenant}','${ids.assignment}'); SET ROLE authenticated`);
 await assert.rejects(()=>status('on_the_way'),/Kanonischer/); assert.equal((await rows('SELECT count(*)::int n FROM time_entries'))[0].n,0);
});
await test('invalid coordinates, partial pairs, NaN and excessive note fail before mutation', async () => {
 for (const options of [{latitude:91,longitude:1},{latitude:1,longitude:181},{latitude:1},{latitude:'NaN',longitude:1},{note:'x'.repeat(4001)}]) {
  await reset(); await assert.rejects(()=>status('on_the_way',options),/Koordinaten/);
  assert.equal((await rows('SELECT status FROM assignments'))[0].status,'planned');
 }
});
await test('skipped start/finish, forbidden cancel and terminal regression are rejected', async () => {
 await reset(); for (const next of ['started','finished','completed','cancelled']) await assert.rejects(()=>status(next,{note:'Grund'}),/Statuswechsel/);
 await reset('completed'); await assert.rejects(()=>status('on_the_way'),/gesperrt/);
 await reset('started'); await assert.rejects(()=>status('finished'),/tatsächlicher Start/);
 await reset(); await assert.rejects(()=>status('no_show'),/Begründung/);
});
await test('Office execution requires verified tenant membership and exact execution permission', async () => {
 await reset(); await config({portal:'',internal:'true'}); await assert.rejects(()=>status('confirmed'),/Berechtigung/);
 await config({portal:'',permissions:'assist.execution.manage',internal:'false'}); await assert.rejects(()=>status('confirmed'),/Berechtigung/);
 await config({portal:'',permissions:'assist.execution.manage',internal:'true'}); await status('confirmed');
});
await test('signature/completion require ended actual time and matching current documentation/signature', async () => {
 await reset('documentation_open'); await assert.rejects(()=>status('signature_open'),/Leistungszeit/);
 await db.exec(`RESET ROLE; UPDATE assignments SET actual_start_at=now()-interval '2 hours',actual_end_at=now()-interval '1 hour'; SET ROLE authenticated`);
 await assert.rejects(()=>status('completed'),/Dokumentation/);
 await db.exec(`RESET ROLE; INSERT INTO documentation_entries VALUES('${ids.document}','${ids.tenant}','${ids.assignment}','${ids.client}','${ids.employee}','saved','Tatsächliche Leistung',now()-interval '30 minutes'); SET ROLE authenticated`);
 await status('signature_open'); await assert.rejects(()=>status('completed'),/Unterschrift/);
 await db.exec(`RESET ROLE; INSERT INTO signatures(tenant_id,assignment_id,client_id,employee_id,documentation_entry_id,status,signer_name,signature_data,signed_at)
 VALUES('${ids.tenant}','${ids.assignment}','${ids.client}','${ids.employee}','${ids.document}','signed','Klient','synthetic-signature',now()-interval '45 minutes'); SET ROLE authenticated`);
 await assert.rejects(()=>status('completed'),/Unterschrift/);
 await db.exec("RESET ROLE; UPDATE signatures SET signed_at=now()-interval '10 minutes'; SET ROLE authenticated");
 await status('completed'); await status('completed');
 assert.equal((await rows("SELECT count(*)::int n FROM time_entries WHERE entry_type='finished'"))[0].n,0);
 assert.equal((await rows('SELECT status FROM assignments'))[0].status,'completed');
});
await test('time-entry insert failure rolls back the assignment update atomically', async () => {
 await reset(); await assert.rejects(()=>status('on_the_way',{note:'force_insert_failure'}),/check constraint/);
 assert.equal((await rows('SELECT status,on_the_way_at FROM assignments'))[0].status,'planned');
 assert.equal((await rows('SELECT on_the_way_at FROM assignments'))[0].on_the_way_at,null);
});
await test('anon cannot execute the status writer; unused bypass RPCs are service-only', async () => {
 await reset(); await db.exec('SET ROLE anon'); await assert.rejects(()=>status('on_the_way'),/permission denied/);
 await db.exec('RESET ROLE');
 for (const signature of ['create_service_record_from_assignment(uuid)','create_invoice_from_service_record(uuid)',
  'book_payment_for_invoice(uuid,numeric,payment_method,text)','add_live_tracking_event(uuid,live_tracking_event_type,numeric,numeric,numeric,boolean)']) {
  const [grants]=(await db.query('SELECT has_function_privilege($1,$3,$4) auth,has_function_privilege($2,$3,$4) anon,has_function_privilege($5,$3,$4) service',
   ['authenticated','anon',signature,'EXECUTE','service_role'])).rows;
  assert.deepEqual(grants,{auth:false,anon:false,service:true});
 }
});
await db.close();
