import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
// Real isolated PostgreSQL execution of the review draft, with synthetic actors/rows.
// These fixtures are not evidence of deployed authorization policies or JWTs.
let db: PGlite;
const tenant = '00000000-0000-4000-8000-000000000001', visit = '00000000-0000-4000-8000-000000000002';
const employee = '00000000-0000-4000-8000-000000000003', client = '00000000-0000-4000-8000-000000000004';
const signature = '00000000-0000-4000-8000-000000000005', proof = '00000000-0000-4000-8000-000000000006';
const start = '2026-10-11T08:00:00Z', end = '2026-10-11T09:00:00Z';
const schema = `CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT '${employee}'::uuid $$;
CREATE FUNCTION current_tenant_id() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.tenant',true),'')::uuid $$;
CREATE FUNCTION current_role_key() RETURNS text LANGUAGE sql AS $$ SELECT current_setting('test.role',true) $$;
CREATE FUNCTION resolve_current_employee_id() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.employee',true),'')::uuid $$;
CREATE FUNCTION current_client_id() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.client',true),'')::uuid $$;
CREATE TABLE assist_visits(id uuid PRIMARY KEY,tenant_id uuid,employee_id uuid,client_id uuid,canonical_status text,
 actual_start_at timestamptz,actual_end_at timestamptz,on_the_way_at timestamptz,arrived_at timestamptz);
CREATE TABLE assist_visit_execution_state(id uuid DEFAULT gen_random_uuid(),tenant_id uuid,visit_id uuid,current_step text,assignment_status text,
 documentation_complete boolean DEFAULT false,signature_complete boolean DEFAULT false,proof_generated boolean DEFAULT false,finalized_at timestamptz,
 travel_started_at timestamptz,travel_ended_at timestamptz,service_started_at timestamptz,service_ended_at timestamptz,updated_at timestamptz DEFAULT now(),PRIMARY KEY(tenant_id,visit_id));
CREATE TABLE assist_visit_documentation(tenant_id uuid,visit_id uuid,short_description text,submitted_at timestamptz);
CREATE TABLE assist_visit_signatures(id uuid PRIMARY KEY,tenant_id uuid,visit_id uuid,is_valid boolean,signature_hash text,payload_hash text,storage_path text);
CREATE TABLE assist_visit_proofs(id uuid PRIMARY KEY,tenant_id uuid,visit_id uuid,signature_id uuid,payload_hash text,payload_snapshot jsonb,portal_visible boolean DEFAULT false,portal_release_status text DEFAULT 'none');`;
const draft = readFileSync('docs/workflow-server-execution-regression-draft.sql','utf8');
beforeAll(async () => { db = new PGlite(); await db.exec(schema); await db.exec(draft); },30000);
afterAll(async () => { await db?.close(); });
beforeEach(async () => {
  await db.exec(`TRUNCATE assist_visit_execution_state,assist_visit_documentation,assist_visit_signatures,assist_visit_proofs,assist_visits;
    SELECT set_config('test.tenant','${tenant}',false),set_config('test.employee','${employee}',false),set_config('test.client','${client}',false),set_config('test.role','employee_portal',false);
    INSERT INTO assist_visits VALUES('${visit}','${tenant}','${employee}','${client}','started','${start}',NULL,'2026-10-11T07:30:00Z','2026-10-11T07:55:00Z');
    INSERT INTO assist_visit_execution_state(tenant_id,visit_id,current_step,assignment_status) VALUES('${tenant}','${visit}','in_service','gestartet');`);
});
const state = async () => (await db.query<Record<string,unknown>>(`SELECT assignment_status,current_step,documentation_complete,signature_complete,proof_generated,finalized_at::text,service_started_at::text,service_ended_at::text,updated_at::text FROM assist_visit_execution_state`)).rows[0];
const finish = () => db.exec(`UPDATE assist_visits SET canonical_status='finished',actual_end_at='${end}'; UPDATE assist_visit_execution_state SET assignment_status='beendet',current_step='documentation';`);
async function signedProof(deferred = false) {
  await db.exec(`INSERT INTO assist_visit_documentation VALUES('${tenant}','${visit}','Leistung','${end}');`);
  if (!deferred) await db.exec(`INSERT INTO assist_visit_signatures VALUES('${signature}','${tenant}','${visit}',true,'image-hash','payload-hash','signature.png');`);
  await db.query(`INSERT INTO assist_visit_proofs(id,tenant_id,visit_id,signature_id,payload_hash,payload_snapshot,portal_visible,portal_release_status) VALUES($1,$2,$3,$4,'hash',$5,$6,$7)`,[
    proof,tenant,visit,deferred ? null : signature,{ documentationNote:'Leistung',visitTimes:{serviceStartedAt:start,serviceEndedAt:end},...(deferred ? {signatureDeferredToClientPortal:true} : {}) },deferred,deferred?'released':'none']);
}
it('reproduces the verified production regression before testing the draft', async () => {
  const old = JSON.parse(readFileSync('docs/workflow-server-permission-metadata-20261011.json','utf8')).functions.find((f: { name:string })=>f.name==='guard_assist_execution_state_regression').definition;
  await db.exec(old); await db.exec(`UPDATE assist_visit_execution_state SET assignment_status='abgeschlossen',current_step='completed';
    UPDATE assist_visit_execution_state SET assignment_status='pausiert',current_step='paused';`);
  expect((await state()).assignment_status).toBe('pausiert');
  await db.exec(draft);
});
it.each(['unterwegs','angekommen','gestartet','pausiert'])('never resumes service with late %s after a durable end', async status => {
  await finish(); await db.query(`UPDATE assist_visit_execution_state SET assignment_status=$1,current_step='in_service',service_ended_at=NULL`,[status]);
  expect(await state()).toMatchObject({assignment_status:'beendet',current_step:'documentation',service_ended_at:'2026-10-11 09:00:00+00'});
});
it.each(['gestartet','pausiert','beendet','dokumentation_offen','unterschrift_offen'])('retains finalized completion against a late %s projection', async status => {
  await finish(); await signedProof(); await db.exec(`UPDATE assist_visits SET canonical_status='completed'; UPDATE assist_visit_execution_state SET assignment_status='abgeschlossen',current_step='completed',finalized_at='${end}',proof_generated=true;`);
  const prior=await state(); await db.query(`UPDATE assist_visit_execution_state SET assignment_status=$1,current_step='signature',finalized_at=NULL,signature_complete=false,proof_generated=false`,[status]);
  expect(await state()).toMatchObject({assignment_status:'abgeschlossen',current_step:'completed',finalized_at:prior.finalized_at,signature_complete:true,proof_generated:true});
});
it('permits genuine repeated pause/resume while service is open', async () => {
  for(let n=0;n<3;n++){await db.exec(`UPDATE assist_visit_execution_state SET assignment_status='pausiert',current_step='paused'`);expect((await state()).assignment_status).toBe('pausiert');
    await db.exec(`UPDATE assist_visit_execution_state SET assignment_status='gestartet',current_step='in_service'`);expect((await state()).assignment_status).toBe('gestartet');}
});
it('permits a new documentation version to invalidate a former signature/proof before closure',async()=>{
  await finish();await signedProof();await db.exec(`UPDATE assist_visit_execution_state SET assignment_status='unterschrift_offen',current_step='signature',proof_generated=true;
    UPDATE assist_visit_documentation SET short_description='Neue Leistung'; UPDATE assist_visit_signatures SET is_valid=false; UPDATE assist_visit_proofs SET signature_id=NULL;
    UPDATE assist_visit_execution_state SET assignment_status='dokumentation_offen',current_step='documentation',signature_complete=false,proof_generated=false;`);
  expect(await state()).toMatchObject({assignment_status:'dokumentation_offen',documentation_complete:true,signature_complete:false,proof_generated:false});
});
it('keeps unsigned deferred completion truthful and lets later portal signature promote its flags',async()=>{
  await finish();await signedProof(true);await db.exec(`UPDATE assist_visits SET canonical_status='completed'; UPDATE assist_visit_execution_state SET assignment_status='abgeschlossen',current_step='completed',finalized_at='${end}',proof_generated=true;`);
  expect(await state()).toMatchObject({assignment_status:'abgeschlossen',signature_complete:false,proof_generated:true});
  await db.exec(`SELECT set_config('test.role','client_portal',false); INSERT INTO assist_visit_signatures VALUES('${signature}','${tenant}','${visit}',true,'image-hash','payload-hash','signature.png');
    UPDATE assist_visit_proofs SET signature_id='${signature}'; UPDATE assist_visit_execution_state SET signature_complete=true;`);
  expect(await state()).toMatchObject({assignment_status:'abgeschlossen',signature_complete:true,proof_generated:true});
});
it('allows canonical time correction and rejects an inverted start/end',async()=>{
  await finish();await db.exec(`UPDATE assist_visits SET actual_start_at='2026-10-11T08:15:00Z'; UPDATE assist_visit_execution_state SET service_started_at='2026-10-11T08:15:00Z'`);
  expect((await state()).service_started_at).toBe('2026-10-11 08:15:00+00');
  await db.exec(`UPDATE assist_visits SET actual_start_at='2026-10-11T10:00:00Z'`);
  await expect(db.exec(`UPDATE assist_visit_execution_state SET service_started_at='2026-10-11T10:00:00Z'`)).rejects.toThrow('Einsatzende');
});
it('does not infer proof readiness after a time correction makes a stored snapshot stale',async()=>{
  await finish();await signedProof();await db.exec(`UPDATE assist_visit_execution_state SET proof_generated=true; UPDATE assist_visits SET actual_start_at='2026-10-11T08:15:00Z'; UPDATE assist_visit_execution_state SET proof_generated=true`);
  expect((await state()).proof_generated).toBe(false);
});
it('preserves same-status retry versions and advances only for a real change',async()=>{
  const prior=await state();await db.exec(`UPDATE assist_visit_execution_state SET updated_at='2099-01-01',assignment_status='gestartet'`);
  expect((await state()).updated_at).toBe(prior.updated_at);
  await db.exec(`UPDATE assist_visit_execution_state SET assignment_status='pausiert',current_step='paused',updated_at='2000-01-01'`);
  expect((await state()).updated_at).not.toBe(prior.updated_at);
});
it('rejects unconfirmed closure and wrong actor/scope without changing the stored version',async()=>{
  const prior=await state();await expect(db.exec(`UPDATE assist_visit_execution_state SET assignment_status='abgeschlossen',finalized_at=now()`)).rejects.toThrow('kanonische');
  await db.exec(`SELECT set_config('test.employee','${client}',false)`);await expect(db.exec(`UPDATE assist_visit_execution_state SET assignment_status='pausiert'`)).rejects.toThrow('zugeordnet');
  await db.exec(`SELECT set_config('test.employee','${employee}',false),set_config('test.tenant','${client}',false)`);await expect(db.exec(`UPDATE assist_visit_execution_state SET assignment_status='pausiert'`)).rejects.toThrow('Mandanten');
  expect(await state()).toEqual(prior);
});
