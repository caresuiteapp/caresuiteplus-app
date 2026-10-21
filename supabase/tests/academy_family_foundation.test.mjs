import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { academyFixture, content, id } from './academy_workspace_fixture.mjs';

const foundationSql = readFileSync(new URL('../changes/academy_family_foundation.sql', import.meta.url), 'utf8');
const activationSql = readFileSync(new URL('../changes/academy_family_access.sql', import.meta.url), 'utf8');
const compatibilitySql = readFileSync(new URL('../changes/academy_gateway_hook_upgrade_compatibility.sql', import.meta.url), 'utf8');
const hash = `pbkdf2-sha256:310000:${'a'.repeat(32)}:${'b'.repeat(64)}`;
const denied = (promise, code = '42501') => assert.rejects(promise, error => error.code === code);

async function existingSecurity(f) {
 return {
  settings: (await f.db.query(`SELECT coalesce(d.datname,'all') AS database_name,p.rolname,r.setconfig
   FROM pg_db_role_setting r LEFT JOIN pg_roles p ON p.oid=r.setrole LEFT JOIN pg_database d ON d.oid=r.setdatabase
   ORDER BY r.setrole,r.setdatabase`)).rows,
  tables: (await f.db.query(`SELECT n.nspname,c.relname,c.relrowsecurity,c.relforcerowsecurity,c.relacl
   FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind IN ('r','p')
   AND n.nspname IN ('public','storage','realtime') ORDER BY n.nspname,c.relname`)).rows,
  policies: (await f.db.query(`SELECT schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check
   FROM pg_policies WHERE schemaname IN ('public','storage','realtime') ORDER BY schemaname,tablename,policyname`)).rows,
  hook: (await f.db.query("SELECT pg_get_functiondef('public.foundation_existing_guard()'::regprocedure) AS definition")).rows,
 };
}

async function prepare(f) {
 await f.db.exec(`
  CREATE ROLE authenticator NOINHERIT;
  CREATE TABLE auth.users(id uuid PRIMARY KEY,raw_app_meta_data jsonb);
  GRANT USAGE ON SCHEMA auth TO service_role;
  GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO service_role;
  CREATE TYPE public.portal_type AS ENUM ('employee','client','relative','business');
  ALTER TABLE public.portal_sessions ALTER COLUMN portal_type TYPE public.portal_type USING portal_type::public.portal_type;
  ALTER TABLE public.portal_sessions ALTER COLUMN id SET DEFAULT gen_random_uuid();
  ALTER TABLE public.portal_sessions ADD COLUMN metadata jsonb DEFAULT '{}',ADD COLUMN updated_at timestamptz DEFAULT now(),ADD COLUMN revoked_reason text;
  ALTER TABLE public.client_portal_access ALTER COLUMN id SET DEFAULT gen_random_uuid();
  ALTER TABLE public.client_portal_access ADD COLUMN email text,ADD COLUMN portal_username text,ADD COLUMN portal_access_code_hash text,
   ADD COLUMN last_login_at timestamptz,ADD COLUMN invited_at timestamptz,ADD COLUMN code_created_at timestamptz,
   ADD COLUMN code_rotated_at timestamptz,ADD COLUMN modules_enabled text[] DEFAULT '{}',ADD COLUMN two_factor_enabled boolean DEFAULT false,
   ADD COLUMN created_at timestamptz DEFAULT now(),ADD COLUMN updated_at timestamptz DEFAULT now();
  GRANT SELECT,INSERT,UPDATE,DELETE ON public.client_portal_access,public.portal_sessions TO authenticated,service_role;
  CREATE SCHEMA storage; CREATE SCHEMA realtime;
  CREATE TABLE storage.objects(id integer); CREATE TABLE storage.buckets(id integer); CREATE TABLE realtime.messages(id integer);
  CREATE TABLE public.foundation_health_fixture(id integer);
  ALTER TABLE public.foundation_health_fixture ENABLE ROW LEVEL SECURITY;
  CREATE POLICY foundation_existing_policy ON public.foundation_health_fixture TO authenticated USING(true);
  GRANT USAGE ON SCHEMA storage,realtime TO authenticated;
  GRANT SELECT ON storage.objects,storage.buckets,realtime.messages,public.foundation_health_fixture TO authenticated;
  CREATE FUNCTION public.foundation_existing_guard() RETURNS void LANGUAGE plpgsql AS $$ BEGIN
   PERFORM set_config('foundation.previous_hook',current_user,true);
  END $$;
  ALTER ROLE authenticator SET pgrst.db_pre_request='public.foundation_existing_guard';
  ALTER ROLE authenticator SET pgrst.db_schemas='public';
 `);
 for (const permission of ['office.access','office.clients.manage_consents']) {
  await f.db.query('INSERT INTO public.role_permissions(role_id,permission_key) VALUES($1,$2)', [id(1),permission]);
 }
}

