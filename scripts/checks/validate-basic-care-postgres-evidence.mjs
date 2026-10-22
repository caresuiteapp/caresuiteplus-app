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
  const forbidden=/access.?token|refresh.?token|password|passwd|secret|jwt|session.?id|request\.jwt|raw_user_meta|raw_app_meta|authorization|bearer|authUserIds|auth_user_id|profile_original/i;
  const walk=v=>{if(v&&typeof v==='object')for(const[k,c]of Object.entries(v)){assert.ok(!forbidden.test(k),k);walk(c);}else if(typeof v==='string')assert.doesNotMatch(v,/eyJ[A-Za-z0-9_-]{12,}\.eyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]+/);};walk(e);
 });
 const carePairs=[['packet','receipt'],['revisionPacket','revisionReceipt'],['correctionPacket','correctionReceipt'],['otherPacket','otherReceipt'],['carePacket','careReceipt']];
 const reviewPairs=[['reviewPacket','reviewReceipt'],['decisionPacket','decisionReceipt'],['returnRequestPacket','returnRequestReceipt'],['returnPacket','returnReceipt'],['independentDecisionPacket','independentDecisionReceipt']];
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
  });
 }
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
