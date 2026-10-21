import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';

const T='10000000-0000-4000-8000-000000000001', OTHER='10000000-0000-4000-8000-000000000002';
const C='20000000-0000-4000-8000-000000000001', CC='30000000-0000-4000-8000-000000000001';
const FOREIGN='30000000-0000-4000-8000-000000000002', U='40000000-0000-4000-8000-000000000001';
const A='50000000-0000-4000-8000-000000000001', SELF='50000000-0000-4000-8000-000000000002';
const LEGACY='50000000-0000-4000-8000-000000000003';
const HASH=`pbkdf2-sha256:310000:${'a'.repeat(32)}:${'b'.repeat(64)}`;
const office={sub:U,role:'authenticated',app_metadata:{portal_type:'business',role_key:'admin',tenant_id:T}};
const family={sub:U,role:'authenticated',app_metadata:{portal_type:'academy_family',role_key:'family_portal',tenant_id:T,portal_account_id:A}};
const service={role:'service_role'};
let db:PGlite;
const change=readFileSync('supabase/changes/academy_family_access.sql','utf8');
const fixture=`
CREATE ROLE authenticator NOINHERIT; CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA auth; CREATE SCHEMA care_security; CREATE SCHEMA storage; CREATE SCHEMA realtime;
CREATE TABLE auth.users(id uuid PRIMARY KEY,raw_app_meta_data jsonb);
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(auth.jwt()->>'sub','')::uuid $$;
GRANT USAGE ON SCHEMA auth,public,storage,realtime,care_security TO anon,authenticated,service_role;
CREATE FUNCTION public.current_tenant_id() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT CASE WHEN coalesce(auth.jwt()->'app_metadata'->>'portal_type','business') IN ('business','client','employee') THEN (auth.jwt()->'app_metadata'->>'tenant_id')::uuid ELSE NULL END $$;
CREATE FUNCTION public.platform_tenant_access_allowed(uuid,boolean DEFAULT true) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT current_setting('app.tenant_disabled',true) IS DISTINCT FROM 'yes' $$;
CREATE FUNCTION care_security.company_permission(uuid,text) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT $1=public.current_tenant_id() AND auth.jwt()->'app_metadata'->>'role_key'='admin' AND current_setting('app.deny',true) IS DISTINCT FROM $2 $$;
CREATE FUNCTION care_security.company_profile(uuid) RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT CASE WHEN care_security.company_permission($1,'office.access') THEN auth.uid() ELSE NULL END $$;
CREATE FUNCTION care_security.company_record_access(uuid,text,uuid DEFAULT NULL,uuid DEFAULT NULL,uuid DEFAULT NULL) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT care_security.company_permission($1,$2) AND current_setting('app.scope_denied',true) IS DISTINCT FROM 'yes' $$;
CREATE TYPE public.portal_type AS ENUM ('client','employee','relative','business');
CREATE TABLE public.clients(id uuid PRIMARY KEY,tenant_id uuid NOT NULL,deleted_at timestamptz,status text DEFAULT 'active');
CREATE TABLE public.client_contacts(id uuid PRIMARY KEY,tenant_id uuid NOT NULL,client_id uuid REFERENCES public.clients(id),first_name text,last_name text,portal_permissions jsonb DEFAULT '{}');
CREATE TABLE public.client_portal_access(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,client_id uuid NOT NULL REFERENCES public.clients(id),contact_id uuid REFERENCES public.client_contacts(id) ON DELETE SET NULL,email text,status text,portal_enabled boolean DEFAULT false,portal_username text,portal_access_code_hash text,auth_user_id uuid,last_login_at timestamptz,invited_at timestamptz,code_created_at timestamptz,code_rotated_at timestamptz,modules_enabled text[] DEFAULT '{}',two_factor_enabled boolean DEFAULT false,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());
CREATE UNIQUE INDEX idx_client_portal_access_tenant_username ON public.client_portal_access(tenant_id,lower(portal_username)) WHERE portal_username IS NOT NULL;
CREATE TABLE public.portal_sessions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid,portal_type public.portal_type,status text,revoked_at timestamptz,revoked_reason text,metadata jsonb,updated_at timestamptz);
CREATE TABLE public.health_records(id integer PRIMARY KEY,secret text);
CREATE TABLE public.grant_only_table(id integer);
CREATE TABLE storage.objects(id integer PRIMARY KEY,secret text);
CREATE TABLE realtime.messages(id integer PRIMARY KEY,secret text);
ALTER TABLE public.health_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY intentionally_broad_tenant ON public.health_records FOR ALL TO authenticated USING(true) WITH CHECK(true);
ALTER TABLE public.client_portal_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY office_legacy ON public.client_portal_access FOR ALL TO authenticated USING(true) WITH CHECK(true);
CREATE VIEW public.owner_health_view AS SELECT * FROM public.health_records;
CREATE FUNCTION public.legacy_definer_health() RETURNS text LANGUAGE sql SECURITY DEFINER AS $$ SELECT secret FROM public.health_records LIMIT 1 $$;
CREATE FUNCTION public.preexisting_guard() RETURNS void LANGUAGE plpgsql AS $$ BEGIN
 PERFORM set_config('app.prior_user',current_user,true);
 IF current_setting('app.prior_deny',true)='yes' THEN RAISE EXCEPTION 'previous hook denies'; END IF;
 END $$;
ALTER ROLE authenticator SET pgrst.db_pre_request='public.preexisting_guard';
SET academy_family.confirmed_pre_request='public.preexisting_guard';
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public,storage,realtime TO authenticated,service_role;
INSERT INTO public.clients(id,tenant_id) VALUES('${C}','${T}');
INSERT INTO public.client_contacts(id,tenant_id,client_id,first_name,last_name) VALUES('${CC}','${T}','${C}','Eva','Familie');
INSERT INTO public.client_portal_access(id,tenant_id,client_id,contact_id) VALUES('${SELF}','${T}','${C}',NULL),('${LEGACY}','${T}','${C}','${CC}');
`;

