// Current captured SQL/policies/grants, isolated PGlite and synthetic rows only.
// No network, business data, old workflow draft activation or new infrastructure.
// Auth/JWT/platform access are controlled session inputs. Other RLS/triggers,
// complete table shapes, Storage/Realtime and end-to-end flows are not modeled.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const read = name => readFileSync(new URL('../../docs/store/' + name, import.meta.url), 'utf8');
const catalog = JSON.parse(read('android-workflow-rls-catalog-20261026.json'));
const draft = read('android-workflow-rls-ceilings-review.sql');
const db = new PGlite();
const id = n => '10000000-0000-4000-8000-' + String(n).padStart(12, '0');
const tenant = id(1), foreign = id(2), employee = id(10), colleague = id(11), client = id(20), otherClient = id(21);
const roles = {office:id(30), owner:id(31), client:id(32)};
const actors = {
  employee:{uid:id(40), profile:id(50), portal:'employee', account:id(60), role:roles.owner},
  client:{uid:id(41), profile:id(51), portal:'client', account:id(61), role:roles.owner},
  relative:{uid:id(42), profile:id(52), portal:'relative', account:id(62), role:roles.client},
  code:{uid:id(43), profile:id(53), portal:'client', account:id(63), role:roles.client},
  office:{uid:id(44), profile:id(54), portal:'', account:null, role:roles.office},
};
const assignment = id(70), otherAssignment = id(71), foreignAssignment = id(72);
const ownVisit = id(80), otherVisit = id(81), draftVisit = id(82), foreignVisit = id(83), legacyVisit = id(84), inconsistentVisit = id(85);
const state = id(90), otherState = id(91), draftState = id(92), foreignState = id(93), legacyState = id(94), inconsistentState = id(95);
await db.exec(`
CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA auth; CREATE SCHEMA care_security;
GRANT USAGE ON SCHEMA public,auth,care_security TO authenticated,anon,service_role;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.uid',true),'')::uuid $$;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('test.jwt',true),''),'{}')::jsonb $$;
CREATE FUNCTION platform_tenant_access_allowed(uuid,boolean DEFAULT true) RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT $1 IS NOT NULL AND coalesce(current_setting('test.platform',true),'true')='true' $$;
CREATE TABLE roles(id uuid PRIMARY KEY,tenant_id uuid,key text,is_admin_role boolean DEFAULT false);
CREATE TABLE profiles(id uuid PRIMARY KEY,auth_user_id uuid,tenant_id uuid,role_id uuid,status text DEFAULT 'active',is_active boolean DEFAULT true);
CREATE TABLE tenant_users(id uuid PRIMARY KEY,tenant_id uuid,auth_user_id uuid,status text DEFAULT 'active',must_change_password boolean DEFAULT false,first_login_completed boolean DEFAULT true);
CREATE TABLE tenant_memberships(tenant_id uuid,user_id uuid,is_active boolean);
CREATE TABLE employees(id uuid PRIMARY KEY,tenant_id uuid,profile_id uuid,status text DEFAULT 'active',deleted_at timestamptz,portal_enabled boolean DEFAULT true);
CREATE TABLE employee_portal_accounts(id uuid PRIMARY KEY,tenant_id uuid,employee_id uuid,auth_user_id uuid,status text DEFAULT 'active',must_change_password boolean DEFAULT false,first_login_completed boolean DEFAULT true,updated_at timestamptz DEFAULT now());
CREATE TABLE clients(id uuid PRIMARY KEY,tenant_id uuid);
CREATE TABLE client_portal_access(id uuid PRIMARY KEY,tenant_id uuid,client_id uuid,auth_user_id uuid,status text DEFAULT 'aktiv',portal_enabled boolean DEFAULT true,account_kind text DEFAULT 'self',access_scope text DEFAULT 'client');
CREATE TABLE client_portal_codes(id uuid PRIMARY KEY,tenant_id uuid,client_id uuid,auth_user_id uuid,status text DEFAULT 'active',expires_at timestamptz);
CREATE TABLE relative_portal_codes(id uuid PRIMARY KEY,tenant_id uuid,client_id uuid,auth_user_id uuid,status text DEFAULT 'active',expires_at timestamptz,created_at timestamptz DEFAULT now());
CREATE TABLE portal_access_permissions(id uuid PRIMARY KEY,tenant_id uuid,portal_type text,portal_account_id uuid,can_view_appointments boolean,updated_at timestamptz DEFAULT now());
CREATE TABLE assignments(id uuid PRIMARY KEY,tenant_id uuid,employee_id uuid,client_id uuid,status text DEFAULT 'planned',title text DEFAULT 'Synthetic');
CREATE TABLE assist_visits(id uuid PRIMARY KEY,tenant_id uuid,employee_id uuid,client_id uuid,legacy_assignment_id uuid,planning_status text DEFAULT 'released');
CREATE TABLE assist_visit_execution_state(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid,visit_id uuid,current_step text DEFAULT 'consent',UNIQUE(tenant_id,visit_id));
SET check_function_bodies=off;
`);
for (const f of catalog.functions) await db.exec(f.definition);
await db.exec('SET check_function_bodies=on');
for (const [name, rid] of Object.entries(roles)) await db.query('INSERT INTO roles VALUES($1,$2,$3,$4)', [rid, tenant, name, name === 'owner']);
for (const a of Object.values(actors)) await db.query('INSERT INTO profiles(id,auth_user_id,tenant_id,role_id) VALUES($1,$2,$3,$4)', [a.profile, a.uid, tenant, a.role]);
await db.query('INSERT INTO employees(id,tenant_id,profile_id) VALUES($1,$2,$3),($4,$2,NULL)',[employee,tenant,actors.employee.profile,colleague]);
await db.query('INSERT INTO employee_portal_accounts(id,tenant_id,employee_id,auth_user_id) VALUES($1,$2,$3,$4)',[actors.employee.account,tenant,employee,actors.employee.uid]);
await db.query('INSERT INTO clients VALUES($1,$2),($3,$2),($4,$5)',[client,tenant,otherClient,id(22),foreign]);
await db.query('INSERT INTO client_portal_access(id,tenant_id,client_id,auth_user_id) VALUES($1,$2,$3,$4)',[actors.client.account,tenant,client,actors.client.uid]);
await db.query('INSERT INTO client_portal_codes(id,tenant_id,client_id,auth_user_id) VALUES($1,$2,$3,$4)',[actors.code.account,tenant,client,actors.code.uid]);
await db.query('INSERT INTO relative_portal_codes(id,tenant_id,client_id,auth_user_id) VALUES($1,$2,$3,$4)',[actors.relative.account,tenant,client,actors.relative.uid]);
await db.query("INSERT INTO portal_access_permissions(id,tenant_id,portal_type,portal_account_id,can_view_appointments) VALUES($1,$2,'relative',$3,true)",[id(65),tenant,actors.relative.account]);
// An active second-tenant membership demonstrates that tenant membership is
// insufficient to authorize the current portal's execution-state requests.
await db.query('INSERT INTO tenant_memberships VALUES($1,$2,true),($1,$3,true)',[foreign,actors.employee.uid,actors.client.uid]);
for (const [aid,t,e,c] of [[assignment,tenant,employee,client],[otherAssignment,tenant,colleague,otherClient],[foreignAssignment,foreign,colleague,id(22)]])
  await db.query('INSERT INTO assignments(id,tenant_id,employee_id,client_id) VALUES($1,$2,$3,$4)',[aid,t,e,c]);
