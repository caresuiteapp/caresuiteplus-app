import {PGlite} from '@electric-sql/pglite';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const db=new PGlite();
await db.exec(`CREATE ROLE authenticated;CREATE ROLE anon;CREATE ROLE service_role BYPASSRLS;CREATE SCHEMA auth;CREATE SCHEMA extensions;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql AS $$SELECT coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
CREATE FUNCTION extensions.digest(text,text) RETURNS bytea LANGUAGE sql AS $$SELECT decode(repeat('ab',32),'hex')$$;
CREATE TABLE auth.sessions(id uuid primary key,user_id uuid,not_after timestamptz,aal text);
CREATE TABLE roles(id uuid,key text,is_admin_role bool,can_manage_tenant bool,can_manage_users bool,can_manage_roles bool);
CREATE TABLE profiles(id uuid,tenant_id uuid,auth_user_id uuid,role_id uuid,status text,is_active bool,first_name text,last_name text,full_name text,email text,phone text,avatar_url text,created_at timestamptz default now(),updated_at timestamptz default now());
CREATE TABLE portal_sessions(id uuid,tenant_id uuid,status text,session_token text,expires_at timestamptz,metadata jsonb,revoked_at timestamptz,revoked_reason text,updated_at timestamptz);
CREATE TABLE portal_push_devices(auth_user_id uuid,tenant_id uuid);
CREATE FUNCTION current_profile_id() RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $$SELECT id FROM profiles WHERE auth_user_id=auth.uid() LIMIT 1$$;
CREATE FUNCTION current_tenant_id() RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $$SELECT tenant_id FROM profiles WHERE auth_user_id=auth.uid() LIMIT 1$$;
CREATE FUNCTION current_role_key() RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $$SELECT r.key FROM roles r JOIN profiles p ON p.role_id=r.id WHERE p.auth_user_id=auth.uid() LIMIT 1$$;
CREATE FUNCTION has_permission(p_permission_key text) RETURNS bool LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $$SELECT auth.uid() IS NOT NULL$$;
CREATE TABLE business_records(id uuid,tenant_id uuid);
ALTER TABLE business_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_records ON business_records FOR ALL TO authenticated USING(tenant_id=current_tenant_id()) WITH CHECK(tenant_id=current_tenant_id());
GRANT SELECT,INSERT,UPDATE,DELETE ON business_records TO authenticated;
`);
await db.exec(readFileSync(new URL('../patches/account_security_platform_sync.sql',import.meta.url),'utf8'));

