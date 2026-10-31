// Existing PGlite and the seven real SQL drafts. Identity/Office tables model
// their actual columns, but do not constitute a deployed Auth or mobile test.
import {readFile} from 'node:fs/promises';
import {randomUUID,createHash} from 'node:crypto';
import {monthlyFactsFixture} from './monthly-facts-fixture.mjs';
export async function employeeFixture(){
 const base=await monthlyFactsFixture(),{f}=base;
 await f.db.exec(`ALTER TABLE employees ADD COLUMN profile_id uuid, ADD COLUMN status text DEFAULT 'aktiv';
  CREATE TABLE profiles(id uuid PRIMARY KEY,tenant_id uuid,auth_user_id uuid,is_active boolean,status text);
  CREATE TABLE employee_portal_accounts(id uuid,tenant_id uuid,employee_id uuid,auth_user_id uuid,status text);
  CREATE TABLE assist_visits(id uuid PRIMARY KEY,tenant_id uuid,employee_id uuid,actual_start_at timestamptz,actual_end_at timestamptz);
  CREATE FUNCTION public.current_tenant_id() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT (auth.jwt()->>'tenant_id')::uuid $$;
  CREATE FUNCTION public.current_portal_type() RETURNS text LANGUAGE sql STABLE AS $$ SELECT coalesce(auth.jwt()->>'portal','business') $$;
  CREATE FUNCTION public.current_portal_account_id() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT (auth.jwt()->>'account_id')::uuid $$;
  CREATE FUNCTION public.platform_tenant_access_allowed(t uuid,b boolean) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT coalesce(auth.jwt()->>'blocked','false')<>'true' $$;
  CREATE OR REPLACE FUNCTION care_security.gkv_exchange_actor(t uuid,p text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
   SELECT coalesce((SELECT CASE WHEN p='office.invoices.view' THEN can_read WHEN p='office.invoices.create' THEN can_write WHEN p IN ('office.clients.edit','office.employees.edit') THEN can_review ELSE false END
    FROM public.fixture_access WHERE actor_id=auth.uid() AND tenant_id=t AND coalesce(auth.jwt()->>'portal','business')='business'),false) $$;
  GRANT INSERT ON assist_visit_proofs TO authenticated;
 `);
 const migration=await readFile(new URL('../../supabase/migrations/20261013072827_verified_assignment_service_records.sql',import.meta.url),'utf8');
 await f.db.exec(migration.slice(migration.indexOf('CREATE OR REPLACE FUNCTION public.workflow_canonical_json'),migration.indexOf('CREATE OR REPLACE FUNCTION public.workflow_signed_proof_source')));
 const employee=(await f.db.query('SELECT id FROM employees LIMIT 1')).rows[0].id,profile=randomUUID(),account=randomUUID();
 await f.db.query("INSERT INTO profiles VALUES($1,$2,$3,true,'active')",[profile,f.tenant,f.actorId]);
 await f.db.query('UPDATE employees SET profile_id=$1 WHERE id=$2',[profile,employee]);
 await f.db.query("INSERT INTO employee_portal_accounts VALUES($1,$2,$3,$4,'active')",[account,f.tenant,employee,f.actorId]);
 await f.db.query('UPDATE fixture_access SET can_write=true WHERE actor_id=$1',[f.otherActor]);
 await f.db.query("INSERT INTO care_security.gkv_monthly_responsibilities VALUES($1,$2,now()+interval '1 day',NULL,$2,'Synthetische unabhängige Prüfung')",[f.tenant,f.otherActor]);
 await f.db.exec(await readFile(new URL('../../docs/gkv/sql/monthly-employees-draft.sql',import.meta.url),'utf8'));
 const claims=(o={})=>f.claims({tenant_id:f.tenant,...o});
 const reviewClaims=()=>claims({sub:f.otherActor,session_id:f.otherSession});
 const command=async(c,requestId=randomUUID(),identity=claims(),tenant=f.tenant)=>(await f.as(identity,'SELECT public.gkv_employee_command($1,$2,$3,$4::jsonb) value',[tenant,requestId,c.action,JSON.stringify(c.input)])).rows[0].value;
 const status=async(id,identity=claims())=>(await f.as(identity,'SELECT public.gkv_employee_request_status($1,$2) value',[f.tenant,id])).rows[0].value;
 const workspace=async(identity=claims(),after=null)=>(await f.as(identity,'SELECT public.gkv_employee_workspace($1,$2) value',[f.tenant,after])).rows[0].value;
 const submit=(number='234567890',identity=claims(),requestId)=>command({action:'submit',input:{id:randomUUID(),employeeNumber:number,evidenceReference:'SYNTHETISCHER Nachweis für Softwaretests'}},requestId,identity);
 const approve=(r)=>command({action:'approve',input:{id:r.id,revision:r.revision,reviewReference:'SYNTHETISCHE unabhängige Nachweisprüfung',reviewNote:'Nummer und Person im Test abgeglichen',validUntil:new Date(Date.now()+86400000).toISOString(),reviewed:true}},undefined,reviewClaims());
 const capture=async(v,identity=claims(),options={})=>{
  const id=randomUUID(),visit=randomUUID(),r=v.p.payload.records[0],payload={documentationNote:'Vollständige Unterstützung bei der Körperpflege.',tasks:[]};
  const times=(await f.db.query("SELECT clock_timestamp() s,clock_timestamp() e")).rows[0];
  const start=options.start??new Date(times.s).toISOString(),end=options.end??new Date(times.e).toISOString();
  await f.db.query('INSERT INTO assist_visits VALUES($1,$2,$3,$4,$5)',[visit,f.tenant,options.employee??employee,start,end]);
  const canonical=(await f.db.query('SELECT public.workflow_canonical_json($1::jsonb) value',[JSON.stringify(payload)])).rows[0].value;
  const hash=options.hash??'sha256:'+createHash('sha256').update(canonical).digest('hex');
  await f.as(identity,'INSERT INTO assist_visit_proofs VALUES($1,$2,$3,$4,$5)',[id,f.tenant,visit,hash,JSON.stringify(payload)]);
  const receipt={...r.sourceReceipt,proof_id:id,visit_id:visit,proof_payload_hash:hash,service_started_at:start,service_ended_at:end};
  await f.db.query("UPDATE service_records SET source_receipt=$2,service_date=($3::timestamptz AT TIME ZONE 'Europe/Berlin')::date,updated_at=clock_timestamp() WHERE id=$1",[r.recordId,JSON.stringify(receipt),start]);
  await f.db.query("UPDATE care_security.gkv_monthly_fact_sources m SET source_updated_at=s.updated_at,source_receipt_sha256=encode(sha256(convert_to(s.source_receipt::text,'UTF8')),'hex') FROM service_records s WHERE s.id=$1 AND m.record_id=s.id",[r.recordId]);
  await base.refresh(v);return {id,visit,receipt};
 };
 // Personal INSERT capture uses the database's live clock. Keep its selected
 // billing month in sync with Berlin's current service day, including UTC edges.
 const setup=({mapped=true}={})=>{
  const instant=new Date(),serviceDate=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(instant);
  return base.setup({mapped,serviceDate,serviceStartedAt:instant.toISOString(),serviceEndedAt:instant.toISOString()});
 };
 return {...base,setup,employee,profile,account,claims,reviewClaims,command,status,workspace,submit,approve,capture};
}