async function foundationFixture({ beforeFoundation, beforeCompatibility } = {}) {
 return academyFixture({ beforeWorkspace: async f => {
  await prepare(f);
  if (beforeFoundation) await beforeFoundation(f);
  await f.db.query('DELETE FROM public.client_portal_access WHERE id=$1', [id(62)]);
  const before = await existingSecurity(f);
  await f.db.exec(foundationSql);
  if (beforeCompatibility) await beforeCompatibility(f);
  await f.db.exec(compatibilitySql);
  assert.deepEqual(await existingSecurity(f),before,'foundation must preserve every existing public/storage/realtime table policy, grant and hook setting');
  assert.equal((await f.db.query("SELECT to_regprocedure('academy_family_private.request_guard()') AS installed")).rows[0].installed,null);
  await f.owner();
 } });
}

const manage = async (f,action,account=id(62)) => (await f.db.query(
 'SELECT public.academy_family_access_manage($1,$2,$3,$4,$5,$6,$7) AS result',
 [id(10),id(50),id(52),action,account,action==='setup'?'family.one':null,['setup','rotate'].includes(action)?hash:null])).rows[0].result;
async function serviceActor(f) {
 await f.owner(); await f.db.query("SELECT set_config('fixture.jwt',$1,false)", [JSON.stringify({role:'service_role'})]);
 await f.db.exec('SET ROLE service_role');
}
const own = (f,action,e,data={}) => f.mutate(action,e.id,e.revision,data,{view:'learner'});

test('staged foundation: existing gateway and public/storage/realtime security stay intact; family access stays disabled even with forged markers', async () => {
 const f=await foundationFixture();
 try {
  assert.deepEqual(await manage(f,'list'),{accesses:[],ready:false});
  await f.db.query("SELECT set_config('academy_family.gateway_checked','v1',false),set_config('academy_family.managed_write','v1',false)");
  assert.equal((await manage(f,'list')).ready,false);
  for(const action of ['setup','enable','rotate']) await denied(manage(f,action),'55000');
  // Normal self-account writes retain their existing semantics.
  await f.db.query('UPDATE public.client_portal_access SET portal_username=$1 WHERE id=$2',['client.self',id(61)]);
  assert.equal((await f.db.query('SELECT portal_username FROM public.client_portal_access WHERE id=$1',[id(61)])).rows[0].portal_username,'client.self');
  await serviceActor(f);
  await denied(f.db.query('SELECT public.academy_family_auth_identity($1,$2,$3)',[id(62),id(10),id(52)]));
  // Service-role writes cannot bypass the staged barrier, even using an active
  // account, a disabled account, or an Auth binding prepared outside the RPC.
  for(const enabled of [true,false]) await denied(f.db.query(`INSERT INTO public.client_portal_access
   (id,tenant_id,client_id,contact_id,account_kind,access_scope,portal_enabled,status,auth_user_id)
   VALUES($1,$2,$3,$4,'academy_family','academy',$5,'aktiv',$6)`,[randomUUID(),id(10),id(50),id(52),enabled,id(131)]));
  await denied(f.db.query("UPDATE public.client_portal_access SET account_kind='academy_family',access_scope='academy',contact_id=$1,auth_user_id=$2 WHERE id=$3",[id(52),id(131),id(61)]));
  await f.owner();
  assert.equal((await f.db.query("SELECT count(*)::int AS n FROM public.client_portal_access WHERE account_kind='academy_family'")).rows[0].n,0);
  assert.equal((await f.db.query('SELECT academy_family_private.gateway_ready() AS ready')).rows[0].ready,false);
  assert.equal((await f.db.query('SELECT count(*)::int AS n FROM academy_family_private.gateway_config')).rows[0].n,0);
 } finally { await f.db.close(); }
});

