// Runs the actual staged SQL with simulated sessions, two tenants and PostgreSQL RLS.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {fixture, directorySource} from './fixtures.mjs';
import {hasDraftShape,hasProfileShape} from '../../src/lib/gkvExchange/model.ts';
import {exchangeStatements,stagingExchangeBody} from '../../scripts/build-gkv-staging-exchange.mjs';
const setup=`
 CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
 CREATE SCHEMA auth; CREATE SCHEMA care_security; GRANT USAGE ON SCHEMA auth,care_security TO authenticated;
 ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated,service_role;
 ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon,authenticated,service_role;
 ALTER DEFAULT PRIVILEGES IN SCHEMA care_security GRANT ALL ON TABLES TO service_role;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.u',true),'')::uuid $$;
 CREATE FUNCTION public.current_tenant_id() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.t',true),'')::uuid $$;
 CREATE FUNCTION public.current_portal_type() RETURNS text LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.portal',true),'') $$;
 CREATE FUNCTION public.current_portal_account_id() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.account',true),'')::uuid $$;
 CREATE FUNCTION public.resolve_current_employee_id() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.employee',true),'')::uuid $$;
 CREATE FUNCTION care_security.office_actor(uuid,text) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT $2=ANY(string_to_array(current_setting('test.permissions',true),',')) $$;
 CREATE TABLE public.tenants(id uuid PRIMARY KEY);
 CREATE TABLE public.invoices(id uuid PRIMARY KEY,tenant_id uuid,invoice_number text);
 CREATE TABLE public.roles(id uuid PRIMARY KEY,key text UNIQUE NOT NULL);
 CREATE TABLE public.role_permissions(role_id uuid,permission_key text,can_view boolean,can_create boolean);
 CREATE TABLE public.profiles(id uuid PRIMARY KEY,auth_user_id uuid,tenant_id uuid,role_id uuid,status text,is_active boolean);
 CREATE TABLE public.employee_portal_accounts(id uuid PRIMARY KEY,auth_user_id uuid,tenant_id uuid,employee_id uuid,status text);
 CREATE TABLE public.assignments(id uuid PRIMARY KEY,tenant_id uuid);
 CREATE TABLE public.assist_visits(id uuid PRIMARY KEY,tenant_id uuid,legacy_assignment_id uuid);
 CREATE TABLE public.assignment_tasks(id uuid PRIMARY KEY,tenant_id uuid,assignment_id uuid,title text,status text,not_done_reason text);
 CREATE TABLE public.assist_visit_tasks(id uuid PRIMARY KEY,tenant_id uuid,visit_id uuid,title text,status text,not_done_reason text);`;
