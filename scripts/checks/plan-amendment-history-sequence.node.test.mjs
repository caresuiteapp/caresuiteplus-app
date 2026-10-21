import {test} from 'node:test';import assert from 'node:assert/strict';
import {decodePlanAmendmentHistory,planAmendmentHistoryVersion} from '../../src/lib/careAssessment/planAmendmentHistoryDomain.ts';
import {historyRecord,historySequence} from './fixtures/plan-amendment-history.mjs';
import {tenant,assessment,client,now,time} from './fixtures/plan-amendment.mjs';
const decode=records=>decodePlanAmendmentHistory({version:planAmendmentHistoryVersion,tenantId:tenant,assessmentId:assessment,count:records.length,records},tenant,assessment,client,now);
test('revision gaps and identical microsecond storage times are valid',()=>{const rows=historySequence(3);assert.deepEqual(decode([rows[1],rows[2],rows[0]]).map(r=>r.result.draftRevision),[10,7,4]);});
test('adjacent accepted technical revisions remain valid',()=>{const rows=historySequence();rows[1].payload.target.draftRevision=4;rows[1].result.previousRevision=4;rows[1].result.draftRevision=5;assert.equal(decode(rows).length,2);});
for(const [name,change] of [
 ['overlapping native revisions',r=>{r.payload.target.draftRevision=3;r.result.previousRevision=3;}],
 ['target older than prior accepted save',r=>r.payload.target.updatedAt=time(10)],
 ['duplicate resulting revision',r=>{r.payload.target.draftRevision=3;r.result.previousRevision=3;r.result.draftRevision=4;}],
 ['preparation before updated target',r=>{r.payload.target.updatedAt=time(12);}]
])test(name,()=>{const rows=historySequence();change(rows[1]);assert.throws(()=>decode(rows));});
for(const status of ['active','planned'])test(`historical ${status} review must have been future at save time`,()=>{const r=historyRecord();r.payload.proposed.status=status;r.payload.proposed.nextEvaluationAt=time(11);r.result.appliedMeasure=structuredClone(r.payload.proposed);assert.throws(()=>decode([r]));r.payload.proposed.nextEvaluationAt='2026-10-09T11:00:00.000002Z';r.result.appliedMeasure=structuredClone(r.payload.proposed);assert.equal(decode([r]).length,1);});
test('completed historical change needs no future review',()=>{const r=historyRecord();r.payload.proposed.status='completed';r.payload.proposed.nextEvaluationAt=null;r.result.appliedMeasure=structuredClone(r.payload.proposed);assert.equal(decode([r]).length,1);});
