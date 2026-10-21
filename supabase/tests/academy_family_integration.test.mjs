import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { academyFixture, id } from './academy_workspace_fixture.mjs';

const familySql = readFileSync(new URL('../changes/academy_family_access.sql',import.meta.url),'utf8');
const hash = `pbkdf2-sha256:310000:${'a'.repeat(32)}:${'b'.repeat(64)}`;
const denied = promise => assert.rejects(promise,error=>error.code==='42501');

async function integratedFixture() {
 return academyFixture({beforeWorkspace:async f=>{
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
   CREATE UNIQUE INDEX client_portal_access_tenant_username ON public.client_portal_access(tenant_id,lower(portal_username)) WHERE portal_username IS NOT NULL;
   GRANT SELECT,INSERT,UPDATE,DELETE ON public.client_portal_access,public.portal_sessions TO service_role;
   CREATE SCHEMA storage; CREATE SCHEMA realtime;
   CREATE TABLE storage.objects(id integer,secret text); CREATE TABLE realtime.messages(id integer,secret text);
   CREATE TABLE public.family_health_fixture(id integer,secret text);
   INSERT INTO public.family_health_fixture VALUES(1,'private medical information');
   INSERT INTO storage.objects VALUES(1,'private document'); INSERT INTO realtime.messages VALUES(1,'private message');
   GRANT USAGE ON SCHEMA storage,realtime TO authenticated;
   GRANT SELECT ON public.family_health_fixture,storage.objects,realtime.messages TO authenticated;
   CREATE FUNCTION public.family_legacy_definer_fixture() RETURNS text LANGUAGE sql SECURITY DEFINER AS $$ SELECT secret FROM public.family_health_fixture LIMIT 1 $$;
   CREATE VIEW public.family_legacy_owner_view_fixture AS SELECT * FROM public.family_health_fixture;
   GRANT SELECT ON public.family_legacy_owner_view_fixture TO authenticated;
   SET academy_family.confirmed_pre_request='none';
  `);
  // Replace the old fixture's pre-created family account with a real managed
  // setup, keeping the exact central contact and Auth principal test identities.
  await f.db.query('DELETE FROM public.client_portal_access WHERE id=$1',[id(62)]);
  await f.db.query('DELETE FROM public.portal_sessions WHERE id=$1',[id(64)]);
  await f.db.query('DELETE FROM public.relative_portal_codes WHERE id=$1',[id(63)]);
  await f.db.query('UPDATE public.client_contacts SET portal_enabled=false WHERE id=$1',[id(52)]);
  for(const permission of ['office.access','office.clients.manage_consents']) {
   await f.db.query('INSERT INTO public.role_permissions(role_id,permission_key) VALUES($1,$2)',[id(1),permission]);
  }
  await f.db.exec(familySql);
  await f.owner();
 }});
}

async function api(f,path,run,{method='POST'}={}) {
 await f.db.exec('BEGIN');
 try {
  await f.db.query("SELECT set_config('request.path',$1,true),set_config('request.method',$2,true),set_config('request.headers','{}',true)",[path,method]);
  await f.db.query('SELECT academy_family_private.request_guard()');
  const value=await run(); await f.db.exec('COMMIT'); return value;
 }catch(error){await f.db.exec('ROLLBACK');throw error;}
}
const load=f=>api(f,'/rpc/academy_workspace_load',()=>f.load('learner'));
const own=(f,action,e,data={},options={})=>api(f,'/rpc/academy_workspace_mutate',()=>f.mutate(action,e.id,e.revision,data,{view:'learner',...options}));
const manage=(f,action,account=null)=>api(f,'/rpc/academy_family_access_manage',async()=>{
 const r=await f.db.query('SELECT public.academy_family_access_manage($1,$2,$3,$4,$5,$6,$7) result',
  [id(10),id(50),id(52),action,account,action==='setup'?'family.one':null,['setup','rotate'].includes(action)?(action==='rotate'?hash.replace('b'.repeat(64),'c'.repeat(64)):hash):null]);
 return r.rows[0].result;
});
async function familyActor(f,account,generation,profile=31){
 await f.actor(profile,10,{role:'authenticated',app_metadata:{portal_type:'academy_family',role_key:'family_portal',portal_account_id:account,tenant_id:id(10),academy_access_generation:generation,relative_contact_id:id(52)}});
}
async function serviceActor(f){
 await f.owner();await f.db.query("SELECT set_config('fixture.jwt',$1,false)",[JSON.stringify({role:'service_role'})]);await f.db.exec('SET ROLE service_role');
}
const identity=(f,account)=>api(f,'/rpc/academy_family_auth_identity',async()=>
 (await f.db.query('SELECT public.academy_family_auth_identity($1,$2,$3) result',[account,id(10),id(52)])).rows[0].result);
async function bindAuthGeneration(f,account,generation,profile){
 await f.owner();
 await f.db.query('INSERT INTO auth.users(id,raw_app_meta_data) VALUES($1,$2)',[id(profile+100),{
  portal_type:'academy_family',role_key:'family_portal',portal_account_id:account,tenant_id:id(10),
  access_scope:'academy',academy_access_generation:generation,relative_contact_id:id(52),
 }]);
 await serviceActor(f);
 await api(f,'/client_portal_access',()=>f.db.query('UPDATE public.client_portal_access SET auth_user_id=$1 WHERE id=$2',[id(profile+100),account]));
}

test('combined real SQL: managed family access → signed principal → learning → independent approval; revoked generations never regain access',async()=>{
 const f=await integratedFixture();
 try{
  const created=await manage(f,'setup');const account=created.access.id;
  assert.equal(created.access.account_kind,'academy_family');assert.equal(created.access.access_generation,1);
  assert.equal(created.access.contact_id,id(52));
  const course=await api(f,'/rpc/academy_workspace_mutate',()=>f.publish());
  await api(f,'/rpc/academy_workspace_mutate',()=>f.assign(course,[{kind:'family',id:id(52)},{kind:'client',id:id(50)},{kind:'employee',id:id(41)}]));

  await serviceActor(f);const mint=await identity(f,account);
  assert.equal(mint.displayName,'Family One');assert.equal(mint.accessGeneration,1);
  // Real Auth mint is external to PGlite; only its verified link is simulated.
  await bindAuthGeneration(f,account,1,31);
  await familyActor(f,account,1);
  let view=await load(f);assert.equal(view.viewer.audience,'family');assert.equal(view.enrollments.length,1);
  assert.equal(view.enrollments[0].participant.id,id(52));assert.equal(JSON.stringify(view).includes('correctOptionId'),false);
  assert.equal((await f.db.query('SELECT public.current_tenant_id() tenant')).rows[0].tenant,null);
  let e=view.enrollments[0];const replayId=randomUUID();const original=e;
  await own(f,'complete_lesson',e,{lessonId:'reading'},{request:replayId});e=(await load(f)).enrollments[0];
  await own(f,'submit_quiz',e,{lessonId:'check',answers:{'question-1':'b'}});e=(await load(f)).enrollments[0];
  await own(f,'submit_enrollment',e);e=(await load(f)).enrollments[0];assert.equal(e.state,'submitted');
  await denied(api(f,'/rpc/academy_workspace_mutate',()=>f.mutate('review_enrollment',e.id,e.revision,{decision:'approve',note:'Self approval',validUntil:null})));
  await f.actor();const approval=await api(f,'/rpc/academy_workspace_mutate',()=>f.mutate('review_enrollment',e.id,e.revision,{decision:'approve',note:'Isoliert geprüft',validUntil:null}));
  assert.ok(approval.certificateId);
  await familyActor(f,account,1);view=await load(f);assert.equal(view.enrollments[0].state,'completed');
  assert.equal(view.certificates.length,1);assert.equal(view.certificates[0].audience,'family');

  // Public owner views and definer functions would bypass ordinary RLS. The
  // actual hook rejects their paths before the underlying query can execute.
  await denied(api(f,'/rpc/family_legacy_definer_fixture',()=>f.db.query('SELECT public.family_legacy_definer_fixture()')));
  await denied(api(f,'/family_legacy_owner_view_fixture',()=>f.db.query('SELECT * FROM public.family_legacy_owner_view_fixture')));
  for(const table of ['public.family_health_fixture','storage.objects','realtime.messages']) assert.equal((await f.db.query(`SELECT * FROM ${table}`)).rows.length,0);

  await f.actor();assert.equal((await manage(f,'rotate',account)).access.access_generation,2);
  await familyActor(f,account,1);await denied(load(f));await denied(own(f,'complete_lesson',original,{lessonId:'reading'},{request:replayId}));
  await serviceActor(f);assert.equal((await identity(f,account)).accessGeneration,2);
  await bindAuthGeneration(f,account,2,33);
  // Even if a caller presents a newer generation, the old Auth user cannot
  // regain the principal. Its old refresh-token metadata remains generation 1.
  await familyActor(f,account,2,31);await denied(load(f));
  await familyActor(f,account,2,33);assert.equal((await load(f)).certificates.length,1);
  await f.actor();assert.equal((await manage(f,'disable',account)).access.access_generation,3);
  await familyActor(f,account,2,33);await denied(load(f));
  await f.actor();assert.equal((await manage(f,'enable',account)).access.access_generation,3);
  await familyActor(f,account,2,33);await denied(load(f));
  await bindAuthGeneration(f,account,3,34);
  await familyActor(f,account,3,33);await denied(load(f));
  await familyActor(f,account,3,34);assert.equal((await load(f)).enrollments[0].state,'completed');
  await f.owner();
  const oldUsers=(await f.db.query("SELECT id,raw_app_meta_data->>'academy_access_generation' AS generation FROM auth.users WHERE id IN ($1,$2) ORDER BY id",[id(131),id(133)])).rows;
  assert.deepEqual(oldUsers,[{id:id(131),generation:'1'},{id:id(133),generation:'2'}]);
  await f.owner();await f.db.query('DELETE FROM public.client_contacts WHERE id=$1',[id(52)]);
  const orphan=(await f.db.query('SELECT account_kind,contact_id,portal_enabled,access_generation FROM public.client_portal_access WHERE id=$1',[account])).rows[0];
  assert.deepEqual(orphan,{account_kind:'academy_family',contact_id:null,portal_enabled:false,access_generation:4});
  await familyActor(f,account,3,34);await denied(load(f));

  // The new family-specific ceilings do not change existing client/employee
  // principal resolution or their assigned personal workspaces.
  await f.learner('client');assert.equal((await api(f,'/rpc/academy_workspace_load',()=>f.load('learner'))).viewer.audience,'client');
  await f.learner('employee');assert.equal((await api(f,'/rpc/academy_workspace_load',()=>f.load('learner'))).viewer.audience,'employee');
 }finally{await f.db.close();}
});
