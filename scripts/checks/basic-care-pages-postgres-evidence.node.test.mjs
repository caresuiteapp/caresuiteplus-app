import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {registerBasicCarePostgresEvidenceTests} from './validate-basic-care-postgres-evidence.mjs';
const url=new URL('./fixtures/basic-care-pages-staging-synthetic-20261022.json',import.meta.url);
const bytes=readFileSync(url),e=JSON.parse(bytes.toString('utf8'));
const p=JSON.parse(readFileSync(new URL('./fixtures/basic-care-pages-staging-synthetic-20261022.provenance.json',import.meta.url),'utf8'));
const sha=v=>createHash('sha256').update(v).digest('hex');
await registerBasicCarePostgresEvidenceTests(url);
test('Actual pages SQL evidence binds unchanged bytes, precise source fixture and applied base migrations',()=>{
 assert.equal(p.schemaVersion,1);assert.equal(p.capturedOn,'2026-10-22');assert.equal(p.evidenceFile,'basic-care-pages-staging-synthetic-20261022.json');
 assert.equal(bytes.length,71434);assert.equal(p.evidenceBytes,bytes.length);assert.equal(sha(bytes),'4aecc6a73e16516899fc908766d2d3193aa0339ac14230e7a9e3a5ff16987c7f');assert.equal(p.evidenceSha256,sha(bytes));
 assert.equal(p.sqlFixture,'supabase/tests/pflege_basic_care_pages_unit_staging.sql');assert.equal(p.sqlFixtureSha256,'b9568cc8ba2540a3ee29d3a42cbc4b4b60cb38ec0c0b2d36c608d4dc965aa846');assert.equal(sha(readFileSync(new URL('../../'+p.sqlFixture,import.meta.url))),p.sqlFixtureSha256);
 assert.deepEqual(p.appliedMigrationVersions,['20261022081906','20261022082127']);
 assert.deepEqual(p.appliedPatchSha256,{"ambulatory_basic_care_quarantined.sql":"fb8b0d44ff5205c684f30c45436ec92c4ea64c8e108b007fc62dbcdfa3206b21","ambulatory_basic_care_dto_limits.sql":"69f710e185696dda4b04b886151bce940870d9219c2771a453fe313316b2c7a0"});
 for(const[name,hash]of Object.entries(p.appliedPatchSha256))assert.equal(sha(readFileSync(new URL('../../supabase/patches/'+name,import.meta.url))),hash);
 assert.equal(p.supplementaryRuntimeUnit,true);assert.equal(p.sqlRollbackAndCleanupVerified,true);assert.equal(p.unitMarker,'pagesUnit');assert.equal(e[p.unitMarker],true);assert.equal(e.rollbackCleanupPassed,true);
});
test('Actual pages sources retain wholly synthetic native originals and exact explicitly chosen planning tuple',()=>{
 const x=e.expected,s=e.issuePacket.sources;assert.equal(e.issuePacket.requestId,x.issueRequestId);assert.equal(e.issuePacket.actorId,x.authorId);
 for(const v of[s.plan.title,s.measure.title,s.measure.intervention,s.tour.name,s.visit.client_name_snapshot,e.issuePacket.reason])assert.match(v,/synthetic/i);
 assert.equal(s.planVersion.id,x.planVersionId);assert.equal(s.measure.id,x.measureId);assert.equal(s.visit.id,x.visitId);
 assert.equal(s.visit.planned_start,'08:15:30.123456');assert.match(e.issuePacket.plannedAt,/\.123456Z$/);assert.equal(e.issuePacket.timeZone,'Europe/Berlin');assert.equal(e.issuePacket.secondPersonRequired,false);
});
