// Isolated real PostgreSQL execution with synthetic actors only. No network.
// Session helpers are fixtures, not evidence of deployed JWT/RLS authorization.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
const read = file => readFileSync(new URL(file, import.meta.url),'utf8');
const metadata = JSON.parse(read('../../docs/workflow-server-write-rpc-metadata-20261011.json'));
const oldRpc = metadata.functions.find(f=>f.name==='repair_assist_visit_workflow_status').definition;
const oldGuard = JSON.parse(read('../../docs/workflow-server-permission-metadata-20261011.json')).functions.find(f=>f.name==='guard_assist_execution_state_regression').definition;
const normalize = JSON.parse(read('../../docs/workflow-server-repair-schema-metadata-20261011.json')).functions[0].definition;
const regressionDraft = read('../../docs/workflow-server-execution-regression-draft.sql');
const repairDraft = read('../../docs/workflow-server-repair-authorization-draft.sql');
const id = { tenant:'10000000-0000-4000-8000-000000000001',foreignTenant:'10000000-0000-4000-8000-000000000002',
  employee:'20000000-0000-4000-8000-000000000001',otherEmployee:'20000000-0000-4000-8000-000000000002',
  profile:'30000000-0000-4000-8000-000000000001',user:'40000000-0000-4000-8000-000000000001',otherUser:'40000000-0000-4000-8000-000000000002',
  account:'50000000-0000-4000-8000-000000000001',assignment:'60000000-0000-4000-8000-000000000001',
  visit:'70000000-0000-4000-8000-000000000001',otherVisit:'70000000-0000-4000-8000-000000000002',client:'80000000-0000-4000-8000-000000000001' };
