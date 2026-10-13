// Synthetic Postgres security tests. No remote writes or real identities.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {test} from 'node:test';
const require=createRequire(import.meta.url);
const {PGlite}=require('@electric-sql/pglite');
const db=new PGlite();
const metadata=JSON.parse(readFileSync(new URL('../../docs/workflow-server-permission-metadata-20261011.json',import.meta.url),'utf8'));
const draft=readFileSync(new URL('../../docs/workflow-server-identity-draft.sql',import.meta.url),'utf8');
const t='10000000-0000-0000-0000-000000000001',other='10000000-0000-0000-0000-000000000002';
const user='20000000-0000-0000-0000-000000000001',admin='20000000-0000-0000-0000-000000000002';
const colleague='20000000-0000-0000-0000-000000000003';
const profile='30000000-0000-0000-0000-000000000001',adminProfile='30000000-0000-0000-0000-000000000002';
const ownRole='40000000-0000-0000-0000-000000000001',adminRole='40000000-0000-0000-0000-000000000002';
const foreignRole='40000000-0000-0000-0000-000000000003',globalRole='40000000-0000-0000-0000-000000000004';
await db.exec(`
CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
 'SELECT nullif(current_setting(''fixture.uid'',true),'''')::uuid';
CREATE FUNCTION current_tenant_id() RETURNS uuid LANGUAGE sql STABLE AS
 'SELECT nullif(current_setting(''fixture.tenant'',true),'''')::uuid';
CREATE FUNCTION current_portal_type() RETURNS text LANGUAGE sql STABLE AS
 'SELECT nullif(current_setting(''fixture.portal'',true),'''')';
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS
 'SELECT jsonb_build_object(''app_metadata'',jsonb_build_object(''portal_type'',current_portal_type(),''portal_account_id'',''30000000-0000-0000-0000-000000000001''))';
CREATE FUNCTION current_portal_account_id() RETURNS uuid LANGUAGE sql STABLE AS
 'SELECT ''30000000-0000-0000-0000-000000000001''::uuid';
CREATE FUNCTION platform_tenant_access_allowed(uuid,boolean DEFAULT true) RETURNS boolean LANGUAGE sql STABLE AS 'SELECT true';
CREATE TABLE roles(id uuid PRIMARY KEY,tenant_id uuid,key text,is_admin_role boolean DEFAULT false);
CREATE TABLE role_permissions(id uuid DEFAULT gen_random_uuid(),tenant_id uuid,role_id uuid,
 permission_key text,can_view boolean,can_create boolean,can_update boolean,can_delete boolean);
CREATE TABLE profiles(id uuid PRIMARY KEY,auth_user_id uuid,tenant_id uuid,role_id uuid,
 status text DEFAULT 'active',is_active boolean DEFAULT true,mfa_enabled boolean DEFAULT false,
 first_name text,last_name text,full_name text,display_name text,phone text,avatar_url text,
 preferred_product_key text,theme_preference text,locale text,timezone text,email text,
 terms_accepted_at timestamptz,privacy_accepted_at timestamptz,locked_at timestamptz,
 created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());
CREATE TABLE tenant_users(id uuid PRIMARY KEY,tenant_id uuid,auth_user_id uuid,role_key text,status text,
 must_change_password boolean DEFAULT false,first_login_completed boolean DEFAULT true);
CREATE TABLE employee_portal_accounts(id uuid PRIMARY KEY,tenant_id uuid,auth_user_id uuid,status text);
CREATE TABLE client_portal_codes(LIKE employee_portal_accounts INCLUDING ALL);
CREATE TABLE relative_portal_codes(LIKE employee_portal_accounts INCLUDING ALL);
CREATE TABLE client_portal_access(LIKE employee_portal_accounts INCLUDING ALL);
ALTER TABLE client_portal_access ADD portal_enabled boolean DEFAULT true;
ALTER TABLE client_portal_codes ADD expires_at timestamptz;
ALTER TABLE relative_portal_codes ADD expires_at timestamptz;
CREATE FUNCTION is_tenant_admin() RETURNS boolean LANGUAGE sql STABLE AS 'SELECT false';
GRANT USAGE ON SCHEMA public,auth TO authenticated,anon,service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated,service_role;
`);
for(const name of ['has_permission']) await db.exec(metadata.functions.find(f=>f.name===name).definition);
const adminOriginal=`CREATE OR REPLACE FUNCTION is_tenant_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
SELECT EXISTS(SELECT 1 FROM profiles p JOIN roles r ON r.id=p.role_id WHERE
(p.id=auth.uid() OR p.auth_user_id=auth.uid()) AND p.status IN ('active','invited')
AND (r.is_admin_role OR r.key IN ('owner','admin','management','geschaeftsfuehrung','business_admin'))) $$;`;
await db.exec(adminOriginal);
for(const [id,tenant,key,isAdmin] of [[ownRole,t,'employee',false],[adminRole,t,'owner',true],[foreignRole,other,'owner',true],[globalRole,null,'office',false]])
 await db.query('INSERT INTO roles VALUES($1,$2,$3,$4)',[id,tenant,key,isAdmin]);
