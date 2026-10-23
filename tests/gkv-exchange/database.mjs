/** Runs the real GKV migrations in an existing, ephemeral PGlite installation.
 * The pre-existing Office verifier is represented by an explicit fail-closed
 * contract double below. This does not test Supabase Auth or that verifier's internals.
 * node --import ./tests/gkv-exchange/register.mjs tests/gkv-exchange/database.mjs /existing/pglite/dist/index.js
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { fixture, linkedFixture, tenantId, batchId, userId, invoiceId, recordId } from './fixtures.mjs';
const {PGlite}=await import(process.argv[2] || '@electric-sql/pglite');
const db=new PGlite();
const other='77777777-7777-4777-8777-777777777777';
await db.exec(`
CREATE ROLE authenticated; CREATE ROLE anon;
CREATE SCHEMA auth; CREATE SCHEMA care_security;
GRANT USAGE ON SCHEMA public,auth,care_security TO authenticated;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.user_id',true),'')::uuid $$;
CREATE FUNCTION public.current_tenant_id() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.tenant_id',true),'')::uuid $$;
CREATE FUNCTION public.current_portal_type() RETURNS text LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.portal',true),'') $$;
CREATE FUNCTION care_security.office_actor(uuid,text) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT $2=ANY(string_to_array(current_setting('test.permissions',true),',')) $$;
CREATE TABLE public.tenants(id uuid PRIMARY KEY);
CREATE TABLE public.clients(id uuid PRIMARY KEY,tenant_id uuid,first_name text,last_name text,date_of_birth date,insurance_number text,care_level text,street text,house_number text,postal_code text,city text);
CREATE TABLE public.invoices(id uuid PRIMARY KEY,tenant_id uuid,updated_at timestamptz,status text,invoice_number text,invoice_date date,total_amount numeric,client_id uuid,service_period_from date,service_period_to date,selected_proof_ids text[],include_service_proofs boolean,proof_fixture jsonb);
CREATE TABLE public.invoice_items(id uuid PRIMARY KEY,tenant_id uuid,invoice_id uuid,updated_at timestamptz,service_record_id uuid,description text,service_date date,quantity numeric,unit text,unit_price numeric,net_amount numeric,vat_amount numeric,vat_rate numeric,gross_amount numeric,sort_order integer);
CREATE TABLE public.service_records(id uuid PRIMARY KEY,tenant_id uuid,client_id uuid,updated_at timestamptz,service_date date,actual_minutes integer,billable_minutes integer,status text,billed_invoice_id uuid,source_receipt jsonb,verified_fixture boolean);
CREATE FUNCTION care_security.office_invoice_assert_source(s public.service_records,b boolean) RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF s.verified_fixture IS DISTINCT FROM true OR b IS DISTINCT FROM true THEN RAISE EXCEPTION 'Source contract rejected'; END IF; END $$;
CREATE FUNCTION care_security.office_invoice_proofs(i public.invoices) RETURNS jsonb LANGUAGE plpgsql AS $$ BEGIN IF i.proof_fixture IS NULL THEN RAISE EXCEPTION 'Proof contract rejected'; END IF; RETURN i.proof_fixture; END $$;
`);
const {source}=linkedFixture({record:true,proof:true});
await db.query('INSERT INTO tenants VALUES ($1),($2)',[tenantId,other]);
await db.query('INSERT INTO clients SELECT * FROM jsonb_populate_record(NULL::clients,$1::jsonb)',[JSON.stringify(source.client)]);
await db.query('INSERT INTO invoices SELECT * FROM jsonb_populate_record(NULL::invoices,$1::jsonb)',[JSON.stringify({...source,include_service_proofs:true,proof_fixture:source.proofs})]);
await db.query('INSERT INTO invoice_items SELECT * FROM jsonb_populate_record(NULL::invoice_items,$1::jsonb)',[JSON.stringify(source.items[0])]);
await db.query('INSERT INTO service_records SELECT * FROM jsonb_populate_record(NULL::service_records,$1::jsonb)',[JSON.stringify({...source.records[0],verified_fixture:true})]);
for(const migration of ['20261019214752_gkv_exchange_workspace.sql','20261019214757_gkv_invoice_source_snapshot.sql'])await db.exec(await readFile(new URL(`../../supabase/migrations/${migration}`,import.meta.url),'utf8'));
async function actor({tenant=tenantId,user=userId,portal='',permissions='office.invoices.view,office.invoices.create',role='authenticated'}={}){
  await db.exec('RESET ROLE');
  for(const [key,value]of Object.entries({'test.tenant_id':tenant,'test.user_id':user,'test.portal':portal,'test.permissions':permissions}))await db.query('SELECT set_config($1,$2,false)',[key,value]);
  await db.exec(`SET ROLE ${role==='anon'?'anon':'authenticated'}`);
}
async function cmd(action,input,request=randomUUID(),tenant=tenantId){return(await db.query('SELECT public.gkv_exchange_command($1,$2,$3,$4::jsonb) result',[tenant,request,action,JSON.stringify(input)])).rows[0].result;}
async function snapshot(ids=[invoiceId],tenant=tenantId){return(await db.query('SELECT public.gkv_invoice_source_snapshot($1,$2::uuid[]) result',[tenant,ids])).rows[0].result;}
async function admin(query,params=[]){await db.exec('RESET ROLE');await db.query(query,params);await actor();}

try {await test('GKV migrations execute with real PostgreSQL RLS, functions and transactions',async t=>{
  await actor();let current;
  await t.test('create, replay and audit are atomic and stable',async()=>{
    const request=randomUUID(),input={new_id:batchId,draft:fixture()};current=await cmd('save',input,request);
    assert.deepEqual(await cmd('save',input,request),current);
    assert.equal((await db.query('SELECT count(*)::int n FROM gkv_exchange_events')).rows[0].n,1);
    await assert.rejects(cmd('save',{...input,draft:{...fixture(),sequence:2}},request));
    await assert.rejects(cmd('save',input),e=>e.code==='40001');
  });
  await db.exec('RESET ROLE');
  await db.exec(await readFile(new URL('../../supabase/migrations/20261019214802_gkv_revision_history.sql',import.meta.url),'utf8'));
  await actor();
  await t.test('direct table mutations and private replay rows are inaccessible',async()=>{
    await assert.rejects(db.query("UPDATE gkv_exchange_batches SET status='accepted'"),e=>e.code==='42501');
    await assert.rejects(db.query('SELECT * FROM care_security.gkv_exchange_requests'),e=>e.code==='42501');
    await assert.rejects(db.query("UPDATE gkv_exchange_revisions SET status='accepted'"),e=>e.code==='42501');
    await assert.rejects(db.query('DELETE FROM gkv_exchange_revisions'),e=>e.code==='42501');
    await assert.rejects(db.query('INSERT INTO gkv_exchange_revisions SELECT * FROM gkv_exchange_revisions'),e=>e.code==='42501');
  });
  await t.test('optimistic revision rejects a second writer and does not add audit rows',async()=>{
    const input={id:batchId,revision:1,draft:{...fixture(),sequence:2}};current=await cmd('save',input);assert.equal(current.revision,2);
    await assert.rejects(cmd('save',input),e=>e.code==='40001');assert.equal((await db.query('SELECT count(*)::int n FROM gkv_exchange_events')).rows[0].n,2);
  });
  await t.test('other tenants and portal sessions cannot read or execute',async()=>{
    for(const scope of [{tenant:other},{tenant:''},{portal:'client'},{user:''},{permissions:''}]){
      await actor(scope);assert.equal((await db.query('SELECT count(*)::int n FROM gkv_exchange_batches')).rows[0].n,0);
      assert.equal((await db.query('SELECT count(*)::int n FROM gkv_exchange_revisions')).rows[0].n,0);
      await assert.rejects(cmd('save',{new_id:randomUUID(),draft:fixture()}),e=>e.code==='42501');
      await assert.rejects(snapshot(),e=>e.code==='42501');
    }await actor();
  });
  await t.test('office readers can inspect saved batches but cannot export or import',async()=>{
    await actor({permissions:'office.invoices.view'});assert.equal((await db.query('SELECT count(*)::int n FROM gkv_exchange_batches')).rows[0].n,1);
    assert.equal((await db.query('SELECT gkv_exchange_export_allowed($1) allowed',[tenantId])).rows[0].allowed,false);
    await assert.rejects(snapshot(),e=>e.code==='42501');await actor();
  });
  await t.test('anonymous role cannot execute the public wrappers',async()=>{
    await actor({role:'anon'});await assert.rejects(snapshot(),e=>e.code==='42501');await actor();
  });
  await t.test('foreign invoice references are rejected before persistence',async()=>{
    const draft=fixture();draft.cases[0].sourceInvoiceId=other;await assert.rejects(cmd('save',{new_id:randomUUID(),draft}),e=>e.code==='42501');
  });
  await t.test('profile revision and download labels never assert verified submission',async()=>{
    const p=await cmd('profile',{revision:0,profile:fixture().profile});assert.equal(p.revision,1);await assert.rejects(cmd('profile',{revision:0,profile:fixture().profile}),e=>e.code==='40001');
    current=await cmd('export_note',{id:batchId,revision:current.revision,sha256:'a'.repeat(64)});assert.equal(current.status,'exported_test');
    const event=(await db.query("SELECT details FROM gkv_exchange_events WHERE event_type='export_note'")).rows[0];assert.equal(event.details.verified,false);
    const note=await cmd('feedback_note',{id:batchId,revision:current.revision,text:'Testnotiz, keine Annahme'});assert.equal(note.status,'exported_test');
  });
  await t.test('canonical invoice snapshot includes every item, verified record, proof and scoped client',async()=>{
    const s=await snapshot();assert.equal(s.version,'gkv-invoice-source-v1');const i=s.invoices[0];assert.equal(i.items.length,1);assert.equal(i.records[0].id,recordId);assert.equal(i.proofs.length,1);assert.equal(i.client.id,userId);
    await assert.rejects(snapshot([invoiceId,invoiceId]));await assert.rejects(snapshot([]));await assert.rejects(snapshot([other]),e=>e.code==='40001');
  });
  await t.test('draft and cancelled source invoices cannot produce a snapshot',async()=>{
    for(const status of ['draft','cancelled']){await admin('UPDATE invoices SET status=$1 WHERE id=$2',[status,invoiceId]);await assert.rejects(snapshot(),e=>e.code==='40001');}
    await admin("UPDATE invoices SET status='issued' WHERE id=$1",[invoiceId]);
  });
  await t.test('source verifier rejection and wrong invoice ownership propagate without a partial result',async()=>{
    await admin('UPDATE service_records SET verified_fixture=false WHERE id=$1',[recordId]);await assert.rejects(snapshot(),/Source contract rejected/);
    await admin('UPDATE service_records SET verified_fixture=true,billed_invoice_id=$1 WHERE id=$2',[other,recordId]);await assert.rejects(snapshot(),e=>e.code==='40001');
    await admin('UPDATE service_records SET billed_invoice_id=$1 WHERE id=$2',[invoiceId,recordId]);
    await admin('UPDATE invoices SET proof_fixture=NULL WHERE id=$1',[invoiceId]);await assert.rejects(snapshot(),/Proof contract rejected/);
  });
  await t.test('cancelled packets cannot be changed or stamped as exported',async()=>{
    current=await cmd('cancel',{id:batchId,revision:current.revision});assert.equal(current.status,'cancelled');
    await assert.rejects(cmd('save',{id:batchId,revision:current.revision,draft:fixture()}));
    await assert.rejects(cmd('export_note',{id:batchId,revision:current.revision,sha256:'b'.repeat(64)}));
  });
  await t.test('history backfills only the current state and preserves every later saved version',async()=>{
    const rows=(await db.query('SELECT *,draft_sha256=encode(sha256(convert_to(draft::text,\'UTF8\')),\'hex\') valid_hash FROM gkv_exchange_revisions WHERE batch_id=$1 ORDER BY revision',[batchId])).rows;
    assert.deepEqual(rows.map(r=>r.revision),[1,2,3,4]);assert.ok(rows.every(r=>r.valid_hash));
    assert.equal(rows[0].capture_kind,'backfill');assert.equal(rows[0].recorded_by,null);assert.equal(rows[0].draft.sequence,1);
    assert.equal(rows[1].capture_kind,'change');assert.equal(rows[1].recorded_by,userId);assert.equal(rows[1].draft.sequence,2);
    assert.deepEqual(rows.map(r=>r.status),['draft','draft','exported_test','cancelled']);
    assert.notEqual(rows[0].draft_sha256,rows[1].draft_sha256);assert.equal(rows[1].draft_sha256,rows[2].draft_sha256);
  });
  const copy=async(input,request=randomUUID(),tenant=tenantId)=>(await db.query('SELECT public.gkv_exchange_copy_revision($1,$2,$3::jsonb) result',[tenant,request,JSON.stringify(input)])).rows[0].result;
  const copyInput=()=>({batch_id:batchId,source_revision:1,expected_revision:current.revision,new_id:randomUUID(),reason:'Fiktive Überarbeitung nach Prüfrückmeldung'});
  await t.test('revision copy preserves original, provenance and source checks while resetting confirmations',async()=>{
    const input=copyInput(),request=randomUUID(),created=await copy(input,request);
    assert.equal(created.id,input.new_id);assert.equal(created.status,'draft');assert.equal(created.revision,1);
    assert.equal(created.origin_batch_id,batchId);assert.equal(created.origin_revision,1);
    assert.equal(created.draft.sequence,1);assert.equal(created.draft.mode,'test');assert.equal(created.draft.cases[0].proofConfirmed,false);
    assert.notEqual(created.draft.createdAt,fixture().createdAt);assert.deepEqual(await copy(input,request),created);
    const parent=(await db.query('SELECT revision,status,draft FROM gkv_exchange_batches WHERE id=$1',[batchId])).rows[0];assert.equal(parent.revision,current.revision);assert.equal(parent.status,'cancelled');assert.equal(parent.draft.sequence,2);
    assert.equal((await db.query('SELECT count(*)::int n FROM gkv_exchange_revisions WHERE batch_id=$1',[created.id])).rows[0].n,1);
    const events=(await db.query("SELECT details FROM gkv_exchange_events WHERE event_type='revision_copy' AND batch_id=$1",[created.id])).rows;
    assert.equal(events.length,1);assert.equal(events[0].details.source_revision,1);assert.equal(events[0].details.text,input.reason);
    await assert.rejects(copy(input),e=>e.code==='40001');await assert.rejects(copy({...input,reason:'Anderer Auftrag'},request));
    await actor({user:other});await assert.rejects(copy(input,request));await actor();
  });
  await t.test('copy rejects stale revisions, foreign scope, missing source and missing reason atomically',async()=>{
    const before=(await db.query('SELECT count(*)::int n FROM gkv_exchange_batches')).rows[0].n;
    for(const change of [{expected_revision:current.revision-1},{source_revision:999},{batch_id:other},{new_id:null},{reason:''}])await assert.rejects(copy({...copyInput(),...change}));
    await actor({tenant:other});await assert.rejects(copy(copyInput(),randomUUID(),other));await actor();
    assert.equal((await db.query('SELECT count(*)::int n FROM gkv_exchange_batches')).rows[0].n,before);
  });
  await t.test('copy is unavailable to view-only, anonymous and portal sessions',async()=>{
    for(const scope of [{permissions:'office.invoices.view'},{portal:'employee'},{user:''},{role:'anon'}]){
      await actor(scope);await assert.rejects(copy(copyInput()),e=>e.code==='42501');
    }await actor();
  });
  await t.test('production and KIM revisions cannot be copied into a test workflow',async()=>{
    for(const change of [{mode:'production'},{channel:'kim'}]){
      const created=await cmd('save',{new_id:randomUUID(),draft:{...fixture(),...change}});
      await assert.rejects(copy({...copyInput(),batch_id:created.id,source_revision:1,expected_revision:1}),/klassische Prüfstände/);
    }
  });
  await t.test('revision cursor pages cannot repeat or hide stored states with equal timestamps',async()=>{
    const created=await cmd('save',{new_id:randomUUID(),draft:fixture()});let latest=created;
    for(let i=0;i<24;i++)latest=await cmd('save',{id:created.id,revision:latest.revision,draft:fixture()});
    const page=(before=2147483647)=>db.query('SELECT revision FROM gkv_exchange_revisions WHERE tenant_id=$1 AND batch_id=$2 AND revision<$3 ORDER BY revision DESC LIMIT 20',[tenantId,created.id,before]);
    const first=(await page()).rows,second=(await page(first.at(-1).revision)).rows;
    assert.equal(first.length,20);assert.equal(second.length,5);assert.deepEqual([...first,...second].map(r=>r.revision),Array.from({length:25},(_,i)=>25-i));
  });
  await t.test('new RPC wrappers and capture trigger have restricted execution and fixed search paths',async()=>{
    const rows=(await db.query("SELECT p.proname,n.nspname,p.prosecdef,p.proconfig,has_function_privilege('anon',p.oid,'EXECUTE') anon_execute FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE p.proname IN('gkv_exchange_copy_revision','gkv_exchange_capture_revision')")).rows;
    assert.equal(rows.length,3);assert.ok(rows.every(r=>r.proconfig.includes('search_path=pg_catalog')&&!r.anon_execute));
    assert.equal(rows.find(r=>r.nspname==='public').prosecdef,false);
    assert.equal((await db.query("SELECT has_function_privilege('authenticated','care_security.gkv_exchange_capture_revision()','EXECUTE') allowed")).rows[0].allowed,false);
  });
});}finally{await db.close();}
