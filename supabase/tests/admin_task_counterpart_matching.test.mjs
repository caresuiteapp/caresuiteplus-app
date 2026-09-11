// Executes only in isolated PostgreSQL; no production connection or client records.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {PGlite} from '@electric-sql/pglite';
const db=new PGlite();
const id=n=>`00000000-0000-4000-8000-${n.toString(16).padStart(12,'0')}`;
const tenant=id(1),visit=id(2),actor=id(3);
await db.exec(`
CREATE ROLE authenticated;
CREATE FUNCTION public.current_tenant_id() RETURNS uuid LANGUAGE SQL AS $$ SELECT current_setting('test.tenant')::uuid $$;
CREATE FUNCTION public.is_tenant_admin() RETURNS boolean LANGUAGE SQL AS $$ SELECT current_setting('test.allowed')::boolean $$;
CREATE FUNCTION public.has_permission(text) RETURNS boolean LANGUAGE SQL AS $$ SELECT false $$;
CREATE FUNCTION public.resolve_current_profile_id() RETURNS uuid LANGUAGE SQL AS $$ SELECT '${actor}'::uuid $$;
CREATE TABLE assist_visits(id uuid primary key,tenant_id uuid,legacy_assignment_id uuid,actual_start_at timestamptz,actual_end_at timestamptz,duration_minutes integer,documentation_status text,proof_status text,execution_status text,canonical_status text,billing_status text,finished_at timestamptz,updated_by uuid,updated_at timestamptz);
CREATE TABLE assignments(id uuid primary key,tenant_id uuid,status text,updated_at timestamptz);
CREATE TABLE assist_visit_tasks(id uuid primary key,tenant_id uuid,visit_id uuid,title text,sort_order integer,status text,is_required boolean,not_done_reason text,completed_at timestamptz,updated_at timestamptz);
CREATE TABLE assignment_tasks(id uuid primary key,tenant_id uuid,assignment_id uuid,title text,sort_order integer,status text,is_required boolean,not_done_reason text,updated_at timestamptz);
CREATE TABLE assist_visit_admin_audit(id uuid default gen_random_uuid(),tenant_id uuid,visit_id uuid,action text,previous_value jsonb,new_value jsonb,reason text,created_at timestamptz default now());
CREATE TABLE assist_visit_signature_requests(tenant_id uuid,visit_id uuid,status text);
CREATE TABLE assist_visit_proofs(tenant_id uuid,visit_id uuid,portal_visible boolean,portal_release_status text);
SELECT set_config('test.tenant','${tenant}',false),set_config('test.allowed','true',false);
`);
await db.exec(readFileSync(new URL('../migrations/20260911210000_admin_task_counterpart_matching.sql',import.meta.url),'utf8'));
const reset=async()=>{await db.exec(`TRUNCATE assist_visit_tasks,assignment_tasks,assist_visits,assignments,assist_visit_admin_audit;
SELECT set_config('test.tenant','${tenant}',false),set_config('test.allowed','true',false);
INSERT INTO assist_visits(id,tenant_id,legacy_assignment_id,actual_start_at,actual_end_at,duration_minutes,documentation_status,proof_status,execution_status,canonical_status,billing_status) VALUES('${visit}','${tenant}','${visit}','2026-08-26 07:02Z','2026-08-26 09:06Z',124,'complete','signed','completed','signature_open','ready');
INSERT INTO assignments(id,tenant_id,status) VALUES('${visit}','${tenant}','signature_open');`);};
const pair=async(n,title='Aufgabe '+n,vSort=n,aSort=0,status='open')=>{await db.query('INSERT INTO assist_visit_tasks(id,tenant_id,visit_id,title,sort_order,status,is_required) VALUES($1,$2,$3,$4,$5,$6,true)',[id(100+n),tenant,visit,title,vSort,status]);await db.query('INSERT INTO assignment_tasks(id,tenant_id,assignment_id,title,sort_order,status,is_required) VALUES($1,$2,$3,$4,$5,$6,true)',[id(200+n),tenant,visit,title,aSort,status]);};
const bulk=async(updates)=> (await db.query('SELECT admin_bulk_update_assist_visit_tasks($1,$2::jsonb,$3) result',[visit,JSON.stringify(updates),'Status geprüft'])).rows[0].result;
const finish=async(states)=>db.query('SELECT admin_reconcile_complete_assist_visit_follow_up($1,$2::jsonb,$3)',[visit,JSON.stringify(states),'Nachbearbeitung geprüft']);
const statuses=async()=> (await db.query("SELECT status FROM assist_visit_tasks UNION ALL SELECT status FROM assignment_tasks")).rows.map(r=>r.status);
try {
await test('unique titles reconcile different IDs and different legacy sort positions',async()=>{await reset();await pair(4);const result=await bulk([{task_id:id(204),status:'done'}]);assert.equal(result.updated,1);assert.deepEqual(await statuses(),['done','done']);const audit=(await db.query('SELECT new_value FROM assist_visit_admin_audit')).rows[0].new_value;assert.equal(audit.visit_task_id,id(104));assert.equal(audit.assignment_task_id,id(204));});
await test('reverse edits from the visit task also reconcile assignment tasks',async()=>{await reset();await pair(5);await bulk([{task_id:id(105),status:'not_possible'}]);assert.deepEqual(await statuses(),['not_possible','not_done']);});
await test('completion reconciles eleven tasks even when all assignment sort positions are zero',async()=>{await reset();for(let i=0;i<11;i++)await pair(i);await finish(Array.from({length:11},(_,i)=>({task_id:id(200+i),status:'done'})));assert.equal((await statuses()).filter(s=>s==='done').length,22);const row=(await db.query('SELECT canonical_status,proof_status,billing_status FROM assist_visits')).rows[0];assert.deepEqual(row,{canonical_status:'completed',proof_status:'signed',billing_status:'ready'});});
await test('repeated titles use an unambiguous matching position',async()=>{await reset();await pair(1,'Kontrolle',1,1);await pair(2,'Kontrolle',2,2);await bulk([{task_id:id(202),status:'done'}]);assert.deepEqual((await db.query('SELECT status FROM assist_visit_tasks ORDER BY sort_order')).rows.map(r=>r.status),['open','done']);});
await test('ambiguous duplicate positions fail and roll back the whole batch',async()=>{await reset();await pair(0,'Eindeutig');await pair(1,'Kontrolle',0,0);await pair(2,'Kontrolle',1,0);await assert.rejects(()=>bulk([{task_id:id(200),status:'done'},{task_id:id(202),status:'done'}]),/nicht eindeutig/);assert.ok((await statuses()).every(s=>s==='open'));assert.equal((await db.query('SELECT count(*)::int n FROM assist_visit_admin_audit')).rows[0].n,0);});
await test('tenant and administrative permission checks remain enforced',async()=>{await reset();await pair(1);await db.exec("SELECT set_config('test.allowed','false',false)");await assert.rejects(()=>bulk([{task_id:id(201),status:'done'}]),/Berechtigung/);await db.exec(`SELECT set_config('test.allowed','true',false),set_config('test.tenant','${id(99)}',false)`);await assert.rejects(()=>bulk([{task_id:id(201),status:'done'}]),/nicht gefunden/);});
await test('deleted references retain the existing skip-and-audit behavior',async()=>{await reset();const result=await bulk([{task_id:id(500),status:'done'}]);assert.equal(result.skipped,1);assert.equal(result.updated,0);});
await test('missing actual end still blocks completion without partial task changes',async()=>{await reset();await pair(1);await db.exec('UPDATE assist_visits SET actual_end_at=NULL');await assert.rejects(()=>finish([{task_id:id(201),status:'done'}]),/Ist-Zeiten fehlen/);assert.deepEqual(await statuses(),['open','open']);});
} finally { await db.close(); }
