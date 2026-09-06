// Isolated PostgreSQL: actual employee RPC + actual canonical event reconciliation trigger.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
const require = createRequire(import.meta.url);
const { PGlite } = require(process.env.CARESUITE_PGLITE_MODULE || '@electric-sql/pglite');
const db = new PGlite();
const t='10000000-0000-0000-0000-000000000001', e='20000000-0000-0000-0000-000000000001', p='30000000-0000-0000-0000-000000000001', v='40000000-0000-0000-0000-000000000001';
const sql = (name) => readFileSync(new URL(`../migrations/${name}.sql`, import.meta.url),'utf8');
await db.exec(`
CREATE ROLE authenticated; CREATE ROLE anon; CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE SQL AS $$ SELECT '${p}'::uuid $$;
CREATE FUNCTION current_tenant_id() RETURNS uuid LANGUAGE SQL AS $$ SELECT current_setting('test.tenant')::uuid $$;
CREATE FUNCTION resolve_current_employee_id() RETURNS uuid LANGUAGE SQL AS $$ SELECT current_setting('test.employee')::uuid $$;
CREATE FUNCTION resolve_current_profile_id() RETURNS uuid LANGUAGE SQL AS $$ SELECT '${p}'::uuid $$;
CREATE FUNCTION is_employee_portal_rls_context(uuid) RETURNS boolean LANGUAGE SQL AS $$ SELECT current_setting('test.portal')::boolean $$;
CREATE TABLE assist_visits(id uuid primary key, tenant_id uuid, employee_id uuid,legacy_assignment_id uuid,planning_status text,canonical_status text,execution_status text,
  planned_start_at timestamptz,planned_end_at timestamptz,on_the_way_at timestamptz,arrived_at timestamptz,actual_start_at timestamptz,actual_end_at timestamptz,finished_at timestamptz,
  duration_minutes integer,updated_by uuid,updated_at timestamptz,is_incomplete boolean,proof_status text);
CREATE TABLE employees(id uuid,tenant_id uuid,profile_id uuid);
CREATE TABLE employee_portal_accounts(tenant_id uuid,employee_id uuid,status text,auth_user_id uuid);
CREATE TABLE profiles(id uuid,auth_user_id uuid);
CREATE TABLE assignments(id uuid,tenant_id uuid,status text,on_the_way_at timestamptz,arrived_at timestamptz,actual_start_at timestamptz,actual_end_at timestamptz,finished_at timestamptz,updated_at timestamptz);
CREATE TABLE assist_visit_documentation(id uuid primary key default gen_random_uuid(),tenant_id uuid,visit_id uuid,short_description text,submitted_at timestamptz,locked boolean default false,metadata jsonb,updated_at timestamptz,unique(tenant_id,visit_id));
CREATE TABLE assist_time_events(id uuid default gen_random_uuid(),tenant_id uuid,visit_id uuid,event_type text,occurred_at timestamptz,recorded_by uuid,metadata jsonb);
CREATE TABLE assist_visit_execution_state(tenant_id uuid,visit_id uuid,current_step text,assignment_status text,travel_started_at timestamptz,travel_ended_at timestamptz,
  service_started_at timestamptz,service_ended_at timestamptz,signature_complete boolean,proof_generated boolean,finalized_at timestamptz,updated_at timestamptz,unique(tenant_id,visit_id));
CREATE TABLE assist_visit_signatures(tenant_id uuid,visit_id uuid,is_valid boolean,invalidated_at timestamptz,invalidation_reason text,updated_at timestamptz);
CREATE TABLE assist_visit_proofs(tenant_id uuid,visit_id uuid,signature_id uuid,portal_release_status text,portal_visible boolean,updated_at timestamptz);
CREATE TABLE workforce_time_events(tenant_id uuid,employee_id uuid,user_id uuid,event_type text,work_mode text,source text,occurred_at timestamptz,reference_type text,reference_id uuid,note text,metadata jsonb,created_by uuid);
CREATE TABLE assist_visit_admin_audit(tenant_id uuid,visit_id uuid,action text,previous_value jsonb,new_value jsonb,reason text);
`);
await db.exec(sql('20260724124500_assist_admin_time_correction_readback'));
await db.exec(sql('20260906100000_employee_open_visit_time_edit'));
async function seed() {
  await db.exec(`RESET ROLE; TRUNCATE assist_visit_documentation,assist_visits,assignments,employees,employee_portal_accounts,profiles,assist_time_events,assist_visit_execution_state,assist_visit_signatures,assist_visit_proofs,workforce_time_events,assist_visit_admin_audit;
    SELECT set_config('test.tenant','${t}',false),set_config('test.employee','${e}',false),set_config('test.portal','true',false);
    INSERT INTO assist_visits(id,tenant_id,employee_id,legacy_assignment_id,planning_status,canonical_status,execution_status,planned_start_at,planned_end_at) VALUES('${v}','${t}','${e}','${v}','confirmed','started','in_progress','2026-09-01 08:00Z','2026-09-01 09:00Z');
    INSERT INTO assignments(id,tenant_id,status) VALUES('${v}','${t}','started');
    INSERT INTO employees VALUES('${e}','${t}','${p}'); INSERT INTO profiles VALUES('${p}','${p}');
    INSERT INTO assist_time_events(tenant_id,visit_id,event_type,occurred_at,metadata) VALUES('${t}','${v}','service_start','2026-09-01 07:30Z','{}');
    INSERT INTO assist_visit_signatures(tenant_id,visit_id,is_valid) VALUES('${t}','${v}',true);
    INSERT INTO assist_visit_proofs(tenant_id,visit_id,signature_id,portal_visible) VALUES('${t}','${v}','${p}',false);
    SET ROLE authenticated;
  `);
}
const run = (overrides={}) => db.query(`SELECT employee_portal_correct_open_visit_times($1,$2,$3,$4,$5,$6,$7,$8,$9) result`,[
  overrides.visit ?? v,overrides.drive ?? '2026-09-01 07:45Z',overrides.arrival ?? '2026-09-01 07:55Z',overrides.start ?? '2026-09-01 08:00Z',overrides.end ?? '2026-09-01 09:00Z',overrides.pause ?? 10,10,overrides.reason ?? 'Tatsächliche Zeiten ergänzt',overrides.overlap ?? false]);