const start='2026-10-10T08:00:00Z',end='2026-10-10T09:00:00Z';
const schema=`CREATE ROLE authenticated; CREATE ROLE anon; CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT nullif(current_setting('test.uid',true),'')::uuid$$;
CREATE FUNCTION current_tenant_id() RETURNS uuid LANGUAGE sql AS $$SELECT nullif(current_setting('test.tenant',true),'')::uuid$$;
CREATE FUNCTION current_portal_type() RETURNS text LANGUAGE sql AS $$SELECT nullif(current_setting('test.portal',true),'')$$;
CREATE FUNCTION current_portal_account_id() RETURNS uuid LANGUAGE sql AS $$SELECT nullif(current_setting('test.account',true),'')::uuid$$;
CREATE FUNCTION current_role_key() RETURNS text LANGUAGE sql AS $$SELECT CASE current_portal_type() WHEN 'employee' THEN 'employee_portal' WHEN 'client' THEN 'client_portal' WHEN 'relative' THEN 'family_portal' ELSE 'business_admin' END$$;
CREATE FUNCTION resolve_current_employee_id() RETURNS uuid LANGUAGE sql AS $$SELECT nullif(current_setting('test.employee',true),'')::uuid$$;
CREATE FUNCTION current_client_id() RETURNS uuid LANGUAGE sql AS $$SELECT '${id.client}'::uuid$$;
CREATE FUNCTION is_internal_tenant_actor(uuid) RETURNS boolean LANGUAGE sql AS $$SELECT $1=current_tenant_id() AND current_setting('test.internal',true)='true'$$;
CREATE FUNCTION has_permission(text) RETURNS boolean LANGUAGE sql AS $$SELECT $1='assist.execution.manage' AND current_setting('test.permission',true)='true'$$;
CREATE FUNCTION is_tenant_admin() RETURNS boolean LANGUAGE sql AS $$SELECT current_setting('test.admin',true)='true'$$;
CREATE TYPE assignment_status AS ENUM('planned','confirmed','on_the_way','arrived','started','paused','finished','documentation_open','signature_open','completed','cancelled','no_show');
CREATE TABLE profiles(id uuid PRIMARY KEY,tenant_id uuid,auth_user_id uuid,status text DEFAULT 'active',is_active boolean DEFAULT true,display_name text,full_name text);
CREATE TABLE tenant_users(tenant_id uuid,auth_user_id uuid,status text,must_change_password boolean,first_login_completed boolean);
CREATE TABLE employees(id uuid,tenant_id uuid,deleted_at timestamptz,portal_enabled boolean DEFAULT true);
CREATE TABLE employee_portal_accounts(id uuid,tenant_id uuid,employee_id uuid,auth_user_id uuid,status text,must_change_password boolean DEFAULT false,first_login_completed boolean DEFAULT true);
CREATE TABLE assignments(id uuid PRIMARY KEY,tenant_id uuid,employee_id uuid,client_id uuid,status assignment_status,updated_at timestamptz DEFAULT now(),updated_by uuid REFERENCES profiles);
CREATE TABLE assist_visits(id uuid PRIMARY KEY,tenant_id uuid,legacy_assignment_id uuid,employee_id uuid,client_id uuid,canonical_status text,execution_status text DEFAULT 'pending',
  on_the_way_at timestamptz,arrived_at timestamptz,actual_start_at timestamptz,actual_end_at timestamptz,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now(),updated_by uuid REFERENCES profiles);
CREATE TABLE assist_visit_execution_state(id uuid DEFAULT gen_random_uuid(),tenant_id uuid,visit_id uuid,current_step text DEFAULT 'consent',assignment_status text,
  travel_started_at timestamptz,travel_ended_at timestamptz,service_started_at timestamptz,service_ended_at timestamptz,finalized_at timestamptz,
  documentation_complete boolean DEFAULT false,signature_complete boolean DEFAULT false,proof_generated boolean DEFAULT false,
  workflow_consistency_status text DEFAULT 'repairable',last_auto_repair_at timestamptz,last_repair_reason text,updated_at timestamptz DEFAULT now(),PRIMARY KEY(tenant_id,visit_id));
CREATE TABLE assist_time_events(id uuid DEFAULT gen_random_uuid(),tenant_id uuid,visit_id uuid,event_type text,occurred_at timestamptz,recorded_by uuid);
CREATE TABLE assist_visit_documentation(tenant_id uuid,visit_id uuid,short_description text,submitted_at timestamptz);
CREATE TABLE assist_visit_signatures(id uuid,tenant_id uuid,visit_id uuid,is_valid boolean,signature_hash text,payload_hash text,storage_path text);
CREATE TABLE assist_visit_proofs(id uuid,tenant_id uuid,visit_id uuid,signature_id uuid,payload_hash text,payload_snapshot jsonb,portal_visible boolean,portal_release_status text);
CREATE TABLE assignment_audit_events(id uuid DEFAULT gen_random_uuid(),tenant_id uuid,assignment_id uuid,action text,actor_profile_id uuid REFERENCES profiles,
  actor_name text,from_status text,to_status text,details text CHECK(details<>'force_audit_failure'),created_at timestamptz);
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;`;
async function createDb(drafts=true) {
  const result=new PGlite(); await result.exec(schema);await result.exec(normalize);await result.exec(oldRpc);await result.exec(oldGuard);
  await result.exec('CREATE TRIGGER trg_guard_assist_execution_state_regression BEFORE UPDATE ON assist_visit_execution_state FOR EACH ROW EXECUTE FUNCTION guard_assist_execution_state_regression()');
  if(drafts){await result.exec(regressionDraft);try { await result.exec(repairDraft); }
    catch(error) { console.error('Repair draft SQL error', { message:error.message,position:error.position,where:error.where,detail:error.detail,internalQuery:error.internalQuery,internalPosition:error.internalPosition }); await result.close(); throw error; }}return result;
}
async function config(db,changes={}) {
  const values={uid:id.user,tenant:id.tenant,portal:'employee',employee:id.employee,account:id.account,internal:'false',permission:'false',admin:'false',...changes};
  for(const[k,v]of Object.entries(values))await db.query('SELECT set_config($1,$2,false)',['test.'+k,v]);
}
async function reset(db,drafts=true) {
  await db.exec('RESET ROLE; TRUNCATE assignment_audit_events,assignments,assist_visits,assist_visit_execution_state,assist_time_events,assist_visit_documentation,assist_visit_signatures,assist_visit_proofs,employee_portal_accounts,employees,tenant_users,profiles');
  await config(db);
  if(drafts)await db.exec(`COMMENT ON FUNCTION guard_assist_execution_state_regression() IS 'caresuite:workflow-execution-regression-v1-review'; ALTER TABLE assist_visit_execution_state ENABLE TRIGGER trg_guard_assist_execution_state_regression`);
  await db.query('INSERT INTO profiles(id,tenant_id,auth_user_id,display_name) VALUES($1,$2,$3,$4),($5,$6,$7,$8)',[id.profile,id.tenant,id.user,'Eigener Akteur',id.otherEmployee,id.foreignTenant,id.otherUser,'Gefälschter Akteur']);
  await db.query('INSERT INTO employees(id,tenant_id) VALUES($1,$2)',[id.employee,id.tenant]);
  await db.query('INSERT INTO employee_portal_accounts(id,tenant_id,employee_id,auth_user_id,status) VALUES($1,$2,$3,$4,$5)',[id.account,id.tenant,id.employee,id.user,'active']);
  await db.query('INSERT INTO assignments(id,tenant_id,employee_id,client_id,status) VALUES($1,$2,$3,$4,$5)',[id.assignment,id.tenant,id.employee,id.client,'planned']);
  await db.query("INSERT INTO assist_visits(id,tenant_id,legacy_assignment_id,employee_id,client_id,canonical_status,on_the_way_at,arrived_at) VALUES($1,$2,$3,$4,$5,'planned','2026-10-10T07:30:00Z','2026-10-10T07:55:00Z')",[id.visit,id.tenant,id.assignment,id.employee,id.client]);
  await db.query("INSERT INTO assist_visit_execution_state(tenant_id,visit_id,assignment_status) VALUES($1,$2,'geplant')",[id.tenant,id.visit]);
  await db.exec('SET ROLE authenticated');
}
const call=(db,target='angekommen',options={})=>db.query('SELECT repair_assist_visit_workflow_status($1,$2,$3,$4,$5,$6)',
  [options.tenant??id.tenant,options.assignment??id.assignment,target,options.reason??'synthetic repair',options.actor??id.employee,options.allow??false]);