for (const [vid,t,e,c,legacy,planning] of [
  [ownVisit,tenant,employee,client,null,'released'],[otherVisit,tenant,colleague,otherClient,null,'released'],
  [draftVisit,tenant,employee,client,assignment,'draft'],[foreignVisit,foreign,colleague,id(22),null,'released'],
  [legacyVisit,tenant,null,client,assignment,'released'],[inconsistentVisit,tenant,colleague,client,assignment,'released'],
]) await db.query('INSERT INTO assist_visits VALUES($1,$2,$3,$4,$5,$6)',[vid,t,e,c,legacy,planning]);
for (const [sid,t,vid] of [[state,tenant,ownVisit],[otherState,tenant,otherVisit],[draftState,tenant,draftVisit],[foreignState,foreign,foreignVisit],[legacyState,tenant,legacyVisit],[inconsistentState,tenant,inconsistentVisit]])
  await db.query('INSERT INTO assist_visit_execution_state(id,tenant_id,visit_id) VALUES($1,$2,$3)',[sid,t,vid]);
for (const table of ['assignments','assist_visit_execution_state']) await db.exec('ALTER TABLE '+table+' ENABLE ROW LEVEL SECURITY');
const privileges = {sel:'SELECT',ins:'INSERT',upd:'UPDATE',del:'DELETE'};
for (const g of catalog.effectivePrivileges) for (const [key,priv] of Object.entries(privileges))
  if (g[key]) await db.exec(`GRANT ${priv} ON ${g.relation} TO ${g.role}`);
