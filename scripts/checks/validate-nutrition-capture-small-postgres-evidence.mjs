// Consume only the actual post-cleanup JSON emitted by the supplementary SQL unit.
// Privileged synthetic SQL evidence is not HTTP Auth/RLS/browser or clinical acceptance.
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {
 nutritionPlanBindingContextIssue,nutritionPlanBindingPacketIssue,nutritionPlanBindingReceiptIssue,
 makeNutritionPlanBindingIntent,
} from '../../src/lib/pflege/nutritionPlanBindingDomain.web.ts';
import {
 nutritionEliminationPacketIssue,nutritionEliminationEntryIssue,nutritionEliminationOriginalIssue,
 nutritionEliminationReceiptIssue,nutritionInstantMicros,
} from '../../src/lib/pflege/nutritionEliminationPacket.web.ts';

export function registerNutritionCaptureSmallPostgresEvidenceTests(path){
 assert.ok(path,'Supply actual retained supplementary Nutrition SQL evidence JSON.');
 let e=JSON.parse(readFileSync(path,'utf8'));
 if(Array.isArray(e)){assert.equal(e.length,1);e=e[0].synthetic_evidence;}
 else if(e&&Object.hasOwn(e,'synthetic_evidence'))e=e.synthetic_evidence;
 if(typeof e==='string')e=JSON.parse(e);
 assert.ok(e&&typeof e==='object'&&!Array.isArray(e));
 const expected=e.expected,p=e.capturePacket,r=e.captureReceipt,context=e.context;
 assert.ok(expected&&p&&r&&context,'Original context, explicit packet and actual receipt are mandatory.');
 const selection=Object.fromEntries(['tenantId','clientId','actorId','planVersionId','measureId','visitId','assessmentId'].map(k=>[k,expected[k]]));
 const scope={tenantId:expected.tenantId,clientId:expected.clientId};
 const clone=structuredClone,foreign='00000000-0000-4000-8000-999999999999';
 test('Supplementary actual unit explicitly confirms full rollback cleanup and contains no credential fields',()=>{
  assert.equal(e.schemaVersion,1);assert.equal(e.supplementaryRuntimeUnit,true);assert.equal(e.cleanupConfirmed,true);
  for(const key of ['captureConfirmed','carePacket','careReceipt','careConfirmed'])assert.ok(e[key],key);
  const walk=v=>{if(v&&typeof v==='object')for(const[k,x]of Object.entries(v)){assert.doesNotMatch(k,/access.?token|refresh.?token|password|secret|session.?id|request\.jwt|raw_user_meta|raw_app_meta|bearer/i);walk(x);}};walk(e);
 });
 test('Actual SQL context satisfies the production decoder with the independent native IDs',()=>{
  assert.equal(nutritionPlanBindingContextIssue(context,selection),null);
  const n=context.nativeOriginals;
  assert.equal(n.plan.client_id,expected.clientId);assert.equal(n.visit.client_id,expected.clientId);
  assert.deepEqual(n.planVersion.snapshot.plan,n.plan);assert.deepEqual(n.planVersion.snapshot.items,[n.measure]);
  assert.equal(n.assessment.subject_id,expected.clientId);assert.equal(n.assessment.variant,'ambulant');
  for(const key of ['assessmentTopics','assessmentRisks','assessmentMeasures','instruments'])assert.deepEqual(n[key],[]);
  assert.equal(n.instrumentSelection,null);assert.equal(n.model,null);
  for(const key of ['devices','weights','protocols','tasks'])assert.deepEqual(context.sources[key],[]);
 });
 test('Production intent factory retains exactly the original context SHA separately from the SQL packet',()=>{
  const intent=makeNutritionPlanBindingIntent({...selection,requestId:expected.captureRequestId,plannedAt:p.plannedAt,context});
  assert.deepEqual(intent.packet,p);assert.equal(intent.expectedPlanSnapshotSha256,context.planSnapshotSha256);
  assert.equal(nutritionPlanBindingPacketIssue(p),null);assert.equal(p.schemaVersion,'1');
  assert.equal(p.kind,context.nativeOriginals.measure.category);assert.equal(p.title,context.nativeOriginals.measure.title);
  assert.equal(Object.hasOwn(p,'expectedPlanSnapshotSha256'),false);
 });
 test('Actual capture and separate own confirmation bind the exact request, profile, scope and retained full source',()=>{
  for(const receipt of [r,e.captureConfirmed])assert.equal(nutritionPlanBindingReceiptIssue(receipt,p,context.planSnapshotSha256),null);
  assert.deepEqual(e.captureConfirmed,r);assert.equal(r.requestId,expected.captureRequestId);
  assert.deepEqual(r.binding.nativeOriginals,context.nativeOriginals);assert.deepEqual(r.binding.sources,context.sources);
  assert.equal(r.binding.capturedBy,expected.actorId);assert.notEqual(r.binding.id,p.requestId);
  assert.equal(nutritionInstantMicros(r.binding.plannedAt),nutritionInstantMicros(p.plannedAt));
 });
 test('Equal substituted SHA in write and confirmation cannot replace the independent original context SHA',()=>{
  const wrong=context.planSnapshotSha256==='sha256:'+'0'.repeat(64)?'sha256:'+'1'.repeat(64):'sha256:'+'0'.repeat(64);
  const a=clone(r),b=clone(e.captureConfirmed);a.binding.planSnapshotSha256=wrong;b.binding.planSnapshotSha256=wrong;
  assert.deepEqual(a,b);assert.ok(nutritionPlanBindingReceiptIssue(a,p,context.planSnapshotSha256));
  assert.ok(nutritionPlanBindingReceiptIssue(b,p,context.planSnapshotSha256));assert.ok(nutritionPlanBindingReceiptIssue(r,p,undefined));
 });
 test('Actual capture rejects own-request, profile, tenant, client, raw original and one-microsecond substitutions',()=>{
  const mutations=[v=>v.requestId=foreign,v=>v.binding.capturedBy=foreign,v=>v.binding.tenantId=foreign,v=>v.binding.clientId=foreign,v=>v.binding.nativeOriginals.measure.notes='Synthetic altered raw native fact',v=>v.binding.plannedAt=p.plannedAt.replace(/(\d{6})Z$/,(_,micros)=>String(Number(micros)+1).padStart(6,'0')+'Z')];
  for(const change of mutations){const v=clone(r);change(v);assert.ok(nutritionPlanBindingReceiptIssue(v,p,context.planSnapshotSha256));}
 });
 test('Actual planned G packet, full original and independently confirmed receipt satisfy production validators',()=>{
  const p=e.carePacket,r=e.careReceipt;
  assert.equal(nutritionEliminationEntryIssue(p.entry),null);assert.equal(nutritionEliminationPacketIssue(p),null);
  assert.equal(nutritionEliminationOriginalIssue(r.original,scope),null);
  for(const receipt of [r,e.careConfirmed])assert.equal(nutritionEliminationReceiptIssue(receipt,p),null);
  assert.deepEqual(e.careConfirmed,r);assert.equal(p.requestId,expected.careRequestId);assert.equal(p.actorId,expected.actorId);
  assert.deepEqual(p.sources,context.sources);assert.deepEqual(r.packet,p);assert.deepEqual(r.original.payload,p.entry);
  for(const key of ['planVersionId','measureId','visitId','assessmentId'])assert.equal(p.entry[key],expected[key]);
  assert.equal(p.entry.planSnapshotSha256,context.planSnapshotSha256);
  assert.equal(nutritionInstantMicros(p.entry.plannedAt),nutritionInstantMicros(e.capturePacket.plannedAt));
 });
 test('Actual saved planning keeps unobserved execution, intake, consent and equipment explicitly absent',()=>{
  const p=e.careReceipt.original.payload;
  assert.equal(p.execution.outcome,'planned');assert.deepEqual(p.execution.performedBy,[]);assert.equal(p.occurredAt,null);
  assert.equal(p.lifecycle,'open');assert.equal(p.decision.state,'not_asked');assert.equal(p.decision.recordedAt,null);
  assert.equal(p.intake.offered,null);assert.equal(p.intake.actual,null);assert.equal(p.elimination.input,null);assert.equal(p.elimination.output,null);
  assert.equal(p.enteral.deviceId,null);assert.equal(p.device.deviceId,null);assert.equal(p.weight.measurementId,null);assert.equal(p.weight.value,null);
  const o=e.careReceipt.original;assert.equal(o.history.length,1);assert.equal(o.rootId,o.headId);assert.equal(o.id,o.headId);assert.equal(o.history[0].id,o.rootId);
 });
 test('Actual G receipt cannot be adopted under another request, profile, scope, history root or authored payload',()=>{
  const p=e.carePacket,r=e.careReceipt;
  for(const change of [v=>v.requestId=foreign,v=>v.original.tenantId=foreign,v=>v.original.clientId=foreign,v=>v.original.rootId=foreign,v=>{v.original.recordedBy=foreign;v.original.history[0].recordedBy=foreign;},v=>{v.original.payload.title='Synthetic substituted title';v.original.history[0].payload.title='Synthetic substituted title';}]){
   const v=clone(r);change(v);assert.ok(nutritionEliminationReceiptIssue(v,p));
  }
 });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(!process.argv[2])throw Error('Supply the actual post-cleanup supplementary Nutrition Staging JSON path.');
 registerNutritionCaptureSmallPostgresEvidenceTests(process.argv[2]);
}
