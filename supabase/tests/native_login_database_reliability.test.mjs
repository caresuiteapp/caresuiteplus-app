import {PGlite} from '@electric-sql/pglite';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const db=new PGlite();
const id=n=>`41000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const tenant=id(1),foreignTenant=id(2),user=id(3),other=id(4),employee=id(5),client=id(6),foreignClient=id(7),unassigned=id(8),draftClient=id(9),profile=id(10);
await db.exec(`CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA auth; CREATE SCHEMA account_security;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
CREATE TABLE auth.mfa_factors(user_id uuid,status text);
CREATE FUNCTION account_security.requires_mfa() RETURNS bool LANGUAGE sql AS $$SELECT true$$;
CREATE FUNCTION account_security.allowed_session() RETURNS bool LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,account_security AS $$SELECT auth.uid() IS NOT NULL AND current_setting('test.active',true)='yes' AND (NOT account_security.requires_mfa() OR current_setting('test.aal',true)='aal2')$$;
GRANT USAGE ON SCHEMA account_security,auth TO authenticated;
GRANT EXECUTE ON FUNCTION account_security.allowed_session() TO authenticated;
CREATE FUNCTION current_tenant_id() RETURNS uuid LANGUAGE sql AS $$SELECT nullif(current_setting('test.tenant',true),'')::uuid$$;
CREATE FUNCTION resolve_current_employee_id() RETURNS uuid LANGUAGE sql AS $$SELECT nullif(current_setting('test.employee',true),'')::uuid$$;
CREATE FUNCTION is_employee_portal_rls_context(uuid) RETURNS bool LANGUAGE sql AS $$SELECT current_setting('test.role',true)='employee'$$;
CREATE TABLE profiles(id uuid primary key,tenant_id uuid,auth_user_id uuid,full_name text,first_name text,last_name text,status text,is_active bool,created_at timestamptz default now());
CREATE TABLE employees(id uuid primary key,tenant_id uuid,first_name text,last_name text);
CREATE TABLE client_preferences(id uuid primary key,tenant_id uuid,client_id uuid,mobility_notes text);
CREATE TABLE assist_visits(tenant_id uuid,client_id uuid,employee_id uuid,planning_status text);
CREATE TABLE assignments(tenant_id uuid,client_id uuid,employee_id uuid);
CREATE TABLE portal_push_devices(id uuid primary key);
CREATE TABLE assignment_audit_events(id uuid primary key,tenant_id uuid,actor_profile_id uuid REFERENCES profiles(id),actor_name text);
ALTER TABLE assignment_audit_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_audit ON assignment_audit_events TO authenticated USING(tenant_id=current_tenant_id()) WITH CHECK(tenant_id=current_tenant_id());
GRANT SELECT ON assist_visits,assignments TO authenticated;
GRANT SELECT,INSERT ON assignment_audit_events TO authenticated;
INSERT INTO employees VALUES('${employee}','${tenant}','Test','Mitarbeitende');
INSERT INTO profiles VALUES('${profile}','${tenant}','${other}','Andere Person','Andere','Person','active',true,now());
INSERT INTO client_preferences VALUES('${id(20)}','${tenant}','${client}','Eigener Hinweis'),('${id(21)}','${foreignTenant}','${foreignClient}','Fremder Hinweis'),('${id(22)}','${tenant}','${unassigned}','Ohne Zuordnung'),('${id(23)}','${tenant}','${draftClient}','Entwurf');
INSERT INTO assist_visits VALUES('${tenant}','${client}','${employee}','scheduled'),('${tenant}','${draftClient}','${employee}','draft');
`);
await db.exec(readFileSync(new URL('../patches/native_login_database_reliability.sql',import.meta.url),'utf8'));
async function as(actor=user,{active='yes',aal='aal1',role='employee',ownTenant=tenant}={}){
 await db.exec('RESET ROLE');
 for(const [key,value] of Object.entries({'request.jwt.claim.sub':actor,'test.active':active,'test.aal':aal,'test.role':role,'test.tenant':ownTenant,'test.employee':employee}))await db.query('SELECT set_config($1,$2,false)',[key,value]);
 await db.exec('SET ROLE authenticated');
}
const scalar=async sql=>Object.values((await db.query(sql)).rows[0])[0];
await test('an account without a verified factor can use aal1 without mandatory enrollment',async()=>{
 await as();assert.equal(await scalar('SELECT account_security.allowed_session()'),true);
 await db.exec('RESET ROLE');await db.query('INSERT INTO auth.mfa_factors VALUES($1,$2),($3,$4)',[user,'unverified',other,'verified']);
 await as();assert.equal(await scalar('SELECT account_security.allowed_session()'),true);
});
await test('a voluntarily verified own factor keeps MFA required; another account cannot satisfy it',async()=>{
 await db.exec('RESET ROLE');await db.query('INSERT INTO auth.mfa_factors VALUES($1,$2)',[user,'verified']);
 await as();assert.equal(await scalar('SELECT account_security.allowed_session()'),false);
 await as(user,{aal:'aal2'});assert.equal(await scalar('SELECT account_security.allowed_session()'),true);
 await db.exec('RESET ROLE');await db.query('DELETE FROM auth.mfa_factors WHERE user_id=$1',[user]);
});
await test('preferences expose only assigned non-draft clients in the own active employee scope',async()=>{
 await as();assert.deepEqual((await db.query('SELECT client_id FROM client_preferences')).rows,[{client_id:client}]);
 await assert.rejects(()=>db.query('INSERT INTO client_preferences VALUES($1,$2,$3,$4)',[id(24),tenant,client,'No write']),/permission denied/);
 for(const options of [{active:'no'},{role:'client'},{ownTenant:foreignTenant}]){await as(user,options);assert.equal((await db.query('SELECT id FROM client_preferences')).rows.length,0);}
 await db.exec('RESET ROLE;SET ROLE anon');await assert.rejects(()=>db.query('SELECT id FROM client_preferences'),/permission denied/);
});
await test('old app employee IDs cannot break audit profile foreign keys or impersonate another profile',async()=>{
 await as();await db.query('INSERT INTO assignment_audit_events VALUES($1,$2,$3,$4)',[id(30),tenant,employee,'Spoofed']);
 let row=(await db.query('SELECT actor_profile_id,actor_name FROM assignment_audit_events')).rows[0];assert.deepEqual(row,{actor_profile_id:null,actor_name:'Test Mitarbeitende'});
 await db.query('INSERT INTO assignment_audit_events VALUES($1,$2,$3,$4)',[id(31),tenant,profile,'Other actor']);
 row=(await db.query('SELECT actor_profile_id FROM assignment_audit_events WHERE id=$1',[id(31)])).rows[0];assert.equal(row.actor_profile_id,null);
 await assert.rejects(()=>db.query('INSERT INTO assignment_audit_events VALUES($1,$2,$3,$4)',[id(32),foreignTenant,profile,'Foreign']),/own tenant/);
 await as(user,{active:'no'});await assert.rejects(()=>db.query('INSERT INTO assignment_audit_events VALUES($1,$2,$3,$4)',[id(33),tenant,employee,'Revoked']),/own tenant/);
});
await test('a real internal profile is attributed from the session, never from the submitted ID',async()=>{
 await as(other,{role:'office',aal:'aal2'});await db.query('INSERT INTO assignment_audit_events VALUES($1,$2,$3,$4)',[id(34),tenant,employee,'Spoofed']);
 assert.deepEqual((await db.query('SELECT actor_profile_id,actor_name FROM assignment_audit_events WHERE id=$1',[id(34)])).rows[0],{actor_profile_id:profile,actor_name:'Andere Person'});
});
await test('push backend upserts are granted without device-side write access',async()=>{
 await db.exec('RESET ROLE');
 assert.equal(await scalar("SELECT has_table_privilege('service_role','portal_push_devices','INSERT')"),true);
 assert.equal(await scalar("SELECT has_table_privilege('service_role','portal_push_devices','UPDATE')"),true);
 assert.equal(await scalar("SELECT has_table_privilege('authenticated','portal_push_devices','INSERT')"),false);
 assert.equal(await scalar("SELECT has_table_privilege('anon','portal_push_devices','SELECT')"),false);
});
await db.close();
