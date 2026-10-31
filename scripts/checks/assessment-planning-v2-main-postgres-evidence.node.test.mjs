import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {validateAssessmentPlanningV2PostgresEvidence,assertAssessmentPlanningV2EvidenceTamperRejections} from './validate-assessment-planning-v2-postgres-evidence.mjs';

const evidenceUrl=new URL('./fixtures/assessment-planning-v2-main-staging-synthetic-20261023.json',import.meta.url);
const bytes=readFileSync(evidenceUrl),e=JSON.parse(bytes.toString('utf8'));
const provenance=JSON.parse(readFileSync(new URL('./fixtures/assessment-planning-v2-main-staging-synthetic-20261023.provenance.json',import.meta.url),'utf8'));
const hash=value=>createHash('sha256').update(value).digest('hex');

test('Actual V2 Staging projection satisfies current production context, source, command, receipt and native packet decoders',()=>{
 const accepted=validateAssessmentPlanningV2PostgresEvidence(e);
 assert.deepEqual(accepted,e);
 assert.equal(accepted.technicalPlanningOnly,true);
 assert.equal(accepted.rollbackCleanupPassed,true);
 assert.equal(accepted.assessmentReceipt.event.recordedAt,provenance.firstAssessmentRecordedAt);
 assert.equal(accepted.planReceipts.at(-1).event.recordedAt,provenance.lastPlanRecordedAt);
 assert.match(accepted.instrument.model.title,/^Synthetic /);
 assert.equal(accepted.instrument.model.claim,'product_model');
 assert.deepEqual(accepted.instrument.instruments,[]);
 assert.deepEqual(accepted.lifecycle.dayRoutines,[]);
 assert.deepEqual(accepted.lifecycle.supportBoundaries,[]);
 assert.equal(accepted.lifecycle.qualityVisit,null);
});

test('Actual retained V2 responses reject thirteen independent scope, source, receipt and complete-read proof substitutions',()=>{
 assert.equal(assertAssessmentPlanningV2EvidenceTamperRejections(e),13);
});

test('Actual V2 result bytes bind the executed SQL and the exact applied additive migration sources',()=>{
 assert.equal(provenance.schemaVersion,1);
 assert.equal(provenance.capturedOn,'2026-10-23');
 assert.equal(provenance.evidenceFile,'assessment-planning-v2-main-staging-synthetic-20261023.json');
 assert.equal(bytes.length,573833);
 assert.equal(provenance.evidenceBytes,bytes.length);
 assert.equal(hash(bytes),'b8317669f91f1a93b6968fc1eedcd74ccaf07805e366e277ec262c5fc7737689');
 assert.equal(provenance.evidenceSha256,hash(bytes));
 assert.equal(provenance.sqlFixture,'supabase/tests/pflege_assessment_planning_v2_unit_staging.sql');
 const sql=readFileSync(new URL('../../'+provenance.sqlFixture,import.meta.url));
 assert.equal(sql.length,14947);
 assert.equal(provenance.sqlFixtureBytes,sql.length);
 assert.equal(hash(sql),'74f8c92dd52083f8cabf6f8490fbeed05b78f70ec41501dea19cad8ee09e1033');
 assert.equal(provenance.sqlFixtureSha256,hash(sql));
 assert.deepEqual(provenance.appliedMigrationVersions,['20261023010345']);
 const sha='075d091fd6f6a0e78c74c05b40c3160e1e3c97a0f8448db6af5b6cb1794c3dcc';
 assert.deepEqual(provenance.appliedPatchSha256,{'ambulatory_assessment_planning_v2_quarantined.sql':sha});
 assert.deepEqual(provenance.appliedMigrationSha256,{'20261023010345_pflege_assessment_planning_v2_quarantined.sql':sha});
 for(const[name,value]of Object.entries(provenance.appliedPatchSha256))assert.equal(hash(readFileSync(new URL('../../supabase/patches/'+name,import.meta.url))),value);
 for(const[name,value]of Object.entries(provenance.appliedMigrationSha256))assert.equal(hash(readFileSync(new URL('../../supabase/migrations/'+name,import.meta.url))),value);
 assert.equal(provenance.sqlRollbackAndCleanupVerified,true);
 assert.equal(provenance.technicalPlanningOnly,true);
});

test('Every retained actual V2 field is free of credentials, Auth claims, sessions, JWTs and private identity proofs',()=>{
 const forbidden=/access.?token|refresh.?token|password|passwd|secret|jwt|session.?id|request\.jwt|raw_user_meta|raw_app_meta|authorization|bearer|auth_user_id|profile_original/i;
 let keys=0,strings=0;
 const walk=(value,path='$')=>{
  if(Array.isArray(value))for(const[index,nested]of value.entries())walk(nested,path+'['+index+']');
  else if(value&&typeof value==='object')for(const[key,nested]of Object.entries(value)){keys++;assert.doesNotMatch(key,forbidden,path+'.'+key);walk(nested,path+'.'+key);}
  else if(typeof value==='string'){strings++;assert.doesNotMatch(value,/eyJ[A-Za-z0-9_-]{12,}\.eyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]+/,path);}
 };
 walk(e);
 assert.equal(keys,9347);
 assert.equal(strings,7051);
});
