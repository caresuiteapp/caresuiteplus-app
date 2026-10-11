// Synthetic isolated PostgreSQL only; no production connection or business rows.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
const db=new PGlite();
const t='10000000-0000-4000-8000-000000000001',foreign='10000000-0000-4000-8000-000000000002';
const e='20000000-0000-4000-8000-000000000001',other='20000000-0000-4000-8000-000000000002';
const u='30000000-0000-4000-8000-000000000001',otherAuth='30000000-0000-4000-8000-000000000002';
const account='40000000-0000-4000-8000-000000000001',v='50000000-0000-4000-8000-000000000001',v2='50000000-0000-4000-8000-000000000002';
const profile='60000000-0000-4000-8000-000000000001',legacy='70000000-0000-4000-8000-000000000001';
await db.exec(`
CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role; CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY); INSERT INTO auth.users VALUES('${u}'),('${otherAuth}');
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.uid'),'')::uuid $$;
CREATE FUNCTION current_tenant_id() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.tenant'),'')::uuid $$;
CREATE FUNCTION current_portal_type() RETURNS text LANGUAGE sql AS $$ SELECT nullif(current_setting('test.portal'),'') $$;
CREATE FUNCTION current_portal_account_id() RETURNS uuid LANGUAGE sql AS $$ SELECT '${account}'::uuid $$;
CREATE FUNCTION resolve_current_employee_id() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.employee'),'')::uuid $$;
CREATE FUNCTION has_permission(text) RETURNS boolean LANGUAGE sql AS $$ SELECT $1=ANY(string_to_array(current_setting('test.permissions'),',')) $$;
CREATE FUNCTION is_internal_tenant_actor(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT current_setting('test.internal')='true' AND $1=current_tenant_id() $$;
CREATE TABLE profiles(id uuid PRIMARY KEY,tenant_id uuid,auth_user_id uuid REFERENCES auth.users(id),is_active boolean,status text);
CREATE TABLE employees(id uuid PRIMARY KEY,tenant_id uuid,profile_id uuid REFERENCES profiles(id));
CREATE TABLE employee_portal_accounts(id uuid,tenant_id uuid,employee_id uuid,auth_user_id uuid,status text);
CREATE TABLE assignments(id uuid PRIMARY KEY,tenant_id uuid,employee_id uuid);
CREATE TABLE assist_visits(id uuid PRIMARY KEY,tenant_id uuid,employee_id uuid,legacy_assignment_id uuid);
CREATE TABLE assist_time_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid,visit_id uuid,event_type text,occurred_at timestamptz);
CREATE TABLE workforce_work_sessions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid,employee_id uuid,user_id uuid REFERENCES auth.users(id),
 work_date date,status text,work_mode text,display_status text,started_at timestamptz,ended_at timestamptz,last_event_at timestamptz,is_online boolean,
 gross_minutes integer DEFAULT 0,pause_minutes integer DEFAULT 0,net_minutes integer DEFAULT 0,metadata jsonb DEFAULT '{}',updated_at timestamptz,
 UNIQUE(tenant_id,employee_id,work_date));
CREATE TABLE workforce_time_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid,employee_id uuid,user_id uuid REFERENCES auth.users(id),event_type text,
 work_mode text,source text,occurred_at timestamptz,session_id uuid,reference_type text,reference_id uuid,metadata jsonb DEFAULT '{}',correction_of_id uuid);
`);
await db.exec(readFileSync(new URL('../../docs/workflow-server-wfm-draft.sql',import.meta.url),'utf8'));
async function config(changes={}) {
 for (const [k,val] of Object.entries({uid:u,tenant:t,portal:'employee',employee:e,permissions:'',internal:'false',...changes}))
  await db.query('SELECT set_config($1,$2,false)',['test.'+k,val]);
}
async function reset() {
 await db.exec(`RESET ROLE; TRUNCATE workforce_time_events,workforce_work_sessions,assist_time_events,assist_visits,assignments,employee_portal_accounts,employees,profiles;
 INSERT INTO profiles VALUES('${profile}','${t}','${otherAuth}',TRUE,'active');
 INSERT INTO employees VALUES('${e}','${t}',NULL),('${other}','${t}','${profile}');
 INSERT INTO employee_portal_accounts VALUES('${account}','${t}','${e}','${u}','active');
 INSERT INTO assignments VALUES('${legacy}','${t}','${e}');
 INSERT INTO assist_visits VALUES('${v}','${t}','${e}','${legacy}'),('${v2}','${t}','${e}',NULL);`);
 await config(); await db.exec('SET ROLE authenticated');
}
async function source(visit,events) {
 await db.exec('RESET ROLE');
 for (const [type,time] of events) await db.query('INSERT INTO assist_time_events(tenant_id,visit_id,event_type,occurred_at) VALUES($1,$2,$3,$4)',[t,visit,type,'2026-09-18T'+time+':00Z']);
 await db.exec('SET ROLE authenticated');
}
const sync=(visit=v,tenant=t)=>db.query('SELECT sync_assist_visit_times_to_wfm($1,$2) inserted',[tenant,visit]);
async function rows(sql) {await db.exec('RESET ROLE');const result=(await db.query(sql)).rows;await db.exec('SET ROLE authenticated');return result;}
const pausedVisit=[['service_start','08:00'],['pause_start','08:10'],['pause_end','08:15'],['pause_start','08:30'],['pause_end','08:40'],['service_end','09:00']];
await test('multiple pauses and multiple Visits produce complete daily totals and source receipts',async()=>{
 await reset();await source(v,pausedVisit);await source(v2,[['service_start','10:00'],['service_end','11:00']]);
 assert.equal((await sync()).rows[0].inserted,6);assert.equal((await sync(v2)).rows[0].inserted,2);
 assert.equal((await sync()).rows[0].inserted,0);assert.equal((await sync(v2)).rows[0].inserted,0);
 assert.deepEqual((await rows('SELECT gross_minutes,pause_minutes,net_minutes,is_online FROM workforce_work_sessions'))[0],
  {gross_minutes:120,pause_minutes:15,net_minutes:105,is_online:false});
 assert.equal((await rows('SELECT count(*)::int n FROM workforce_time_events'))[0].n,8);
 assert.equal((await rows("SELECT count(DISTINCT metadata->>'assist_source_event_id')::int n FROM workforce_time_events"))[0].n,8);
});
await test('manual arrival preserves recorded drive interval and real zero instead of fake one minute',async()=>{
 await reset();await source(v,[['drive_start','07:00'],['arrived_manual','07:15'],['service_end','07:15']]);await sync();
 assert.equal((await rows('SELECT net_minutes FROM workforce_work_sessions'))[0].net_minutes,15);
 await reset();await source(v,[['service_end','09:00']]);await sync();
 assert.equal((await rows('SELECT net_minutes FROM workforce_work_sessions'))[0].net_minutes,0);
});
await test('a real Office clock block plus its Visit count once and deduct every pause once',async()=>{
 await reset();await db.exec(`RESET ROLE;
 INSERT INTO workforce_time_events(tenant_id,employee_id,event_type,source,occurred_at) VALUES
 ('${t}','${e}','office_check_in','portal','2026-09-18T07:00Z'),('${t}','${e}','clock_out','portal','2026-09-18T11:00Z'); SET ROLE authenticated`);
 await source(v,pausedVisit);await sync();
 assert.deepEqual((await rows('SELECT gross_minutes,pause_minutes,net_minutes FROM workforce_work_sessions'))[0],{gross_minutes:240,pause_minutes:15,net_minutes:225});
});
await test('legacy ID resolves exactly its canonical Visit, never an unrelated employee row',async()=>{
 await reset();await source(v,[['service_start','08:00'],['service_end','09:00']]);
 assert.equal((await sync(legacy)).rows[0].inserted,2);
 assert.equal((await rows('SELECT reference_id FROM workforce_time_events LIMIT 1'))[0].reference_id,v);
 await reset();await db.exec(`RESET ROLE; UPDATE assist_visits SET employee_id='${other}' WHERE id='${v2}'; SET ROLE authenticated`);
 await config({portal:'',internal:'true',permissions:'time.tracking.admin.correct'});
 await source(v2,[['service_start','08:00'],['service_end','09:00']]);await sync(v2);
 assert.deepEqual((await rows('SELECT employee_id,user_id FROM workforce_work_sessions'))[0],{employee_id:other,user_id:otherAuth});
 assert.notEqual(otherAuth,profile);
});
await test('cross tenant, foreign employee, client actor and disabled/pending accounts cannot project',async()=>{
 for (const change of [{uid:''},{tenant:foreign},{portal:'client'},{employee:other}]) {
  await reset();await source(v,[['service_start','08:00'],['service_end','09:00']]);await config(change);
  await assert.rejects(()=>sync(),/Anmeldung|Konto|Berechtigung|zugeordnet/i);
  assert.equal((await rows('SELECT count(*)::int n FROM workforce_time_events'))[0].n,0);
 }
 for (const status of ['disabled','pending_first_login']) {
  await reset();await db.exec(`RESET ROLE; UPDATE employee_portal_accounts SET status='${status}'; SET ROLE authenticated`);
  await assert.rejects(()=>sync(),/aktives/i);
 }
 await reset();await config({portal:'',internal:'true',permissions:'time.tracking.own.start',employee:other});
 await assert.rejects(()=>sync(),/zugeordnet/);
});
await test('exact legacy mirrors are adopted without adding duplicates',async()=>{
 await reset();await source(v,[['service_start','08:00'],['service_end','09:00']]);
 await db.exec(`RESET ROLE; INSERT INTO workforce_time_events(tenant_id,employee_id,event_type,source,occurred_at,reference_type,reference_id)
 VALUES('${t}','${e}','visit_started','assist','2026-09-18T08:00Z','visit','${v}'); SET ROLE authenticated`);
 assert.equal((await sync()).rows[0].inserted,1);assert.equal((await sync()).rows[0].inserted,0);
 assert.equal((await rows('SELECT count(*)::int n FROM workforce_time_events'))[0].n,2);
});
await test('source edits, employee reassignment and corrected ledgers do not silently create a second receipt',async()=>{
 await reset();await source(v,[['service_start','08:00'],['service_end','09:00']]);await sync();
 await db.exec("RESET ROLE; UPDATE assist_time_events SET occurred_at=occurred_at+interval '1 minute' WHERE event_type='service_end'; SET ROLE authenticated");
 await assert.rejects(()=>sync(),/geändertes Quellereignis/);
 assert.equal((await rows('SELECT net_minutes FROM workforce_work_sessions'))[0].net_minutes,60);
 await db.exec(`RESET ROLE; UPDATE assist_visits SET employee_id='${other}' WHERE id='${v}'; SET ROLE authenticated`);
 await config({portal:'',internal:'true',permissions:'time.tracking.admin.correct'});
 await assert.rejects(()=>sync(),/geändertes Quellereignis/);
 assert.equal((await rows('SELECT count(*)::int n FROM workforce_work_sessions'))[0].n,1);
 await reset();await source(v,[['service_start','08:00'],['service_end','09:00']]);await sync();
 await db.exec(`RESET ROLE; INSERT INTO workforce_time_events(tenant_id,employee_id,session_id,event_type,source,occurred_at,correction_of_id)
 SELECT tenant_id,employee_id,id,'manual_correction','office','2026-09-18T10:00Z',gen_random_uuid() FROM workforce_work_sessions; SET ROLE authenticated`);
 await assert.rejects(()=>sync(),/Korrigierte/);
});
await test('future or unmatched historical start fails atomically and cannot invent work minutes',async()=>{
 await reset();await source(v,[['service_start','08:00']]);await assert.rejects(()=>sync(),/Nicht beendete/);
 assert.equal((await rows('SELECT count(*)::int n FROM workforce_time_events'))[0].n,0);
 await reset();await db.exec(`RESET ROLE; INSERT INTO assist_time_events(tenant_id,visit_id,event_type,occurred_at) VALUES('${t}','${v}','service_start',now()+interval '1 day'); SET ROLE authenticated`);
 await assert.rejects(()=>sync(),/Quellereignis/);assert.equal((await rows('SELECT count(*)::int n FROM workforce_work_sessions'))[0].n,0);
});
await test('anonymous execution and direct internal recomputation are unavailable',async()=>{
 await reset();await db.exec('SET ROLE anon');await assert.rejects(()=>sync(),/permission denied/);await db.exec('RESET ROLE');
 assert.equal((await db.query("SELECT has_function_privilege('authenticated','workflow_recalculate_wfm_day(uuid)','EXECUTE') allowed")).rows[0].allowed,false);
});
await db.close();
