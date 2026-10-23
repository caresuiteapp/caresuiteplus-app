import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {registerBasicCarePostgresEvidenceTests} from './validate-basic-care-postgres-evidence.mjs';
/** Registers checks only when the caller supplies an actual retained unit-4 PostgreSQL result. */
export async function registerBasicCareReviewUnitEvidenceTests(source){
 await registerBasicCarePostgresEvidenceTests(source);
 const evidence=JSON.parse(await readFile(source instanceof URL?source:pathToFileURL(source),'utf8'));
 test('Actual supplementary review unit has distinct own authors and exact separately confirmed historical receipts',()=>{
  const e=evidence,p=e.packet,r=e.receipt,request=e.reviewPacket,decision=e.decisionPacket;
  assert.equal(e.supplementaryReviewUnit,true);assert.equal(e.rollbackCleanupPassed,true);
  assert.notEqual(e.expected.authorId,e.expected.reviewerId);
  assert.equal(p.requestId,e.expected.createRequestId);assert.equal(p.actorId,e.expected.authorId);
  assert.equal(r.original.payload.lifecycle,'completed');assert.equal(r.original.payload.execution.outcome,'performed');
  assert.deepEqual(r.original.payload.execution.performedBy,[e.expected.authorId]);
  assert.equal(r.original.payload.consent.state,'consented');assert.ok(r.original.payload.consent.recordedAt);
  assert.equal(request.requestId,e.expected.reviewRequestId);assert.equal(decision.requestId,e.expected.decisionRequestId);
  assert.equal(request.actorId,e.expected.authorId);assert.equal(decision.actorId,e.expected.reviewerId);
  assert.deepEqual(request.careOriginal,r.original);assert.deepEqual(decision.careOriginal,r.original);
  assert.deepEqual(decision.reviewOriginal,e.reviewReceipt.original);
  assert.equal(e.reviewReceipt.original.status,'requested');assert.equal(e.decisionReceipt.original.status,'accepted');
  assert.deepEqual(e.decisionReceipt.original.history.slice(0,-1),e.reviewReceipt.original.history);
  assert.deepEqual(e.requestConfirmedReceipt,e.reviewReceipt);assert.deepEqual(e.decisionConfirmedReceipt,e.decisionReceipt);
  const q=e.decisionReceipt.original.history.at(-1).qualificationOriginal;
  assert.equal(q.profileId,e.expected.reviewerId);assert.equal(q.scopeKind,'basic_care_review');
 });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(!process.argv[2])throw Error('Supply actual supplementary BasicCare review unit evidence JSON path');
 await registerBasicCareReviewUnitEvidenceTests(process.argv[2]);
}