for (const p of catalog.policies) await db.exec(`CREATE POLICY "${p.policyname}" ON ${p.tablename} AS ${p.permissive} FOR ${p.cmd} TO ${p.roles.slice(1,-1)}${p.qual?' USING ('+p.qual+')':''}${p.with_check?' WITH CHECK ('+p.with_check+')':''}`);

const owner = () => db.exec('RESET ROLE');
async function actor(name='employee', changes={}) {
  await owner();
  const a={...actors[name],...changes};
  await db.query("SELECT set_config('test.uid',$1,false),set_config('test.jwt',$2,false),set_config('test.platform',$3,false)",
    [a.uid??'',JSON.stringify({app_metadata:{portal_type:a.portal,portal_account_id:a.account,tenant_id:a.claimTenant??tenant,role_key:a.roleClaim??''}}),a.platform??'true']);
  await db.exec('SET ROLE authenticated');
}
const ids = async table => (await db.query('SELECT id FROM '+table+' ORDER BY id')).rows.map(r=>r.id);
const write = async (sql,params=[]) => (await db.query(sql+' RETURNING id',params)).rows;
const snapshots = async () => (await db.exec('SELECT * FROM assignments ORDER BY id; SELECT * FROM assist_visit_execution_state ORDER BY id')).map(result=>result.rows);
async function catalogState() {
  return (await db.query("SELECT tablename,policyname,permissive,cmd,roles,qual,with_check FROM pg_policies WHERE tablename IN ('assignments','assist_visit_execution_state') AND policyname NOT LIKE 'android_workflow_%' ORDER BY 1,2")).rows;
}
async function checkPrivileges() {
  for (const g of catalog.effectivePrivileges) for (const [key,priv] of Object.entries(privileges))
    assert.equal((await db.query('SELECT has_table_privilege($1,$2,$3) AS allowed',[g.role,g.relation,priv])).rows[0].allowed,g[key],`${g.role} ${g.relation} ${priv}`);
}

