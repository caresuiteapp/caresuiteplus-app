import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {registerBasicCarePostgresEvidenceTests} from './validate-basic-care-postgres-evidence.mjs';
const url=new URL('./fixtures/basic-care-binding-receipt-staging-synthetic-20261022.json',import.meta.url);
const bytes=readFileSync(url),e=JSON.parse(bytes.toString('utf8'));
const provenance=JSON.parse(readFileSync(new URL('./fixtures/basic-care-binding-receipt-staging-synthetic-20261022.provenance.json',import.meta.url),'utf8'));
await registerBasicCarePostgresEvidenceTests(url);

test('Retained supplementary actual BasicCare SQL bytes bind their precise fixture and applied base migrations',()=>{
 assert.equal(provenance.schemaVersion,1);assert.equal(provenance.capturedOn,'2026-10-22');
 assert.equal(bytes.length,30965);assert.equal(provenance.evidenceBytes,bytes.length);
 assert.equal(createHash('sha256').update(bytes).digest('hex'),'9a6d08a37ff9f2165a2e483466b3833c19854cfeabbc36633ae3e898fc4ed493');
 assert.equal(provenance.evidenceSha256,createHash('sha256').update(bytes).digest('hex'));
 assert.equal(provenance.sqlFixture,'supabase/tests/pflege_basic_care_binding_receipt_unit_staging.sql');
 assert.equal(provenance.sqlFixtureSha256,'1117db3437fa1f6779a9a21bfe6afd6c127355a1615612f71001a9d77a4ad664');
 assert.equal(createHash('sha256').update(readFileSync(new URL('../../'+provenance.sqlFixture,import.meta.url))).digest('hex'),provenance.sqlFixtureSha256);
 assert.deepEqual(provenance.appliedMigrationVersions,['20261022081906','20261022082127']);
 assert.deepEqual(provenance.appliedPatchSha256,{'ambulatory_basic_care_quarantined.sql':'fb8b0d44ff5205c684f30c45436ec92c4ea64c8e108b007fc62dbcdfa3206b21','ambulatory_basic_care_dto_limits.sql':'69f710e185696dda4b04b886151bce940870d9219c2771a453fe313316b2c7a0'});
 for(const [name,sha] of Object.entries(provenance.appliedPatchSha256))assert.equal(createHash('sha256').update(readFileSync(new URL('../../supabase/patches/'+name,import.meta.url))).digest('hex'),sha);
 assert.equal(provenance.supplementaryRuntimeUnit,true);assert.equal(provenance.sqlRollbackAndCleanupVerified,true);
});
test('Actual retained native originals explicitly remain wholly synthetic planning without performance or review',()=>{
 const p=e.issuePacket,s=p.sources,r=e.receipt.original;
 for(const value of [s.plan.title,s.measure.title,s.measure.intervention,s.tour.name,s.visit.client_name_snapshot,p.reason,r.recordedByName])assert.match(value,/synthetic/i);
 assert.equal(e.supplementaryRuntimeUnit,true);assert.equal(e.rollbackCleanupPassed,true);
 assert.equal(p.timeZone,'Europe/Berlin');assert.equal(s.visit.planned_start,'08:15:30.123456');assert.match(p.plannedAt,/\.123456Z$/);
 assert.equal(r.payload.execution.outcome,'planned');assert.equal(r.payload.occurredAt,null);assert.equal(r.payload.consent.state,'not_asked');
 assert.deepEqual(r.payload.execution.performedBy,[]);assert.deepEqual(r.payload.execution.interventions,[]);assert.equal(r.payload.execution.result,'');assert.equal(r.payload.lifecycle,'open');
 assert.equal(e.confirmedReceipt.requestId,e.expected.createRequestId);assert.deepEqual(e.confirmedReceipt,e.receipt);
});
