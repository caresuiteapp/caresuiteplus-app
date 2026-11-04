// Actual employee release and client completion RPCs + nine review SQL drafts.
// Auth/roles and Storage transport remain isolated doubles, never live accounts.
import {readFile} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {assistOriginalFixture} from './monthly-assist-fixture.mjs';
import {portalStatements} from '../../scripts/build-gkv-staging-portal.mjs';
import {signingPng} from './monthly-host-fixture.mjs';
export async function assistDeferredFixture(options={}){
 const x=await assistOriginalFixture(options),{f}=x,db=f.db;
 await db.exec(`
  ALTER TABLE assist_visit_proofs ADD COLUMN portal_release_status text DEFAULT 'not_released',ADD COLUMN released_to_portal_at timestamptz;
  ALTER TABLE assist_visits ADD COLUMN planning_status text DEFAULT 'published';
  ALTER TABLE assist_visit_signatures ADD COLUMN metadata jsonb DEFAULT '{}';
  CREATE TABLE client_documents(id uuid PRIMARY KEY,tenant_id uuid,client_id uuid,title text,file_name text,mime_type text,category text,
   storage_path text,portal_visible boolean,status text,sensitivity text,source text,uploaded_by uuid,signed_at timestamptz,signature_required boolean,updated_at timestamptz);
  CREATE TABLE assist_visit_execution_state(tenant_id uuid,visit_id uuid,current_step text,assignment_status text,signature_complete boolean,
   proof_generated boolean,finalized_at timestamptz,updated_at timestamptz,PRIMARY KEY(tenant_id,visit_id));
  CREATE TYPE public.product_key AS ENUM ('office','assist','pflege','stationaer','beratung','akademie');
  ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
  GRANT USAGE ON SCHEMA storage TO authenticated; GRANT SELECT,INSERT ON storage.objects TO authenticated;
  CREATE FUNCTION public.is_employee_portal_rls_context(t uuid) RETURNS boolean LANGUAGE sql AS $$
   SELECT public.current_tenant_id()=t AND public.current_portal_type()='employee' $$;
  CREATE FUNCTION public.is_client_portal_rls_context(t uuid) RETURNS boolean LANGUAGE sql AS $$
   SELECT public.current_tenant_id()=t AND public.current_portal_type()='client' $$;
  CREATE FUNCTION public.resolve_current_profile_id() RETURNS uuid LANGUAGE sql AS $$ SELECT id FROM public.profiles WHERE auth_user_id=auth.uid() $$;
  CREATE FUNCTION public.current_client_id() RETURNS uuid LANGUAGE sql AS $$ SELECT (auth.jwt()->>'client_id')::uuid $$;
 `);
 // Same portal SQL, two Storage policies, ACL checks and typed audit table as the
 // staging bundle. Authentication and the Storage transport remain isolated.
 await db.transaction(async tx=>{await tx.exec(await portalStatements());});
 await db.exec(await readFile(new URL('../../supabase/migrations/20261104084500_bind_employee_proof_release_account.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../../docs/gkv/sql/portal-source-integrity.sql',import.meta.url),'utf8'));
 if(options.monthlyCapture!==false) await db.exec(await readFile(new URL('../../docs/gkv/sql/monthly-assist-deferred-draft.sql',import.meta.url),'utf8'));
 const clientActor=randomUUID(),clientSession=randomUUID();
 await db.query('INSERT INTO auth.sessions VALUES($1,$2,NULL)',[clientSession,clientActor]);
 const personal=()=>x.claims({portal:'employee',account_id:x.account});
 const clientClaims=v=>x.claims({portal:'client',client_id:v.client,sub:clientActor,session_id:clientSession});
 const prepare=async()=>{
  const v=await x.start();v.end=await x.clock();
  await db.query("UPDATE assignments SET status='signature_pending',actual_end_at=$2 WHERE id=$1",[v.assignment,v.end]);
  await db.query("UPDATE assist_visits SET canonical_status='signature_pending',actual_end_at=$2 WHERE id=$1",[v.visit,v.end]);
  await db.query("INSERT INTO assist_time_events(tenant_id,visit_id,event_type,occurred_at) VALUES($1,$2,'service_end',$3)",[f.tenant,v.visit,v.end]);
  await db.query('INSERT INTO assist_visit_documentation VALUES($1,$2,$3,$4,$5)',[randomUUID(),f.tenant,v.visit,v.end,v.snapshot.documentationNote]);
  v.snapshot={...v.snapshot,visitTimes:{serviceStartedAt:v.start,serviceEndedAt:v.end,serviceSeconds:Math.round((Date.parse(v.end)-Date.parse(v.start))/1000)},
   signature:null,signerName:null,signedAt:null,signatureDeferredToClientPortal:true,signatureDeferredAt:await x.clock(),signatureDeferredBy:x.profile,signatureDeferredReason:'Synthetischer Portalauftrag'};
  return v;
 };
 const release=async(v,{snapshot=v.snapshot,identity=personal()}={})=>(await f.as(identity,
  'SELECT public.employee_portal_release_deferred_signature($1,$2,$3,$4,$5::jsonb,$6) value',
  [f.tenant,v.draft,v.client,'Synthetischer Einsatz',JSON.stringify(snapshot),await x.jsonHash(snapshot)])).rows[0].value;
 const closeVisit=async v=>{
  await db.query("UPDATE assignments SET status='completed' WHERE id=$1",[v.assignment]);
  await db.query("UPDATE assist_visits SET canonical_status='completed' WHERE id=$1",[v.visit]);
 };
 const captured=async v=>(await db.query('SELECT * FROM care_security.gkv_assist_deferred_sources WHERE proof_id=$1',[v.draft])).rows[0];
 const sign=async(v,{identity=clientClaims(v),signatureMetadata={},signedAt,signedHash,signaturePayloadHash,signaturePath}={})=>{
  const p=(await db.query('SELECT * FROM assist_visit_proofs WHERE id=$1',[v.draft])).rows[0];
  v.signed=signedAt??await x.clock();v.png=Buffer.from(signingPng(),'base64');
  v.signaturePath=signaturePath??`tenant/${f.tenant}/assist/visits/${v.visit}/signatures/${v.signature}.png`;
  x.storage.set(v.signaturePath,v.png);
  const payload={visitId:v.visit,clientId:v.client,employeeId:x.employee,plannedStartAt:p.payload_snapshot.plannedStartAt,plannedEndAt:p.payload_snapshot.plannedEndAt,
   taskStatuses:p.payload_snapshot.tasks.map(t=>({taskId:t.id,status:t.status})),documentationNote:p.payload_snapshot.documentationNote};
  await db.query("INSERT INTO assist_visit_signatures(id,tenant_id,visit_id,storage_path,signature_hash,payload_hash,signed_at,signer_name,signer_role,metadata) VALUES($1,$2,$3,$4,$5,$6,$7,'Synthetische Person','client',$8) ON CONFLICT(id) DO NOTHING",
   [v.signature,f.tenant,v.visit,v.signaturePath,'sha256:'+createHash('sha256').update('data:image/png;base64,'+v.png.toString('base64')).digest('hex'),signaturePayloadHash??await x.jsonHash(payload),v.signed,
    JSON.stringify({proofId:v.draft,signedVia:'client_portal',proofPayloadHash:p.payload_hash,...signatureMetadata})]);
  // The application uses the stored signature timestamp when resuming an upload.
  v.signed=new Date((await db.query('SELECT signed_at FROM assist_visit_signatures WHERE id=$1',[v.signature])).rows[0].signed_at).toISOString();
  const snapshot={...p.payload_snapshot,signatureDeferredToClientPortal:false,clientPortalSignedAt:v.signed,signedViaClientPortal:true,
   clientPortalPdfSignatureId:v.signature,signerName:'Synthetische Person',signedAt:v.signed,
   signature:{signerName:'Synthetische Person',signedAt:v.signed,signerRole:'client'}};
  const pdfPath=`tenant/${f.tenant}/assist/visits/${v.visit}/proofs/${v.draft}-${v.signature}-${randomUUID()}.pdf`;
  const pdf=Buffer.from('SYNTHETIC CLIENT PDF: final worker must generate/verify its own original');
  x.storage.set(pdfPath,pdf);
  await db.query('INSERT INTO storage.objects VALUES($1,$2),($1,$3)',['office-documents',v.signaturePath,pdfPath]);
  return (await f.as(identity,'SELECT public.client_portal_finalize_assist_proof($1,$2,$3,$4,$5,$6,$7) value',
   [f.tenant,v.draft,v.signature,p.payload_hash,signedHash??await x.jsonHash(snapshot),pdfPath,createHash('sha256').update(pdf).digest('hex')])).rows[0].value;
 };
 // Seed historical time ONLY inside this isolated fixture. Production has no
 // backdate endpoint. This models a later day without a wall-clock hour's wait.
 const age=async(v,minutes=60)=>{
  const shift=s=>new Date(Date.parse(s)-minutes*60_000).toISOString();
  const c=await captured(v);v.start=shift(v.start);v.end=shift(v.end);
  v.snapshot={...c.payload_snapshot,plannedStartAt:shift(c.payload_snapshot.plannedStartAt),plannedEndAt:shift(c.payload_snapshot.plannedEndAt),
   signatureDeferredAt:shift(c.payload_snapshot.signatureDeferredAt),visitTimes:{...c.payload_snapshot.visitTimes,serviceStartedAt:v.start,serviceEndedAt:v.end}};
  const hash=await x.jsonHash(v.snapshot);
  await db.exec('BEGIN');try{
   await db.exec('ALTER TABLE assist_visit_proofs DISABLE TRIGGER gkv_assist_deferred_guard; ALTER TABLE care_security.gkv_assist_deferred_sources DISABLE TRIGGER gkv_assist_deferred_sources_immutable;');
   await db.query('UPDATE assignments SET actual_start_at=$2,actual_end_at=$3 WHERE id=$1',[v.assignment,v.start,v.end]);
   await db.query('UPDATE assist_visits SET actual_start_at=$2,actual_end_at=$3,planned_start_at=$2,planned_end_at=$2 WHERE id=$1',[v.visit,v.start,v.end]);
   await db.query("UPDATE assist_time_events SET occurred_at=occurred_at-$2*interval '1 minute' WHERE visit_id=$1",[v.visit,minutes]);
   await db.query("UPDATE assist_visit_documentation SET submitted_at=submitted_at-$2*interval '1 minute' WHERE visit_id=$1",[v.visit,minutes]);
   await db.query('UPDATE assist_visit_proofs SET payload_snapshot=$2,payload_hash=$3 WHERE id=$1',[v.draft,JSON.stringify(v.snapshot),hash]);
   await db.query("UPDATE care_security.gkv_assist_deferred_sources SET payload_snapshot=$2,payload_hash=$3,captured_at=captured_at-$4*interval '1 minute',service_started_at=$5,service_ended_at=$6,documentation_submitted_at=documentation_submitted_at-$4*interval '1 minute' WHERE proof_id=$1",
    [v.draft,JSON.stringify(v.snapshot),hash,minutes,v.start,v.end]);
   await db.query("UPDATE care_security.gkv_employee_registrations SET submitted_at=submitted_at-$2*interval '1 minute',reviewed_at=reviewed_at-$2*interval '1 minute',valid_from=valid_from-$2*interval '1 minute' WHERE id=$1",[c.registration_id,minutes]);
   await db.exec('ALTER TABLE assist_visit_proofs ENABLE TRIGGER gkv_assist_deferred_guard; ALTER TABLE care_security.gkv_assist_deferred_sources ENABLE TRIGGER gkv_assist_deferred_sources_immutable; COMMIT;');
  }catch(e){await db.exec('ROLLBACK');throw e;}
 };
 return {...x,prepareDeferred:prepare,releaseDeferred:release,closeVisit,signDeferred:sign,captured,ageDeferred:age,personal,clientClaims,clientActor,clientSession};
}