await test('current permissive OR exposes same-tenant assignments and other-tenant member execution state',async()=>{
  await actor(); assert.deepEqual(await ids('assignments'),[assignment,otherAssignment]);
  assert.deepEqual(await ids('assist_visit_execution_state'),[state,otherState,draftState,foreignState,legacyState,inconsistentState]);
  await actor('client'); assert.deepEqual(await ids('assignments'),[assignment,otherAssignment]);
  assert.deepEqual(await write("UPDATE assist_visit_execution_state SET current_step='in_service' WHERE id=$1",[otherState]),[{id:otherState}]);
  await owner(); await db.query("UPDATE assist_visit_execution_state SET current_step='consent' WHERE id=$1",[otherState]);
});
await test('current admin ALL permits portal-admin foreign assignment CRUD; own policy permits client re-parenting',async()=>{
  await actor('client');
  assert.deepEqual(await write("UPDATE assignments SET title='changed' WHERE id=$1",[otherAssignment]),[{id:otherAssignment}]);
  await db.query('INSERT INTO assignments(id,tenant_id,employee_id,client_id) VALUES($1,$2,$3,$4)',[id(170),tenant,colleague,otherClient]);
  assert.deepEqual(await write('DELETE FROM assignments WHERE id=$1',[id(170)]),[{id:id(170)}]);
  await actor(); assert.deepEqual(await write('UPDATE assignments SET client_id=$1 WHERE id=$2',[otherClient,assignment]),[{id:assignment}]);
  await owner(); await db.query('UPDATE assignments SET client_id=$1 WHERE id=$2',[client,assignment]);
  await db.query("UPDATE assignments SET title='Synthetic'");
});
await test('current employee helper accepts pending first login in the own UPDATE policy without admin authority',async()=>{
  await owner(); await db.query('UPDATE profiles SET role_id=$1 WHERE id=$2',[roles.client,actors.employee.profile]);
  await db.query("UPDATE employee_portal_accounts SET status='pending_first_login',must_change_password=true,first_login_completed=false WHERE id=$1",[actors.employee.account]);
  await actor(); assert.equal((await db.query('SELECT is_tenant_admin() AS admin')).rows[0].admin,false);
  assert.deepEqual(await write("UPDATE assignments SET title='pending update' WHERE id=$1",[assignment]),[{id:assignment}]);
  await owner(); await db.query('UPDATE profiles SET role_id=$1 WHERE id=$2',[actors.employee.role,actors.employee.profile]);
  await db.query("UPDATE employee_portal_accounts SET status='active',must_change_password=false,first_login_completed=true WHERE id=$1",[actors.employee.account]);
  await db.query("UPDATE assignments SET title='Synthetic'");
});
await test('review applies twice without changing captured policies, grants or rows',async()=>{
  await owner(); const before=await catalogState();
  const rowsBefore=await snapshots();
  await checkPrivileges(); await db.exec(draft); await db.exec(draft);
  assert.deepEqual(await catalogState(),before); await checkPrivileges();
  assert.deepEqual(await snapshots(),rowsBefore);
});
await test('active own employee reads/updates own assignment and canonical/legacy own execution only',async()=>{
  await actor(); assert.deepEqual(await ids('assignments'),[assignment]);
  assert.deepEqual(await ids('assist_visit_execution_state'),[state,legacyState]);
  assert.deepEqual(await write("UPDATE assignments SET status='started' WHERE id=$1",[assignment]),[{id:assignment}]);
  assert.deepEqual(await write("UPDATE assist_visit_execution_state SET current_step='in_service' WHERE id=$1",[state]),[{id:state}]);
  assert.deepEqual(await write("UPDATE assignments SET title='forbidden' WHERE id=$1",[otherAssignment]),[]);
  assert.deepEqual(await write("UPDATE assist_visit_execution_state SET current_step='in_service' WHERE id=$1",[otherState]),[]);
  await assert.rejects(db.query('INSERT INTO assignments(id,tenant_id,employee_id,client_id) VALUES($1,$2,$3,$4)',[id(178),tenant,employee,client]),/row-level security/i);
  assert.deepEqual(await write('DELETE FROM assignments WHERE id=$1',[assignment]),[]);
});
for (const name of ['client','code','relative']) await test(`${name} reads own assignment status and has no direct execution-state or assignment write access`,async()=>{
  await actor(name); assert.deepEqual(await ids('assignments'),[assignment]);
  assert.deepEqual(await ids('assist_visit_execution_state'),[]);
  assert.deepEqual(await write("UPDATE assignments SET status='completed' WHERE id=$1",[assignment]),[]);
  assert.deepEqual(await write('DELETE FROM assignments WHERE id=$1',[assignment]),[]);
  await assert.rejects(db.query('INSERT INTO assignments(id,tenant_id,client_id) VALUES($1,$2,$3)',[id(171),tenant,client]),/row-level security/i);
  await assert.rejects(db.query('INSERT INTO assist_visit_execution_state(tenant_id,visit_id) VALUES($1,$2)',[tenant,ownVisit]),/row-level security/i);
});
await test('verified Business retains current-tenant planning CRUD and execution read/upsert',async()=>{
  await actor('office'); assert.deepEqual(await ids('assignments'),[assignment,otherAssignment]);
  assert.deepEqual(await ids('assist_visit_execution_state'),[state,otherState,draftState,legacyState,inconsistentState]);
  await db.query('INSERT INTO assignments(id,tenant_id,employee_id,client_id) VALUES($1,$2,$3,$4)',[id(172),tenant,colleague,otherClient]);
  assert.deepEqual(await write('UPDATE assignments SET employee_id=$1,client_id=$2 WHERE id=$3',[employee,client,id(172)]),[{id:id(172)}]);
  assert.deepEqual(await write('DELETE FROM assignments WHERE id=$1',[id(172)]),[{id:id(172)}]);
  assert.deepEqual(await write("UPDATE assist_visit_execution_state SET current_step='tasks' WHERE id=$1",[otherState]),[{id:otherState}]);
  await owner(); await db.query('INSERT INTO assist_visits(id,tenant_id,client_id) VALUES($1,$2,$3)',[id(180),tenant,otherClient]);
  await actor('office');
  assert.deepEqual((await db.query("INSERT INTO assist_visit_execution_state(tenant_id,visit_id,current_step) VALUES($1,$2,'consent') ON CONFLICT(tenant_id,visit_id) DO UPDATE SET current_step=excluded.current_step RETURNING visit_id",[tenant,id(180)])).rows,[{visit_id:id(180)}]);
  await owner(); await db.query('DELETE FROM assist_visit_execution_state WHERE visit_id=$1',[id(180)]); await db.query('DELETE FROM assist_visits WHERE id=$1',[id(180)]);
});
await test('employee execution upsert succeeds; drafts and conflicting canonical ownership fail closed',async()=>{
  await owner(); await db.query('INSERT INTO assist_visits(id,tenant_id,employee_id,client_id) VALUES($1,$2,$3,$4)',[id(181),tenant,employee,client]);
  await actor();
  for (let attempt=0;attempt<2;attempt++) assert.deepEqual((await db.query("INSERT INTO assist_visit_execution_state(tenant_id,visit_id,current_step) VALUES($1,$2,'consent') ON CONFLICT(tenant_id,visit_id) DO UPDATE SET current_step=excluded.current_step RETURNING visit_id",[tenant,id(181)])).rows,[{visit_id:id(181)}]);
  assert.equal((await db.query("INSERT INTO assist_visit_execution_state(tenant_id,visit_id,current_step) VALUES($1,$2,'tasks') ON CONFLICT(tenant_id,visit_id) DO UPDATE SET current_step=excluded.current_step RETURNING id",[tenant,ownVisit])).rows[0].id,state);
  for(const vid of [otherVisit,draftVisit,inconsistentVisit,foreignVisit])
    await assert.rejects(db.query("INSERT INTO assist_visit_execution_state(tenant_id,visit_id,current_step) VALUES($1,$2,'tasks') ON CONFLICT(tenant_id,visit_id) DO UPDATE SET current_step=excluded.current_step",[tenant,vid]),/row-level security/i);
  await owner(); await db.query('DELETE FROM assist_visit_execution_state WHERE visit_id=$1',[id(181)]); await db.query('DELETE FROM assist_visits WHERE id=$1',[id(181)]);
});
await test('portal identity fields cannot be re-parented, even to another own client/visit',async()=>{
  await actor();
  for (const [field,value] of [['id',id(173)],['tenant_id',foreign],['employee_id',colleague],['client_id',otherClient]])
    await assert.rejects(db.query(`UPDATE assignments SET ${field}=$1 WHERE id=$2`,[value,assignment]),/Zuordnung|row-level security/i);
  for (const [field,value] of [['id',id(174)],['tenant_id',foreign],['visit_id',legacyVisit]])
    await assert.rejects(db.query(`UPDATE assist_visit_execution_state SET ${field}=$1 WHERE id=$2`,[value,state]),/Zuordnung|row-level security/i);
});
await test('all actors deny foreign tenant rows and mismatched visit tenants; missing auth and invalid JWT scope deny',async()=>{
  for (const name of Object.keys(actors)) {
    await actor(name); assert.equal((await ids('assignments')).includes(foreignAssignment),false);
    assert.equal((await ids('assist_visit_execution_state')).includes(foreignState),false);
    assert.deepEqual(await write("UPDATE assist_visit_execution_state SET current_step='tasks' WHERE id=$1",[foreignState]),[]);
    await assert.rejects(db.query('INSERT INTO assist_visit_execution_state(tenant_id,visit_id) VALUES($1,$2)',[tenant,foreignVisit]),/row-level security/i);
    await assert.rejects(db.query('INSERT INTO assignments(id,tenant_id,client_id) VALUES($1,$2,$3)',[id(175),foreign,id(22)]),/row-level security/i);
  }
  for (const changes of [{uid:null},{account:id(999)},{portal:'unknown'},{platform:'false'},{roleClaim:'employee_portal',portal:''}]) {
    await actor('employee',changes); assert.deepEqual(await ids('assignments'),[]); assert.deepEqual(await ids('assist_visit_execution_state'),[]);
  }
});
await test('revoked/pending/password-reset employee accounts and inactive/unbound profiles deny with retained JWT',async()=>{
  for (const [table,field,value] of [
    ['employee_portal_accounts','status','blocked'],['employee_portal_accounts','status','pending_first_login'],
    ['employee_portal_accounts','status','password_reset_required'],['employee_portal_accounts','must_change_password',true],
    ['employee_portal_accounts','first_login_completed',false],['employees','portal_enabled',false],['employees','status','inactive'],
    ['employees','deleted_at','2026-01-01'],['profiles','status','blocked'],['profiles','is_active',false],
    ['profiles','auth_user_id',id(999)],
  ]) {
    await owner(); const rid=table==='profiles'?actors.employee.profile:table==='employees'?employee:actors.employee.account;
    const previous=(await db.query(`SELECT ${field} FROM ${table} WHERE id=$1`,[rid])).rows[0][field];
    await db.query(`UPDATE ${table} SET ${field}=$1 WHERE id=$2`,[value,rid]);
    await actor(); assert.deepEqual(await ids('assignments'),[],`${table}.${field}`); assert.deepEqual(await ids('assist_visit_execution_state'),[]);
    await owner(); await db.query(`UPDATE ${table} SET ${field}=$1 WHERE id=$2`,[previous,rid]);
  }
});
await test('disabled client account, expired code and revoked latest relative appointment permission deny',async()=>{
  await owner(); await db.query('UPDATE client_portal_access SET portal_enabled=false WHERE id=$1',[actors.client.account]);
  await actor('client'); assert.deepEqual(await ids('assignments'),[]);
  await owner(); await db.query('UPDATE client_portal_access SET portal_enabled=true WHERE id=$1',[actors.client.account]);
  await db.query("UPDATE client_portal_codes SET expires_at=now()-interval '1 hour'");
  await actor('code'); assert.deepEqual(await ids('assignments'),[]);
  await owner(); await db.query('UPDATE client_portal_codes SET expires_at=NULL');
  await db.query("INSERT INTO portal_access_permissions VALUES($1,$2,'relative',$3,false,now()+interval '1 minute')",[id(66),tenant,actors.relative.account]);
  await actor('relative'); assert.deepEqual(await ids('assignments'),[]);
  await owner(); await db.query('DELETE FROM portal_access_permissions WHERE id=$1',[id(66)]);
});
await test('pending Business identity and duplicate active employee auth profiles fail closed',async()=>{
  await owner(); await db.query("INSERT INTO tenant_users VALUES($1,$2,$3,'active',true,false)",[id(176),tenant,actors.office.uid]);
  await actor('office'); assert.deepEqual(await ids('assignments'),[]);
  await owner(); await db.query('DELETE FROM tenant_users');
  await db.query('INSERT INTO profiles(id,auth_user_id,tenant_id,role_id) VALUES($1,$2,$3,$4)',[id(177),actors.employee.uid,tenant,roles.owner]);
  await actor(); assert.deepEqual(await ids('assignments'),[]); assert.deepEqual(await ids('assist_visit_execution_state'),[]);
  await owner(); await db.query('DELETE FROM profiles WHERE id=$1',[id(177)]);
});
await test('fresh-catalog gate aborts policy, privilege or actor-helper drift before changing reviewed objects',async()=>{
  await owner();
  async function aborts(pattern) {
    try { await assert.rejects(db.exec(draft),pattern); }
    finally { await db.exec('ROLLBACK'); }
  }
  const policy=catalog.policies.find(p=>p.policyname==='assignments_select_own_tenant');
  await db.exec('ALTER POLICY assignments_select_own_tenant ON assignments USING(true)');
  await aborts(/policies changed/i);
  await db.exec('ALTER POLICY assignments_select_own_tenant ON assignments USING('+policy.qual+')');
  await db.exec('REVOKE INSERT ON assignments FROM authenticated');
  await aborts(/privileges changed/i);
  await db.exec('GRANT INSERT ON assignments TO authenticated');
  await db.exec('CREATE OR REPLACE FUNCTION is_tenant_admin() RETURNS boolean LANGUAGE sql AS $$ SELECT false $$');
  await aborts(/actor helper changed/i);
  await db.exec(catalog.functions.find(f=>f.proname==='is_tenant_admin').definition);
  await db.exec(draft);
  await actor(); assert.deepEqual(await ids('assignments'),[assignment]);
});
await test('table privileges remain exact, including no anon access and no service-role execution-state grant',async()=>{
  await owner(); await checkPrivileges();
  await db.exec('SET ROLE anon'); await assert.rejects(db.query('SELECT * FROM assignments'),/permission denied/i);
  await owner(); await db.exec('SET ROLE service_role'); await assert.rejects(db.query('SELECT * FROM assist_visit_execution_state'),/permission denied/i);
  await owner();
});
await db.close();