async function write(db,sql,args=[]) {await db.exec('RESET ROLE');if(args.length)await db.query(sql,args);else await db.exec(sql);await db.exec('SET ROLE authenticated');}
async function snapshot(db) {
  return {assignments:(await db.query('SELECT * FROM assignments ORDER BY id')).rows,visits:(await db.query('SELECT * FROM assist_visits ORDER BY id')).rows,
    states:(await db.query('SELECT * FROM assist_visit_execution_state ORDER BY visit_id')).rows,audit:(await db.query('SELECT * FROM assignment_audit_events')).rows};
}
await test('reproduces the captured Production caller-tenant/actor spoof and terminal proof bypass',async()=>{
  const old=await createDb(false);try{
    await reset(old,false);await config(old,{tenant:id.foreignTenant});
    await call(old,'abgeschlossen',{actor:id.otherEmployee,allow:true});
    const state=await snapshot(old);assert.equal(state.assignments[0].status,'completed');assert.equal(state.visits[0].canonical_status,'completed');
    assert.equal(state.audit[0].actor_profile_id,id.otherEmployee);assert.equal(state.audit[0].actor_name,'Gefälschter Akteur');
    assert.equal((await old.query('SELECT count(*)::int n FROM assist_visit_proofs')).rows[0].n,0);
  }finally{await old.close();}
});
// The active RPC body is retained; only its caller/row binding is guarded.
const authGuardDb=await createDb(false);
await authGuardDb.exec(`CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
 SELECT jsonb_build_object('role',coalesce(current_setting('test.jwt_role',true),'authenticated'),
   'user_metadata',jsonb_build_object('role',current_setting('test.user_meta_role',true)))$$;
 CREATE ROLE service_role;GRANT EXECUTE ON FUNCTION repair_assist_visit_workflow_status(uuid,uuid,text,text,uuid,boolean) TO service_role;
 CREATE SCHEMA care_security;
 CREATE FUNCTION care_security.company_actor(uuid,text) RETURNS boolean LANGUAGE sql AS $$
 SELECT $1=current_tenant_id() AND $2='assist.execution.manage' AND current_setting('test.internal',true)='true'
   AND (current_setting('test.permission',true)='true' OR current_setting('test.admin',true)='true')$$;`);
