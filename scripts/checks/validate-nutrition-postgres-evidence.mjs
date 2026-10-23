// Only consume actual JSON emitted after the quarantined Staging fixture cleanup.
// Synthetic SQL calls do not establish HTTP Auth/RLS/UI acceptance or clinical release.
import nodeTest from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {
 nutritionEliminationSourcesIssue,nutritionEliminationEntryIssue,nutritionEliminationPacketIssue,
 nutritionEliminationOriginalIssue,nutritionEliminationReceiptIssue,makeNutritionEliminationPacket,
 nutritionReviewPacketIssue,nutritionReviewOriginalIssue,nutritionReviewReceiptIssue,makeNutritionReviewPacket,
 nutritionInstantMicros,summarizeNutritionQuantities,nutritionWorkspaceHistoryIssue,nutritionSelectedOriginalIssue,
} from '../../src/lib/pflege/nutritionEliminationPacket.web.ts';
import {
 nutritionPlanBindingContextIssue,nutritionPlanBindingPacketIssue,nutritionPlanBindingReceiptIssue,
 makeNutritionPlanBindingPacket,makeNutritionPlanBindingIntent,
} from '../../src/lib/pflege/nutritionPlanBindingDomain.web.ts';
import {snapshotProtocolRequest,protocolDecimal,protocolAmount} from '../../src/lib/pflege/dailyProtocolDomain.ts';

