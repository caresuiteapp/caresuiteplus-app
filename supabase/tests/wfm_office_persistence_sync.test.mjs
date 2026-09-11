// Uses the existing isolated PostgreSQL runtime; never connects to production.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
const db = new PGlite();
const sql = name => readFileSync(new URL(`../migrations/${name}.sql`, import.meta.url), 'utf8');
const t='10000000-0000-4000-8000-000000000001', e='20000000-0000-4000-8000-000000000001', r='30000000-0000-4000-8000-000000000001';
const key=`${t}:${e}:2026-08-03:manual:${r}`;
await db.exec(`
CREATE ROLE authenticated; CREATE ROLE anon; CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE SQL AS $$ SELECT '${r}'::uuid $$;
CREATE FUNCTION current_tenant_id() RETURNS uuid LANGUAGE SQL AS $$ SELECT current_setting('test.tenant')::uuid $$;
CREATE FUNCTION has_permission(text) RETURNS boolean LANGUAGE SQL AS $$ SELECT current_setting('test.allowed')::boolean $$;
CREATE FUNCTION is_tenant_admin() RETURNS boolean LANGUAGE SQL AS $$ SELECT false $$;
CREATE TABLE employees(id uuid primary key,tenant_id uuid,profile_id uuid,created_at timestamptz);
CREATE TABLE assignments(id uuid,tenant_id uuid,employee_id uuid);
CREATE TABLE workforce_time_entry_reviews(id uuid primary key default gen_random_uuid(),tenant_id uuid NOT NULL,employee_id uuid REFERENCES employees(id),work_date date,
 entry_kind text,reference_id uuid,reference_key text,review_status text,export_blocking boolean,review_note text,office_comment text,reviewed_at timestamptz,reviewed_by uuid,
 metadata jsonb default '{}',updated_at timestamptz default clock_timestamp(),export_status text default 'not_exported',
 CONSTRAINT workforce_time_entry_reviews_tenant_reference_key_unique UNIQUE(tenant_id,reference_key));
CREATE TABLE workforce_time_review_actions(id uuid default gen_random_uuid(),tenant_id uuid,entry_review_id uuid REFERENCES workforce_time_entry_reviews(id),action text,prev_status text,new_status text,
 reason text,comment text,old_value jsonb,new_value jsonb,actor_id uuid,source text,metadata jsonb,created_at timestamptz default clock_timestamp());
INSERT INTO employees(id,tenant_id) VALUES('${e}','${t}');
SELECT set_config('test.tenant','${t}',false),set_config('test.allowed','true',false);
`);
await db.exec(sql('0261_wfm_time_review_atomic_repair'));
await db.exec(sql('20260911100000_wfm_office_time_entry_persistence'));
const snapshot={id:r,tenantId:t,employeeId:e,workDate:'2026-08-03',source:'manual_addition',workKind:'buero',actualStartAt:'2026-08-03T08:00:00Z',actualEndAt:'2026-08-03T10:00:00Z',pauseMinutes:15,flags:[]};
const save=async(entry=snapshot,revision=null,tenant=t)=> (await db.query('SELECT * FROM wfm_save_office_time_entry($1,$2,$3,$4,$5,$6,$7,$8,$9)',[tenant,e,'2026-08-03','manual',r,key,entry,'Zeit ergänzt',revision])).rows[0];
const read=async(query)=> (await db.query(query)).rows;
await test('manual entry survives a database read; exact retry creates no duplicate audit',async()=>{
 const first=await save(); assert.equal(first.metadata.office_time_entry.pauseMinutes,15);
 const count=(await read('SELECT count(*)::int n FROM workforce_time_review_actions'))[0].n;
 const retry=await save(); assert.equal(retry.id,first.id);
 assert.equal((await read('SELECT count(*)::int n FROM workforce_time_review_actions'))[0].n,count);
 assert.equal((await read('SELECT count(*)::int n FROM workforce_time_entry_reviews'))[0].n,1);
});
await test('stale edits cannot overwrite the current revision',async()=>{
 const first=await save(); const revised={...snapshot,source:'correction',pauseMinutes:30};
 const current=await save(revised,first.updated_at);
 await assert.rejects(()=>save({...revised,pauseMinutes:45},first.updated_at),/inzwischen geändert/);
 assert.equal((await read('SELECT metadata FROM workforce_time_entry_reviews'))[0].metadata.office_time_entry.pauseMinutes,30);
 assert.notEqual(current.updated_at.toISOString(),first.updated_at.toISOString());
});
await test('permission and tenant isolation apply on the server',async()=>{
 await db.exec("SELECT set_config('test.allowed','false',false)"); await assert.rejects(()=>save(),/Berechtigung/);
 await db.exec("SELECT set_config('test.allowed','true',false)"); await assert.rejects(()=>save(snapshot,null,e),/Berechtigung/);
});
await test('invalid inputs leave no partial change',async()=>{
 for(const entry of [{...snapshot,pauseMinutes:-1},{...snapshot,pauseMinutes:121},{...snapshot,pauseMinutes:1.5},{...snapshot,actualEndAt:snapshot.actualStartAt},{...snapshot,flags:null}]) await assert.rejects(()=>save(entry));
 assert.equal((await read('SELECT metadata FROM workforce_time_entry_reviews'))[0].metadata.office_time_entry.pauseMinutes,30);
});
await test('exported entries remain locked',async()=>{
 await db.exec("UPDATE workforce_time_entry_reviews SET export_status='exported'");
 const row=(await read('SELECT * FROM workforce_time_entry_reviews'))[0];
 await assert.rejects(()=>save({...snapshot,pauseMinutes:10},row.updated_at),/Exportierte/);
 await db.exec("UPDATE workforce_time_entry_reviews SET export_status='not_exported'");
});
await test('audit failure rolls back the correction and review together',async()=>{
 await db.exec("ALTER TABLE workforce_time_review_actions ADD CONSTRAINT fail_audit CHECK (comment IS DISTINCT FROM 'Zeitwerte dauerhaft gespeichert') NOT VALID");
 const row=(await read('SELECT * FROM workforce_time_entry_reviews'))[0];
 await assert.rejects(()=>save({...snapshot,source:'correction',pauseMinutes:5},row.updated_at),/fail_audit/);
 assert.equal((await read('SELECT metadata FROM workforce_time_entry_reviews'))[0].metadata.office_time_entry.pauseMinutes,30);
 await db.exec('ALTER TABLE workforce_time_review_actions DROP CONSTRAINT fail_audit');
});
await db.exec(`
CREATE TABLE employee_payroll_settings(tenant_id uuid,employee_id uuid,mileage_rate_cents integer);
CREATE TABLE employee_logbook_profiles(tenant_id uuid,employee_id uuid,mileage_rate_cents integer);
CREATE TABLE employee_logbook_trips(id uuid primary key default gen_random_uuid(),tenant_id uuid,employee_id uuid,assignment_id uuid,purpose text,route_type text,status text,started_at timestamptz,ended_at timestamptz,distance_final_km numeric,start_address text,end_address text,mileage_rate_cents integer,mileage_amount_cents integer,counts_as_work_time boolean,duration_seconds integer,worktime_deduction_minutes integer,updated_at timestamptz);
CREATE TABLE assist_driving_log(id uuid primary key default gen_random_uuid(),tenant_id uuid,visit_id uuid,employee_id uuid,purpose text,travel_type text,started_at timestamptz,ended_at timestamptz,distance_km numeric,start_address text,end_address text,status text,notes text,payroll_eligible boolean,work_time_eligible boolean,logbook_eligible boolean,mileage_rate_cents integer,mileage_amount_cents integer,updated_at timestamptz);
CREATE TABLE employee_expense_claims(tenant_id uuid,employee_id uuid,expense_date date,category text,description text,amount_cents integer,approved_amount_cents integer,mileage_km numeric,mileage_rate_cents integer,origin text,destination text,business_purpose text,tax_treatment text,status text,submitted_at timestamptz,assignment_id uuid,driving_log_id uuid,travel_type text,automatic_source boolean,rejection_reason text,updated_at timestamptz,reviewed_at timestamptz,reviewed_by uuid);
CREATE UNIQUE INDEX expense_log_unique ON employee_expense_claims(tenant_id,driving_log_id) WHERE driving_log_id IS NOT NULL;
`);
const prepare=sql('20260822123000_employee_logbook_live_r1').match(/CREATE OR REPLACE FUNCTION public.prepare_employee_logbook_trip\(\)[\s\S]*?END \$\$;/)[0];
await db.exec(prepare);
await db.exec(sql('20260911101000_wfm_logbook_payroll_sync'));
await db.exec('CREATE TRIGGER employee_logbook_sync_payroll AFTER INSERT OR UPDATE ON employee_logbook_trips FOR EACH ROW EXECUTE FUNCTION sync_employee_logbook_to_payroll()');
await test('trip dates, time, assignment and reimbursement follow a correction',async()=>{
 await db.exec(`INSERT INTO employee_logbook_trips(id,tenant_id,employee_id,assignment_id,purpose,route_type,status,started_at,ended_at,distance_final_km) VALUES('${r}','${t}','${e}','${r}','Einsatzfahrt','client_to_client','completed','2026-08-31 21:00Z','2026-08-31 21:30Z',10)`);
 assert.equal((await read('SELECT amount_cents FROM employee_expense_claims'))[0].amount_cents,300);
 await db.exec("UPDATE employee_expense_claims SET status='approved',approved_amount_cents=300");
 await db.exec(`UPDATE employee_logbook_trips SET started_at='2026-08-31 22:15Z',ended_at='2026-08-31 23:00Z',distance_final_km=20,assignment_id='${e}'`);
 const claim=(await read('SELECT * FROM employee_expense_claims'))[0];
 assert.equal(claim.expense_date.toISOString().slice(0,10),'2026-09-01'); assert.equal(claim.assignment_id,e);
 assert.equal(claim.amount_cents,600); assert.equal(claim.status,'submitted'); assert.equal(claim.approved_amount_cents,null);
 await db.exec("UPDATE employee_logbook_trips SET started_at='2026-08-31 22:30Z'");
 assert.equal((await read('SELECT duration_seconds FROM employee_logbook_trips'))[0].duration_seconds,1800);
 assert.equal((await read('SELECT count(*)::int n FROM employee_expense_claims'))[0].n,1);
});
await test('cancelled and private trips no longer leave payable reimbursements',async()=>{
 await db.exec("UPDATE employee_logbook_trips SET status='cancelled'");
 assert.equal((await read('SELECT status FROM employee_expense_claims'))[0].status,'rejected');
 assert.equal((await read('SELECT payroll_eligible FROM assist_driving_log'))[0].payroll_eligible,false);
 await db.exec("UPDATE employee_logbook_trips SET status='completed'");
 assert.equal((await read('SELECT status FROM employee_expense_claims'))[0].status,'submitted');
 assert.equal((await read('SELECT payroll_eligible FROM assist_driving_log'))[0].payroll_eligible,true);
 await db.exec("UPDATE employee_logbook_trips SET status='corrected',route_type='private_non_business'");
 assert.equal((await read('SELECT status FROM employee_expense_claims'))[0].status,'rejected');
});
await test('already reimbursed amounts reject a trip rewrite atomically',async()=>{
 await db.exec("UPDATE employee_logbook_trips SET route_type='client_to_client'; UPDATE employee_expense_claims SET status='reimbursed',approved_amount_cents=600");
 await assert.rejects(()=>db.exec('UPDATE employee_logbook_trips SET distance_final_km=30'),/bereits erstattet/);
 assert.equal((await read('SELECT distance_final_km FROM employee_logbook_trips'))[0].distance_final_km,'20');
});
await db.close();
