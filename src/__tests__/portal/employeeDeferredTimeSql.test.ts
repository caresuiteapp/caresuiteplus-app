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
},60000);
beforeEach(async()=>{
  await db.exec(`RESET ROLE;DROP TRIGGER IF EXISTS fail_follow_up_audit ON workforce_time_review_actions;
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
describe('own deferred-time corrections in the real review workflow',()=>{
  it('keeps the signed visit unchanged, writes pending work and an audit atomically, then accepts Office approval',async()=>{
    const original=await rows('SELECT to_jsonb(v) data FROM assist_visits v');
    const result=await submit();expect(result.review_status).toBe('pending_review');
    const saved=(await rows('SELECT * FROM workforce_time_entry_reviews'))[0];
    expect(saved).toMatchObject({employee_id:e,export_blocking:true,reviewed_by:null,reviewed_at:null});
    expect(saved.metadata.office_time_entry).toMatchObject({netMinutes:80,source:'correction',reviewStatus:'pending_review',workDate:day});
    expect(await rows('SELECT to_jsonb(v) data FROM assist_visits v')).toEqual(original);
    expect((await rows('SELECT * FROM assist_visit_proofs'))[0].signed_contents).toBe('signed original');
    expect(await rows('SELECT * FROM workforce_time_review_actions')).toHaveLength(1);
    await expect(db.query('SELECT * FROM public.wfm_review_office_time_entry($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
      [t,e,day,'visit',v,key(),'approved',null,result.updated_at,JSON.stringify(saved.metadata.office_time_entry)])).rejects.toThrow(/Berechtigung/);
    await db.exec("SELECT set_config('test.admin','true',false),set_config('test.portal','false',false)");
    const approved=await db.query<Record<string,any>>('SELECT * FROM public.wfm_review_office_time_entry($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
      [t,e,day,'visit',v,key(),'approved',null,result.updated_at,JSON.stringify(saved.metadata.office_time_entry)]);
    expect(approved.rows[0].review_status).toBe('approved');
    expect(approved.rows[0].metadata.office_time_entry.netMinutes).toBe(80);
  });
  it('supports standalone sessions with their original ID and work date',async()=>{
    await owner(()=>db.exec('DELETE FROM workforce_time_events'));
    const result=await submit({kind:'session',ref:s,id:`session:${s}`});
    expect(result.entry_id).toBe(`session:${s}`);
    expect((await rows('SELECT * FROM workforce_time_entry_reviews'))[0].metadata.office_time_entry).toMatchObject({sessionId:s,visitId:null,assignmentId:null});
  });
  it('rejects another employee and another tenant without writing a review',async()=>{
    await db.exec(`SELECT set_config('test.employee','${other}',false)`);
    await expect(submit()).rejects.toThrow(/zugeordnet/);
    await db.exec(`SELECT set_config('test.employee','${e}',false),set_config('test.tenant','${other}',false)`);
    await expect(submit()).rejects.toThrow(/zugeordnet/);
    expect(await rows('SELECT * FROM workforce_time_entry_reviews')).toHaveLength(0);
  });
  it('requires a portal employee session and revokes anonymous execution',async()=>{
    await db.exec("SELECT set_config('test.portal','false',false)");await expect(submit()).rejects.toThrow(/anmeldung/);
    await db.exec('RESET ROLE;SET ROLE anon');await expect(submit()).rejects.toThrow(/permission denied/);
  });
  it.each([{reason:''},{start:'2026-10-30T22:00:00Z'},{end:'2026-10-31T05:00Z'},{end:'2999-01-01T07:30Z'},{pause:1000},{start:'-infinity'}])('rejects invalid corrections %j',async patch=>{
    await expect(submit(patch)).rejects.toThrow();expect(await rows('SELECT * FROM workforce_time_entry_reviews')).toHaveLength(0);
  });
  it('rejects source changes and repeat submissions with stale revisions',async()=>{
    await expect(submit({source:'2026-11-01T11:00Z'})).rejects.toThrow(/geändert/);
    await submit();await expect(submit()).rejects.toThrow(/geändert/);
    expect(await rows('SELECT * FROM workforce_time_review_actions')).toHaveLength(1);
  });
  it('rejects locked, exported and already caught-up work',async()=>{
    const result=await submit();
    for(const [column,value] of [['review_status','locked'],['export_status','exported']]){
      await owner(()=>db.exec(`UPDATE workforce_time_entry_reviews SET review_status='${column==='review_status'?value:'pending_review'}',export_status='${column==='export_status'?value:'not_exported'}'`));
      const row=(await rows('SELECT * FROM workforce_time_entry_reviews'))[0];
      await expect(submit({review:row.updated_at})).rejects.toThrow(/gesperrte/);
    }
    await owner(()=>db.exec("UPDATE workforce_time_entry_reviews SET review_status='pending_review',export_status='not_exported'"));
    const row=(await rows('SELECT * FROM workforce_time_entry_reviews'))[0];
    await owner(()=>db.query('INSERT INTO payroll_month_statements VALUES($1,$2,$3,$4)',[t,e,'superseded',JSON.stringify({catchUpTimeEntries:[{sourceEntryId:result.entry_id}]})]));
    await expect(submit({review:row.updated_at})).rejects.toThrow(/bereits nachberechnet/);
  });
  it('retains invalid approved captures as correctable, but protects complete approved time',async()=>{
    await owner(()=>db.query(`INSERT INTO workforce_time_entry_reviews(tenant_id,employee_id,work_date,entry_kind,reference_id,reference_key,review_status,updated_at)
      VALUES($1,$2,$3,'visit',$4,$5,'approved',$6)`,[t,e,day,v,key(),rev]));
    expect((await submit({review:rev})).review_status).toBe('pending_review');
    await owner(()=>db.exec(`UPDATE workforce_time_entry_reviews SET review_status='approved';
      INSERT INTO workforce_time_events(tenant_id,employee_id,session_id,reference_id,event_type,occurred_at) VALUES('${t}','${e}','${s}','${v}','visit_ended','${day}T07:30Z')`));
    const row=(await rows('SELECT * FROM workforce_time_entry_reviews'))[0];
    await expect(submit({review:row.updated_at})).rejects.toThrow(/bereits vollständig freigegeben/);
  });
  it('does not persist a correction if its audit cannot be saved',async()=>{
    await owner(()=>db.exec(`CREATE OR REPLACE FUNCTION fail_follow_up_audit() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'audit unavailable';END$$;
      CREATE TRIGGER fail_follow_up_audit BEFORE INSERT ON workforce_time_review_actions FOR EACH ROW EXECUTE FUNCTION fail_follow_up_audit();`));
    await expect(submit()).rejects.toThrow(/audit unavailable/);
    expect(await rows('SELECT * FROM workforce_time_entry_reviews')).toHaveLength(0);
  });
  it('accepts only a manual snapshot with matching ownership and identity',async()=>{
    const ref=randomUUID(), entryId=randomUUID();
    const snapshot={id:entryId,tenantId:t,employeeId:e,workDate:day,workKind:'buero',source:'manual_addition',flags:[]};
    await owner(()=>db.query(`INSERT INTO workforce_time_entry_reviews(tenant_id,employee_id,work_date,entry_kind,reference_id,reference_key,review_status,metadata,updated_at)
      VALUES($1,$2,$3,'manual',$4,$5,'rejected',$6,$7)`,[t,e,day,ref,key('manual',ref),JSON.stringify({office_time_entry:snapshot}),rev]));
    await expect(submit({kind:'manual',ref,id:'wrong',source:rev,review:rev})).rejects.toThrow(/nicht gefunden/);
    expect((await submit({kind:'manual',ref,id:entryId,source:rev,review:rev})).review_status).toBe('pending_review');
  });
});