await authGuardDb.exec(read('../../docs/store/android-repair-assist-visit-workflow-status-guard-review.sql'));
await test('current-body guard binds own employee/profile callers and stored audit author',async()=>{
 for(const actor of [id.employee,id.profile,null]){
  await reset(authGuardDb,false);await call(authGuardDb,'angekommen',{actor});const state=await snapshot(authGuardDb);
  assert.equal(state.assignments[0].status,'arrived');assert.equal(state.audit[0].actor_profile_id,id.profile);
 }
});
await test('current-body guard denies missing/foreign/disabled/other-role identity before any writes',async()=>{
 for(const changes of [{uid:''},{uid:id.otherUser},{tenant:''},{tenant:id.foreignTenant},{employee:''},{employee:id.otherEmployee},{account:id.otherVisit},{portal:'client'},{portal:'relative'}]){
  await reset(authGuardDb,false);await config(authGuardDb,changes);const before=await snapshot(authGuardDb);
  await assert.rejects(()=>call(authGuardDb));assert.deepEqual(await snapshot(authGuardDb),before);
 }
 for(const sql of ["UPDATE employee_portal_accounts SET status='disabled'",'UPDATE employee_portal_accounts SET must_change_password=true','UPDATE employee_portal_accounts SET first_login_completed=false','UPDATE employees SET portal_enabled=false','UPDATE employees SET deleted_at=now()','UPDATE profiles SET is_active=false',
  `INSERT INTO tenant_users(tenant_id,auth_user_id,status,must_change_password,first_login_completed) VALUES('${id.tenant}','${id.user}',NULL,false,true)`,
  `INSERT INTO tenant_users(tenant_id,auth_user_id,status,must_change_password,first_login_completed) VALUES('${id.tenant}','${id.user}','active',NULL,true)`,
  `INSERT INTO tenant_users(tenant_id,auth_user_id,status,must_change_password,first_login_completed) VALUES('${id.tenant}','${id.user}','active',false,NULL)`]){
  await reset(authGuardDb,false);await write(authGuardDb,sql);const before=await snapshot(authGuardDb);
  await assert.rejects(()=>call(authGuardDb));assert.deepEqual(await snapshot(authGuardDb),before);
 }
});
await test('current-body guard denies arbitrary actor, foreign assignment and employee timestamp bypass',async()=>{
 for(const options of [{actor:id.otherEmployee},{assignment:id.otherVisit},{tenant:id.foreignTenant},{allow:true}]){
  await reset(authGuardDb,false);const before=await snapshot(authGuardDb);
  await assert.rejects(()=>call(authGuardDb,'angekommen',options));assert.deepEqual(await snapshot(authGuardDb),before);
 }
});
await test('current-body guard retains explicitly authorized Office/admin repair and denies missing permission',async()=>{
 for(const rights of [{permission:'true',admin:'false'},{permission:'false',admin:'true'}]){
  await reset(authGuardDb,false);await config(authGuardDb,{portal:'business',internal:'true',...rights});
  await call(authGuardDb);const state=await snapshot(authGuardDb);
  assert.equal(state.assignments[0].status,'arrived');assert.equal(state.audit[0].actor_profile_id,id.profile);
 }
 await reset(authGuardDb,false);await config(authGuardDb,{portal:'business',internal:'true',permission:'false',admin:'false'});
 const before=await snapshot(authGuardDb);await assert.rejects(()=>call(authGuardDb));assert.deepEqual(await snapshot(authGuardDb),before);
});
await test('current-body guard preserves trusted service-role jobs and rejects user metadata role spoofing',async()=>{
 await reset(authGuardDb,false);await config(authGuardDb,{uid:'',tenant:'',portal:''});
 await authGuardDb.query("SELECT set_config('test.jwt_role','service_role',false)");
 await authGuardDb.exec('SET ROLE service_role');
 await call(authGuardDb,'angekommen',{actor:id.otherEmployee});
 await authGuardDb.exec('RESET ROLE');
 const service=(await authGuardDb.query('SELECT actor_profile_id FROM assignment_audit_events')).rows[0];
 assert.equal(service.actor_profile_id,id.otherEmployee); // Original trusted job semantics.
 await authGuardDb.query("SELECT set_config('test.jwt_role','authenticated',false)");
 await authGuardDb.query("SELECT set_config('test.user_meta_role','service_role',false)");
 await reset(authGuardDb,false);await config(authGuardDb,{uid:'',tenant:'',portal:''});
 const before=await snapshot(authGuardDb);await assert.rejects(()=>call(authGuardDb));
 assert.deepEqual(await snapshot(authGuardDb),before);
 await authGuardDb.query("SELECT set_config('test.user_meta_role','',false)");
});
await test('current-body guard keeps signature/defaults and refuses changed function bodies',async()=>{
 const [meta]=(await authGuardDb.query("SELECT pg_get_function_identity_arguments(oid) args,pronargdefaults defaults,prosecdef FROM pg_proc WHERE proname='repair_assist_visit_workflow_status'")).rows;
 assert.equal(meta.args,'p_tenant_id uuid, p_assignment_id uuid, p_target_status text, p_reason text, p_actor_employee_id uuid, p_allow_service_without_timestamp boolean');
 assert.equal(meta.defaults,3);assert.equal(meta.prosecdef,true);
 await authGuardDb.exec('RESET ROLE');await assert.rejects(()=>authGuardDb.exec(read('../../docs/store/android-repair-assist-visit-workflow-status-guard-review.sql')),/Reviewed function source changed/);
 await authGuardDb.exec('ROLLBACK');
});
await authGuardDb.close();
const db=await createDb();
await test('own partial repair uses real actor profile and actual times; retry changes no version or audit',async()=>{
  await reset(db);await call(db);const first=await snapshot(db);
  assert.equal(first.assignments[0].status,'arrived');assert.equal(first.visits[0].canonical_status,'arrived');assert.equal(first.states[0].current_step,'arrived');
  assert.equal(first.audit[0].actor_profile_id,id.profile);assert.notEqual(first.audit[0].actor_profile_id,id.employee);assert.equal(first.audit[0].actor_name,'Eigener Akteur');
  assert.equal(first.visits[0].actual_start_at,null);await call(db);assert.deepEqual(await snapshot(db),first);
});
await test('mirrors an existing service-start event without inventing a start or completion proof',async()=>{
  await reset(db);await write(db,'INSERT INTO assist_time_events(tenant_id,visit_id,event_type,occurred_at,recorded_by) VALUES($1,$2,$3,$4,$5)',[id.tenant,id.visit,'service_start',start,id.profile]);
  await call(db,'gestartet');const s=await snapshot(db);assert.equal(s.assignments[0].status,'started');assert.equal(new Date(s.visits[0].actual_start_at).toISOString(),'2026-10-10T08:00:00.000Z');
  assert.equal(s.states[0].proof_generated,false);assert.equal(s.states[0].signature_complete,false);
});
await test('uses actual repeated pause/resume events while service is open',async()=>{
  await reset(db);await write(db,'UPDATE assist_visits SET actual_start_at=$1',[start]);
  await write(db,'INSERT INTO assist_time_events(tenant_id,visit_id,event_type,occurred_at) VALUES($1,$2,$3,$4)',[id.tenant,id.visit,'pause_start','2026-10-10T08:15:00Z']);
  await call(db,'pausiert');assert.equal((await snapshot(db)).assignments[0].status,'paused');
  await write(db,'INSERT INTO assist_time_events(tenant_id,visit_id,event_type,occurred_at) VALUES($1,$2,$3,$4)',[id.tenant,id.visit,'pause_end','2026-10-10T08:20:00Z']);
  await call(db,'gestartet');assert.equal((await snapshot(db)).assignments[0].status,'started');
});
await test('repairs a real end and submitted documentation to signature pending without fabricating a signature',async()=>{
  await reset(db);await write(db,'UPDATE assist_visits SET actual_start_at=$1,actual_end_at=$2',[start,end]);
  await write(db,'INSERT INTO assist_visit_documentation VALUES($1,$2,$3,$4)',[id.tenant,id.visit,'Tatsächliche Leistung',end]);
  await call(db,'unterschrift_offen');const s=await snapshot(db);assert.equal(s.assignments[0].status,'signature_open');assert.equal(s.visits[0].canonical_status,'signature_pending');
  assert.equal(s.states[0].documentation_complete,true);assert.equal(s.states[0].signature_complete,false);assert.equal(s.states[0].proof_generated,false);
});
await test('denies cross-tenant, foreign assignment, spoofed employee and unbound visit/client scopes without any writes',async()=>{
  for(const options of[{tenant:id.foreignTenant},{assignment:id.otherVisit},{actor:id.otherEmployee},{actor:id.profile}]){
    await reset(db);const prior=await snapshot(db);await assert.rejects(()=>call(db,'angekommen',options));assert.deepEqual(await snapshot(db),prior);
  }
  for(const mutation of[`UPDATE assignments SET employee_id='${id.otherEmployee}'`,`UPDATE assist_visits SET employee_id='${id.otherEmployee}'`,`UPDATE assist_visits SET client_id='${id.otherEmployee}'`]){
    await reset(db);await write(db,mutation);const prior=await snapshot(db);await assert.rejects(()=>call(db),/zugeordnet|zuordnung/i);assert.deepEqual(await snapshot(db),prior);
  }
});
await test('rejects missing authentication, wrong or inactive profile and ambiguous auth mappings',async()=>{
  for(const change of[{uid:''},{uid:id.otherUser},{tenant:''}]){await reset(db);await config(db,change);const prior=await snapshot(db);await assert.rejects(()=>call(db));assert.deepEqual(await snapshot(db),prior);}
  for(const mutation of[`UPDATE profiles SET is_active=false WHERE id='${id.profile}'`,`UPDATE profiles SET status='disabled' WHERE id='${id.profile}'`,
    `UPDATE profiles SET tenant_id='${id.foreignTenant}' WHERE id='${id.profile}'`,`UPDATE profiles SET auth_user_id='${id.otherUser}' WHERE id='${id.profile}'`,
    `UPDATE profiles SET auth_user_id='${id.user}',tenant_id='${id.tenant}' WHERE id='${id.otherEmployee}'`]){
    await reset(db);await write(db,mutation);const prior=await snapshot(db);await assert.rejects(()=>call(db),/Authprofil/);assert.deepEqual(await snapshot(db),prior);
  }
});
await test('rejects disabled portal, first-login/password requirements and another account binding',async()=>{
  for(const mutation of["UPDATE employee_portal_accounts SET status='disabled'","UPDATE employee_portal_accounts SET must_change_password=true",
    "UPDATE employee_portal_accounts SET first_login_completed=false",`UPDATE employee_portal_accounts SET auth_user_id='${id.otherUser}'`,
    `UPDATE employee_portal_accounts SET employee_id='${id.otherEmployee}'`,`UPDATE employees SET deleted_at=now()`,`UPDATE employees SET portal_enabled=false`]){
    await reset(db);await write(db,mutation);const prior=await snapshot(db);await assert.rejects(()=>call(db),/Mitarbeitendenkonto/);assert.deepEqual(await snapshot(db),prior);
  }
  await reset(db);await config(db,{account:id.otherEmployee});await assert.rejects(()=>call(db),/Mitarbeitendenkonto/);
});
await test('denies inactive tenant-user bootstrap even when profile and portal account are active',async()=>{
  for(const flags of[['inactive',false,true],['active',true,true],['active',false,false]]){
    await reset(db);await write(db,'INSERT INTO tenant_users VALUES($1,$2,$3,$4,$5)',[id.tenant,id.user,...flags]);
    const prior=await snapshot(db);await assert.rejects(()=>call(db),/Authprofil/);assert.deepEqual(await snapshot(db),prior);
  }
});
await test('Office needs verified business scope plus execution permission or Admin and uses its actual author',async()=>{
  await reset(db);await config(db,{portal:'business',internal:'true'});await assert.rejects(()=>call(db),/Berechtigung/);
  await config(db,{portal:'business',permission:'true'});await assert.rejects(()=>call(db),/Berechtigung/);
  await config(db,{portal:'business',internal:'true',permission:'true'});await call(db);assert.equal((await snapshot(db)).audit[0].actor_profile_id,id.profile);
  await reset(db);await config(db,{portal:'business',internal:'true',admin:'true'});await call(db);assert.equal((await snapshot(db)).assignments[0].status,'arrived');
});
await test('client and family portals cannot borrow Office permissions',async()=>{
  for(const portal of['client','relative']){await reset(db);await config(db,{portal,internal:'true',permission:'true',admin:'true'});const prior=await snapshot(db);await assert.rejects(()=>call(db),/Berechtigung/);assert.deepEqual(await snapshot(db),prior);}
});
await test('no caller can claim terminal completion, cancellation or no-show through repair',async()=>{
  for(const target of['abgeschlossen','storniert','nicht_erschienen']){await reset(db);await config(db,{portal:'business',internal:'true',admin:'true'});
    const prior=await snapshot(db);await assert.rejects(()=>call(db,target),/belegt/);assert.deepEqual(await snapshot(db),prior);}
});
await test('missing start cannot be bypassed with the former allow-service Boolean, including Admin',async()=>{
  await reset(db);await config(db,{portal:'business',internal:'true',admin:'true'});const prior=await snapshot(db);
  await assert.rejects(()=>call(db,'gestartet',{allow:true}),/Zeitbelege/);assert.deepEqual(await snapshot(db),prior);
  await assert.rejects(()=>call(db,'gestartet'),/belegt/);
});
await test('ended and terminal versions cannot regress, and inconsistent completed mirrors remain at the PDF gate',async()=>{
  await reset(db);await write(db,'UPDATE assist_visits SET actual_start_at=$1,actual_end_at=$2',[start,end]);await call(db,'beendet');
  let prior=await snapshot(db);await assert.rejects(()=>call(db,'pausiert'),/belegt/);assert.deepEqual(await snapshot(db),prior);
  await write(db,"UPDATE assist_visits SET canonical_status='completed'");prior=await snapshot(db);await assert.rejects(()=>call(db,'abgeschlossen'),/PDFkorrektur/);assert.deepEqual(await snapshot(db),prior);
  await write(db,"UPDATE assignments SET status='completed'; UPDATE assist_visit_execution_state SET assignment_status='abgeschlossen',current_step='completed'");
  prior=await snapshot(db);await call(db,'abgeschlossen');assert.deepEqual(await snapshot(db),prior);await assert.rejects(()=>call(db,'gestartet'),/Terminale/);
});
await test('does not pick a last recurrence or repair every linked Visit',async()=>{
  await reset(db);await write(db,'INSERT INTO assist_visits(id,tenant_id,legacy_assignment_id,employee_id,client_id,canonical_status) VALUES($1,$2,$3,$4,$5,$6)',[id.otherVisit,id.tenant,id.assignment,id.employee,id.client,'planned']);
  const prior=await snapshot(db);await assert.rejects(()=>call(db),/nicht eindeutig/);assert.deepEqual(await snapshot(db),prior);
});
await test('rejects inverted/future timestamps rather than generating missing proof evidence',async()=>{
  for(const values of[[end,start],['2099-01-01T08:00:00Z',null]]){
    await reset(db);await write(db,'UPDATE assist_visits SET actual_start_at=$1,actual_end_at=$2',values);const prior=await snapshot(db);await assert.rejects(()=>call(db,'beendet'),/Zeitbelege/);assert.deepEqual(await snapshot(db),prior);
  }
});
await test('requires the monotone reviewed guard at installation and every repair call',async()=>{
  await reset(db);await write(db,"COMMENT ON FUNCTION guard_assist_execution_state_regression() IS NULL");await assert.rejects(()=>call(db),/Execution-Guard/);
  await db.exec('RESET ROLE');await assert.rejects(()=>db.exec(repairDraft),/Execution-Guard/);await db.exec('ROLLBACK');
  await reset(db);await write(db,'ALTER TABLE assist_visit_execution_state DISABLE TRIGGER trg_guard_assist_execution_state_regression');await assert.rejects(()=>call(db),/Execution-Guard/);
});
await test('rolls back every status/timestamp projection if the audit transaction fails',async()=>{
  await reset(db);const prior=await snapshot(db);await assert.rejects(()=>call(db,'angekommen',{reason:'force_audit_failure'}));assert.deepEqual(await snapshot(db),prior);
});
await test('the repaired function is unavailable to PUBLIC and anon',async()=>{
  await reset(db);const acl=(await db.query("SELECT has_function_privilege('anon','repair_assist_visit_workflow_status(uuid,uuid,text,text,uuid,boolean)','EXECUTE') AS anon,has_function_privilege('authenticated','repair_assist_visit_workflow_status(uuid,uuid,text,text,uuid,boolean)','EXECUTE') AS auth")).rows[0];
  assert.deepEqual(acl,{anon:false,auth:true});
});
await db.close();