for(const [role,tenant,key] of [[adminRole,t,'office.employees.edit'],[adminRole,t,'office.clients.edit'],[foreignRole,other,'office.access'],[globalRole,null,'office.documents.view']])
 await db.query('INSERT INTO role_permissions(tenant_id,role_id,permission_key,can_view,can_create,can_update,can_delete) VALUES($1,$2,$3,true,true,true,true)',[tenant,role,key]);
await db.query('INSERT INTO profiles(id,auth_user_id,tenant_id,role_id,first_name,email) VALUES($1,$2,$3,$4,\'Person\',\'synthetic@example.invalid\'),($5,$6,$3,$7,\'Admin\',\'admin@example.invalid\')',[profile,user,t,ownRole,adminProfile,admin,adminRole]);
for(const table of ['tenant_users','employee_portal_accounts','client_portal_codes','relative_portal_codes','client_portal_access'])
 await db.query('INSERT INTO '+table+'(id,tenant_id,auth_user_id,status) VALUES($1,$2,$3,\'active\')',[profile,t,user]);
await db.exec(`ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_update ON profiles FOR UPDATE TO authenticated USING(auth_user_id=auth.uid() OR id=auth.uid()) WITH CHECK(auth_user_id=auth.uid() OR id=auth.uid());
CREATE POLICY tenant_select ON profiles FOR SELECT TO authenticated USING(tenant_id=current_tenant_id() OR auth_user_id=auth.uid());
CREATE POLICY tenant_admin ON profiles FOR ALL TO authenticated USING(tenant_id=current_tenant_id() AND is_tenant_admin()) WITH CHECK(tenant_id=current_tenant_id() AND is_tenant_admin());`);
for(const table of ['roles','role_permissions','tenant_users','employee_portal_accounts','client_portal_codes','relative_portal_codes','client_portal_access'])
 await db.exec('ALTER TABLE '+table+' ENABLE ROW LEVEL SECURITY; CREATE POLICY permissive_tenant ON '+table+' FOR ALL TO authenticated USING(tenant_id=current_tenant_id() OR tenant_id IS NULL) WITH CHECK(tenant_id=current_tenant_id() OR tenant_id IS NULL);');