async function request<T=Record<string,unknown>>(claims:unknown,path:string,sql:string,params:unknown[]=[],options:{hook?:boolean;method?:string;settings?:Record<string,string>}={}) {
 await db.exec('BEGIN');
 try {
  await db.query("SELECT set_config('request.jwt.claims',$1,true),set_config('request.path',$2,true),set_config('request.method',$3,true)",[JSON.stringify(claims),path,options.method??'POST']);
  for(const [key,value] of Object.entries(options.settings??{})) await db.query('SELECT set_config($1,$2,true)',[key,value]);
  const role=(claims as {role:string}).role;
  await db.exec(`SET LOCAL ROLE ${role==='service_role'?'service_role':role==='anon'?'anon':'authenticated'}`);
  if(options.hook!==false) await db.query('SELECT academy_family_private.request_guard()');
  const result=await db.query<T>(sql,params);
  await db.exec('COMMIT');
  return result.rows;
 } catch(error) { await db.exec('ROLLBACK');throw error; }
}
async function manage(action:string,account:string|null=null,contact:string|null=CC,extra:{username?:string;hash?:string;claims?:unknown;hook?:boolean;settings?:Record<string,string>}={}) {
 const rows=await request<{result:{access?:Record<string,unknown>;accesses?:Record<string,unknown>[];ready?:boolean}}>(extra.claims??office,'/rpc/academy_family_access_manage',
  'SELECT public.academy_family_access_manage($1,$2,$3,$4,$5,$6,$7) AS result',[T,C,contact,action,account,extra.username??(action==='setup'?'eva.familie':null),extra.hash??(['setup','rotate'].includes(action)?HASH:null)],extra);
 return rows[0].result;
}

