// Real canonical workflow migration + all eight monthly SQL drafts. Auth/roles
// and Storage transport are isolated doubles; the byte handler is real. Pass the
// existing Edge renderer for the local byte run; CI uses an explicit PDF double.
import {randomUUID,createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {jsPDF} from 'jspdf';
import {employeeFixture} from './monthly-employees-fixture.mjs';
import {lines} from './monthly-facts-fixture.mjs';
import {signingPng} from './monthly-host-fixture.mjs';
import {createProofCompletionHandler} from '../../supabase/functions/complete-assist-service-record/handler.ts';
const fixturePdf=async(source,signature)=>{
 const pdf=new jsPDF();pdf.text('SYNTHETIC ASSIST PIPELINE FIXTURE',15,20);
 pdf.text(String(source.receipt.proof_id),15,30);pdf.addImage(signature,'PNG',15,40,80,30);
 return new Uint8Array(pdf.output('arraybuffer'));
};
export async function assistOriginalFixture({render=fixturePdf}={}){
 const x=await employeeFixture(),{f}=x,db=f.db;
 await db.exec(`
  ALTER TABLE tenants ADD COLUMN name text DEFAULT 'Synthetische Einrichtung',ADD COLUMN legal_name text;
  ALTER TABLE clients ADD COLUMN full_name text;
  ALTER TABLE employees ADD COLUMN full_name text;
  CREATE TABLE roles(id uuid PRIMARY KEY,tenant_id uuid,key text);
  CREATE TABLE role_permissions(role_id uuid,permission_key text,can_create boolean);
  ALTER TABLE profiles ADD COLUMN role_id uuid;
  CREATE FUNCTION public.resolve_current_employee_id() RETURNS uuid LANGUAGE sql STABLE AS $$
   SELECT employee_id FROM public.employee_portal_accounts WHERE id=public.current_portal_account_id() $$;
  ALTER TABLE assist_visits ADD COLUMN client_id uuid,ADD COLUMN legacy_assignment_id uuid,
   ADD COLUMN canonical_status text DEFAULT 'in_progress',ADD COLUMN planned_start_at timestamptz,ADD COLUMN planned_end_at timestamptz;
  CREATE TABLE assignments(id uuid PRIMARY KEY,tenant_id uuid,client_id uuid,employee_id uuid,status text,
   actual_start_at timestamptz,actual_end_at timestamptz);
  ALTER TABLE assist_visit_proofs ADD COLUMN signature_id uuid,ADD COLUMN status text DEFAULT 'draft',
   ADD COLUMN storage_path text,ADD COLUMN proof_number text,ADD COLUMN generated_at timestamptz,ADD COLUMN generated_by uuid,
   ADD COLUMN approved_at timestamptz,ADD COLUMN approved_by uuid,ADD COLUMN billing_released boolean DEFAULT false,
   ADD COLUMN portal_visible boolean DEFAULT false,ADD COLUMN metadata jsonb DEFAULT '{}',
   ADD COLUMN created_by uuid,ADD COLUMN updated_by uuid,ADD COLUMN created_at timestamptz DEFAULT clock_timestamp(),
   ADD COLUMN updated_at timestamptz DEFAULT clock_timestamp(),ADD COLUMN pdf_storage_path text,ADD COLUMN pdf_hash text;
  ALTER TABLE service_records ALTER COLUMN id SET DEFAULT gen_random_uuid(),ALTER COLUMN updated_at SET DEFAULT clock_timestamp(),
   ADD COLUMN assignment_id uuid,ADD COLUMN assist_visit_id uuid,ADD COLUMN product_key text,ADD COLUMN planned_minutes integer,
   ADD COLUMN documentation_entry_id uuid,ADD COLUMN signature_id uuid;
  CREATE TABLE assist_visit_signatures(id uuid PRIMARY KEY,tenant_id uuid,visit_id uuid,is_valid boolean DEFAULT true,
   invalidated_at timestamptz,storage_path text,signature_hash text,payload_hash text,signed_at timestamptz,signer_name text,signer_role text);
  CREATE TABLE assist_visit_documentation(id uuid PRIMARY KEY,tenant_id uuid,visit_id uuid,submitted_at timestamptz,short_description text);
  CREATE TABLE assist_visit_tasks(id uuid PRIMARY KEY,tenant_id uuid,visit_id uuid,title text,status text,not_done_reason text);
  CREATE TABLE assignment_tasks(id uuid PRIMARY KEY,tenant_id uuid,assignment_id uuid,title text,status text,not_done_reason text);
  CREATE TABLE assist_time_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid,visit_id uuid,event_type text,occurred_at timestamptz);
  CREATE TABLE documentation_entries(id uuid PRIMARY KEY);
  CREATE TABLE signatures(id uuid PRIMARY KEY);
  CREATE SCHEMA storage;CREATE TABLE storage.objects(bucket_id text,name text);
  GRANT SELECT,INSERT,UPDATE,DELETE ON assist_visit_proofs TO authenticated;
 `);
 const role=randomUUID();await db.query("INSERT INTO roles VALUES($1,$2,'employee')",[role,f.tenant]);
 await db.query("INSERT INTO role_permissions VALUES($1,'assist.records.create',true)",[role]);
 await db.query('UPDATE profiles SET role_id=$1',[role]);
 // Compile/execute actual production validators, worker attestations and guards.
 await db.exec(await readFile(new URL('../../supabase/migrations/20261013072827_verified_assignment_service_records.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../../docs/gkv/sql/monthly-assist-originals-draft.sql',import.meta.url),'utf8'));
 // The broader Office boundary remains a test double; delegate its source check
 // to the real canonical validator rather than accepting a fixture boolean.
 await db.exec(`CREATE OR REPLACE FUNCTION care_security.office_invoice_assert_source(s public.service_records,b boolean) RETURNS void
  LANGUAGE plpgsql AS $$ DECLARE source jsonb; BEGIN
   source:=public.workflow_signed_proof_source(s.tenant_id,(s.source_receipt->>'visit_id')::uuid,(s.source_receipt->>'proof_id')::uuid,b,true);
   IF source||jsonb_build_object('assignment_id',s.assignment_id) IS DISTINCT FROM s.source_receipt THEN RAISE EXCEPTION 'Source receipt changed'; END IF;
  END $$;`);
 const jsonHash=async value=>'sha256:'+createHash('sha256').update((await db.query('SELECT public.workflow_canonical_json($1::jsonb) value',[JSON.stringify(value)])).rows[0].value).digest('hex');
 const clock=async()=>new Date((await db.query('SELECT clock_timestamp() v')).rows[0].v).toISOString();
 const storage=new Map();
 const rpc=async(name,args,identity=x.claims())=>{
  const calls={gkv_assist_original_context:['SELECT public.gkv_assist_original_context($1,$2) value',[args.t,args.a_id]],
   gkv_assist_original_seal:['SELECT public.gkv_assist_original_seal($1,$2,$3,$4::jsonb) value',[args.t,args.a_id,args.p_request,JSON.stringify(args.p_expected)]],
   workflow_assignment_proof_source:['SELECT public.workflow_assignment_proof_source($1,$2) value',[args.p_tenant_id,args.p_assignment_id]],
   workflow_prepare_assignment_service_record:['SELECT public.workflow_prepare_assignment_service_record($1,$2) value',[args.p_tenant_id,args.p_assignment_id]]};
  const [sql,values]=calls[name]??[];if(!sql)throw Error('Unexpected fixture RPC: '+name);
  try{return {data:(await f.as(identity,sql,values)).rows[0].value,error:null};}catch(e){return {data:null,error:{code:e.code,message:e.message}};}
 };
 const context=async(v,identity=x.claims())=>(await f.as(identity,'SELECT public.gkv_assist_original_context($1,$2) value',[f.tenant,v.assignment])).rows[0].value;
 const seal=async(v,expected,request=randomUUID(),identity=x.claims())=>(await f.as(identity,'SELECT public.gkv_assist_original_seal($1,$2,$3,$4::jsonb) value',[f.tenant,v.assignment,request,JSON.stringify(expected)])).rows[0].value;
 const start=async()=>{
  const v={assignment:randomUUID(),visit:randomUUID(),draft:randomUUID(),client:randomUUID(),signature:randomUUID(),task:randomUUID()};
  v.start=new Date(Date.parse(await clock())-45*60_000).toISOString();
  await db.query("INSERT INTO clients(id,tenant_id,first_name,last_name,insurance_number) VALUES($1,$2,'Synthetische','Person','A123456789')",[v.client,f.tenant]);
  await db.query("INSERT INTO assignments VALUES($1,$2,$3,$4,'in_progress',$5,NULL)",[v.assignment,f.tenant,v.client,x.employee,v.start]);
  await db.query('INSERT INTO assist_visits(id,tenant_id,employee_id,actual_start_at,client_id,legacy_assignment_id,planned_start_at,planned_end_at) VALUES($1,$2,$3,$4,$5,$6,$4,$4)',[v.visit,f.tenant,x.employee,v.start,v.client,v.assignment]);
  v.snapshot={visitId:v.visit,clientId:v.client,employeeId:x.employee,plannedStartAt:v.start,plannedEndAt:v.start,
   documentationNote:'Synthetische dokumentierte Unterstützung.',tasks:[{id:v.task,title:'Unterstützung',status:'done'}],
   visitTimes:{serviceStartedAt:v.start,serviceEndedAt:null,serviceSeconds:0}};
  await db.query("INSERT INTO assist_visit_tasks VALUES($1,$2,$3,'Unterstützung','done',NULL)",[v.task,f.tenant,v.visit]);
  await db.query("INSERT INTO assist_time_events(tenant_id,visit_id,event_type,occurred_at) VALUES($1,$2,'service_start',$3)",[f.tenant,v.visit,v.start]);
  await f.as(x.claims(),'INSERT INTO assist_visit_proofs(id,tenant_id,visit_id,payload_hash,payload_snapshot) VALUES($1,$2,$3,$4,$5)',[v.draft,f.tenant,v.visit,await jsonHash(v.snapshot),JSON.stringify(v.snapshot)]);
  return v;
 };
 const finish=async(v,{endedAt}={})=>{
  v.end=endedAt??await clock();v.signed=await clock();
  await db.query("UPDATE assignments SET status='completed',actual_end_at=$2 WHERE id=$1",[v.assignment,v.end]);
  await db.query("UPDATE assist_visits SET canonical_status='completed',actual_end_at=$2 WHERE id=$1",[v.visit,v.end]);
  await db.query("INSERT INTO assist_time_events(tenant_id,visit_id,event_type,occurred_at) VALUES($1,$2,'service_end',$3)",[f.tenant,v.visit,v.end]);
  await db.query('INSERT INTO assist_visit_documentation VALUES($1,$2,$3,$4,$5)',[randomUUID(),f.tenant,v.visit,v.end,v.snapshot.documentationNote]);
  const signaturePayload={visitId:v.visit,clientId:v.client,employeeId:x.employee,plannedStartAt:v.start,plannedEndAt:v.start,
   taskStatuses:[{taskId:v.task,status:'done'}],documentationNote:v.snapshot.documentationNote};
  v.png=Buffer.from(signingPng(),'base64');v.signaturePath=`tenant/${f.tenant}/assist/visits/${v.visit}/signatures/${v.signature}.png`;
  storage.set(v.signaturePath,v.png);
  await db.query("INSERT INTO assist_visit_signatures(id,tenant_id,visit_id,storage_path,signature_hash,payload_hash,signed_at,signer_name,signer_role) VALUES($1,$2,$3,$4,$5,$6,$7,'Synthetische Person','client')",
   [v.signature,f.tenant,v.visit,v.signaturePath,'sha256:'+createHash('sha256').update('data:image/png;base64,'+v.png.toString('base64')).digest('hex'),await jsonHash(signaturePayload),v.signed]);
  v.snapshot={...v.snapshot,visitTimes:{serviceStartedAt:v.start,serviceEndedAt:v.end,serviceSeconds:Math.round((Date.parse(v.end)-Date.parse(v.start))/1000)},
   signature:{signerName:'Synthetische Person',signerRole:'client',signedAt:v.signed}};
  await f.as(x.claims(),'UPDATE assist_visit_proofs SET signature_id=$2,payload_hash=$3,payload_snapshot=$4,updated_at=clock_timestamp() WHERE id=$1',
   [v.draft,v.signature,await jsonHash(v.snapshot),JSON.stringify(v.snapshot)]);return v;
 };
 const handler=createProofCompletionHandler({
  userClient:()=>({auth:{getUser:async()=>({data:{user:{id:f.actorId}},error:null})},rpc}),
  serviceClient:()=>({rpc:async(name,args)=>{
   if(name!=='workflow_commit_proof_attestation')throw Error('Unexpected privileged RPC');
   try{return {data:(await db.query('SELECT public.workflow_commit_proof_attestation($1,$2,$3,$4,$5,$6,$7) value',
    [args.t,args.a_id,args.p_id,args.expected_payload_hash,args.expected_signature_hash,args.pdf_path,args.pdf_sha])).rows[0].value,error:null};}
   catch(e){return {data:null,error:{code:e.code,message:e.message}};}
  },storage:{from:bucket=>({download:async path=>({data:storage.has(path)?new Blob([storage.get(path)]):null,error:null}),
   upload:async(path,bytes)=>{if(!storage.has(path)){storage.set(path,bytes);await db.query('INSERT INTO storage.objects VALUES($1,$2)',[bucket,path]);}return {error:null};}})}}),render,
 });
 const complete=async v=>handler(new Request('https://fixture.test/complete',{method:'POST',headers:{Authorization:'Bearer synthetic-user'},body:JSON.stringify({tenantId:f.tenant,assignmentId:v.assignment})}));
 const monthly=async v=>{
  const receipt=(await f.as(x.claims(),'SELECT public.workflow_prepare_assignment_service_record($1,$2) value',[f.tenant,v.assignment])).rows[0].value;
  await db.query("UPDATE assist_visit_proofs SET status='approved',approved_at=clock_timestamp(),approved_by=$2 WHERE id=$1",[receipt.proof_id,x.profile]);
  await db.query("UPDATE service_records SET status='approved',updated_at=clock_timestamp() WHERE id=$1",[receipt.id]);
  await db.query("INSERT INTO care_security.gkv_monthly_fact_sources SELECT tenant_id,id,updated_at,encode(sha256(convert_to(source_receipt::text,'UTF8')),'hex'),'123123123',$2::jsonb,'SYNTHETISCHE Leistungszuordnung' FROM service_records WHERE id=$1",[receipt.id,JSON.stringify(lines)]);
  const month=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(v.start)).slice(0,7);
  const p=await f.command('create',{new_id:randomUUID(),client_id:v.client,month,service_type:'01',source_ids:[receipt.id]},undefined,x.claims());
  return {p,input:{tenantId:f.tenant,proofId:p.id,revision:p.revision,captureId:randomUUID()},receipt};
 };
 // Synthetic historical registration/visit times avoid a real 45-minute wait.
 // The real command is exercised first; only this isolated fixture seeds history.
 const approve=async r=>{const approved=await x.approve(r);
  await db.query("UPDATE care_security.gkv_employee_registrations SET submitted_at=submitted_at-interval '1 hour',reviewed_at=reviewed_at-interval '1 hour',valid_from=valid_from-interval '1 hour' WHERE id=$1",[approved.id]);
  return approved;
 };
 return {...x,approve,start,finish,context,seal,rpc,complete,monthly,jsonHash,storage,clock};
}