const id=n=>`30000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const tenant=id(1),otherTenant=id(2),employee=id(10),admin=id(11),other=id(12),employeeSession=id(20),otherSession=id(21),adminSession=id(22);
await db.exec(`INSERT INTO roles VALUES('${id(30)}','employee',false,false,false,false),('${id(31)}','owner',true,true,true,true);
INSERT INTO profiles(id,tenant_id,auth_user_id,role_id,status,is_active) VALUES('${id(40)}','${tenant}','${employee}','${id(30)}','active',true),('${id(41)}','${tenant}','${admin}','${id(31)}','active',true),('${id(42)}','${otherTenant}','${other}','${id(30)}','active',true);
INSERT INTO auth.sessions VALUES('${employeeSession}','${employee}',null,'aal1'),('${otherSession}','${other}',null,'aal1'),('${adminSession}','${admin}',null,'aal1');
INSERT INTO business_records VALUES('${id(50)}','${tenant}'),('${id(51)}','${otherTenant}');
UPDATE account_security.runtime SET mfa_enforced=true;
`);
async function as(user,session,aal='aal1'){
 await db.exec('RESET ROLE');
 await db.query("SELECT set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",[user,JSON.stringify({sub:user,session_id:session,aal,app_metadata:{}})]);
 await db.exec('SET ROLE authenticated');
}
const scalar=async(sql,params=[])=>Object.values((await db.query(sql,params)).rows[0])[0];
await test('a real own session reads only its own tenant records',async()=>{
 await as(employee,employeeSession); assert.equal(await scalar('SELECT current_tenant_id()'),tenant);
 assert.deepEqual((await db.query('SELECT id FROM business_records')).rows,[{id:id(50)}]);
 await assert.rejects(()=>db.query('INSERT INTO business_records VALUES($1,$2)',[id(52),otherTenant]),/row.level security/);
});
await test('missing, foreign and expired session ids cannot use the new self-service APIs',async()=>{
 for(const session of [id(90),otherSession]){await as(employee,session);assert.equal((await scalar('SELECT account_security_state()')).active,false);}
 await db.exec('RESET ROLE');await db.query("UPDATE auth.sessions SET not_after=now()-interval '1 second' WHERE id=$1",[employeeSession]);
 await as(employee,employeeSession);assert.equal((await scalar('SELECT account_security_state()')).active,false);
 await db.exec('RESET ROLE');await db.query('UPDATE auth.sessions SET not_after=null WHERE id=$1',[employeeSession]);
});
await test('privileged aal1 can load its own enrollment identity but cannot change protected account settings',async()=>{
 await as(admin,adminSession);assert.equal((await scalar('SELECT account_security_state()')).mfaRequired,true);
 const own=await scalar('SELECT account_security_bootstrap($1)',[admin]);assert.equal(own.mfaRequired,true);assert.equal(own.profile.tenantId,tenant);
 await assert.rejects(()=>db.query('SELECT account_security_bootstrap($1)',[employee]),/own session/);
 await assert.rejects(()=>db.query("SELECT account_security_register_device('web','Browser')"),/Active account/);
});
await test('an aal2 claim without a confirmed server session does not pass MFA',async()=>{
 await as(admin,adminSession,'aal2');await assert.rejects(()=>db.query("SELECT account_security_register_device('web','Büro')"),/Active account/);
 await db.exec('RESET ROLE');await db.query("UPDATE auth.sessions SET aal='aal2' WHERE id=$1",[adminSession]);
 await as(admin,adminSession,'aal2');assert.equal(await scalar('SELECT current_tenant_id()'),tenant);
 assert.equal(await scalar("SELECT account_security_register_device('web','Büro')"),true);
});
await test('device lists and revocation are restricted to the current owner and tenant',async()=>{
 await as(employee,employeeSession);assert.equal(await scalar("SELECT account_security_register_device('android','Telefon')"),true);
 let devices=await scalar('SELECT account_security_list_devices()');assert.equal(devices.length,1);assert.equal(devices[0].current,true);assert.equal(devices[0].id,employeeSession);
 await assert.rejects(()=>db.query('SELECT account_security_revoke_device($1)',[adminSession]),/Own device/);
 await assert.rejects(()=>db.query('SELECT * FROM account_security.device_sessions'),/permission denied/);
});
await test('personal notification changes return exact server readback without changing another account',async()=>{
 await as(employee,employeeSession);const saved=await scalar("SELECT account_security_notification_preferences('message',false)");assert.equal(saved.message,false);assert.equal(saved.assignment,true);
 await assert.rejects(()=>db.query("SELECT account_security_notification_preferences('other',false)"),/Invalid event/);
 await as(admin,adminSession,'aal2');assert.equal((await scalar('SELECT account_security_notification_preferences()')).message,true);
});
await test('push preferences preserve source guards and apply only to the exact recipient',async()=>{
 await db.exec('RESET ROLE');
 await db.exec(`CREATE FUNCTION portal_push_event_visible(d portal_push_devices,kind text,source uuid) RETURNS boolean LANGUAGE sql AS $$SELECT source IS NOT NULL$$`);
 await db.exec(readFileSync(new URL('../patches/account_security_push_preferences.sql',import.meta.url),'utf8'));
 const visible=async(user,tid,kind,source=id(90))=>scalar('SELECT portal_push_event_visible(ROW($1::uuid,$2::uuid)::portal_push_devices,$3,$4::uuid)',[user,tid,kind,source]);
 assert.equal(await visible(employee,tenant,'message'),false);
 assert.equal(await visible(employee,otherTenant,'message'),true);
 assert.equal(await visible(admin,tenant,'message'),true);
 assert.equal(await visible(employee,tenant,'visit'),true);
 assert.equal(await visible(employee,tenant,'visit',null),false);
 await as(employee,employeeSession);
 await assert.rejects(()=>db.query('SELECT account_security.original_portal_push_event_visible(ROW($1::uuid,$2::uuid)::portal_push_devices,$3,$4::uuid)',[employee,tenant,'message',id(90)]),/permission denied/);
});
await test('revoking the current device invalidates its refresh session and all new self-service APIs',async()=>{
 await as(employee,employeeSession);assert.equal(await scalar('SELECT account_security_revoke_device($1)',[employeeSession]),true);
 assert.equal((await scalar('SELECT account_security_state()')).active,false);
 await assert.rejects(()=>db.query('SELECT account_security_list_devices()'),/Active session/);
 await as(admin,adminSession,'aal2');assert.equal(await scalar('SELECT current_tenant_id()'),tenant);
});
await test('anonymous callers cannot invoke any account-management RPC',async()=>{
 await db.exec('SET ROLE anon');
 for(const sql of ['SELECT account_security_state()','SELECT account_security_list_devices()','SELECT account_security_notification_preferences()'])await assert.rejects(()=>db.query(sql),/permission denied/);
});
await test('approved staging enforcement rejects retained tokens at existing RLS and RPC boundaries',async()=>{
 await db.exec('RESET ROLE');
 await db.exec(readFileSync(new URL('../patches/account_security_enforcement_staging.sql',import.meta.url),'utf8'));
 await as(employee,employeeSession);assert.equal(await scalar('SELECT current_profile_id()'),null);assert.equal(await scalar("SELECT has_permission('office.clients.view')"),false);assert.equal((await db.query('SELECT * FROM business_records')).rows.length,0);
 await as(admin,adminSession,'aal1');assert.equal(await scalar('SELECT current_tenant_id()'),null);
 await as(admin,adminSession,'aal2');assert.equal(await scalar('SELECT current_tenant_id()'),tenant);
});
await test('copied identity resolvers cannot be called directly by an authenticated client',async()=>{
 await as(admin,adminSession,'aal2');
 for(const name of ['current_profile_id','current_tenant_id','current_role_key']) await assert.rejects(()=>db.query('SELECT account_security.original_'+name+'()'),/permission denied/);
 await assert.rejects(()=>db.query("SELECT account_security.original_has_permission('office.clients.view')"),/permission denied/);
});
await test('a fresh active employee session retains only its original tenant access',async()=>{
 await db.exec('RESET ROLE');await db.query("INSERT INTO auth.sessions VALUES($1,$2,null,'aal1')",[id(24),employee]);await as(employee,id(24));
 assert.equal(await scalar('SELECT current_tenant_id()'),tenant);assert.deepEqual((await db.query('SELECT id FROM business_records')).rows,[{id:id(50)}]);
});
await test('the existing trusted service path is preserved and cannot be claimed by authenticated users',async()=>{
 await as(employee,employeeSession);await db.query("SELECT set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:employee,role:'service_role',session_id:employeeSession,aal:'aal1'})]);
 assert.equal(await scalar('SELECT current_tenant_id()'),null);
 await db.exec('RESET ROLE');await db.exec('SET ROLE service_role');
 assert.equal(await scalar('SELECT current_tenant_id()'),tenant);assert.equal(await scalar("SELECT has_permission('office.clients.view')"),true);
});
await db.close();
