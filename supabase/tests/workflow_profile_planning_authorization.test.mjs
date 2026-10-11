// Authorization-frontgate proof only: captured planning headers and entry checks,
// actual captured identity/membership/permission helpers, synthetic planning body.
// Complete assignment/calendar/task scheduling is not executed or claimed.
// The full draft bodies are separately checked against the captured originals
// and loaded/applied three times in isolated PGlite. No remote writes/data.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
const require = createRequire(import.meta.url);
const { PGlite } = require('@electric-sql/pglite');
const db = new PGlite();
const read = path => readFileSync(new URL('../../' + path, import.meta.url), 'utf8');
const metadata = JSON.parse(read('docs/workflow-server-write-rpc-metadata-20261011.json'));
const permissionMetadata = JSON.parse(read('docs/workflow-server-permission-metadata-20261011.json'));
const personnelMetadata = JSON.parse(read('docs/workflow-server-personnel-metadata-20261011.json'));
const membershipMetadata = JSON.parse(read('docs/workflow-server-identity-helper-metadata-20261011.json'));
const identityDraft = read('docs/workflow-server-identity-draft.sql');
const draft = read('docs/workflow-server-profile-planning-authorization-draft.sql');
const normalize = source => source.replaceAll('\r\n', '\n');
function definition(source, name) {
  const start = source.indexOf('CREATE OR REPLACE FUNCTION public.' + name + '(');
  assert.ok(start >= 0, 'function source required: ' + name);
  const tail = source.slice(start);
  const delimiter = tail.match(/\bAS\s+(\$[\w]*\$)/);
  assert.ok(delimiter, 'dollar-quoted body required');
  const bodyStart = delimiter.index + delimiter[0].length;
  const end = tail.indexOf(delimiter[1], bodyStart);
  assert.ok(end > bodyStart);
  return tail.slice(0, end + delimiter[1].length);
}
const guardPattern = /  -- workflow-profile-planning-auth-v1 BEGIN\n[\s\S]*?  -- workflow-profile-planning-auth-v1 END\n/;
const names = ['schedule_client_assignment_profile', 'schedule_client_assignment_profile_legacy_core'];
const writers = names.map(name => ({
  name, signature: `public.${name}(uuid,uuid,date,time)`,
  original: normalize(metadata.functions.find(f => f.name === name).definition).trim().replace(/;$/, ''),
  patched: normalize(definition(draft, name)),
}));
const ids = {
  tenant: '10000000-0000-4000-8000-000000000001',
  foreignTenant: '10000000-0000-4000-8000-000000000002',
  user: '20000000-0000-4000-8000-000000000001',
  foreignUser: '20000000-0000-4000-8000-000000000002',
  actorProfile: '30000000-0000-4000-8000-000000000001',
  profile: '40000000-0000-4000-8000-000000000001',
  foreignProfile: '40000000-0000-4000-8000-000000000002',
  manageRole: '50000000-0000-4000-8000-000000000001',
  readonlyRole: '50000000-0000-4000-8000-000000000002',
  account: '60000000-0000-4000-8000-000000000001',
};
await db.exec(`
CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA auth;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS
 $$SELECT current_setting('fixture.jwt',true)::jsonb$$;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
 $$SELECT nullif(auth.jwt()->>'sub','')::uuid$$;
CREATE TABLE roles(id uuid PRIMARY KEY,tenant_id uuid,key text,is_admin_role boolean);
CREATE TABLE profiles(id uuid PRIMARY KEY,auth_user_id uuid,tenant_id uuid,role_id uuid,status text,is_active boolean);
CREATE TABLE role_permissions(role_id uuid,tenant_id uuid,permission_key text,
 can_view boolean,can_create boolean,can_update boolean,can_delete boolean);
CREATE TABLE tenant_users(id uuid,tenant_id uuid,auth_user_id uuid,status text,must_change_password boolean,first_login_completed boolean);
CREATE TABLE tenant_memberships(tenant_id uuid,user_id uuid,is_active boolean,role_key text);
CREATE TABLE employee_portal_accounts(id uuid,tenant_id uuid,auth_user_id uuid,status text);
CREATE TABLE client_portal_access(id uuid,tenant_id uuid,auth_user_id uuid,portal_enabled boolean,status text);
CREATE TABLE client_portal_codes(id uuid,tenant_id uuid,auth_user_id uuid,status text,expires_at timestamptz);
CREATE TABLE relative_portal_codes(id uuid,tenant_id uuid,auth_user_id uuid,status text,expires_at timestamptz);
CREATE TABLE platform_tenants(tenant_id uuid,status text);
CREATE TABLE platform_account_access_states(tenant_id uuid,tenant_user_id uuid,state text);
CREATE FUNCTION is_platform_user() RETURNS boolean LANGUAGE sql AS $$SELECT false$$;
-- Only row-type compilation is needed here; no original planning body is run.
CREATE TABLE client_assignment_profiles(id uuid);
CREATE TABLE assignments(id uuid);
CREATE TABLE fixture_planning_writes(id uuid DEFAULT gen_random_uuid(),source text,tenant_id uuid,
 assignment_profile_id uuid,assignment_date date,start_time time,actor_uid uuid);
GRANT USAGE ON SCHEMA public,auth TO authenticated,anon,service_role;
`);
async function loadCaptured(collection, name) {
  const row = collection.find(f => f.name === name);
  assert.ok(row, 'captured helper required: ' + name);
  await db.exec(row.definition);
}
await loadCaptured(personnelMetadata.helpers, 'current_portal_type');
await loadCaptured(personnelMetadata.helpers, 'current_portal_account_id');
await loadCaptured(membershipMetadata.helpers, 'platform_tenant_access_allowed');
await loadCaptured(membershipMetadata.helpers, 'is_tenant_member');
await loadCaptured(permissionMetadata.functions, 'current_tenant_id');
await loadCaptured(permissionMetadata.functions, 'resolve_current_profile_id');
await loadCaptured(personnelMetadata.helpers, 'is_tenant_admin');
await loadCaptured(permissionMetadata.functions, 'has_permission');
async function claims(changes = {}, role = 'authenticated') {
  await db.exec('RESET ROLE');
  const payload = {
    sub: ids.user,
    app_metadata: { portal_type: 'business', portal_account_id: ids.account, tenant_id: ids.tenant },
    user_metadata: { tenant_id: ids.foreignTenant, role_key: 'owner' },
    ...changes,
  };
  await db.query("SELECT set_config('fixture.jwt',$1,false)", [JSON.stringify(payload)]);
  await db.exec('SET ROLE ' + role);
}
async function reset(changes = {}, role = 'authenticated') {
  await db.exec(`RESET ROLE; TRUNCATE fixture_planning_writes,roles,profiles,role_permissions,tenant_users,
    tenant_memberships,employee_portal_accounts,client_portal_access,client_portal_codes,relative_portal_codes,
    platform_tenants,platform_account_access_states`);
  await db.query('INSERT INTO roles VALUES($1,$2,$3,false),($4,$5,$6,false)',
    [ids.manageRole,ids.tenant,'planner',ids.readonlyRole,ids.foreignTenant,'readonly']);
  await db.query("INSERT INTO profiles VALUES($1,$2,$3,$4,'active',true)",
    [ids.actorProfile,ids.user,ids.tenant,ids.manageRole]);
  await db.query("INSERT INTO role_permissions VALUES($1,$2,'assist.assignments.manage',true,true,true,false)",
    [ids.manageRole,ids.tenant]);
  await db.query("INSERT INTO tenant_users VALUES($1,$2,$3,'active',false,true)", [ids.account,ids.tenant,ids.user]);
  await db.query("INSERT INTO tenant_memberships VALUES($1,$2,true,'planner'),($3,$2,true,'readonly')",
    [ids.tenant,ids.user,ids.foreignTenant]);
  await db.query("INSERT INTO employee_portal_accounts VALUES($1,$2,$3,'active')", [ids.account,ids.tenant,ids.user]);
  await db.query("INSERT INTO client_portal_access VALUES($1,$2,$3,true,'aktiv')", [ids.account,ids.tenant,ids.user]);
  await db.query("INSERT INTO relative_portal_codes VALUES($1,$2,$3,'active',now()+interval '1 hour')", [ids.account,ids.tenant,ids.user]);
  await claims(changes, role);
}
async function snapshot() {
  await db.exec('RESET ROLE');
  return (await db.query('SELECT * FROM fixture_planning_writes ORDER BY id')).rows;
}
async function installFrontgateStub(writer, source) {
  const match = source.match(/\bAS\s+(\$[\w]*\$)/);
  const header = source.slice(0, match.index);
  const begin = source.indexOf('\nBEGIN\n');
  assert.ok(begin > 0);
  const remaining = source.slice(begin + '\nBEGIN\n'.length);
  const firstPlanningRead = remaining.search(/\n\s*SELECT\s+\*\s*\n\s*INTO v_profile/);
  assert.ok(firstPlanningRead > 0, 'captured planning-read boundary required');
  const entryChecks = remaining.slice(0, firstPlanningRead);
  // Deliberately replace only the downstream planning body in this fixture.
  await db.exec(`${header}AS $fixture$
BEGIN
${entryChecks}
 INSERT INTO fixture_planning_writes(source,tenant_id,assignment_profile_id,assignment_date,start_time,actor_uid)
 VALUES('${writer.name}',p_tenant_id,p_profile_id,p_assignment_date,p_start_time,auth.uid());
 RETURN jsonb_build_object('frontgateFixtureOnly',true,'source','${writer.name}',
  'tenantId',p_tenant_id,'profileId',p_profile_id,'date',p_assignment_date,'startTime',p_start_time,'actorUid',auth.uid());
END;
$fixture$;`);
  await db.exec(`REVOKE EXECUTE ON FUNCTION ${writer.signature} FROM PUBLIC,anon;
    GRANT EXECUTE ON FUNCTION ${writer.signature} TO authenticated,service_role;`);
}
const call = (writer, tenant = ids.tenant, profile = ids.profile) =>
  db.query(`SELECT public.${writer.name}($1::uuid,$2::uuid,$3::date,$4::time) AS result`,
    [tenant,profile,'2026-10-12','08:15:00']);