test('Staging exchange package: actual DDL, privileges, commands and scoped proof helpers',async t=>{
 const db=new PGlite(); const q=(sql,args=[])=>db.query(sql,args);
 const one=async(sql,args=[])=>(await q(sql,args)).rows[0].out;
 const tenant=randomUUID(),other=randomUUID(),user=randomUUID(),role=randomUUID(),employee=randomUUID(),account=randomUUID();
 const visit=randomUUID(),assign=randomUUID(),task=randomUUID(),oldTask=randomUUID();
 const claim=async (key,value)=>q('SELECT set_config($1,$2,false)',['test.'+key,value]);
 async function identity({u=user,t=tenant,portal='business',permissions='office.invoices.view,office.invoices.create'}={}){
   await db.exec('RESET ROLE'); for(const [k,v] of Object.entries({u,t,portal,permissions,employee,account}))await claim(k,v);
 }
 const match=(tasks,legacy=false,scope=tenant,v=visit,a=assign)=>one('SELECT public.workflow_tasks_match($1::jsonb,$2,$3,$4,$5) out',[tasks===undefined?null:JSON.stringify(tasks),scope,v,a,legacy]);
 const allowed=(tid=tenant,emp=employee)=>one('SELECT public.workflow_record_actor_allowed($1,$2) out',[tid,emp]);
 const cmd=(action,input,req=randomUUID(),tid=tenant)=>one('SELECT public.gkv_exchange_command($1,$2,$3,$4::jsonb) out',[tid,req,action,JSON.stringify(input)]);
 try{
  await db.exec(setup);
  await t.test('the guarded migration rejects a different target before creating objects',async()=>{
   await db.exec("CREATE SCHEMA supabase_migrations; CREATE TABLE supabase_migrations.schema_migrations(version text); BEGIN");
   await assert.rejects(db.exec(await stagingExchangeBody()),/Different staging history/);
   await db.exec('ROLLBACK'); assert.equal(await one("SELECT to_regclass('public.gkv_exchange_batches') AS out"),null);
  });
  await db.transaction(async tx=>{await tx.exec(await exchangeStatements());});
  await q('INSERT INTO tenants VALUES ($1),($2)',[tenant,other]); await q('INSERT INTO roles VALUES($1,$2)',[role,'office']);
  await q("INSERT INTO profiles VALUES($1,$1,$2,$3,'active',true)",[user,tenant,role]);
  await q("INSERT INTO role_permissions VALUES($1,'assist.records.create',true,false)",[role]);
  await q("INSERT INTO employee_portal_accounts VALUES($1,$2,$3,$4,'active')",[account,user,tenant,employee]);
  await q('INSERT INTO assignments VALUES ($1,$2)',[assign,tenant]);
  await q('INSERT INTO assist_visits VALUES ($1,$2,$3)',[visit,tenant,assign]);
  await t.test('global and tenant-specific roles, disabled grants and personal portal identities fail closed',async()=>{
   await identity(); assert.equal(await allowed(),true); assert.equal(await allowed(other),false);
   await claim('t',''); assert.equal(await allowed(),false); await identity({u:''}); assert.equal(await allowed(),false);
   await identity({portal:'client'}); assert.equal(await allowed(),false);
   await identity({portal:'employee'}); assert.equal(await allowed(),true); assert.equal(await allowed(tenant,randomUUID()),false);
   await claim('account',randomUUID()); assert.equal(await allowed(),false);
   await identity(); await q('UPDATE role_permissions SET can_view=false'); assert.equal(await allowed(),false);
   await q("UPDATE role_permissions SET permission_key='records',can_create=true"); assert.equal(await allowed(),true);
   await db.exec('ALTER TABLE roles ADD COLUMN tenant_id uuid; ALTER TABLE role_permissions ADD COLUMN tenant_id uuid');
   await q('UPDATE roles SET tenant_id=$1',[other]); assert.equal(await allowed(),false);
   await q('UPDATE roles SET tenant_id=$1',[tenant]); await q('UPDATE role_permissions SET tenant_id=$1',[other]); assert.equal(await allowed(),false);
   await q('UPDATE role_permissions SET tenant_id=$1',[tenant]); assert.equal(await allowed(),true);
   await db.exec('UPDATE profiles SET is_active=false'); assert.equal(await allowed(),false);
  });
  await t.test('an empty source, foreign visit, stale legacy copy or duplicate cannot replace actual tasks',async()=>{
   assert.equal(await match([]),true); for(const v of [null,{},undefined,42]) assert.equal(await match(v),false);
   assert.equal(await match([],false,other),false); assert.equal(await match([],false,tenant,randomUUID()),false);
   assert.equal(await match([],false,tenant,visit,randomUUID()),false); assert.equal(await match([],null),false);
   await q("INSERT INTO assignment_tasks VALUES($1,$2,$3,'Alt','skipped',' Grund ')",[oldTask,tenant,assign]);
   const previous={id:oldTask,title:'Alt',status:'not_requested',note:'Grund'};
   assert.equal(await match([]),false); assert.equal(await match([],true),false);
   assert.equal(await match([previous],true),true); assert.equal(await match([previous]),false);
   await q("INSERT INTO assist_visit_tasks VALUES($1,$2,$3,'Neu','not_possible',' Grund ')",[task,tenant,visit]);
   const current={id:task,title:'Neu',status:'not_done',completionNote:'Grund'};
   assert.equal(await match([current]),true);assert.equal(await match([previous],true),false);
   for(const value of [[],[current,current],[{...current,title:'Alt'}],[{...current,status:'invented'}],[{...current,completionNote:23}],[{...current,note:null,completionNote:'anders'}]]) assert.equal(await match(value),false);
   await q("UPDATE assist_visit_tasks SET status='invented' WHERE id=$1",[task]); assert.equal(await match([current]),false);
  });
  await t.test('canonical UTF-8 proof bytes match an independent ordered JSON digest',async()=>{
   const expected='{"a":[3,null,{"c":"Ä","z":false}],"b":"Grüße"}';
   assert.equal(await one("SELECT encode(sha256(convert_to(public.workflow_canonical_json($1::jsonb),'UTF8')),'hex') out",[JSON.stringify({b:'Grüße',a:[3,null,{z:false,c:'Ä'}]})]),createHash('sha256').update(expected).digest('hex'));
  });
  await t.test('workspace keeps request identity, revision history, scoped reads and unverified feedback',async()=>{
   await identity(); await db.exec('SET ROLE authenticated');
   const id=randomUUID(),request=randomUUID(),draft=fixture();
   assert.ok(hasDraftShape(draft));
   const input={new_id:id,draft}, first=await cmd('save',input,request);assert.deepEqual(await cmd('save',input,request),first);
   await assert.rejects(cmd('save',{...input,draft:{...draft,changed:true}},request),/Auftragskennung/);
   const m=await cmd('export_note',{id,revision:1,sha256:'a'.repeat(64)});assert.equal(m.status,'exported_test');
   await cmd('feedback_note',{id,revision:2,text:'Nur ein Prüfvermerk',verified:true,status:'accepted'});
   assert.equal(await one("SELECT details->'verified' out FROM gkv_exchange_events WHERE event_type='feedback_note'"),false);
   assert.equal(await one('SELECT status out FROM gkv_exchange_batches WHERE id=$1',[id]),'exported_test');
   await assert.rejects(cmd('cancel',{id,revision:1}),e=>e.code==='40001');
   const copyInput={batch_id:id,expected_revision:2,source_revision:1,new_id:randomUUID(),reason:'Prüfstand kopiert'};
   const copy=await one('SELECT public.gkv_exchange_copy_revision($1,$2,$3::jsonb) out',[tenant,randomUUID(),JSON.stringify(copyInput)]);
   assert.ok(hasDraftShape(copy.draft));assert.equal(copy.origin_batch_id,id);assert.equal(copy.draft.cases[0].proofConfirmed,false);
   assert.equal(await one('SELECT count(*)::int out FROM gkv_exchange_revisions WHERE batch_id=$1',[id]),2);
   const profile=await cmd('profile',{profile:draft.profile,revision:0});assert.equal(profile.revision,1);assert.ok(hasProfileShape(profile.profile));
   const d={filename:'AO-Pruefung',source:directorySource()},directory=await cmd('directory',d);
   assert.equal((await cmd('directory',d)).id,directory.id);
   await assert.rejects(q("UPDATE gkv_exchange_batches SET status='accepted' WHERE id=$1",[id]),e=>e.code==='42501');
   for(const scope of [{t:other},{portal:'employee'},{u:''}]){
    await identity(scope);await db.exec('SET ROLE authenticated');
    assert.equal(await one('SELECT count(*)::int out FROM gkv_exchange_batches WHERE id=$1',[id]),0);
    await assert.rejects(cmd('save',input),e=>e.code==='42501');
   }
   await identity({permissions:'office.invoices.view'});await db.exec('SET ROLE authenticated');
   assert.equal(await one('SELECT count(*)::int out FROM gkv_exchange_batches WHERE id=$1',[id]),1);
   await assert.rejects(cmd('save',input),e=>e.code==='42501');
   await assert.rejects(q('SELECT * FROM care_security.gkv_exchange_requests'),e=>e.code==='42501');
  });
 } finally { await db.close(); }
});