beforeAll(async()=>{db=new PGlite();await db.exec(fixture);await db.exec(change);},30000);
afterAll(async()=>{await db.close();});
beforeEach(async()=>{
 await db.exec(`RESET ROLE; DELETE FROM public.portal_sessions; DELETE FROM academy_family_private.access_events;
 DELETE FROM public.client_portal_access WHERE account_kind='academy_family';
 INSERT INTO public.client_contacts(id,tenant_id,client_id,first_name,last_name,portal_permissions) VALUES('${CC}','${T}','${C}','Eva','Familie','{"canViewCarePlan":false}') ON CONFLICT(id) DO UPDATE SET portal_permissions=excluded.portal_permissions;
 INSERT INTO public.client_contacts(id,tenant_id,client_id,first_name,last_name) VALUES('${FOREIGN}','${OTHER}','${C}','Fremd','Kontakt') ON CONFLICT(id) DO NOTHING;
 DELETE FROM public.health_records; INSERT INTO public.health_records VALUES(1,'health secret');
 DELETE FROM storage.objects; INSERT INTO storage.objects VALUES(1,'document secret');
 DELETE FROM realtime.messages; INSERT INTO realtime.messages VALUES(1,'realtime secret');
 DELETE FROM public.grant_only_table; INSERT INTO public.grant_only_table VALUES(1);`);
});