async function denyBoth() {
  for (const writer of writers) await assert.rejects(call(writer), /42501|erforderlich|Berechtigung|permission denied/i);
  assert.equal((await snapshot()).length, 0);
}
await test('both full draft bodies retain exact captured headers/defaults/returns and every original planning statement', async () => {
  assert.equal((draft.match(/CREATE OR REPLACE FUNCTION public\./g) ?? []).length, 2);
  for (const writer of writers) {
    assert.equal((writer.patched.match(/workflow-profile-planning-auth-v1 BEGIN/g) ?? []).length, 1);
    assert.equal(writer.patched.replace(guardPattern, ''), writer.original);
    assert.equal((writer.patched.match(/ DEFAULT /g) ?? []).length, 0);
    await db.exec(writer.original);
    await installFrontgateStub(writer, writer.original);
  }
});
for (const writer of writers) {
  await test('captured ' + writer.name + ' entry gate allows A permission plus read-only B membership before the draft', async () => {
    await reset();
    const scope = (await db.query(`SELECT auth.uid() AS actor,current_tenant_id() AS tenant,
      is_tenant_member($1::uuid) AS foreign_member,has_permission('assist.assignments.manage') AS can_manage`, [ids.foreignTenant])).rows[0];
    assert.deepEqual(scope, { actor: ids.user, tenant: ids.tenant, foreign_member: true, can_manage: true });
    const result = (await call(writer, ids.foreignTenant, ids.foreignProfile)).rows[0].result;
    assert.equal(result.tenantId, ids.foreignTenant);
    const rows = await snapshot();
    assert.equal(rows.length, 1);
    assert.equal(rows[0].tenant_id, ids.foreignTenant);
  });
}
await test('three full-draft applications preserve existing records and load the preserved full function definitions', async () => {
  const before = await snapshot();
  for (let pass = 0; pass < 3; pass++) await db.exec(draft);
  assert.deepEqual(await snapshot(), before);
  for (const writer of writers) {
    const row = (await db.query(`SELECT pg_get_functiondef(oid) AS definition,
      pg_get_function_identity_arguments(oid) AS args,pg_get_function_result(oid) AS result,
      pronargdefaults,prosecdef,proconfig FROM pg_proc WHERE oid=$1::regprocedure`, [writer.signature])).rows[0];
    assert.equal(row.args, metadata.functions.find(f => f.name === writer.name).args);
    assert.equal(row.pronargdefaults, 0);
    assert.equal(row.result, 'jsonb');
    assert.equal(row.prosecdef, true);
    assert.deepEqual(row.proconfig, ['search_path=public, pg_temp']);
    await installFrontgateStub(writer, normalize(row.definition));
  }
  // Same root-owned identity definitions required by the local planning draft.
  for (const name of ['current_tenant_id','resolve_current_profile_id','is_tenant_admin','has_permission']) {
    await db.exec(definition(identityDraft, name));
  }
});
for (const writer of writers) {
  await test(writer.name + ' denies A permission being used for B membership without any write', async () => {
    await reset();
    await assert.rejects(call(writer, ids.foreignTenant, ids.foreignProfile), /Aktives eigenes Firmenprofil/);
    assert.equal((await snapshot()).length, 0);
  });
  await test(writer.name + ' retains every typed input and JSON return for an authorized own-tenant actor', async () => {
    await reset();
    const result = (await call(writer)).rows[0].result;
    assert.deepEqual(result, { frontgateFixtureOnly: true, source: writer.name, tenantId: ids.tenant,
      profileId: ids.profile, date: '2026-10-12', startTime: '08:15:00', actorUid: ids.user });
    const [row] = await snapshot();
    assert.equal(row.assignment_profile_id, ids.profile);
    assert.equal(row.actor_uid, ids.user);
  });
}
await test('legacy business portal-type NULL retains its actual bound active profile and existing permission', async () => {
  await reset({ app_metadata: { tenant_id: ids.tenant } });
  for (const writer of writers) await call(writer);
  assert.equal((await snapshot()).length, 2);
});
await test('configured own-tenant admin planning permission stays allowed without a new admin bypass', async () => {
  await reset();
  await db.exec("RESET ROLE; UPDATE roles SET key='admin',is_admin_role=true WHERE key='planner'; SET ROLE authenticated");
  assert.equal((await db.query('SELECT is_tenant_admin() AS admin')).rows[0].admin, true);
  for (const writer of writers) await call(writer);
  await db.exec('RESET ROLE; DELETE FROM role_permissions; TRUNCATE fixture_planning_writes; SET ROLE authenticated');
  await denyBoth();
});
await test('client, employee and relative portals are denied even with the same actual tenant/profile', async () => {
  for (const portal of ['client','employee','relative']) {
    await reset({ app_metadata: { portal_type: portal, portal_account_id: ids.account, tenant_id: ids.tenant } });
    assert.equal((await db.query('SELECT current_tenant_id() AS tenant')).rows[0].tenant, ids.tenant);
    await denyBoth();
  }
});
await test('missing actual auth, NULL current tenant and NULL requested tenant deny both entry points without writes', async () => {
  await reset({ sub: '' });
  await denyBoth();
  await reset({ app_metadata: { portal_type: 'unsupported' } });
  assert.equal((await db.query('SELECT current_tenant_id() AS tenant')).rows[0].tenant, null);
  await denyBoth();
  await reset();
  for (const writer of writers) await assert.rejects(call(writer, null), /Aktives eigenes Firmenprofil/);
  assert.equal((await snapshot()).length, 0);
});
await test('inactive/unbound profiles and unready tenant users are denied without writes', async () => {
  for (const mutation of [
    "UPDATE profiles SET status='blocked'", 'UPDATE profiles SET is_active=false',
    `UPDATE profiles SET auth_user_id='${ids.foreignUser}'`,
    "UPDATE tenant_users SET status='inactive'", 'UPDATE tenant_users SET must_change_password=true',
    'UPDATE tenant_users SET first_login_completed=false', 'UPDATE tenant_users SET first_login_completed=NULL',
  ]) {
    await reset();
    await db.exec('RESET ROLE; ' + mutation + '; SET ROLE authenticated');
    await denyBoth();
  }
});
await test('own read-only role, missing membership and NULL permission are fail-closed', async () => {
  await reset();
  await db.exec('RESET ROLE; DELETE FROM role_permissions; SET ROLE authenticated');
  await denyBoth();
  await reset();
  await db.exec("RESET ROLE; UPDATE profiles SET auth_user_id=NULL,id='70000000-0000-4000-8000-000000000001'; DELETE FROM tenant_memberships; SET ROLE authenticated");
  await denyBoth();
  await reset();
  // A synthetic NULL-helper outage probes fail-closed handling; the captured
  // permission helper itself is not asserted to return NULL in production.
  await db.exec('RESET ROLE; CREATE OR REPLACE FUNCTION has_permission(p_permission_key text) RETURNS boolean LANGUAGE sql AS $$SELECT NULL::boolean$$; SET ROLE authenticated');
  await denyBoth();
  await db.exec('RESET ROLE');
  await db.exec(definition(identityDraft, 'has_permission'));
});
await test('anon remains unable to execute either planning API and produces no writes', async () => {
  await reset({ sub: '' }, 'anon');
  await denyBoth();
});
await test('current-tenant permission helper cannot borrow a different tenant profile role after scope changes', async () => {
  await reset();
  await db.exec(`RESET ROLE;
    UPDATE profiles SET tenant_id='${ids.foreignTenant}',role_id='${ids.readonlyRole}';
    INSERT INTO profiles VALUES('70000000-0000-4000-8000-000000000001','${ids.user}','${ids.tenant}','${ids.manageRole}','active',true);
    SET ROLE authenticated`);
  assert.equal((await db.query('SELECT current_tenant_id() AS tenant')).rows[0].tenant, ids.foreignTenant);
  assert.equal((await db.query("SELECT has_permission('assist.assignments.manage') AS can_manage")).rows[0].can_manage, false);
  for (const writer of writers) await assert.rejects(call(writer, ids.foreignTenant), /Aktives eigenes Firmenprofil/);
  assert.equal((await snapshot()).length, 0);
});
await db.close();