async function read(query) { await db.exec('RESET ROLE'); return (await db.query(query)).rows; }
await test('own open visit: canonical times, pauses, workforce and audit update together',async()=>{
  await seed(); assert.equal((await run()).rows[0].result.ok,true);
  const visits=await read('SELECT * FROM assist_visits');
  assert.equal(visits[0].duration_minutes,50); assert.equal(visits[0].canonical_status,'finished');
  assert.equal((await read("SELECT count(*)::int n FROM assist_time_events WHERE event_type='service_start'"))[0].n,1);
  assert.equal((await read("SELECT count(*)::int n FROM assist_time_events WHERE event_type IN ('pause_start','pause_end')"))[0].n,2);
  assert.equal((await read('SELECT signature_complete FROM assist_visit_execution_state'))[0].signature_complete,false);
  assert.equal((await read('SELECT is_valid FROM assist_visit_signatures'))[0].is_valid,false);
  assert.equal((await read('SELECT signature_id FROM assist_visit_proofs'))[0].signature_id,null);
  assert.equal((await read('SELECT previous_value FROM assist_visit_admin_audit'))[0].previous_value.time_events.length,1);
  assert.equal((await read("SELECT count(*)::int n FROM workforce_time_events WHERE event_type='visit_started'"))[0].n,1);
});
await test('cannot edit another employee visit',async()=>{ await seed(); await db.exec("SELECT set_config('test.employee','20000000-0000-0000-0000-000000000002',false)"); await assert.rejects(()=>run(),/nicht zugeordnet/); });
await test('cannot edit another tenant visit',async()=>{ await seed(); await db.exec("SELECT set_config('test.tenant','10000000-0000-0000-0000-000000000002',false)"); await assert.rejects(()=>run(),/nicht gefunden/); });
await test('non-employee context does not gain an administrative entry point',async()=>{ await seed(); await db.exec("SELECT set_config('test.portal','false',false)"); await assert.rejects(()=>run(),/Mitarbeitendenanmeldung/); });
await test('finalized, cancelled and draft visits stay protected',async()=>{
 for(const update of ["canonical_status='completed'","planning_status='cancelled'","planning_status='draft'"]){ await seed(); await db.exec(`RESET ROLE; UPDATE assist_visits SET ${update}; SET ROLE authenticated;`); await assert.rejects(()=>run(),/abgeschlossen|freigegeben/); }
 await seed(); await db.exec(`RESET ROLE; INSERT INTO assist_visit_execution_state(tenant_id,visit_id,finalized_at) VALUES('${t}','${v}',now()); SET ROLE authenticated;`); await assert.rejects(()=>run(),/abgeschlossen/);
});
await test('invalid times and missing reason make no changes',async()=>{
 for(const input of [{start:'2026-09-01 10:00Z'},{pause:90},{pause:-1},{reason:''}]) {await seed(); await assert.rejects(()=>run(input)); assert.equal((await read('SELECT count(*)::int n FROM assist_visit_admin_audit'))[0].n,0);}
});
await test('overlap requires explicit confirmation',async()=>{
 await seed(); await db.exec(`RESET ROLE; INSERT INTO assist_visits(id,tenant_id,employee_id,planned_start_at,planned_end_at,execution_status) VALUES('40000000-0000-0000-0000-000000000002','${t}','${e}','2026-09-01 08:30Z','2026-09-01 09:30Z','pending'); SET ROLE authenticated;`);
 assert.equal((await run()).rows[0].result.overlap,true); assert.equal((await run({overlap:true})).rows[0].result.ok,true);
});
await test('a downstream write failure rolls the entire edit back',async()=>{
 await seed(); await db.exec(`RESET ROLE; ALTER TABLE assist_visit_admin_audit ADD CONSTRAINT reject_test CHECK (false); SET ROLE authenticated;`);
 await assert.rejects(()=>run(),/reject_test/);
 assert.equal((await read('SELECT canonical_status FROM assist_visits'))[0].canonical_status,'started');
 assert.equal((await read('SELECT is_valid FROM assist_visit_signatures'))[0].is_valid,true);
 await db.exec('ALTER TABLE assist_visit_admin_audit DROP CONSTRAINT reject_test');
});
await test('a second correction to an earlier date replaces stale events and preserves both audit versions',async()=>{
  await seed(); await run(); await run({drive:'2026-08-31 07:45Z',arrival:'2026-08-31 07:55Z',start:'2026-08-31 08:00Z',end:'2026-08-31 09:00Z'});
  assert.equal((await read('SELECT actual_start_at FROM assist_visits'))[0].actual_start_at.toISOString(),'2026-08-31T08:00:00.000Z');
  assert.equal((await read("SELECT count(*)::int n FROM assist_time_events WHERE event_type='service_start'"))[0].n,1);
  assert.equal((await read('SELECT count(*)::int n FROM assist_visit_admin_audit'))[0].n,2);
});
await test('editing submitted documentation invalidates the old signature atomically',async()=>{
  await seed(); await db.exec(`RESET ROLE; SELECT set_config('test.portal','false',false);
    INSERT INTO assist_visit_documentation(tenant_id,visit_id,short_description) VALUES('${t}','${v}','Bisherige Doku');
    SELECT set_config('test.portal','true',false);
    UPDATE assist_visit_documentation SET short_description='Ergänzte Doku',submitted_at=now();`);
  assert.equal((await read('SELECT is_valid FROM assist_visit_signatures'))[0].is_valid,false);
  assert.equal((await read('SELECT previous_value FROM assist_visit_admin_audit'))[0].previous_value.short_description,'Bisherige Doku');
  assert.equal((await read('SELECT signature_id FROM assist_visit_proofs'))[0].signature_id,null);
});
await test('a completed visit rejects a documentation change and retains the evidence',async()=>{
  await seed(); await db.exec(`RESET ROLE; SELECT set_config('test.portal','false',false);
    INSERT INTO assist_visit_documentation(tenant_id,visit_id,short_description) VALUES('${t}','${v}','Bisherige Doku');
    UPDATE assist_visits SET canonical_status='completed'; SELECT set_config('test.portal','true',false);`);
  await assert.rejects(()=>db.exec("UPDATE assist_visit_documentation SET short_description='Nach Abschluss'"),/abgeschlossen/);
  assert.equal((await read('SELECT short_description FROM assist_visit_documentation'))[0].short_description,'Bisherige Doku');
  assert.equal((await read('SELECT is_valid FROM assist_visit_signatures'))[0].is_valid,true);
});
await test('invalid timestamps and drive after service start are rejected',async()=>{
  for(const input of [{start:'-infinity'},{end:'infinity'},{drive:'2026-09-01 10:00Z'}]){await seed(); await assert.rejects(()=>run(input),/Zeitfolge/);}
});
await test('documentation cannot be changed by another employee',async()=>{
  await seed(); await db.exec(`RESET ROLE; SELECT set_config('test.portal','false',false);
    INSERT INTO assist_visit_documentation(tenant_id,visit_id,short_description) VALUES('${t}','${v}','Bisherige Doku');
    SELECT set_config('test.portal','true',false),set_config('test.employee','20000000-0000-0000-0000-000000000002',false);`);
  await assert.rejects(()=>db.exec("UPDATE assist_visit_documentation SET short_description='Fremder Einsatz'"),/nicht zugeordnet/);
  assert.equal((await read('SELECT short_description FROM assist_visit_documentation'))[0].short_description,'Bisherige Doku');
});
await test('clearing optional travel times clears stale workforce events and preserves their audit record',async()=>{
  await seed(); await run();
  await db.query(`SELECT employee_portal_correct_open_visit_times($1,NULL,NULL,'2026-09-01 08:00Z','2026-09-01 09:00Z',0,0,'Kein Anfahrtszeit-Nachtrag',false)`,[v]);
  assert.equal((await read("SELECT count(*)::int n FROM workforce_time_events WHERE event_type IN ('visit_drive_start','visit_arrived')"))[0].n,0);
  const history=await read('SELECT previous_value FROM assist_visit_admin_audit');
  assert.ok(history.some((r)=>r.previous_value.workforce_events.some((e)=>e.event_type==='visit_drive_start')));
});
await db.close();