async function actor(uid=user,tenant=t,portal='employee'){
 await db.exec('RESET ROLE');
 await db.query("SELECT set_config('fixture.uid',$1,false),set_config('fixture.tenant',$2,false),set_config('fixture.portal',$3,false)",[uid??'',tenant??'',portal??'']);
 await db.exec('SET ROLE authenticated');
}
async function value(sql,params=[]){return (await db.query(sql,params)).rows[0];}
async function write(sql,params=[]){return (await db.query(sql+' RETURNING id',params)).rows;}
async function restore(){await db.exec('RESET ROLE');await db.query('UPDATE profiles SET role_id=$1,tenant_id=$2,status=\'active\',is_active=true WHERE id=$3',[ownRole,t,profile]);await actor();}
await test('installed semantics reproduce own-profile promotion before draft',async()=>{
 await actor();
 assert.equal((await value('SELECT has_permission(\'office.employees.edit\') AS ok')).ok,false);
 await write('UPDATE profiles SET role_id=$1 WHERE id=$2',[adminRole,profile]);
 assert.equal((await value('SELECT is_tenant_admin() AS ok')).ok,true);
 assert.equal((await value('SELECT has_permission(\'office.employees.edit\') AS ok')).ok,true);
 await restore();
});
await test('installed semantics reproduce role from foreign tenant and orphan invited profile',async()=>{
 await db.exec('RESET ROLE');
 await db.query('UPDATE profiles SET role_id=$1,tenant_id=NULL,status=\'invited\' WHERE id=$2',[foreignRole,profile]);
 await actor(user,null,null);
 assert.equal((await value('SELECT has_permission(\'office.access\') AS ok,is_tenant_admin() AS admin')).ok,true);
 await restore();
});
await test('draft applies twice without mutating synthetic business rows',async()=>{
 await db.exec('RESET ROLE');
 const before=(await db.query('SELECT * FROM profiles ORDER BY id')).rows;
 await db.exec(draft);await db.exec(draft);
 assert.deepEqual((await db.query('SELECT * FROM profiles ORDER BY id')).rows,before);
 await actor();
});
await test('safe names avatar and preferences remain writable with profile ID distinct from Auth UID',async()=>{
 assert.deepEqual(await write("UPDATE profiles SET first_name='Updated',avatar_url='safe.png',locale='de-DE',updated_at=now() WHERE id=$1",[profile]),[{id:profile}]);
});
await test('legacy ID collision cannot impersonate the explicitly bound Auth identity',async()=>{
 await db.exec('RESET ROLE');
 await db.query('INSERT INTO profiles(id,auth_user_id,tenant_id,role_id) VALUES($1,$2,$3,$4)',[user,colleague,t,adminRole]);
 await actor(user,t,null);
 assert.deepEqual(await value("SELECT resolve_current_profile_id() AS profile,current_tenant_id() AS tenant,current_role_key() AS role,is_tenant_admin() AS admin"),{profile,tenant:t,role:'employee',admin:false});
 assert.deepEqual(await write("UPDATE profiles SET first_name='spoofed' WHERE id=$1",[user]),[]);
 await db.exec('RESET ROLE');await db.query('DELETE FROM profiles WHERE id=$1',[user]);await actor();
});
for(const [field,valueToSet] of [['role_id',adminRole],['role_id',foreignRole],['tenant_id',other],['auth_user_id',colleague],['id',colleague],['email','changed@example.invalid'],['status','invited'],['mfa_enabled',true],['is_active',false]]){
 await test('direct self mutation of '+field+' is rejected ('+String(valueToSet)+')',async()=>{
  await actor(); await assert.rejects(db.query('UPDATE profiles SET '+field+'=$1 WHERE id=$2',[valueToSet,profile]),/42501|immutable|personal profile/i);
 });
}
await test('portal actor cannot insert a privileged profile or alter role permissions',async()=>{
 await actor();
 await assert.rejects(db.query('INSERT INTO profiles(id,auth_user_id,tenant_id,role_id) VALUES($1,$1,$2,$3)',[colleague,t,adminRole]),/row-level security|tenant administrator/i);
 assert.deepEqual(await write("UPDATE roles SET is_admin_role=true WHERE id=$1",[ownRole]),[]);
 assert.deepEqual((await db.query("UPDATE role_permissions SET permission_key='office.access' WHERE role_id=$1 RETURNING id",[adminRole])).rows,[]);
 await assert.rejects(db.query("INSERT INTO tenant_users(id,tenant_id,role_key) VALUES($1,$2,'owner')",[colleague,t]),/row-level security/i);
});
await test('portal Auth UID cannot use inherited Office permissions or admin role even if stale profile is privileged',async()=>{
 await db.exec('RESET ROLE');await db.query('UPDATE profiles SET role_id=$1 WHERE id=$2',[adminRole,profile]);
 for(const portal of ['employee','client','relative']){
  await actor(user,t,portal);
  assert.deepEqual(await value("SELECT has_permission('office.employees.edit') AS permitted,is_tenant_admin() AS admin"),{permitted:false,admin:false});
 }
 await restore();
});
await test('blocked and inactive business profiles have no permissions',async()=>{
 for(const [status,active] of [['blocked',true],['active',false]]){
  await db.exec('RESET ROLE');await db.query('UPDATE profiles SET role_id=$1,status=$2,is_active=$3 WHERE id=$4',[adminRole,status,active,profile]);
  await actor(user,t,'business');
  assert.deepEqual(await value("SELECT has_permission('office.employees.edit') AS permitted,is_tenant_admin() AS admin"),{permitted:false,admin:false});
 }
 await restore();
});
await test('foreign role, foreign permission scope and orphan profile never grant tenant administration',async()=>{
 await db.exec('RESET ROLE');await db.query('UPDATE profiles SET role_id=$1 WHERE id=$2',[foreignRole,profile]);
 await actor(user,t,null);
 assert.deepEqual(await value("SELECT has_permission('office.access') AS permitted,is_tenant_admin() AS admin"),{permitted:false,admin:false});
 await db.exec('RESET ROLE');await db.query('UPDATE profiles SET tenant_id=NULL,status=\'invited\' WHERE id=$1',[profile]);
 await actor(user,null,null);
 assert.equal((await value("SELECT has_permission('office.access') AS permitted")).permitted,false);
 await restore();
});
await test('valid global role template still supplies read permission but cannot be modified',async()=>{
 await db.exec('RESET ROLE');await db.query('UPDATE profiles SET role_id=$1 WHERE id=$2',[globalRole,profile]);
 await actor(user,t,null);
 assert.equal((await value("SELECT has_permission('office.documents.view') AS permitted")).permitted,true);
 assert.deepEqual(await write("UPDATE roles SET is_admin_role=true WHERE id=$1",[globalRole]),[]);
 await restore();
});
for(const table of ['employee_portal_accounts','client_portal_codes','relative_portal_codes','client_portal_access']){
 await test(table+' cannot be created/rebound/disabled by portal actor',async()=>{
  for(const portal of ['employee','client','relative']){
   await actor(user,t,portal);
   await assert.rejects(db.query('INSERT INTO '+table+'(id,tenant_id,auth_user_id,status) VALUES($1,$2,$3,\'active\')',[colleague,t,colleague]),/row-level security/i);
   assert.deepEqual(await write('UPDATE '+table+" SET auth_user_id=$1,status='blocked' WHERE id=$2",[colleague,profile]),[]);
  }
 });
}
await test('same-tenant administrator retains role/account management but cannot move profile identity',async()=>{
 await actor(admin,t,'business');
 assert.equal((await value("SELECT has_permission('office.employees.edit') AS permitted")).permitted,true);
 assert.deepEqual(await write('UPDATE profiles SET role_id=$1 WHERE id=$2',[adminRole,profile]),[{id:profile}]);
 await assert.rejects(db.query('UPDATE profiles SET auth_user_id=$1 WHERE id=$2',[colleague,profile]),/immutable/i);
 await assert.rejects(db.query('UPDATE profiles SET role_id=$1 WHERE id=$2',[foreignRole,profile]),/another tenant/i);
 assert.deepEqual(await write("UPDATE employee_portal_accounts SET status='password_reset_required' WHERE id=$1",[profile]),[{id:profile}]);
});
await test('tenant admin cannot assign permission to foreign/global role or mutate global role template',async()=>{
 await actor(admin,t,'business');
 await assert.rejects(db.query("INSERT INTO role_permissions(tenant_id,role_id,permission_key) VALUES($1,$2,'forged')",[t,foreignRole]),/tenant must match/i);
 await assert.rejects(db.query("INSERT INTO role_permissions(tenant_id,role_id,permission_key) VALUES($1,$2,'forged')",[t,globalRole]),/tenant must match/i);
 assert.deepEqual(await write("UPDATE roles SET key='owner' WHERE id=$1",[globalRole]),[]);
});
await test('blocked account and required first-login/password changes deny business server permissions',async()=>{
 await db.exec('RESET ROLE');
 await db.query("INSERT INTO tenant_users(id,tenant_id,auth_user_id,role_key,status) VALUES($1,$2,$3,'owner','active')",[adminProfile,t,admin]);
 for(const [status,change,complete] of [['blocked',false,true],['active',true,true],['active',false,false]]){
  await db.exec('RESET ROLE');
  await db.query('UPDATE tenant_users SET status=$1,must_change_password=$2,first_login_completed=$3 WHERE id=$4',[status,change,complete,adminProfile]);
  await actor(admin,t,'business');
  assert.deepEqual(await value("SELECT has_permission('office.employees.edit') AS permitted,is_tenant_admin() AS admin"),{permitted:false,admin:false});
 }
 await db.exec('RESET ROLE');await db.query("UPDATE tenant_users SET status='active',must_change_password=false,first_login_completed=true WHERE id=$1",[adminProfile]);
 await actor(admin,t,'business');assert.equal((await value("SELECT is_tenant_admin() AS admin")).admin,true);
});
await test('service-role first-login/provisioning writes remain possible; missing uid is denied',async()=>{
 await db.exec('RESET ROLE; SET ROLE service_role');
 assert.deepEqual(await write('UPDATE profiles SET auth_user_id=$1 WHERE id=$2',[colleague,profile]),[{id:profile}]);
 assert.deepEqual(await write("UPDATE employee_portal_accounts SET status='active' WHERE id=$1",[profile]),[{id:profile}]);
 await actor(null,t,null);
 assert.deepEqual(await value("SELECT has_permission('office.employees.edit') AS permitted,is_tenant_admin() AS admin"),{permitted:false,admin:false});
});
await db.close();

