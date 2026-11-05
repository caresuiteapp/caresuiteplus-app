import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
const t='11111111-1111-4111-8111-111111111111', e='22222222-2222-4222-8222-222222222222';
const v='33333333-3333-4333-8333-333333333333', s='44444444-4444-4444-8444-444444444444', u='55555555-5555-4555-8555-555555555555';
const other='66666666-6666-4666-8666-666666666666', day='2026-10-31', rev='2026-11-01T12:00:00.000Z';
const key=(kind='visit',ref=v)=>`${t}:${e}:${day}:${kind}:${ref}`;
const file=(name:string)=>readFileSync(name,'utf8');
let db:PGlite;
async function owner<T>(f:()=>Promise<T>){await db.exec('RESET ROLE');try{return await f();}finally{await db.exec('SET ROLE authenticated');}}
async function rows(sql:string){return owner(async()=> (await db.query<Record<string,any>>(sql)).rows);}
async function submit(patch:Record<string,unknown>={}) {
  const p={workDate:day,kind:'visit',ref:v,id:`visit:${v}:${day}`,start:`${day}T06:00:00Z`,end:`${day}T07:30:00Z`,pause:10,reason:'Fehlenden Abschluss nachgetragen',review:null,source:rev,...patch};
  return (await db.query<{result:Record<string,any>}>('SELECT public.employee_portal_submit_time_correction($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) result',
    [p.workDate,p.kind,p.ref,p.id,p.start,p.end,p.pause,p.reason,p.review,p.source])).rows[0].result;
}
beforeAll(async()=>{
  db=new PGlite();
  await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE SCHEMA auth;
    CREATE TABLE auth.users(id uuid primary key);CREATE TABLE tenants(id uuid primary key);
    CREATE TABLE employees(id uuid primary key,tenant_id uuid,first_name text,last_name text);
    CREATE TABLE clients(id uuid primary key,tenant_id uuid,first_name text,last_name text);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT nullif(current_setting('test.uid',true),'')::uuid$$;
    CREATE FUNCTION current_tenant_id() RETURNS uuid LANGUAGE sql AS $$SELECT nullif(current_setting('test.tenant',true),'')::uuid$$;
    CREATE FUNCTION resolve_current_employee_id() RETURNS uuid LANGUAGE sql AS $$SELECT nullif(current_setting('test.employee',true),'')::uuid$$;
    CREATE FUNCTION is_employee_portal_rls_context(uuid) RETURNS boolean LANGUAGE sql AS $$SELECT coalesce(current_setting('test.portal',true),'false')::boolean$$;
    CREATE FUNCTION has_permission(text) RETURNS boolean LANGUAGE sql AS $$SELECT current_setting('test.admin',true)='true'$$;
    CREATE FUNCTION is_tenant_admin() RETURNS boolean LANGUAGE sql AS $$SELECT false$$;
    CREATE FUNCTION set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN NEW.updated_at:=clock_timestamp(); RETURN NEW;END$$;
    CREATE TABLE workforce_work_sessions(id uuid primary key,tenant_id uuid,employee_id uuid,work_date date,started_at timestamptz,ended_at timestamptz,
      work_mode text,status text,display_status text,current_visit_id uuid,pause_minutes int default 0,gross_minutes int default 0,net_minutes int default 0,updated_at timestamptz);
    CREATE TABLE workforce_time_events(id uuid default gen_random_uuid(),tenant_id uuid,employee_id uuid,session_id uuid,reference_id uuid,event_type text,occurred_at timestamptz);
    CREATE TABLE assist_visits(id uuid primary key,tenant_id uuid,employee_id uuid,client_id uuid,legacy_assignment_id uuid,assignment_date date,
      planned_start_at timestamptz,planned_end_at timestamptz,actual_start_at timestamptz,actual_end_at timestamptz,finished_at timestamptz,
      planning_status text,canonical_status text,execution_status text,service_name text,title text,recurrence_json jsonb,updated_at timestamptz);
    CREATE TABLE assignments(id uuid,tenant_id uuid,employee_id uuid,actual_start_at timestamptz,actual_end_at timestamptz,finished_at timestamptz,planned_start_at timestamptz,assignment_date date,status text);
    CREATE TABLE assist_visit_execution_state(tenant_id uuid,visit_id uuid,service_started_at timestamptz,service_ended_at timestamptz,assignment_status text);
    CREATE TABLE workforce_team_meetings(id uuid,tenant_id uuid,starts_at timestamptz,ends_at timestamptz,status text,counts_as_work_time bool);
    CREATE TABLE workforce_team_meeting_attendees(tenant_id uuid,employee_id uuid,meeting_id uuid);
    CREATE TABLE payroll_month_statements(tenant_id uuid,employee_id uuid,status text,snapshot_json jsonb);
    CREATE TABLE assist_visit_proofs(visit_id uuid,signed_contents text);GRANT USAGE ON SCHEMA auth TO authenticated;`);
  // Real review constraints, RLS and permissions, plus the real Office approval RPC.
  await db.exec(file('supabase/migrations/0240_wfm_time_reviews_phase2_p21.sql'));
  await db.exec("ALTER TABLE workforce_time_entry_reviews ADD COLUMN export_status text default 'not_exported';GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;");
  await db.exec(file('supabase/migrations/20261018041917_wfm_office_review_revision.sql'));
  await db.exec(file('supabase/patches/employee_portal_time_follow_up.sql'));
  await db.exec(`CREATE SCHEMA care_security;
    CREATE FUNCTION care_security.office_actor(uuid,text) RETURNS boolean LANGUAGE sql AS $$SELECT coalesce(current_setting('test.hr',true),'false')::boolean$$;
    ALTER TABLE payroll_month_statements ADD COLUMN id uuid PRIMARY KEY DEFAULT gen_random_uuid(),ADD COLUMN period_year int,ADD COLUMN period_month int,ADD COLUMN version int DEFAULT 1;
    CREATE TABLE payroll_month_audit_log(id uuid DEFAULT gen_random_uuid(),tenant_id uuid,statement_id uuid,employee_id uuid,action text,actor_id uuid,summary text,metadata jsonb);
    GRANT USAGE ON SCHEMA care_security TO authenticated;
    GRANT SELECT ON payroll_month_statements,payroll_month_audit_log TO authenticated;`);
  await db.exec(file('supabase/patches/payroll_time_acceptance.sql'));
},60000);
beforeEach(async()=>{
  await db.exec(`RESET ROLE;DROP TRIGGER IF EXISTS fail_follow_up_audit ON workforce_time_review_actions;DROP TRIGGER IF EXISTS fail_payroll_acceptance_audit ON payroll_month_audit_log;TRUNCATE payroll_month_audit_log;
    TRUNCATE workforce_time_review_actions,workforce_time_entry_reviews,workforce_time_events,workforce_work_sessions,assist_visits,payroll_month_statements,assist_visit_proofs,employees,clients,tenants,auth.users CASCADE;
    INSERT INTO tenants VALUES('${t}');INSERT INTO employees VALUES('${e}','${t}','Test','Person'),('${other}','${t}','Other','Person');
    INSERT INTO auth.users VALUES('${u}');INSERT INTO clients VALUES('${other}','${t}','Test','Client');
    INSERT INTO assist_visits(id,tenant_id,employee_id,client_id,assignment_date,planned_start_at,planned_end_at,actual_start_at,planning_status,canonical_status,updated_at)
      VALUES('${v}','${t}','${e}','${other}','${day}','${day}T06:00Z','${day}T07:30Z','${day}T06:00Z','confirmed','completed','${rev}');
    INSERT INTO workforce_work_sessions(id,tenant_id,employee_id,work_date,started_at,work_mode,current_visit_id,updated_at)
      VALUES('${s}','${t}','${e}','${day}','${day}T06:00Z','field','${v}','${rev}');
    INSERT INTO workforce_time_events(tenant_id,employee_id,session_id,reference_id,event_type,occurred_at)
      VALUES('${t}','${e}','${s}','${v}','visit_started','${day}T06:00Z');
    INSERT INTO assist_visit_proofs VALUES('${v}','signed original');
    SELECT set_config('test.uid','${u}',false),set_config('test.tenant','${t}',false),set_config('test.employee','${e}',false),
      set_config('test.portal','true',false),set_config('test.admin','false',false);SET ROLE authenticated;`);
});
afterAll(()=>db?.close());

const deferred={ key:`2026-10:visit:${v}:${day}`,entryId:`visit:${v}:${day}`,originYear:2026,originMonth:10,workDate:day,
  assignmentId:v,visitId:v,sessionId:s,plannedStartAt:`${day}T06:00:00Z`,clientLabel:'Test Client',assignmentTitle:'Begleitung',reason:'incomplete' };
beforeEach(async()=>{
  await submit();
  await owner(()=>db.query("INSERT INTO payroll_month_statements(tenant_id,employee_id,status,period_year,period_month,snapshot_json) VALUES($1,$2,'published',2026,10,$3)",[t,e,JSON.stringify({deferredTimeEntries:[deferred]})]));
  await db.exec("SELECT set_config('test.admin','true',false),set_config('test.hr','true',false),set_config('test.portal','false',false)");
});
async function accept(month=11,extra:Record<string,unknown>={}){
  const review=(await rows('SELECT * FROM workforce_time_entry_reviews'))[0];
  const p={tenant:t,employee:e,key:deferred.key,review:review.id,revision:review.updated_at,year:2026,month,acceptance:null,...extra};
  return (await db.query<{result:Record<string,any>}>('SELECT public.payroll_accept_corrected_time($1,$2,$3,$4,$5,$6,$7,$8) result',
    [p.tenant,p.employee,p.key,p.review,p.revision,p.year,p.month,p.acceptance])).rows[0].result;
}
function snapshot(a:Record<string,any>){return {currentPeriodWorkMinutes:0,catchUpWorkMinutes:80,actualWorkMinutes:80,deferredTimeEntries:[],
  catchUpTimeEntries:[{...deferred,acceptanceId:a.id,sourceEntryId:a.source_entry_id,minutes:80,travelMinutes:0,actualStartAt:a.office_entry.actualStartAt,actualEndAt:a.office_entry.actualEndAt,reviewedAt:null}]};}
async function assertRollover(value:Record<string,any>,month=11){return db.query('SELECT public.payroll_office_assert_time_rollovers($1,$2,2026,$3,$4)',[t,e,month,JSON.stringify(value)]);}
describe('explicit current-month and next-month payroll acceptance',()=>{
  it.each([10,11])('approves and reserves the correction for month %i without rewriting the published origin',async(month)=>{
    const old=await rows('SELECT to_jsonb(p) value FROM payroll_month_statements p');
    const visit=await rows('SELECT to_jsonb(v) value FROM assist_visits v');
    const accepted=await accept(month);
    expect(accepted).toMatchObject({target_year:2026,target_month:month,deferred_key:deferred.key,office_entry:expect.objectContaining({netMinutes:80})});
    expect((await rows('SELECT * FROM workforce_time_entry_reviews'))[0].review_status).toBe('approved');
    expect(await rows('SELECT to_jsonb(p) value FROM payroll_month_statements p')).toEqual(old);
    expect(await rows('SELECT to_jsonb(v) value FROM assist_visits v')).toEqual(visit);
    expect((await rows('SELECT * FROM payroll_month_audit_log'))[0]).toMatchObject({action:'time_accepted'});
    await expect(assertRollover(snapshot(accepted),month)).resolves.toBeDefined();
    await expect(assertRollover(snapshot(accepted),month===10?11:10)).rejects.toThrow(/nicht.*angenommen/);
  });
  it('does not auto-include a corrected and approved time without a period acceptance',async()=>{
    const fake={id:randomUUID(),source_entry_id:deferred.entryId,office_entry:{actualStartAt:`${day}T06:00:00Z`,actualEndAt:`${day}T07:30:00Z`}};
    await expect(assertRollover(snapshot(fake))).rejects.toThrow(/nicht.*angenommen/);
  });
  it.each(['confirmed','locked','paid'])('rejects accepting into a %s month but allows its following month',async(status)=>{
    await owner(()=>db.query('UPDATE payroll_month_statements SET status=$1',[status]));
    await expect(accept(10)).rejects.toThrow(/Abrechnung.*bestätigt/);
    expect((await accept(11)).target_month).toBe(11);
  });
  it('retargets an unpublished acceptance only with its current revision and does not duplicate audit on retry',async()=>{
    const review=(await rows('SELECT * FROM workforce_time_entry_reviews'))[0];
    const first=await accept(10);
    const retry=await accept(10,{revision:review.updated_at});expect(retry.id).toBe(first.id);
    expect(await rows('SELECT * FROM payroll_month_audit_log')).toHaveLength(1);
    await expect(accept(11)).rejects.toThrow(/inzwischen/);
    const moved=await accept(11,{acceptance:first.updated_at});expect(moved.id).toBe(first.id);expect(moved.target_month).toBe(11);
    expect(await rows('SELECT * FROM payroll_time_acceptances')).toHaveLength(1);
    await expect(assertRollover(snapshot(moved),10)).rejects.toThrow(/nicht.*angenommen/);
  });
  it('keeps a published catch-up frozen and disallows accepting it a second time',async()=>{
    const first=await accept(11),saved=snapshot(first);
    await owner(()=>db.query("INSERT INTO payroll_month_statements(tenant_id,employee_id,status,period_year,period_month,snapshot_json) VALUES($1,$2,'published',2026,11,$3)",[t,e,JSON.stringify(saved)]));
    await expect(accept(12,{acceptance:first.updated_at})).rejects.toThrow(/bereits.*berücksichtigt/);
    await owner(()=>db.exec("UPDATE workforce_time_entry_reviews SET metadata=jsonb_set(metadata,'{office_time_entry,netMinutes}','90')"));
    await expect(assertRollover(saved)).resolves.toBeDefined();
  });
  it('rejects changes to accepted values and forged minutes at publication',async()=>{
    const first=await accept(11),saved=snapshot(first);
    const tampered=structuredClone(saved);tampered.catchUpTimeEntries[0].minutes=81;tampered.catchUpWorkMinutes=81;tampered.actualWorkMinutes=81;
    await expect(assertRollover(tampered)).rejects.toThrow(/nicht.*angenommen/);
    await owner(()=>db.exec("UPDATE workforce_time_entry_reviews SET metadata=jsonb_set(metadata,'{office_time_entry,netMinutes}','90')"));
    await expect(assertRollover(saved)).rejects.toThrow(/nicht.*angenommen/);
  });
  it('prevents a second alias from reserving the same source and rejects arbitrary source identities',async()=>{
    const first=await accept();
    const alias={...deferred,key:'2026-10:planned-alias',entryId:'planned-alias'};
    await owner(()=>db.query("UPDATE payroll_month_statements SET snapshot_json=$1",[JSON.stringify({deferredTimeEntries:[deferred,alias]})]));
    await expect(accept(12,{key:alias.key})).rejects.toThrow(/andere.*angenommen/);
    await expect(accept(12,{key:'missing'})).rejects.toThrow(/noch nicht/);
    await expect(accept(12,{employee:other})).rejects.toThrow(/noch nicht/);
    expect((await rows('SELECT * FROM payroll_time_acceptances'))[0].id).toBe(first.id);
  });
  it('blocks portal, missing HR access, stale review revisions, and direct writes',async()=>{
    await db.exec("SELECT set_config('test.hr','false',false)");await expect(accept()).rejects.toThrow(/Berechtigung/);
    await db.exec("SELECT set_config('test.hr','true',false),set_config('test.admin','false',false)");await expect(accept()).rejects.toThrow(/Berechtigung/);
    await db.exec("SELECT set_config('test.admin','true',false)");await expect(accept(11,{revision:rev})).rejects.toThrow(/inzwischen/);
    await expect(db.exec('UPDATE payroll_time_acceptances SET target_month=12')).rejects.toThrow(/permission denied/);
  });
  it('rolls approval, reservation and both audits back together if payroll auditing fails',async()=>{
    await owner(()=>db.exec("CREATE FUNCTION fail_acceptance_audit() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'audit unavailable';END$$;CREATE TRIGGER fail_payroll_acceptance_audit BEFORE INSERT ON payroll_month_audit_log FOR EACH ROW EXECUTE FUNCTION fail_acceptance_audit()"));
    await expect(accept()).rejects.toThrow(/audit unavailable/);
    expect((await rows('SELECT * FROM workforce_time_entry_reviews'))[0].review_status).toBe('pending_review');
    expect(await rows('SELECT * FROM payroll_time_acceptances')).toHaveLength(0);
    expect(await rows('SELECT * FROM workforce_time_review_actions')).toHaveLength(1);
  });
});