export function registerNutritionPostgresEvidenceTests(supplied){
 assert.ok(supplied,'Pass the actual saved Staging evidence JSON file.');
 let e=JSON.parse(readFileSync(supplied,'utf8'));
 if(Array.isArray(e)){assert.equal(e.length,1);e=e[0].evidence;}
 else if(e&&typeof e==='object'&&Object.hasOwn(e,'evidence'))e=e.evidence;
 if(typeof e==='string')e=JSON.parse(e);
 assert.ok(e&&typeof e==='object'&&!Array.isArray(e));
 assert.equal(e.schemaVersion,1);assert.equal(e.cleanupConfirmed,true);
 const c=e.expected,clone=structuredClone,sha=/^sha256:[a-f0-9]{64}$/;
 assert.ok(c&&typeof c==='object');
 const kind=e.fixtureKind;assert.ok(['capture','core','review','authority'].includes(kind),'Declare the independent fixture unit.');
 const test=(name,run)=>nodeTest('['+kind+'] '+name,run);
 const pairs=kind==='capture'?[]:[['initial planning','carePacket','careReceipt',1],['append-only planning revision','revisionPacket','revisionReceipt',2],['other visit planning','otherCarePacket','otherCareReceipt',1],...(kind==='core'?[['Unicode author planning','unicodeCarePacket','unicodeCareReceipt',1]]:[])];
 const required=['context','otherCaptureContext','capturePacket','captureReceipt','otherCapturePacket','otherCaptureReceipt','prerequisites',...pairs.flatMap(([,p,r])=>[p,r]),...(kind==='core'?['nativeProtocolRequest','legacyWeight','historicalOriginal','carePage1','carePage2','careTail','finalCarePage','emptyPage']:[]),...(['review','authority'].includes(kind)?['historicalOriginal','reviewPacket','reviewReceipt','finalCarePage','reviewPage','emptyPage']:[]),...(kind==='review'?['plannedReviewPacket','plannedReviewReceipt','reviewTail']:[])];
 const flags={capture:['canonicalIdsBlocked'],core:['actualWritesBlocked','unicodeCasesPassed','canonicalIdsBlocked'],review:['clinicalDecisionsBlocked','canonicalIdsBlocked','plannedInspectionPassed'],authority:['rawAccountRelinkBlocked','readOnlyConfirmationsPassed']};
 test('Only complete actual synthetic evidence emitted after rollback cleanup and unit-specific denials is accepted',()=>{for(const key of required)assert.ok(e[key],key);for(const key of flags[kind])assert.equal(e[key],true,key);});
 test('Actual context preserves absent instruments/devices and unknown date-only task instants',()=>{
  const context=e.context;assert.equal(nutritionPlanBindingContextIssue(context,e.capturePacket),null);
  assert.equal(nutritionEliminationSourcesIssue(context.sources),null);assert.match(context.planSnapshotSha256,sha);
  assert.equal(context.nativeOriginals.instrumentSelection,null);assert.equal(context.nativeOriginals.model,null);
  assert.deepEqual(context.nativeOriginals.instruments,[]);assert.deepEqual(context.sources.devices,[]);assert.deepEqual(context.sources.weights,[]);
  assert.equal(context.sources.tasks.length,1);assert.equal(context.sources.tasks[0].dueAt,null);assert.ok(context.blockedReasons.length);
  assert.deepEqual(Object.keys(context.nativeOriginals).sort(),['plan','planVersion','measure','visit','tour','assessment','assessmentTopics','assessmentRisks','assessmentMeasures','instrumentSelection','model','instruments'].sort());
 });
 for(const [pKey,rKey,cKey] of [['capturePacket','captureReceipt','context'],['otherCapturePacket','otherCaptureReceipt','otherCaptureContext']]){
  test('Actual '+pKey+' binds its own independent original context, native scope and retained receipt',()=>{
   const p=e[pKey],r=e[rKey],context=e[cKey],b=r.binding;
   assert.ok(context,'A separate actual context must be captured before this request.');
   assert.equal(nutritionPlanBindingContextIssue(context,p),null);assert.equal(nutritionPlanBindingPacketIssue(p),null);
   assert.equal(nutritionPlanBindingReceiptIssue(r,p,context.planSnapshotSha256),null);
   assert.deepEqual(p.nativeOriginals,context.nativeOriginals);assert.deepEqual(p.sources,context.sources);
   assert.equal(p.tenantId,c.tenantId);assert.equal(p.clientId,c.clientId);assert.equal(p.actorId,c.actorId);
   assert.equal(r.requestId,p.requestId);assert.deepEqual(r.packet,p);assert.deepEqual(b.nativeOriginals,p.nativeOriginals);assert.deepEqual(b.sources,p.sources);
   for(const key of ['tenantId','clientId','planVersionId','measureId','visitId','assessmentId','kind','title'])assert.equal(b[key],p[key],key);
   assert.equal(b.capturedBy,c.actorId);assert.equal(b.planSnapshotSha256,context.planSnapshotSha256);
   assert.equal(nutritionInstantMicros(b.plannedAt),nutritionInstantMicros(p.plannedAt));assert.notEqual(nutritionInstantMicros(b.capturedAt),null);
   assert.equal(p.nativeOriginals.plan.client_id,c.clientId);assert.equal(p.nativeOriginals.visit.client_id,c.clientId);
   assert.equal(p.nativeOriginals.measure.id,p.measureId);assert.equal(p.nativeOriginals.measure.category,p.kind);assert.equal(p.nativeOriginals.measure.title,p.title);
   assert.deepEqual(makeNutritionPlanBindingPacket({...p,context}),p);
   assert.deepEqual(makeNutritionPlanBindingIntent({...p,context}),{packet:p,expectedPlanSnapshotSha256:context.planSnapshotSha256});
  });
 }
 test('Different native visits retain different independent original foundation hashes',()=>{
  assert.notEqual(e.capturePacket.visitId,e.otherCapturePacket.visitId);
  assert.notEqual(e.context.planSnapshotSha256,e.otherCaptureContext.planSnapshotSha256);
  assert.ok(nutritionPlanBindingReceiptIssue(e.otherCaptureReceipt,e.otherCapturePacket,e.context.planSnapshotSha256));
 });
 test('Same invented capture and confirmation hashes cannot replace the independently captured expectation',()=>{
  const p=e.capturePacket,expected=e.context.planSnapshotSha256,r=clone(e.captureReceipt);
  r.binding.planSnapshotSha256='sha256:'+(expected.at(-1)==='0'?'1':'0').repeat(64);
  for(const receipt of [r,clone(r)])assert.ok(nutritionPlanBindingReceiptIssue(receipt,p,expected));
  assert.ok(nutritionPlanBindingReceiptIssue(e.captureReceipt,p,undefined));
 });
 test('Production capture validators reject replaced native originals and valid-looking own receipt substitutions',()=>{
  const p=e.capturePacket,r=e.captureReceipt;
  for(const mutate of [v=>{v.requestId=e.otherCapturePacket.requestId;},v=>{v.packet.title+=' changed';},v=>{v.binding.capturedBy=c.reviewerId;},v=>{v.binding.tenantId=c.clientId;},v=>{v.binding.nativeOriginals.measure.title+=' changed';},v=>{v.binding.sources.assessment.fingerprint='sha256:'+'0'.repeat(64);},v=>{v.binding.plannedAt=new Date(Date.parse(v.binding.plannedAt)+1).toISOString();},v=>{v.binding.unexpected='unrecorded';}]){
   const changed=clone(r);mutate(changed);assert.ok(nutritionPlanBindingReceiptIssue(changed,p,e.context.planSnapshotSha256));
  }
  const context=clone(e.context);context.nativeOriginals.measure.title+=' changed';assert.ok(nutritionPlanBindingContextIssue(context,p));
 });
 for(const [name,pKey,rKey,revision] of pairs){
  test('Actual '+name+' packet and full own receipt satisfy the production Web domain',()=>{
   const p=e[pKey],r=e[rKey];assert.equal(nutritionEliminationEntryIssue(p.entry),null);assert.equal(nutritionEliminationSourcesIssue(p.sources),null);
   assert.equal(nutritionEliminationPacketIssue(p),null);assert.equal(nutritionEliminationOriginalIssue(r.original,p),null);assert.equal(nutritionEliminationReceiptIssue(r,p),null);
   assert.deepEqual(makeNutritionEliminationPacket(p),p);assert.equal(r.original.revision,revision);assert.equal(r.original.history.length,revision);
   assert.equal(r.original.recordedBy,c.actorId);assert.equal(r.original.payload.execution.outcome,'planned');assert.equal(r.original.payload.lifecycle,'open');assert.equal(r.original.payload.occurredAt,null);assert.equal(r.original.payload.intake.actual,null);
  });
 }
 if(kind==='core')test('Actual 500 UTF-16 unit author is retained without byte or code-point truncation',()=>{
  assert.equal(e.unicodeName.length,500);assert.equal(Array.from(e.unicodeName).length,250);assert.equal(Buffer.byteLength(e.unicodeName,'utf8'),1000);
  assert.equal(e.unicodeCareReceipt.original.recordedByName,e.unicodeName);assert.equal(e.unicodeCareReceipt.original.history[0].recordedByName,e.unicodeName);
 });
 if(kind==='core')test('Append-only correction retains the whole first original and freshly captured native protocol sources',()=>{
  const p=e.revisionPacket,o=e.revisionReceipt.original;assert.deepEqual(o.history[0],e.careReceipt.original.history[0]);assert.equal(o.history[1].previousId,e.careReceipt.original.headId);assert.deepEqual(o.history[1].payload,p.entry);
  assert.notDeepEqual(p.sources,e.carePacket.sources);assert.equal(p.entry.planSnapshotSha256,e.carePacket.entry.planSnapshotSha256);assert.equal(p.sources.protocols.length,1);assert.deepEqual(p.sources.weights,[]);
 });
 if(kind==='core')test('Native protocol preserves exact measured quantities, observed basis and microsecond actual instant',()=>{
  const p=e.nativeProtocolRequest;assert.deepEqual(snapshotProtocolRequest(p),p);assert.equal(p.draft.entry.actual.value,'0.100');assert.equal(p.draft.entry.offered.value,'0.300');assert.equal(p.draft.entry.actual.state,'measured');assert.equal(p.draft.entry.source,'observed');assert.ok(p.draft.entry.actual.basis);
  assert.notEqual(nutritionInstantMicros(p.draft.entry.occurredAt),null);assert.match(p.draft.entry.occurredAt,/\.\d{6}Z$/);assert.equal(protocolDecimal(p.draft.entry.actual.value),100n);assert.equal(protocolAmount(protocolDecimal(p.draft.entry.actual.value)),'0.1');
 });
 if(kind==='core')test('Legacy captured weight retains its unknown actual instant and missing original request',()=>{
  assert.equal(e.legacyWeight.occurred_at,null);assert.ok(e.legacyWeight.measured_at);assert.equal(e.legacyWeight.creation_request_id,null);assert.equal(e.legacyWeight.client_id,c.clientId);assert.deepEqual(e.revisionPacket.sources.weights,[]);
 });
 for(const [name,pKey,rKey] of (['review','authority'].includes(kind)?[['historical actual request','reviewPacket','reviewReceipt'],...(kind==='review'?[['technical planned/open inspection','plannedReviewPacket','plannedReviewReceipt']]:[])]:[])){
  test('Actual '+name+' binds a whole request receipt without a clinical decision',()=>{
   const p=e[pKey],r=e[rKey];assert.equal(nutritionEliminationOriginalIssue(p.careOriginal,c),null);assert.equal(nutritionReviewPacketIssue(p),null);assert.equal(nutritionReviewOriginalIssue(r.original,p),null);assert.equal(nutritionReviewReceiptIssue(r,p),null);assert.deepEqual(makeNutritionReviewPacket(p),p);
   assert.equal(r.original.status,'requested');assert.equal(r.original.history.length,1);assert.equal(r.original.history[0].qualification,null);assert.equal(r.original.history[0].id,r.original.rootId);
  });
 }
 if(kind==='review')test('Technical inspection preserves open planning and cannot be repackaged as acceptance or return',()=>{
  const p=e.plannedReviewPacket,r=e.plannedReviewReceipt;assert.deepEqual(p.careOriginal,e.revisionReceipt.original);assert.equal(p.careOriginal.payload.execution.outcome,'planned');assert.equal(p.careOriginal.payload.lifecycle,'open');assert.equal(p.careOriginal.payload.occurredAt,null);
  for(const action of ['return','accept'])assert.ok(nutritionReviewPacketIssue({...p,action,requestId:e.reviewPacket.requestId,expectedHeadId:r.original.headId,expectedRevision:1,reviewOriginal:r.original,actorId:c.reviewerId,reason:action==='return'?'Explicit planning clarification':'',requiredChange:action==='return'?'Explicit proposed planning change':'',rationale:action==='accept'?'Technical inspection proves no clinical execution':''}));
 });
 if(kind!=='capture')test('Historical quantity arithmetic is exact, deduplicated and ignores all newly planned G rows',()=>{
  const original=e.historicalOriginal,start=original.payload.occurredAt,end=new Date(Date.parse(start)+1).toISOString(),all=[original,clone(original),e.revisionReceipt.original,e.otherCareReceipt.original];
  const result=summarizeNutritionQuantities(all,c,start,end);assert.equal(result.entries,1);assert.equal(result.missing,0);assert.deepEqual(result.groups,[{channel:'drink_protocol',unit:'ml',value:'0.1',count:1}]);
  assert.equal(summarizeNutritionQuantities([original],c,new Date(Date.parse(start)-1).toISOString(),start).entries,0,'The actual original microsecond is excluded by the end boundary.');
 });
 if(kind==='core')test('Complete actual pages and empty tail retain one full scoped mutation fingerprint',()=>{
  const pages=[e.carePage1,e.carePage2,e.careTail];assert.equal(pages[0].rows.length,1);assert.equal(pages[1].rows.length,1);assert.equal(pages[2].rows.length,0);assert.notEqual(pages[0].rows[0].rootId,pages[1].rows[0].rootId);
  for(const page of pages){assert.match(page.stateFingerprint,sha);assert.equal(page.stateFingerprint,pages[0].stateFingerprint);for(const row of page.rows)assert.equal(nutritionEliminationOriginalIssue(row,c),null);}
  assert.equal(pages[2].nextCursorId,null);assert.equal(pages[2].nextCursorRecordedAt,null);
 });
 if(kind!=='capture')test('Current unit prerequisite/care/review projections share the complete ledger fingerprint',()=>{
  const page=e.finalCarePage;assert.equal(page.rows.length,3);assert.equal(page.stateFingerprint,e.prerequisites.stateFingerprint);
  if(kind==='core')assert.notEqual(page.stateFingerprint,e.carePage1.stateFingerprint);
  if(['review','authority'].includes(kind)){assert.equal(e.reviewPage.stateFingerprint,page.stateFingerprint);assert.deepEqual(e.reviewPage.rows,[e.reviewReceipt.original]);}
  if(kind==='review'){assert.equal(e.reviewTail.stateFingerprint,page.stateFingerprint);assert.deepEqual(e.reviewTail.rows,[]);}
  for(const row of page.rows)assert.equal(nutritionEliminationOriginalIssue(row,c),null);
  assert.deepEqual(e.emptyPage.rows,[]);assert.match(e.emptyPage.stateFingerprint,sha);
 });
 if(['review','authority'].includes(kind))test('Actual complete review ledger binds each retained historical care event and exact selected original',()=>{
  const workspace={careOriginals:e.finalCarePage.rows,reviewOriginals:e.reviewPage.rows};assert.equal(nutritionWorkspaceHistoryIssue(workspace,c),null);assert.equal(nutritionSelectedOriginalIssue(workspace,c,e.revisionReceipt.original),null);
  const foreign=clone(workspace);foreign.reviewOriginals[0].careRootId=e.otherCareReceipt.original.rootId;assert.equal(nutritionReviewOriginalIssue(foreign.reviewOriginals[0],c),null);assert.ok(nutritionWorkspaceHistoryIssue(foreign,c));
  const replaced=clone(e.revisionReceipt.original);replaced.payload.assistance.details+=' substituted';replaced.history.at(-1).payload.assistance.details+=' substituted';assert.equal(nutritionEliminationOriginalIssue(replaced,c),null);assert.ok(nutritionSelectedOriginalIssue(workspace,c,replaced));
 });
 if(kind!=='capture')test('Own receipt validator rejects substituted request, actor, payload and earlier history in actual SQL originals',()=>{
  const p=e.revisionPacket,r=e.revisionReceipt;
  for(const mutate of [v=>{v.requestId=e.otherCapturePacket.requestId;},v=>{v.packet.reason+=' changed';},v=>{v.original.tenantId=c.clientId;},v=>{v.original.recordedBy=c.reviewerId;v.original.history.at(-1).recordedBy=c.reviewerId;},v=>{v.original.history[0].payload.intake.item+=' changed';},v=>{v.original.payload.assistance.details+=' changed';v.original.history.at(-1).payload.assistance.details+=' changed';},v=>{v.original.rootId=e.historicalOriginal.rootId;},v=>{v.original.history.shift();}]){const changed=clone(r);mutate(changed);assert.ok(nutritionEliminationReceiptIssue(changed,p));}
 });
 if(['review','authority'].includes(kind))test('Own review receipt rejects substituted actor, request, care fingerprint and clinical label',()=>{
  const p=e.reviewPacket,r=e.reviewReceipt;
  for(const mutate of [v=>{v.requestId=e.otherCapturePacket.requestId;},v=>{v.original.status='accepted';},v=>{v.original.history[0].actorId=c.reviewerId;},v=>{v.original.careFingerprint='sha256:'+'0'.repeat(64);},v=>{v.packet.careOriginal.payload.intake.actual='0.200';},v=>{v.original.rootId=e.historicalOriginal.rootId;}]){const changed=clone(r);mutate(changed);assert.ok(nutritionReviewReceiptIssue(changed,p));}
 });
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){assert.ok(process.argv[2],'Pass one or more actual saved fixture evidence files.');for(const supplied of process.argv.slice(2))registerNutritionPostgresEvidenceTests(supplied);}
