import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {registerBasicCarePostgresEvidenceTests} from './validate-basic-care-postgres-evidence.mjs';

/** Accepts only a caller-supplied actual, rolled-back supplementary unit-7 capture. */
export async function registerBasicCareReviewAuthRelinkEvidenceTests(source){
 await registerBasicCarePostgresEvidenceTests(source);
 const e=JSON.parse(await readFile(source instanceof URL?source:pathToFileURL(source),'utf8'));
 test('Actual qualified review receipt remains owned by its original account after a same-profile Auth relink',()=>{
  assert.equal(e.supplementaryReviewAuthRelinkUnit,true);
  assert.equal(e.rollbackCleanupPassed,true);
  assert.equal(e.sameProfileDifferentAuthQualified,true);
  assert.equal(e.differentAuthReplayDenied,true);
  assert.equal(e.differentAuthConfirmDenied,true);
  const x=e.expected,p=e.packet,request=e.reviewPacket,decision=e.decisionPacket;
  assert.notEqual(x.authorId,x.reviewerId);
  assert.equal(p.actorId,x.authorId);assert.equal(p.requestId,x.createRequestId);
  assert.equal(e.receipt.original.payload.lifecycle,'completed');
  assert.equal(e.receipt.original.payload.execution.outcome,'performed');
  assert.deepEqual(e.receipt.original.payload.execution.performedBy,[x.authorId]);
  assert.equal(request.actorId,x.authorId);assert.equal(request.requestId,x.reviewRequestId);
  assert.equal(decision.actorId,x.reviewerId);assert.equal(decision.requestId,x.decisionRequestId);
  assert.deepEqual(request.careOriginal,e.receipt.original);
  assert.deepEqual(decision.careOriginal,e.receipt.original);
  assert.deepEqual(decision.reviewOriginal,e.reviewReceipt.original);
  assert.equal(e.reviewReceipt.original.status,'requested');
  assert.equal(e.decisionReceipt.original.status,'accepted');
  assert.deepEqual(e.decisionReceipt.original.history.slice(0,-1),e.reviewReceipt.original.history);
  assert.deepEqual(e.decisionConfirmedReceipt,e.decisionReceipt);
  const q=e.decisionReceipt.original.history.at(-1).qualificationOriginal;
  assert.equal(q.profileId,x.reviewerId);assert.equal(q.scopeKind,'basic_care_review');
 });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(!process.argv[2])throw Error('Supply actual supplementary review Auth-relink SQL evidence JSON path');
 await registerBasicCareReviewAuthRelinkEvidenceTests(process.argv[2]);
}
