import {test} from 'node:test';
import assert from 'node:assert/strict';
import {decodePlanAmendmentHistory,planAmendmentHistoryVersion} from '../../src/lib/careAssessment/planAmendmentHistoryDomain.ts';
import {proposal,id,tenant,assessment,client,actor,now,time} from './fixtures/plan-amendment.mjs';
import {historyRecord,historySequence} from './fixtures/plan-amendment-history.mjs';
const env=records=>({version:planAmendmentHistoryVersion,tenantId:tenant,assessmentId:assessment,count:records.length,records});
const decode=v=>decodePlanAmendmentHistory(v,tenant,assessment,client,now);
test('stored original and exact receipt retained and frozen',()=>{const r=historyRecord(),[v]=decode(env([r]));assert.deepEqual(v,r);r.payload.reason='changed';assert.notEqual(v.payload.reason,r.payload.reason);assert(Object.isFrozen(v.result.appliedMeasure));});
test('expired historical review date remains readable',()=>assert.equal(decodePlanAmendmentHistory(env([historyRecord()]),tenant,assessment,client,Date.parse('2027-01-01')).length,1));
test('complete empty history is accepted',()=>assert.deepEqual(decode(env([])),[]));
for(const [name,mutate] of [
 ['count mismatch',v=>v.count++],['unknown envelope field',v=>v.page=1],['unknown record field',v=>v.records[0].extra=true],['foreign tenant',v=>v.tenantId=id(99)],['foreign assessment',v=>v.assessmentId=id(99)],['foreign client',v=>v.records[0].payload.target.clientId=id(99)],['missing actor',v=>v.records[0].actorId=''],['blank name',v=>v.records[0].actorName=' '],['future stored time',v=>v.records[0].recordedAt='2027-01-01T00:00:00Z'],['before preparation',v=>v.records[0].recordedAt=time(9)],['wrong receipt id',v=>v.records[0].result.id=id(99)],['wrong receipt source',v=>v.records[0].result.sourceHeadId=id(99)],['wrong applied measure',v=>v.records[0].result.appliedMeasure.intervention='Other'],['invalid revision',v=>v.records[0].result.draftRevision=3],['missing original source',v=>delete v.records[0].payload.source],['no explicit adjustment',v=>v.records[0].payload.source.events[0].draft.entry.measureReviews[0].nextAction='continue'],['duplicate record',v=>{v.records.push(structuredClone(v.records[0]));v.count++;}],['invalid protocol',v=>v.version='old']
])test(name,()=>{const v=env([historyRecord()]);mutate(v);assert.throws(()=>decode(v));});
test('full history is deterministically sorted without mutating input',()=>{const [a,b]=historySequence(),v=env([a,b]);assert.deepEqual(decode(v).map(r=>r.id),[b.id,a.id]);assert.equal(v.records[0].id,a.id);});
