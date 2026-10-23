import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {registerVitalPostgresEvidenceTests} from './validate-vital-postgres-evidence.mjs';

// Actual synthetic Staging response captured after the fixture's verified inner cleanup,
// before its explicit outer ROLLBACK. These originals are not fabricated by this test.
const fixtureUrl=new URL('./fixtures/vital-staging-synthetic-20261022.json',import.meta.url);
const fixtureText=readFileSync(fixtureUrl,'utf8');
const fixture=JSON.parse(fixtureText);
const provenance=JSON.parse(readFileSync(new URL('./fixtures/vital-staging-synthetic-20261022.provenance.json',import.meta.url),'utf8'));
await registerVitalPostgresEvidenceTests(fixtureUrl);

test('Retained actual Vital SQL sample has verified provenance and byte integrity',()=>{
 assert.equal(createHash('sha256').update(fixtureText).digest('hex'),provenance.sha256);
 assert.equal(provenance.synthetic,true);
 assert.equal(provenance.sqlRollbackAndCleanupVerified,true);
 assert.equal(provenance.authHttpVerified,false);
 assert.equal(provenance.browserVerified,false);
 assert.equal(provenance.realClinicalQualificationVerified,false);
 assert.equal(provenance.sourceFixture,'supabase/tests/pflege_vital_workspace_staging.sql');
 assert.match(provenance.sourceFixtureSha256,/^[a-f0-9]{64}$/);
 assert.deepEqual(provenance.appliedMigrationVersions,['20261022055525','20261022055705','20261022055901','20261022064013']);
});
test('Retained actual Vital SQL sample contains only synthetic originals and no Auth material',()=>{
 assert.deepEqual(Object.keys(fixture).sort(),['cleanupConfirmed','correctionPacket','correctionReceipt','decisionPacket','decisionReceipt','expected','followUpPacket','followUpReceipt','invalidationPacket','invalidationReceipt','legacyNative','native','nativePacket','pathPacket','pathReceipt','returnPacket','returnReceipt','returnRequestPacket','returnRequestReceipt','reviewPacket','reviewReceipt','revisionPacket','revisionReceipt','schemaVersion','sources'].sort());
 assert.equal(fixture.cleanupConfirmed,true);
 assert.match(fixture.native.recorded_by_name,/synthetic/i);
 assert.match(fixture.native.note,/synthetic/i);
 assert.match(fixture.decisionReceipt.original.history[1].actorName,/synthetic/i);
 assert.doesNotMatch(fixtureText,/session|token|auth_user|raw_user|raw_app|email|password|bearer|claims|secret|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\./i);
});
