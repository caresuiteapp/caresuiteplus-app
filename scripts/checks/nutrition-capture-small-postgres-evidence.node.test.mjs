import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {registerNutritionCaptureSmallPostgresEvidenceTests} from './validate-nutrition-capture-small-postgres-evidence.mjs';
const evidenceUrl=new URL('./fixtures/nutrition-capture-small-staging-synthetic-20261022.json',import.meta.url);
const bytes=readFileSync(evidenceUrl),e=JSON.parse(bytes.toString('utf8'));
const provenance=JSON.parse(readFileSync(new URL('./fixtures/nutrition-capture-small-staging-synthetic-20261022.provenance.json',import.meta.url),'utf8'));
const hash=v=>createHash('sha256').update(v).digest('hex');
registerNutritionCaptureSmallPostgresEvidenceTests(evidenceUrl);

test('Retained actual Nutrition SQL bytes bind the exact runtime fixture and actual applied base migration',()=>{
 assert.equal(provenance.schemaVersion,1);assert.equal(provenance.capturedOn,'2026-10-22');
 assert.equal(bytes.length,76874);assert.equal(provenance.evidenceBytes,bytes.length);
 assert.equal(hash(bytes),'56b9d9b3bc0cb6b646c0513b1c056716f47e75d35cd0683fd8bf4d570c50e2ad');
 assert.equal(provenance.evidenceSha256,hash(bytes));
 assert.equal(provenance.sqlFixture,'supabase/tests/pflege_nutrition_capture_small_staging.sql');
 const sql=readFileSync(new URL('../../'+provenance.sqlFixture,import.meta.url));
 assert.equal(sql.length,14498);assert.equal(provenance.sqlFixtureBytes,sql.length);
 assert.equal(hash(sql),'cba9bad197abfe888d1b0487d4586a865b1df6f560d4ae97cda42c1dfa20a460');
 assert.equal(hash(sql),provenance.sqlFixtureSha256);
 assert.deepEqual(provenance.appliedMigrationVersions,['20261022115155']);
 const base='9ad65e8ca65f9311f46980c67bf6135259d7f0d5d0afb8c69d96d9c5e5e3ceac';
 assert.deepEqual(provenance.appliedPatchSha256,{'ambulatory_nutrition_workspace_quarantined.sql':base});
 assert.deepEqual(provenance.appliedMigrationSha256,{'20261022115155_pflege_nutrition_workspace_quarantined.sql':base});
 for(const [name,sha]of Object.entries(provenance.appliedPatchSha256))assert.equal(hash(readFileSync(new URL('../../supabase/patches/'+name,import.meta.url))),sha);
 for(const [name,sha]of Object.entries(provenance.appliedMigrationSha256))assert.equal(hash(readFileSync(new URL('../../supabase/migrations/'+name,import.meta.url))),sha);
 assert.equal(provenance.supplementaryRuntimeUnit,true);assert.equal(provenance.sqlRollbackAndCleanupVerified,true);
});
test('Every retained Nutrition object is recursively free of credential, Auth claim and session material',()=>{
 const forbidden=/access.?token|refresh.?token|password|passwd|secret|jwt|session.?id|request\.jwt|raw_user_meta|raw_app_meta|authorization|bearer|auth_user_id/i;
 const walk=(v,path='$')=>{
  if(Array.isArray(v))for(const [i,x]of v.entries())walk(x,path+'['+i+']');
  else if(v&&typeof v==='object')for(const[k,x]of Object.entries(v)){assert.doesNotMatch(k,forbidden,path+'.'+k);walk(x,path+'.'+k);}
  else if(typeof v==='string')assert.doesNotMatch(v,/eyJ[A-Za-z0-9_-]{12,}\.eyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]+/,path);
 };walk(e);
});
test('Actual retained Nutrition originals stay synthetic planning with absent clinical observations and exact own confirmation',()=>{
 const n=e.context.nativeOriginals,p=e.careReceipt.original.payload;
 for(const value of [n.plan.title,n.measure.title,n.measure.intervention,n.tour.name,n.visit.client_name_snapshot,n.assessment.subject_name_snapshot,n.assessment.assessor_name_snapshot,e.careReceipt.original.recordedByName,p.intake.item])assert.match(value,/synthetic/i);
 assert.equal(n.visit.planned_start,'12:15:30.123456');assert.match(e.capturePacket.plannedAt,/\.123456Z$/);
 assert.equal(e.captureReceipt.binding.capturedAt,provenance.captureRecordedAt);
 assert.equal(e.careReceipt.original.recordedAt,provenance.careRecordedAt);
 assert.equal(p.execution.outcome,'planned');assert.equal(p.occurredAt,null);assert.deepEqual(p.execution.performedBy,[]);
 assert.equal(p.intake.actual,null);assert.equal(p.intake.offered,null);assert.equal(p.decision.state,'not_asked');assert.equal(p.lifecycle,'open');
 assert.equal(e.capturePacket.requestId,e.expected.captureRequestId);assert.equal(e.carePacket.requestId,e.expected.careRequestId);
 assert.deepEqual(e.captureConfirmed,e.captureReceipt);assert.deepEqual(e.careConfirmed,e.careReceipt);
});
