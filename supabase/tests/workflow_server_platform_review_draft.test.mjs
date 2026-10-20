// Local captured-function regression only; no production review or identity writes.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
const require=createRequire(import.meta.url);
const {PGlite}=require('@electric-sql/pglite');
const db=new PGlite();
const metadata=JSON.parse(readFileSync(new URL('../../docs/workflow-server-write-rpc-metadata-20261011.json',import.meta.url),'utf8'));
const helperMetadata=JSON.parse(readFileSync(new URL('../../docs/workflow-server-rpc-helper-metadata-20261011.json',import.meta.url),'utf8'));
const draft=readFileSync(new URL('../../docs/workflow-server-platform-review-draft.sql',import.meta.url),'utf8');
const ordinary='10000000-0000-0000-0000-000000000001';
const client='10000000-0000-0000-0000-000000000002';
const employee='10000000-0000-0000-0000-000000000003';
const inactive='10000000-0000-0000-0000-000000000004';
const admin='10000000-0000-0000-0000-000000000005';
const owner='10000000-0000-0000-0000-000000000006';
const support='10000000-0000-0000-0000-000000000007';
const review='20000000-0000-0000-0000-000000000001';
const otherReview='20000000-0000-0000-0000-000000000002';
const sha='a'.repeat(64);
const items=[{criterionId:'synthetic-criterion',category:'synthetic',result:'passed',notes:'Synthetic',evidence:[]}];
const names=['platform_bodymap_start_review','platform_bodymap_save_review','platform_bodymap_approve_review','platform_bodymap_revoke_review'];
await db.exec(`
CREATE ROLE anon;CREATE ROLE authenticated;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
 'SELECT nullif(current_setting(''fixture.uid'',true),'''')::uuid';
CREATE TABLE platform_users(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,role text,status text);
CREATE TABLE bodymap_medical_review_runs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),variant_id text,
 asset_path text,asset_sha256 text,source_commit_sha text,checklist_version integer,status text,
 reviewer_name text,reviewer_qualification text,review_scope text,checklist_snapshot jsonb,
 decision_reason text,submitted_at timestamptz,approved_at timestamptz,approved_by uuid,revoked_at timestamptz,revoked_by uuid,
 updated_at timestamptz DEFAULT now());
CREATE TABLE bodymap_medical_review_items(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),review_id uuid,
 criterion_id text,category text,result text,notes text,evidence jsonb);
CREATE TABLE bodymap_medical_review_issues(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),review_id uuid,
 anatomical_zone_id text,view_id text,severity text,status text,title text,description text,
 surface_point jsonb,evidence jsonb,resolution text);
CREATE TABLE bodymap_medical_review_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),review_id uuid,
 variant_id text,event_type text,actor_role text,before jsonb,after jsonb,reason text);
CREATE TABLE synthetic_platform_audit(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),action text,entity text,
 entity_id uuid,tenant_id uuid,before jsonb,after jsonb,reason text);
CREATE FUNCTION platform_write_audit_log(text,text,uuid,uuid,jsonb,jsonb,text) RETURNS void LANGUAGE sql AS
 'INSERT INTO synthetic_platform_audit(action,entity,entity_id,tenant_id,before,after,reason) VALUES($1,$2,$3,$4,$5,$6,$7)';
GRANT USAGE ON SCHEMA public,auth TO anon,authenticated;
`);
for(const table of ['bodymap_medical_review_runs','bodymap_medical_review_items','bodymap_medical_review_issues','bodymap_medical_review_events']){
 await db.exec(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;GRANT SELECT,INSERT,UPDATE,DELETE ON ${table} TO authenticated;`);
}
for(const name of ['platform_current_role','platform_bodymap_can_write_review']){
 await db.exec(helperMetadata.helpers.find(f=>f.name===name).definition);
}
for(const name of names){
 const fn=metadata.functions.find(f=>f.name===name);
 await db.exec(fn.definition);
 const identity=(await db.query('SELECT pg_get_function_identity_arguments(oid) AS args FROM pg_proc WHERE proname=$1',[name])).rows[0].args;
 await db.exec(`REVOKE EXECUTE ON FUNCTION ${name}(${identity}) FROM PUBLIC;GRANT EXECUTE ON FUNCTION ${name}(${identity}) TO authenticated;`);
}
for(const [uid,role,status] of [[inactive,'platform_owner','disabled'],[admin,'platform_admin','active'],[owner,'platform_owner','active'],[support,'platform_support','active']]){
 await db.query('INSERT INTO platform_users(user_id,role,status) VALUES($1,$2,$3)',[uid,role,status]);
}
const tables=['bodymap_medical_review_runs','bodymap_medical_review_items','bodymap_medical_review_issues','bodymap_medical_review_events','synthetic_platform_audit'];
async function actor(uid=ordinary,role='authenticated'){
 await db.exec('RESET ROLE');await db.query("SELECT set_config('fixture.uid',$1,false)",[uid??'']);await db.exec('SET ROLE '+role);
}
async function resetReviews(status='in_review'){
 await db.exec('RESET ROLE');for(const table of tables)await db.exec('TRUNCATE '+table);
 await db.query(`INSERT INTO bodymap_medical_review_runs(id,variant_id,asset_sha256,status,reviewer_name)
 VALUES($1,'synthetic-variant',$2,$3,'Synthetic'),($4,'other-variant',$2,'in_review','Other')`,[review,sha,status,otherReview]);
 await db.query(`INSERT INTO bodymap_medical_review_items(review_id,criterion_id,result) VALUES($1,'synthetic-criterion','passed'),($2,'other-criterion','passed')`,[review,otherReview]);
}
async function snapshot(){
 await db.exec('RESET ROLE');const result={};for(const table of tables)result[table]=(await db.query('SELECT * FROM '+table+' ORDER BY id')).rows;return result;
}
async function start(){return (await db.query(`SELECT platform_bodymap_start_review($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) AS id`,
 ['new-synthetic-variant','synthetic.svg',sha,'synthetic-commit','Synthetic Reviewer','Synthetic Qualification','Synthetic Scope',1,[],items])).rows[0].id;}
async function save(id=review){return db.query('SELECT platform_bodymap_save_review($1,$2,$3,$4,$5,$6,$7,$8)',
 [id,'Synthetic Updated','Synthetic Qualification','Synthetic Scope','in_review',items,[],'Synthetic reason']);}
async function approve(id=review,hash=sha){return db.query('SELECT platform_bodymap_approve_review($1,1,$2,$3)',[id,hash,'Synthetic decision']);}
async function revoke(id=review){return db.query('SELECT platform_bodymap_revoke_review($1,$2)',[id,'Synthetic revoke']);}
const actions={start,save,approve,revoke};
await test('captured NULL role falls through all four authenticated Bodymap writers',async()=>{
 await resetReviews();await actor();
 assert.equal((await db.query('SELECT platform_current_role() AS role,platform_bodymap_can_write_review() AS allowed')).rows[0].role,null);
 assert.equal((await db.query('SELECT platform_bodymap_can_write_review() AS allowed')).rows[0].allowed,null);
 const id=await start();await save(id);await approve(id);await revoke(id);
 const state=await snapshot();assert.equal(state.bodymap_medical_review_runs.find(row=>row.id===id).status,'revoked');
 assert.equal(state.bodymap_medical_review_events.length,4);
});
await test('draft applies twice without changing any review, evidence or audit row',async()=>{
 const before=await snapshot();await db.exec(draft);await db.exec(draft);assert.deepEqual(await snapshot(),before);
});
for(const [label,uid,role] of [['anonymous',null,'anon'],['ordinary Auth',ordinary,'authenticated'],['client account',client,'authenticated'],['employee account',employee,'authenticated'],['inactive platform owner',inactive,'authenticated'],['platform support',support,'authenticated']]){
 for(const [name,invoke] of Object.entries(actions)){
  await test(label+' cannot '+name+' medical reviews and produces no writes',async()=>{
   await resetReviews(name==='revoke'?'approved':'in_review');const before=await snapshot();await actor(uid,role);
   await assert.rejects(invoke(),/permission denied|forbidden|owner_only/i);assert.deepEqual(await snapshot(),before);
  });
 }
}
await test('admin can start a review and save evidence for that review',async()=>{
 await resetReviews();await actor(admin);const id=await start();await save(id);const state=await snapshot();
 assert.equal(state.bodymap_medical_review_runs.find(row=>row.id===id).reviewer_name,'Synthetic Updated');
 assert.equal(state.bodymap_medical_review_events.filter(row=>row.review_id===id).length,2);
});
for(const [name,invoke] of [['approve',approve],['revoke',revoke]]){
 await test('admin cannot '+name+' a final medical review',async()=>{
  await resetReviews(name==='revoke'?'approved':'in_review');const before=await snapshot();await actor(admin);
  await assert.rejects(invoke(),/owner_only/i);assert.deepEqual(await snapshot(),before);
 });
}
await test('owner retains start/save/approve/revoke and records the real owner identity',async()=>{
 await resetReviews();await actor(owner);const id=await start();await save(id);await approve(id);await revoke(id);
 const state=await snapshot();const row=state.bodymap_medical_review_runs.find(row=>row.id===id);
 assert.equal(row.status,'revoked');assert.equal(row.approved_by,owner);
 assert.ok(state.bodymap_medical_review_events.filter(row=>row.review_id===id).every(row=>row.actor_role==='platform_owner'));
});
await test('approved reviews remain immutable to save even for an owner',async()=>{
 await resetReviews('approved');const before=await snapshot();await actor(owner);await assert.rejects(save(),/immutable_review_decision/);assert.deepEqual(await snapshot(),before);
});
await test('changed asset hash prevents approval and unrelated review evidence is preserved on save',async()=>{
 await resetReviews();const before=await snapshot();await actor(owner);await assert.rejects(approve(review,'b'.repeat(64)),/asset_changed_review_invalid/);
 assert.deepEqual(await snapshot(),before);await actor(admin);await save();const after=await snapshot();
 assert.deepEqual(after.bodymap_medical_review_items.filter(row=>row.review_id===otherReview),before.bodymap_medical_review_items.filter(row=>row.review_id===otherReview));
 assert.deepEqual(after.bodymap_medical_review_runs.find(row=>row.id===otherReview),before.bodymap_medical_review_runs.find(row=>row.id===otherReview));
});
await db.close();
