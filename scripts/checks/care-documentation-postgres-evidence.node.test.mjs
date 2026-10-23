import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {registerCareDocumentationPostgresEvidenceTests} from './validate-care-documentation-postgres-evidence.mjs';

const fixtureUrl=new URL('./fixtures/care-documentation-staging-synthetic-20261022.json',import.meta.url);
const fixtureText=readFileSync(fixtureUrl,'utf8'),fixture=JSON.parse(fixtureText);
const provenance=JSON.parse(readFileSync(new URL('./fixtures/care-documentation-staging-synthetic-20261022.provenance.json',import.meta.url),'utf8'));
await registerCareDocumentationPostgresEvidenceTests(fixtureUrl);

test('Retained actual CareDocumentation SQL sample preserves provenance and byte integrity',()=>{
 assert.equal(createHash('sha256').update(fixtureText).digest('hex'),provenance.sha256);
 assert.equal(provenance.sourceFixture,'supabase/tests/pflege_care_documentation_quarantined_staging.sql');
 assert.equal(provenance.sourceFixtureSha256,'bb209bb196ec2fe6cf14e3b86c9c4c5c855fc7af2cb78f76d79c64873feaffaf');
 assert.equal(provenance.sourcePatchSha256,'0d8bd54acc3a3123c248a74c752e71760c6307b8d13db79ac1f8435545a0e173');
 assert.deepEqual(provenance.appliedMigrationVersions,['20261022080425']);assert.equal(provenance.synthetic,true);
 assert.equal(provenance.sqlRollbackAndCleanupVerified,true);assert.equal(provenance.authHttpVerified,false);
 assert.equal(provenance.browserVerified,false);assert.equal(provenance.realClinicalQualificationVerified,false);
});
test('Actual CareDocumentation projection retains synthetic unsigned originals without Auth material',()=>{
 const forbidden=new Set(['access_token','refresh_token','session_id','authorization','password','secret','auth_user_id','raw_user_meta_data','raw_app_meta_data','jwt','claims','request.jwt.claims']);
 const visit=value=>{if(Array.isArray(value))value.forEach(visit);else if(value&&typeof value==='object')for(const [key,item]of Object.entries(value)){assert.ok(!forbidden.has(key.toLowerCase()),key);visit(item);}else if(typeof value==='string')assert.doesNotMatch(value,/Bearer\s+|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\./i);};
 visit(fixture);assert.equal(fixture.cleanupConfirmed,true);assert.equal(fixture.sameProfileDifferentAuthReplayDenied,true);
 assert.match(fixture.nativeFirst.title,/synthetic/i);assert.match(fixture.nativeFirst.recorded_by_name,/synthetic/i);
 for(const key of ['nativeFirst','nativeSecondUnsigned','nativeThird']){assert.equal(fixture[key].signature_status,'unsigned');assert.equal(fixture[key].signed_at,null);assert.equal(fixture[key].signed_by,null);}
});
