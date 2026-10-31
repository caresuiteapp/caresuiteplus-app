import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {registerBasicCareReviewUnitEvidenceTests} from './validate-basic-care-review-unit-evidence.mjs';
const url=new URL('./fixtures/basic-care-review-acceptance-staging-synthetic-20261022.json',import.meta.url);
const bytes=readFileSync(url),e=JSON.parse(bytes.toString('utf8'));
const p=JSON.parse(readFileSync(new URL('./fixtures/basic-care-review-acceptance-staging-synthetic-20261022.provenance.json',import.meta.url),'utf8'));
const hash=content=>createHash('sha256').update(content).digest('hex');
await registerBasicCareReviewUnitEvidenceTests(url);

test('Retained supplementary review SQL bytes bind the exact subset and applied base migration sources',()=>{
 assert.equal(p.schemaVersion,1);assert.equal(p.capturedOn,'2026-10-22');
 assert.equal(bytes.length,64885);assert.equal(p.evidenceBytes,bytes.length);
 assert.equal(hash(bytes),'17b8417660fb02dac53aa8178f52739740c0566f7df2ee9809e88ad22d53043d');assert.equal(p.evidenceSha256,hash(bytes));
 assert.equal(p.sqlFixture,'supabase/tests/pflege_basic_care_review_acceptance_unit_staging.sql');
 const sql=readFileSync(new URL('../../'+p.sqlFixture,import.meta.url));
 assert.equal(sql.length,14933);assert.equal(p.sqlFixtureBytes,sql.length);
 assert.equal(hash(sql),'30200bbce796b2f8271977c43a320e31730f2c8485cadad2aaa9ec46b16a8b3a');assert.equal(p.sqlFixtureSha256,hash(sql));
 assert.deepEqual(p.appliedMigrationVersions,['20261022081906','20261022082127']);
 const base='fb8b0d44ff5205c684f30c45436ec92c4ea64c8e108b007fc62dbcdfa3206b21',dto='69f710e185696dda4b04b886151bce940870d9219c2771a453fe313316b2c7a0';
 assert.deepEqual(p.appliedPatchSha256,{'ambulatory_basic_care_quarantined.sql':base,'ambulatory_basic_care_dto_limits.sql':dto});
 assert.deepEqual(p.appliedMigrationSha256,{'20261022081906_pflege_basic_care_quarantined.sql':base,'20261022082127_pflege_basic_care_dto_limits.sql':dto});
 for(const[name,sha]of Object.entries(p.appliedPatchSha256))assert.equal(hash(readFileSync(new URL('../../supabase/patches/'+name,import.meta.url))),sha);
 for(const[name,sha]of Object.entries(p.appliedMigrationSha256))assert.equal(hash(readFileSync(new URL('../../supabase/migrations/'+name,import.meta.url))),sha);
 assert.equal(p.fullBaselineFixture,'supabase/tests/pflege_basic_care_review_reconstructed_staging.sql');assert.equal(p.fullBaselineFixtureSha256,'2195790347f9e4553df7b10763968bd16959ce1515b5ef86de014cfb0ef9f1f2');
 assert.equal(hash(readFileSync(new URL('../../'+p.fullBaselineFixture,import.meta.url))),p.fullBaselineFixtureSha256);
 const map=JSON.parse(readFileSync(new URL('../../'+p.subsetMap,import.meta.url),'utf8'));
 assert.equal(map.unit,4);assert.equal(map.sqlSha256,p.sqlFixtureSha256);assert.equal(map.runtimeEvidenceSha256,p.evidenceSha256);
 assert.match(map.runtimeStatus,/^PASS: actual supplementary/);assert.ok(map.excluded.includes('Real clinical qualification or approval'));
 assert.equal(p.supplementaryReviewUnit,true);assert.equal(p.sqlRollbackAndCleanupVerified,true);
});
test('Every retained supplementary review original is free of credentials, Auth claims, session material and private proofs',()=>{
 const forbidden=/access.?token|refresh.?token|password|passwd|secret|jwt|session.?id|request\.jwt|raw_user_meta|raw_app_meta|authorization|bearer|authUserIds|auth_user_id|profile_original/i;
 const secretValue=/eyJ[A-Za-z0-9_-]{12,}\.eyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]+|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|(?:postgres|postgresql):\/\/[^\s]+:[^\s]+@|sb_secret_[A-Za-z0-9_]+/i;
 const walk=(v,path='$')=>{if(Array.isArray(v))for(const[i,x]of v.entries())walk(x,`${path}[${i}]`);else if(v&&typeof v==='object')for(const[k,x]of Object.entries(v)){assert.doesNotMatch(k,forbidden,path+'.'+k);walk(x,path+'.'+k);}else if(typeof v==='string')assert.doesNotMatch(v,secretValue,path);};walk(e);
});
test('Actual supplementary review timestamps and qualification narratives remain explicitly synthetic',()=>{
 assert.equal(e.supplementaryReviewUnit,true);assert.equal(e.rollbackCleanupPassed,true);
 for(const value of [e.receipt.original.recordedByName,...e.decisionReceipt.original.history.map(x=>x.actorName),e.decisionReceipt.original.history.at(-1).qualificationOriginal.title])assert.match(value,/synthetic/i);
 assert.match(e.decisionReceipt.original.history.at(-1).qualificationOriginal.qualificationType,/^synthetic_/);
 assert.equal(e.receipt.original.recordedAt,p.careRecordedAt);assert.equal(e.reviewReceipt.original.history[0].recordedAt,p.reviewRequestedAt);assert.equal(e.decisionReceipt.original.history.at(-1).recordedAt,p.reviewAcceptedAt);
 assert.deepEqual(e.requestConfirmedReceipt,e.reviewReceipt);assert.deepEqual(e.decisionConfirmedReceipt,e.decisionReceipt);
 assert.equal(e.reviewReceipt.original.status,'requested');assert.equal(e.decisionReceipt.original.status,'accepted');
 assert.notEqual(e.reviewPacket.actorId,e.decisionPacket.actorId);
});
