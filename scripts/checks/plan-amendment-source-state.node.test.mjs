import {test} from 'node:test';import assert from 'node:assert/strict';
import {amendmentSourceStates} from '../../src/lib/careAssessment/planAmendmentSourceState.ts';
import {buildPlanAmendmentArchive} from '../../src/lib/careAssessment/planAmendmentHistoryExport.ts';
import {historyRecord} from './fixtures/plan-amendment-history.mjs';
import {currentSource} from './fixtures/plan-amendment-source.mjs';
import {tenant,assessment,client,now,id} from './fixtures/plan-amendment.mjs';
const compare=(amendments,evaluations)=>amendmentSourceStates(amendments,evaluations,tenant,assessment,client,now);
test('unchanged source retains exact native head',()=>{const r=historyRecord(),[s]=compare([r],[r.payload.source]);assert.equal(s.state,'unchanged');assert.equal(s.currentHeadId,r.payload.source.headId);});
for(const [action,state] of [['replace','corrected'],['void','withdrawn']])test(`later ${action} retains accepted amendment and original source`,()=>{const r=historyRecord(),before=structuredClone(r),current=currentSource(action),[s]=compare([r],[current]);assert.equal(s.state,state);assert.equal(s.originalEventCount,1);assert.equal(s.currentEventCount,2);assert.equal(s.currentHeadId,current.headId);assert.deepEqual(r,before);const out=buildPlanAmendmentArchive([r],tenant,assessment,client,'2026-10-10T05:00:00Z',now);assert.deepEqual(out.archive.records[0].payload.source,before.payload.source);});
test('absent current source is explicit unavailability, not withdrawal',()=>{const [s]=compare([historyRecord()],[]);assert.equal(s.state,'unavailable');assert.equal(s.currentHeadId,null);assert.equal(s.currentEventCount,null);});
test('empty changes and complete source list remain valid',()=>assert.deepEqual(compare([],[]),[]));
for(const [name,change] of [
 ['original actor substituted',s=>s.events[0].actorName='Different person'],
 ['original clinical source substituted',s=>s.events[0].draft.entry.observedEffect='Different original'],
 ['native plan substituted',s=>s.root.snapshot.measures[0].intervention='Different original plan'],
 ['root creation timestamp substituted',s=>{s.root.createdAt='2026-10-09T09:00:00Z';s.events[0].recordedAt=s.root.createdAt;}],
 ['partial current history',s=>s.eventCount=3],
 ['wrong current client',s=>s.root.snapshot.clientId=id(99)],
 ['wrong current tenant',s=>{s.root.tenantId=id(99);s.root.snapshot.tenantId=id(99);}]
])test(name,()=>{const s=currentSource();change(s);assert.throws(()=>compare([historyRecord()],[s]));});
test('invalid amendment cannot be compared even when source is absent',()=>{const r=historyRecord();r.result.requestId=id(99);assert.throws(()=>compare([r],[]));});
test('duplicate current originals are rejected rather than chosen arbitrarily',()=>{const s=currentSource();assert.throws(()=>compare([historyRecord()],[s,structuredClone(s)]));});
