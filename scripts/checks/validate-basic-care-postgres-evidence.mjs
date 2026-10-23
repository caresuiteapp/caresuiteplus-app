import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
/** Registers tests only for an actual retained synthetic SQL capture supplied by the caller. */
export async function registerBasicCarePostgresEvidenceTests(source){
 const url=source instanceof URL?source:pathToFileURL(source),text=await readFile(url,'utf8'),e=JSON.parse(text);
 const domain=await import('../../src/lib/pflege/basicCarePacket.web.ts');
 const sections=[['capture',e,e.actualCallExpected??e.expected]];
 if(e.knownControl)sections.push(['known control',e.knownControl,e.expected]);
 for(const c of e.denialCases??[])sections.push([`native author case${c.case}`,c,c.expected]);
 test('Actual BasicCare capture has explicit SQL rollback and contains no credentials or private Auth proof rows',()=>{
  assert.equal(e.rollbackCleanupPassed,true);
  const forbidden=/access.?token|refresh.?token|password|passwd|secret|jwt|session.?id|request\.jwt|raw_user_meta|raw_app_meta|authorization|bearer|authUserIds|auth_user_id|profile_original|native_original|involved_auth|private.?proof|claims/i;
  const walk=v=>{if(v&&typeof v==='object')for(const[k,c]of Object.entries(v)){assert.ok(!forbidden.test(k),k);walk(c);}else if(typeof v==='string')assert.doesNotMatch(v,/eyJ[A-Za-z0-9_-]{12,}\.eyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]+/);};walk(e);
 });
 const carePairs=[['packet','receipt'],['revisionPacket','revisionReceipt'],['correctionPacket','correctionReceipt'],['otherPacket','otherReceipt'],['carePacket','careReceipt']];
 const reviewPairs=[['reviewPacket','reviewReceipt'],['decisionPacket','decisionReceipt'],['returnRequestPacket','returnRequestReceipt'],['returnPacket','returnReceipt'],['independentDecisionPacket','independentDecisionReceipt'],['newReviewPacket','newReviewReceipt']];
 for(const[label,s,expected]of sections){
  for(const[pk,rk]of carePairs)if(s[pk]&&s[rk])test(`Actual ${label} ${rk} satisfies current production complete care and receipt binding`,()=>{
   const p=s[pk],r=s[rk];assert.equal(domain.basicCarePacketIssue(p),null);assert.equal(domain.basicCareReceiptIssue(r,p),null);
   assert.equal(domain.basicCareOriginalIssue(r.original,{tenantId:expected.tenantId,clientId:expected.clientId}),null);
   assert.equal(p.tenantId,expected.tenantId);assert.equal(p.clientId,expected.clientId);assert.equal(p.actorId,expected.authorId);
   assert.equal(r.requestId,p.requestId);assert.deepEqual(r.packet,p);assert.equal(r.original.revision,p.expectedRevision+1);assert.deepEqual(r.original.payload,p.entry);
   assert.equal(r.original.history[0].id,r.original.rootId);assert.equal(r.original.history.at(-1).id,r.original.headId);assert.notEqual(r.original.id,p.requestId);
   if(p.original)assert.deepEqual(r.original.history.slice(0,-1),p.original.history);
   if(pk==='carePacket'&&expected.careRequestId)assert.equal(p.requestId,expected.careRequestId);
  });
  for(const[pk,rk]of carePairs)if(s[pk]&&s[rk])test(`Derived actual ${label} ${rk} rejects request, root, authored action and payload substitutions`,()=>{
   const p=s[pk],r=s[rk],foreign='00000000-0000-4000-8000-999999999999';
   for(const mutate of [v=>v.requestId=foreign,v=>v.original.rootId=foreign,v=>{v.original.recordedBy=foreign;v.original.history.at(-1).recordedBy=foreign;},v=>{v.original.payload.title='Synthetic substituted authored payload';v.original.history.at(-1).payload.title='Synthetic substituted authored payload';}]){const v=structuredClone(r);mutate(v);assert.ok(domain.basicCareReceiptIssue(v,p));}
  });
  for(const[pk,rk]of reviewPairs)if(s[pk]&&s[rk])test(`Actual ${label} ${rk} satisfies production own full review/history receipt binding`,()=>{
   const p=s[pk],r=s[rk];assert.equal(domain.basicCareReviewPacketIssue(p),null);assert.equal(domain.basicCareReviewReceiptIssue(r,p),null);
   assert.equal(domain.basicCareReviewOriginalIssue(r.original,{tenantId:expected.tenantId,clientId:expected.clientId,careRootId:p.careOriginal.rootId,careHeadId:p.careOriginal.headId,careContentFingerprint:p.careOriginal.contentFingerprint}),null);
   assert.equal(p.tenantId,expected.tenantId);assert.equal(p.clientId,expected.clientId);assert.equal(r.requestId,p.requestId);assert.deepEqual(r.packet,p);
   if(p.reviewOriginal)assert.deepEqual(r.original.history.slice(0,-1),p.reviewOriginal.history);
   if(p.action==='request')assert.equal(p.actorId,expected.authorId);
   else{const q=r.original.history.at(-1).qualificationOriginal;assert.equal(q.profileId,p.actorId);assert.equal(q.scopeKind,'basic_care_review');for(const k of ['sourceFingerprint','documentFingerprint','scopeFingerprint','employeeFingerprint'])assert.match(q[k],/^sha256:[0-9a-f]{64}$/);}
   if(pk==='reviewPacket'&&expected.reviewRequestId)assert.equal(p.requestId,expected.reviewRequestId);
  });
  for(const[pk,rk]of reviewPairs)if(s[pk]&&s[rk])test(`Derived actual ${label} ${rk} rejects own-call, care-root, author and qualified-family substitution`,()=>{
   const p=s[pk],r=s[rk],foreign='00000000-0000-4000-8000-999999999999';
   const mutations=[v=>v.requestId=foreign,v=>v.original.rootId=foreign,v=>v.original.careRootId=foreign,v=>v.original.history.at(-1).actorId=foreign];
   if(p.action!=='request')mutations.push(v=>v.original.history.at(-1).qualificationOriginal.profileId=foreign,v=>v.original.history.at(-1).qualificationOriginal.scopeKind='wound_review');
   for(const mutate of mutations){const v=structuredClone(r);mutate(v);assert.ok(domain.basicCareReviewReceiptIssue(v,p));}
  });
  if(s.issuePacket&&s.issueReceipt)test(`Actual ${label} issuer retains full native snapshot and explicitly authored native selection`,()=>{
   const p=s.issuePacket,r=s.issueReceipt,n=p.sources;assert.deepEqual(r.packet,p);assert.equal(r.requestId,p.requestId);assert.equal(p.tenantId,expected.tenantId);assert.equal(p.clientId,expected.clientId);
   assert.deepEqual(n.planVersion.snapshot.plan,n.plan);assert.deepEqual(n.planVersion.snapshot.items.find(i=>i.id===p.measureId),n.measure);assert.equal(n.planVersion.id,p.planVersionId);assert.equal(n.measure.id,p.measureId);assert.equal(n.visit.id,p.visitId);assert.equal(n.plan.client_id,p.clientId);assert.equal(n.visit.client_id,p.clientId);assert.equal(n.visit.tour_id,n.tour.id);
   assert.equal(r.plan.kind,n.measure.category);assert.equal(r.plan.title,n.measure.title);assert.equal(r.plan.secondPersonRequired,p.secondPersonRequired);assert.equal(r.plan.pressureOriginals,null);assert.equal(r.plan.fallOriginals,null);
   assert.equal(r.plan.planVersionId,p.planVersionId);assert.equal(r.plan.measureId,p.measureId);assert.equal(r.plan.visitId,p.visitId);assert.equal(r.plan.plannedAt,p.plannedAt);assert.match(r.bindingId,/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);assert.match(r.plan.planSnapshotSha256,/^sha256:[a-f0-9]{64}$/);
  });
 }
 if(e.supplementaryRuntimeUnit)test('Supplementary actual native-binding unit confirms the exact own planned original without an actual care claim',()=>{
  assert.equal(e.supplementaryRuntimeUnit,true);assert.deepEqual(e.confirmedReceipt,e.receipt);assert.equal(domain.basicCareReceiptIssue(e.confirmedReceipt,e.packet),null);assert.equal(e.packet.requestId,e.expected.createRequestId);assert.equal(e.issuePacket.requestId,e.expected.issueRequestId);
  assert.equal(e.receipt.original.payload.execution.outcome,'planned');assert.equal(e.receipt.original.payload.occurredAt,null);assert.deepEqual(e.receipt.original.payload.execution.performedBy,[]);assert.equal(e.receipt.original.payload.consent.state,'not_asked');assert.equal(e.receipt.original.payload.lifecycle,'open');assert.equal(e.receipt.original.history.length,1);
 });
 if(e.pagesUnit)test('Actual independent page unit satisfies complete production originals, exact head cursors and a real empty terminator',()=>{
  const latest=e.correctionReceipt??e.revisionReceipt;assert.deepEqual(e.page1.rows,[e.otherReceipt.original]);assert.deepEqual(e.page2.rows,[latest.original]);assert.deepEqual(e.tail.rows,[]);
  assert.equal(e.tail.nextCursorId,null);assert.equal(e.tail.nextCursorRecordedAt,null);assert.equal(e.page1.stateFingerprint.length,71);assert.match(e.page1.stateFingerprint,/^sha256:[a-f0-9]{64}$/);assert.equal(e.page2.stateFingerprint,e.page1.stateFingerprint);assert.equal(e.tail.stateFingerprint,e.page1.stateFingerprint);
  for(const p of[e.page1,e.page2]){assert.deepEqual(Object.keys(p).sort(),['rows','nextCursorId','nextCursorRecordedAt','stateFingerprint'].sort());assert.equal(p.nextCursorId,p.rows[0].headId);assert.equal(p.nextCursorRecordedAt,p.rows[0].recordedAt);assert.equal(domain.basicCareOriginalIssue(p.rows[0],{tenantId:e.expected.tenantId,clientId:e.expected.clientId}),null);}
 });
 if(e.qualifiedSelfExclusionUnit)test('Actual qualified author exclusion agrees with production while the independent control remains valid',()=>{
  assert.equal(e.qualifiedSelfExclusionUnit,true);assert.equal(e.selfDenied,true);assert.equal(e.selfPacket.actorId,e.expected.authorId);assert.equal(e.selfPacket.action,'accept');assert.equal(e.selfQualification.profileId,e.expected.authorId);assert.equal(e.selfQualification.scopeKind,'basic_care_review');
  assert.deepEqual(e.selfPacket.careOriginal,e.receipt.original);assert.deepEqual(e.selfPacket.reviewOriginal,e.reviewReceipt.original);assert.ok(domain.basicCareReviewPacketIssue(e.selfPacket));
  const independent=structuredClone(e.selfPacket);independent.actorId=e.expected.reviewerId;assert.equal(domain.basicCareReviewPacketIssue(independent),null);assert.equal(e.decisionPacket.actorId,e.expected.reviewerId);assert.equal(e.decisionReceipt.original.status,'accepted');
 });
 if(e.qualificationNegativesUnit||e.dtoNegativesUnit)test('Actual isolated qualification or DTO negatives retain an otherwise qualified successful decision control',()=>{
  assert.equal(e.qualificationNegativesUnit===true||e.dtoNegativesUnit===true,true);assert.equal(e.decisionPacket.requestId,e.expected.decisionRequestId);assert.equal(e.decisionPacket.actorId,e.expected.reviewerId);assert.notEqual(e.expected.authorId,e.expected.reviewerId);
  assert.equal(e.reviewReceipt.original.status,'requested');assert.equal(e.decisionReceipt.original.status,'accepted');assert.deepEqual(e.decisionReceipt.original.history.slice(0,-1),e.reviewReceipt.original.history);assert.deepEqual(e.decisionPacket.careOriginal,e.receipt.original);
 });
 if(e.returnHistoryUnit||e.acceptanceCorrectionUnit)test('Actual qualified decision stays bound to the immutable historical care after a later correction',()=>{
  assert.equal(e.returnHistoryUnit===true||e.acceptanceCorrectionUnit===true,true);assert.equal(e.decisionPacket.action,e.returnHistoryUnit?'return':'accept');assert.equal(e.decisionPacket.actorId,e.expected.reviewerId);assert.equal(e.decisionReceipt.original.status,e.returnHistoryUnit?'returned':'accepted');assert.equal(e.revisionPacket.action,'revise');
  assert.deepEqual(e.decisionReceipt.original.history.slice(0,-1),e.reviewReceipt.original.history);assert.deepEqual(e.decisionPacket.careOriginal,e.receipt.original);assert.deepEqual(e.revisionPacket.original,e.receipt.original);assert.notEqual(e.revisionReceipt.original.headId,e.decisionReceipt.original.careHeadId);assert.equal(e.decisionReceipt.original.careHeadId,e.receipt.original.headId);
  assert.equal(e.revisionReceipt.original.rootId,e.receipt.original.rootId);assert.deepEqual(e.revisionReceipt.original.history.slice(0,-1),e.receipt.original.history);if(e.returnHistoryUnit){assert.ok(e.decisionPacket.reason.length>=10);assert.ok(e.decisionPacket.requiredChange.length>=10);assert.equal(e.decisionPacket.rationale,'');}else{assert.equal(e.decisionPacket.reason,'');assert.equal(e.decisionPacket.requiredChange,'');assert.ok(e.decisionPacket.rationale.length>=10);}
 });
 if(e.correctedReviewUnit)test('Actual later care receives a new unqualified requested review without inheriting prior acceptance',()=>{
  const n=e.newReviewReceipt.original;assert.equal(e.correctedReviewUnit,true);assert.equal(e.decisionReceipt.original.status,'accepted');assert.equal(e.newReviewPacket.requestId,e.expected.newReviewRequestId);assert.equal(e.newReviewPacket.action,'request');assert.deepEqual(e.newReviewPacket.careOriginal,e.revisionReceipt.original);
  assert.equal(n.status,'requested');assert.equal(n.revision,1);assert.equal(n.history.length,1);assert.equal(n.history[0].qualificationOriginal,null);assert.notEqual(n.rootId,e.decisionReceipt.original.rootId);assert.equal(n.careRootId,e.revisionReceipt.original.rootId);assert.equal(n.careHeadId,e.revisionReceipt.original.headId);assert.equal(n.careContentFingerprint,e.revisionReceipt.original.contentFingerprint);assert.notEqual(n.careHeadId,e.decisionReceipt.original.careHeadId);
 });
 if(e.reviewPagesUnit)test('Actual decided review page cursor retains the original root creation rather than the later decision head',()=>{
  assert.equal(e.reviewPagesUnit,true);assert.deepEqual(e.page1.rows,[e.decisionReceipt.original]);assert.deepEqual(e.tail.rows,[]);assert.equal(e.tail.nextCursorId,null);assert.equal(e.tail.nextCursorRecordedAt,null);
  const original=e.decisionReceipt.original;assert.equal(domain.basicCareReviewOriginalIssue(original,{tenantId:e.expected.tenantId,clientId:e.expected.clientId,careRootId:e.receipt.original.rootId,careHeadId:e.receipt.original.headId,careContentFingerprint:e.receipt.original.contentFingerprint}),null);
  assert.equal(e.page1.nextCursorId,original.rootId);assert.equal(e.page1.nextCursorRecordedAt,e.reviewReceipt.original.history[0].recordedAt);assert.notEqual(e.page1.nextCursorId,original.headId);assert.match(e.page1.stateFingerprint,/^sha256:[a-f0-9]{64}$/);assert.equal(e.tail.stateFingerprint,e.page1.stateFingerprint);
  for(const page of[e.page1,e.tail])assert.deepEqual(Object.keys(page).sort(),['rows','nextCursorId','nextCursorRecordedAt','stateFingerprint'].sort());
 });
 if(e.authorityUnit)test('Actual authority unit retains its original own receipt after all isolated authority and Auth relink denials',()=>{
  assert.equal(e.authorityUnit,true);assert.equal(e.sameProfileDifferentAuthReplayDenied,true);assert.deepEqual(e.confirmedReceipt,e.receipt);assert.equal(domain.basicCareReceiptIssue(e.confirmedReceipt,e.packet),null);assert.equal(e.packet.actorId,e.expected.authorId);assert.equal(e.packet.requestId,e.expected.createRequestId);
 });
 if(e.denialCases)test('Actual native author cases reach real completed care and technically qualified reviewer before exact42501 denials',()=>{
  assert.deepEqual(e.denialCases.map(c=>c.case),[1,2,3,4,5,6,7,8,9,10]);
  for(const c of e.denialCases){assert.equal(c.careReceipt.original.payload.lifecycle,'completed');assert.equal(c.careReceipt.original.payload.execution.outcome,'performed');assert.equal(c.reviewReceipt.original.status,'requested');assert.equal(c.acceptSqlState,'42501');assert.equal(c.returnSqlState,'42501');assert.equal(c.qualifiedReviewer.profileId,c.expected.reviewerId);assert.equal(c.qualifiedReviewer.scopeKind,'basic_care_review');assert.equal(domain.basicCareReviewPacketIssue(c.acceptPacket),null);assert.equal(domain.basicCareReviewPacketIssue(c.returnPacket),null);
   if(c.case===1)assert.equal(c.issuePacket.sources.planVersion.actor_id,null);if(c.case===2)assert.equal(c.issuePacket.sources.measure.created_by,null);
   if(c.case===5||c.case===6){assert.equal(c.retirementChangedStateToken,true);assert.match(c.stateBefore,/^sha256:[0-9a-f]{64}$/);assert.match(c.stateAfter,/^sha256:[0-9a-f]{64}$/);assert.notEqual(c.stateBefore,c.stateAfter);}
   if(c.case===9)assert.equal(c.issuePacket.sources.planVersion.actor_id,c.expected.nativeUpdaterId);if(c.case===10)assert.equal(c.issuePacket.sources.measure.created_by,c.expected.nativeUpdaterId);
   if(c.case===8){assert.notEqual(c.expected.nativeUpdaterId,c.expected.reviewerId);assert.notEqual(c.expected.nativeUpdaterId,c.expected.authorId);assert.equal(c.issuePacket.sources.measure.updated_by,c.expected.nativeUpdaterId);}
  }
 });
 if(e.retainedOriginalAccountWithoutLiveLinkInference)test('Actual pre-care relink blocks original account through another profile while unrelated qualified acceptance succeeds',()=>{
  assert.equal(e.retainedOriginalAccountWithoutLiveLinkInference,true);assert.equal(e.blockedSqlState,'42501');assert.equal(e.currentTourConservativeExclusionRetained,true);assert.equal(e.blockedAcceptPacket.actorId,e.alternateReviewerProfileId);assert.notEqual(e.blockedAcceptPacket.actorId,e.nativePlannerProfileId);assert.equal(e.issuePacket.sources.planVersion.actor_id,e.nativePlannerProfileId);assert.equal(e.issuePacket.sources.measure.created_by,e.nativePlannerProfileId);assert.equal(e.independentDecisionPacket.actorId,e.independentReviewerProfileId);assert.equal(e.independentDecisionReceipt.original.status,'accepted');
  assert.equal(domain.basicCareReviewPacketIssue(e.blockedAcceptPacket),null);assert.equal(domain.basicCareReviewPacketIssue(e.blockedReturnPacket),null);
 });
 if(e.initialContext){
  const binding=await import('../../src/lib/pflege/basicCareBinding.web.ts');const p=e.packet,x=e.expected,scope={tenantId:x.tenantId,clientId:x.clientId,actorId:x.authorId};
  test('Actual intent SQL contexts and exact UTF8 caller hash satisfy current production binding decoders',async()=>{
   assert.deepEqual(binding.decodeBasicCareBindingContext(e.initialContext,scope),e.initialContext);assert.deepEqual(binding.decodeBasicCareBindingContext(e.finalContext,scope),e.finalContext);assert.equal(e.initialContext.candidates.length,4);assert.equal(e.finalContext.candidates.length,3);
   for(const[t,h]of [[e.packetText,e.packetHash],[e.cancelPacketText,e.cancelPacketHash],[e.earlyPacketText,e.earlyPacketHash]]){assert.equal('sha256:'+createHash('sha256').update(t,'utf8').digest('hex'),h);assert.equal(await binding.basicCareBindingPacketHash(t),h);}
   assert.deepEqual(JSON.parse(e.packetText),p);assert.notEqual(await binding.basicCareBindingPacketHash(' '+e.packetText),e.packetHash);assert.equal(e.sameProfileDifferentAuthDenied,true);
   const ref=(requestId,packetHash)=>({...scope,requestId,packetHash}),sel={planVersionId:p.planVersionId,measureId:p.measureId,visitId:p.visitId,kind:p.sources.measure.category,plannedAt:p.plannedAt,secondPersonRequired:p.secondPersonRequired};
   for(const[key,requestId,hash]of [['absent',e.absentRequestId,e.packetHash],['prepared',x.issueRequestId,e.packetHash],['committed',x.issueRequestId,e.packetHash],['cancelled',e.cancelRequestId,e.cancelPacketHash],['earlyCancelled',e.earlyCancelRequestId,e.earlyPacketHash]])assert.deepEqual(binding.decodeBasicCareBindingStatus(e[key],ref(requestId,hash),sel),e[key]);
   assert.deepEqual(e.committed.plan,e.nativeIssueReceipt.plan);assert.deepEqual(e.nativeIssueReceipt.packet,p);assert.deepEqual(e.dstGap,[]);assert.deepEqual(e.dstFold,['2026-10-25T00:30:00.123456Z','2026-10-25T01:30:00.123456Z']);
  });
 }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){if(!process.argv[2])throw Error('Supply actual synthetic Postgres evidence JSON path');await registerBasicCarePostgresEvidenceTests(process.argv[2]);}