test('gateway upgrade compatibility preserves a qualified existing hook as text without activating the staged gateway', async () => {
 const f=await foundationFixture({beforeCompatibility:async f=>{
  await f.db.exec("INSERT INTO academy_family_private.gateway_config(singleton,previous_hook) VALUES(true,'public.foundation_existing_guard()'::regprocedure)");
 }});
 try {
  await f.owner();
  const row=(await f.db.query('SELECT previous_hook,pg_typeof(previous_hook)::text AS storage_type FROM academy_family_private.gateway_config')).rows[0];
  assert.deepEqual(row,{previous_hook:'public.foundation_existing_guard()',storage_type:'text'});
  assert.equal((await f.db.query('SELECT academy_family_private.gateway_ready() AS ready')).rows[0].ready,false);
  const before=await existingSecurity(f);await f.db.exec(compatibilitySql);assert.deepEqual(await existingSecurity(f),before);
  await f.actor();assert.equal((await manage(f,'list')).ready,false);await denied(manage(f,'setup'),'55000');
 } finally { await f.db.close(); }
});

test('staged foundation with actual workspace SQL: office authoring and employee/client learning reach independently reviewed certificates', async () => {
 const f=await foundationFixture();
 try {
  const template=await f.mutate('save_template',randomUUID(),null,{name:'Eigene Vorlage',description:'Staged rollout',content:content()});
  assert.equal((await f.load()).templates[0].id,template.recordId);
  const course=await f.publish();
  await f.assign(course,[{kind:'employee',id:id(41)},{kind:'client',id:id(50)}]);
  for(const kind of ['employee','client']) {
   await f.learner(kind); let view=await f.load('learner');
   assert.equal(view.viewer.audience,kind); assert.equal(view.enrollments.length,1); assert.deepEqual(view.templates,[]);
   assert.equal(JSON.stringify(view).includes('correctOptionId'),false);
   let e=view.enrollments[0]; await own(f,'complete_lesson',e,{lessonId:'reading'});
   e=(await f.load('learner')).enrollments[0]; await own(f,'submit_quiz',e,{lessonId:'check',answers:{'question-1':'b'}});
   e=(await f.load('learner')).enrollments[0]; await own(f,'submit_enrollment',e);
   e=(await f.load('learner')).enrollments[0]; assert.equal(e.state,'submitted');
   await f.actor(); const reviewed=await f.mutate('review_enrollment',e.id,e.revision,{decision:'approve',note:'Isoliert geprüft',validUntil:null});
   assert.ok(reviewed.certificateId);
   await f.learner(kind); view=await f.load('learner');
   assert.equal(view.enrollments[0].state,'completed');assert.equal(view.certificates.length,1);assert.equal(view.certificates[0].audience,kind);
  }
  await f.learner('family'); await denied(f.load('learner'));
 } finally { await f.db.close(); }
});

test('staged foundation refuses existing family accounts or activated configuration; later full activation still requires its verified baseline', async () => {
 const f=await foundationFixture({beforeFoundation:async f=>{
  await denied(f.db.exec(foundationSql),'55000'); await f.db.exec('ROLLBACK');
 }});
 try {
  await f.owner();
  await f.db.exec('INSERT INTO academy_family_private.gateway_config(singleton) VALUES(true)');
  await denied(f.db.exec(foundationSql),'55000'); await f.db.exec('ROLLBACK');
  await f.db.exec('DELETE FROM academy_family_private.gateway_config');
  await denied(f.db.exec(activationSql),'P0001'); await f.db.exec('ROLLBACK');
  await f.db.exec("SET academy_family.confirmed_pre_request='public.foundation_existing_guard'");
  await f.db.exec(activationSql);
  assert.equal((await f.db.query('SELECT previous_hook AS hook FROM academy_family_private.gateway_config')).rows[0].hook,'public.foundation_existing_guard()');
  await f.actor(); await f.db.exec('BEGIN');
  await f.db.query("SELECT set_config('request.path','/rpc/academy_family_access_manage',true),set_config('request.method','POST',true)");
  await f.db.query('SELECT academy_family_private.request_guard()');
  assert.equal((await manage(f,'list')).ready,true);
  const created=await manage(f,'setup');assert.equal(created.access.account_kind,'academy_family');
  await f.db.exec('COMMIT');
 } finally { await f.db.close(); }
});