describe('personal family Academy database boundary',()=>{
 it('backfills self and legacy identities without enabling or broadening them',async()=>{
  const rows=await db.query<{id:string;account_kind:string;access_scope:string;portal_enabled:boolean}>('SELECT id,account_kind,access_scope,portal_enabled FROM public.client_portal_access ORDER BY id');
  expect(rows.rows).toEqual([{id:SELF,account_kind:'self',access_scope:'client',portal_enabled:false},{id:LEGACY,account_kind:'legacy_contact',access_scope:'client',portal_enabled:false}]);
 });
 it('creates a separate personal account and returns no credential hash or auth link',async()=>{
  const result=await manage('setup');
  expect(result.access).toMatchObject({contact_id:CC,client_id:C,account_kind:'academy_family',access_scope:'academy',access_generation:1,modules_enabled:['academy'],portal_enabled:true});
  expect(result.access).not.toHaveProperty('portal_access_code_hash');expect(result.access).not.toHaveProperty('auth_user_id');
  const perms=await db.query<{portal_permissions:unknown}>('SELECT portal_permissions FROM public.client_contacts WHERE id=$1',[CC]);
  expect(perms.rows[0].portal_permissions).toEqual({canViewCarePlan:false});
  expect((await manage('list',null,null)).accesses).toHaveLength(1);
  await expect(manage('setup')).rejects.toThrow(/bereits/);
 });
 it('fails closed when the live request hook is missing and exposes that state in list',async()=>{
  expect((await manage('list',null,null,{hook:false})).ready).toBe(false);
  await expect(manage('setup',null,CC,{hook:false})).rejects.toThrow(/noch nicht/);
 });
 it('requires exact office permission, scope and contact tenancy',async()=>{
  await expect(manage('setup',null,FOREIGN)).rejects.toThrow(/gehört nicht/);
  await expect(manage('setup',null,CC,{settings:{'app.deny':'office.clients.manage_consents'}})).rejects.toThrow(/nicht freigegeben/);
  await expect(manage('setup',null,CC,{settings:{'app.scope_denied':'yes'}})).rejects.toThrow(/nicht freigegeben/);
  await expect(manage('setup',null,CC,{hash:'not-a-hash'})).rejects.toThrow(/Verfahren/);
 });
 it('disables only the chosen account, revokes its sessions and reactivates through exact contact binding',async()=>{
  const id=(await manage('setup')).access!.id as string;
  await db.query("INSERT INTO public.portal_sessions(tenant_id,portal_type,status,metadata) VALUES($1,'academy_family','active',$2),($1,'client','active',$3)",[T,{portal_account_id:id},{portal_account_id:SELF}]);
  expect((await manage('disable',id)).access).toMatchObject({status:'deaktiviert',portal_enabled:false,access_generation:2});
  const sessions=await db.query<{status:string;portal_type:string}>('SELECT status,portal_type FROM public.portal_sessions ORDER BY portal_type::text');
  expect(sessions.rows).toEqual([{status:'revoked',portal_type:'academy_family'},{status:'active',portal_type:'client'}]);
  expect((await manage('enable',id)).access).toMatchObject({portal_enabled:true,access_generation:2});
  await expect(manage('disable',id,FOREIGN)).rejects.toThrow(/gehört nicht/);
 });
 it('rotates a code without silently enabling a disabled account and revokes existing sessions',async()=>{
  const id=(await manage('setup')).access!.id as string;
  await db.query("INSERT INTO public.portal_sessions(tenant_id,portal_type,status,metadata) VALUES($1,'academy_family','active',$2)",[T,{portal_account_id:id}]);
  expect((await manage('rotate',id,CC,{hash:HASH.replace('b'.repeat(64),'c'.repeat(64))})).access!.access_generation).toBe(2);
  expect((await db.query<{status:string}>('SELECT status FROM public.portal_sessions')).rows[0].status).toBe('revoked');
  await manage('disable',id);
  expect((await manage('rotate',id,CC,{hash:HASH})).access).toMatchObject({portal_enabled:false,access_generation:4});
 });
 it('prevents account reclassification and fails closed when the contact is removed',async()=>{
  const id=(await manage('setup')).access!.id as string;
  await expect(db.query("UPDATE public.client_portal_access SET account_kind='self',access_scope='client' WHERE id=$1",[id])).rejects.toThrow(/Kontoart/);
  await db.query('DELETE FROM public.client_contacts WHERE id=$1',[CC]);
  const row=await db.query<{account_kind:string;portal_enabled:boolean;contact_id:null;access_generation:number}>('SELECT account_kind,portal_enabled,contact_id,access_generation FROM public.client_portal_access WHERE id=$1',[id]);
  expect(row.rows[0]).toEqual({account_kind:'academy_family',portal_enabled:false,contact_id:null,access_generation:2});
  await expect(manage('enable',id)).rejects.toThrow(/gehört nicht/);
 });
 it('forbids raw office updates to family accounts but preserves existing self operations',async()=>{
  const id=(await manage('setup')).access!.id as string;
  await expect(request(office,'/client_portal_access','UPDATE public.client_portal_access SET portal_enabled=false WHERE id=$1',[id])).rejects.toThrow(/Zugangsverwaltung/);
  await expect(request(office,'/client_portal_access','DELETE FROM public.client_portal_access WHERE id=$1',[id])).rejects.toThrow(/nicht direkt gelöscht/);
  await expect(request(office,'/client_portal_access','UPDATE public.client_portal_access SET contact_id=$1 WHERE id=$2',[CC,SELF])).rejects.toThrow(/Selbstzugang/);
  await expect(request(office,'/client_portal_access',"UPDATE public.client_portal_access SET status='aktiv' WHERE id=$1",[SELF])).resolves.toEqual([]);
 });
 it('mints identity only for service-role, active exact account/contact and active gateway',async()=>{
  const id=(await manage('setup')).access!.id as string;
  const query='SELECT public.academy_family_auth_identity($1,$2,$3) AS identity';
  const rows=await request<{identity:unknown}>(service,'/rpc/academy_family_auth_identity',query,[id,T,CC]);
  expect(rows[0].identity).toMatchObject({accountId:id,tenantId:T,contactId:CC,firstName:'Eva',lastName:'Familie',accessGeneration:1});
  await expect(request(service,'/rpc/academy_family_auth_identity',query,[id,T,FOREIGN])).rejects.toThrow(/nicht mehr aktiv/);
  await expect(request(service,'/rpc/academy_family_auth_identity',query,[id,T,CC],{hook:false})).rejects.toThrow(/nicht verfügbar/);
  await expect(request(service,'/rpc/academy_family_auth_identity',query,[id,T,CC],{settings:{'app.tenant_disabled':'yes'}})).rejects.toThrow(/nicht verfügbar/);
  await expect(request(office,'/rpc/academy_family_auth_identity',query,[id,T,CC])).rejects.toThrow(/permission denied/);
  await manage('disable',id);
  await expect(request(service,'/rpc/academy_family_auth_identity',query,[id,T,CC])).rejects.toThrow(/nicht mehr aktiv/);
 });
 it('rejects a legacy client Auth link before any old Edge deployment can mint family credentials',async()=>{
  const id=(await manage('setup')).access!.id as string;
  await db.query('INSERT INTO auth.users(id,raw_app_meta_data) VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET raw_app_meta_data=excluded.raw_app_meta_data',[U,{portal_type:'client',role_key:'client_portal',portal_account_id:id,tenant_id:T}]);
  await expect(request(service,'/client_portal_access','UPDATE public.client_portal_access SET auth_user_id=$1 WHERE id=$2',[U,id])).rejects.toThrow(/Auth-Identität/);
  await db.query('UPDATE auth.users SET raw_app_meta_data=$1 WHERE id=$2',[{portal_type:'academy_family',role_key:'family_portal',portal_account_id:id,tenant_id:T,access_scope:'academy',academy_access_generation:1,relative_contact_id:CC},U]);
  await expect(request(service,'/client_portal_access','UPDATE public.client_portal_access SET auth_user_id=$1 WHERE id=$2',[U,id])).resolves.toEqual([]);
 });
 it('binds only a fresh generation-specific Auth user and rejects an in-flight older mint after rotation',async()=>{
  const id=(await manage('setup')).access!.id as string, nextUser='40000000-0000-4000-8000-000000000002';
  const metadata=(generation:number,contact=CC)=>({portal_type:'academy_family',role_key:'family_portal',portal_account_id:id,tenant_id:T,access_scope:'academy',academy_access_generation:generation,relative_contact_id:contact});
  const bind=(user:string)=>request(service,'/client_portal_access','UPDATE public.client_portal_access SET auth_user_id=$1 WHERE id=$2',[user,id]);
  await db.query('INSERT INTO auth.users(id,raw_app_meta_data) VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET raw_app_meta_data=excluded.raw_app_meta_data',[U,metadata(1)]);
  await bind(U);
  expect((await manage('rotate',id,CC,{hash:HASH.replace('b'.repeat(64),'c'.repeat(64))})).access!.access_generation).toBe(2);
  await db.query('INSERT INTO auth.users(id,raw_app_meta_data) VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET raw_app_meta_data=excluded.raw_app_meta_data',[nextUser,metadata(2,FOREIGN)]);
  await expect(bind(nextUser)).rejects.toThrow(/Generation dieses persönlichen Kontakts/);
  await db.query('UPDATE auth.users SET raw_app_meta_data=$1 WHERE id=$2',[metadata(2),nextUser]);
  await bind(nextUser);
  await expect(bind(U)).rejects.toThrow(/Generation dieses persönlichen Kontakts/);
  expect((await db.query<{auth_user_id:string}>('SELECT auth_user_id FROM public.client_portal_access WHERE id=$1',[id])).rows[0].auth_user_id).toBe(nextUser);
  // Deactivation must still be possible while the linked user's metadata is
  // from the previous generation; it must not silently raise those metadata.
  expect((await manage('disable',id)).access!.access_generation).toBe(3);
  expect((await manage('enable',id)).access!.access_generation).toBe(3);
  expect((await db.query<{generation:number}>("SELECT (raw_app_meta_data->>'academy_access_generation')::integer AS generation FROM auth.users WHERE id=$1",[nextUser])).rows[0].generation).toBe(2);
 });
 it('denies family direct public, Storage and Realtime rows despite permissive legacy policies',async()=>{
  for(const table of ['public.health_records','public.grant_only_table','storage.objects','realtime.messages']) {
   expect(await request(family,'/ignored',`SELECT * FROM ${table}`,[],{hook:false})).toEqual([]);
   expect(await request(office,'/ignored',`SELECT * FROM ${table}`,[],{hook:false})).toHaveLength(1);
  }
  await expect(request(family,'/ignored',"INSERT INTO public.health_records VALUES(2,'injected')",[],{hook:false})).rejects.toThrow(/row-level security/);
 });
 it('blocks legacy SECURITY DEFINER RPCs and owner views at the request boundary',async()=>{
  for(const path of ['/rpc/legacy_definer_health','/owner_health_view','/health_records','/rpc/academy_family_access_manage','/rpc/academy_workspace_mutate/','/rpc/graphql']) {
   await expect(request(family,path,'SELECT public.legacy_definer_health()')).rejects.toThrow(/ausschließlich/);
  }
  await expect(request(office,'/rpc/legacy_definer_health','SELECT public.legacy_definer_health() AS secret')).resolves.toEqual([{secret:'health secret'}]);
 });
 it('allows only the exact Academy routes and preserves the existing hook identity and denial',async()=>{
  const rows=await request(family,'/rpc/academy_workspace_load',"SELECT current_setting('app.prior_user') AS caller");
  expect(rows).toEqual([{caller:'authenticated'}]);
  await expect(request(family,'/rpc/academy_workspace_mutate','SELECT 1',[],{method:'GET'})).rejects.toThrow(/ausschließlich/);
  await expect(request(family,'/rpc/academy_workspace_load','SELECT 1',[],{settings:{'request.headers':'{"accept-profile":"academy_private"}'}})).rejects.toThrow(/ausschließlich/);
  await expect(request(family,'/rpc/academy_workspace_load','SELECT 1',[],{settings:{'app.prior_deny':'yes'}})).rejects.toThrow(/previous hook denies/);
 });
 it('can be applied again without losing or recursively chaining the previous hook',async()=>{
  await db.exec(change);
  const rows=await db.query<{previous_hook:string}>('SELECT previous_hook::text FROM academy_family_private.gateway_config');
  expect(rows.rows[0].previous_hook).toBe('public.preexisting_guard()');
  expect(await request(office,'/rpc/anything',"SELECT current_setting('app.prior_user') AS caller")).toEqual([{caller:'authenticated'}]);
 });
 it('fails closed when the stored predecessor is missing or not schema-qualified',async()=>{
  try {
   await db.query("UPDATE academy_family_private.gateway_config SET previous_hook='public.missing_predecessor()'");
   await expect(request(office,'/rpc/academy_workspace_load','SELECT 1')).rejects.toThrow(/nicht mehr auflösbar/);
   await db.query("UPDATE academy_family_private.gateway_config SET previous_hook='preexisting_guard()'");
   await expect(request(office,'/rpc/academy_workspace_load','SELECT 1')).rejects.toThrow(/schemaqualifiziert/);
  } finally {
   await db.query("UPDATE academy_family_private.gateway_config SET previous_hook='public.preexisting_guard()'");
  }
 });
 it('aborts the first installation when the effective previous hook has not been confirmed',async()=>{
  const other=new PGlite();
  try{
   await other.exec(fixture);await other.exec('RESET academy_family.confirmed_pre_request');
   await expect(other.exec(change)).rejects.toThrow(/Hook-Konfiguration geprüft/);
   await other.exec('ROLLBACK');
   const rows=await other.query<{column_name:string}>("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='client_portal_access' AND column_name='account_kind'");
   expect(rows.rows).toEqual([]);
   await other.exec("SET academy_family.confirmed_pre_request='none'");
   await expect(other.exec(change)).rejects.toThrow(/stimmt nicht/);
   await other.exec('ROLLBACK');
  }finally{await other.close();}
 });
});
