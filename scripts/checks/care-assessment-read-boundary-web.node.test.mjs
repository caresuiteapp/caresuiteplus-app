import test from 'node:test';import assert from 'node:assert/strict';
import {createCareAssessmentReadBoundary,beginCareAssessmentRead,acceptCareAssessmentQueryRead,captureCareAssessmentPendingRead,acceptCareAssessmentConfirmedRead,isCurrentCareAssessmentReadEnvelope} from '../../src/lib/careAssessment/careAssessmentReadBoundary.web.ts';
import {captureCareAssessmentDraftBaseline,confirmCareAssessmentDraftWrite,adoptCareAssessmentDraftRead} from '../../src/lib/careAssessment/careAssessmentDraftReadState.web.ts';
import {makeAssessmentDraftRequest,assertAssessmentDraftReceipt} from '../../src/lib/careAssessment/assessmentDraftRequestDomain.ts';
const id=n=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
const scope=()=>({tenantId:id(1),profileId:id(2),roleKey:'business_admin',assessmentId:id(3),subjectType:'client',canRead:true});
const context=()=>({...scope(),subjectId:id(4)});
const saved=(revision=12)=>({id:id(3),tenantId:id(1),subjectType:'client',subjectId:id(4),status:'draft',version:2,draftRevision:revision,reason:'initial',reasonDetail:'Originalgespräch',nextReviewAt:null,personStatement:'Gesicherter Originalton',statementSource:'person',statementSourceName:'',conversationParticipants:[],communicationSupport:'',informationSourceSummary:'',professionalSummary:'',changeSummary:'',destabilizationSummary:'',topics:[{topicKey:'self_care',personPerspective:'Eigenes Original'}],risks:[],measures:[],evaluations:[],events:[{id:id(5),recorded_at:'2026-10-11T10:00:00.000001Z',detail:{author:'Historische Fachperson',original:'Vollständiger Originalbeleg'}}],links:[],versionHistory:[{actorName:'Historische Planfachperson',createdAt:'2026-10-11T10:00:00.000001Z'}],updatedAt:'2026-10-11T10:00:00.000001Z'});
const begin=()=>createCareAssessmentReadBoundary(scope(),saved());
const acceptQuery=(boundary,ticket,value)=>acceptCareAssessmentQueryRead(boundary,ticket,value,scope());
const confirm=(boundary,ticket,pending,value)=>acceptCareAssessmentConfirmedRead(boundary,ticket,pending,value,context());

test('actual existing receipt and baseline helpers accept own13 over independently read14; boundary prevents that overwrite',()=>{
 let boundary=begin();const original=saved(),baseline=captureCareAssessmentDraftBaseline(original,context()),editable=structuredClone(original);
 editable.personStatement='Eigene Schreibangabe';
 const request=makeAssessmentDraftRequest(editable,'save'),pending=captureCareAssessmentPendingRead(boundary);
 boundary=acceptQuery(boundary,beginCareAssessmentRead(boundary),saved(14)).boundary;
 const own=saved(13);own.personStatement=editable.personStatement;
 assert.doesNotThrow(()=>assertAssessmentDraftReceipt(request,{assessmentId:own.id,draftRevision:own.draftRevision,status:own.status}));
 assert.equal(confirmCareAssessmentDraftWrite(own,baseline.context,context()).value.draftRevision,13);
 const ticket=beginCareAssessmentRead(boundary);
 assert.throws(()=>confirm(boundary,ticket,pending,own),/seit Beginn/);
 assert.equal(boundary.saved.draftRevision,14);assert.equal(baseline.assessment.draftRevision,12);assert.equal(editable.personStatement,'Eigene Schreibangabe');
});
test('independent read14 finishing during own13 reload is registered synchronously and blocks its receipt adoption',async()=>{
 let boundary=begin();const pending=captureCareAssessmentPendingRead(boundary),ticket=beginCareAssessmentRead(boundary);let resolve;
 const fetch=new Promise(done=>{resolve=done;});
 const manual=(async()=>{const loaded=await fetch;return confirm(boundary,ticket,pending,loaded);})();
 boundary=acceptQuery(boundary,beginCareAssessmentRead(boundary),saved(14)).boundary;
 resolve(saved(13));await assert.rejects(manual,/seit Beginn/);assert.equal(boundary.saved.draftRevision,14);
});
test('query started with12 returning after accepted own13 is rejected before returning a successful envelope',async()=>{
 let boundary=begin();const pending=captureCareAssessmentPendingRead(boundary),oldQuery=beginCareAssessmentRead(boundary);let resolve;
 const fetch=new Promise(done=>{resolve=done;});
 const query=(async()=>{const loaded=await fetch;return acceptQuery(boundary,oldQuery,loaded);})();
 const own=confirm(boundary,beginCareAssessmentRead(boundary),pending,saved(13));boundary=own.boundary;
 resolve(saved(12));await assert.rejects(query,/abgelöst/);assert.equal(boundary.saved.draftRevision,13);assert.equal(isCurrentCareAssessmentReadEnvelope(boundary,own.envelope),true);
});
test('wrapper approved12 before own13 but shared hook consumes12 afterwards: stale envelope cannot pass passive adoption',()=>{
 let boundary=begin();const pending=captureCareAssessmentPendingRead(boundary),original=saved(),baseline=captureCareAssessmentDraftBaseline(original,context());
 const oldQuery=acceptQuery(boundary,beginCareAssessmentRead(boundary),saved());boundary=oldQuery.boundary;
 const own=confirm(boundary,beginCareAssessmentRead(boundary),pending,saved(13));boundary=own.boundary;
 const acceptedForm=confirmCareAssessmentDraftWrite(own.envelope.assessment,baseline.context,context());
 // Existing baseline helper alone would regard late12 as an adoptable clean refresh.
 assert.equal(adoptCareAssessmentDraftRead(acceptedForm.baseline,acceptedForm.value,oldQuery.envelope.assessment,context()).value.draftRevision,12);
 assert.equal(isCurrentCareAssessmentReadEnvelope(boundary,oldQuery.envelope),false);
 assert.equal(isCurrentCareAssessmentReadEnvelope(boundary,own.envelope),true);
 assert.equal(acceptedForm.value.draftRevision,13);
});
test('same generation older query envelope with changed full content is rejected after a later authoritative query read',()=>{
 let boundary=begin();const first=acceptQuery(boundary,beginCareAssessmentRead(boundary),saved());boundary=first.boundary;
 const secondRead=saved();secondRead.events[0].detail.original='Anderes vollständiges Original';
 const second=acceptQuery(boundary,beginCareAssessmentRead(boundary),secondRead);boundary=second.boundary;
 assert.equal(first.envelope.receipt.generation,second.envelope.receipt.generation);
 assert.equal(isCurrentCareAssessmentReadEnvelope(boundary,first.envelope),false);
 assert.equal(isCurrentCareAssessmentReadEnvelope(boundary,second.envelope),true);
});
test('already observed exact own result is safely retained instead of treating its independent read as conflicting',()=>{
 let boundary=begin();const pending=captureCareAssessmentPendingRead(boundary),own=saved(13);
 boundary=acceptQuery(boundary,beginCareAssessmentRead(boundary),own).boundary;
 const accepted=confirm(boundary,beginCareAssessmentRead(boundary),pending,own);
 assert.deepEqual(accepted.boundary.saved,own);assert.equal(accepted.boundary.generation,1);
});
for(const [label,change] of [
 ['microsecond timestamp',v=>{v.events[0].recorded_at='2026-10-11T10:00:00.000002Z';}],
 ['historical author',v=>{v.versionHistory[0].actorName='Andere ursprüngliche Fachperson';}],
 ['historical original',v=>{v.events[0].detail.original='Anderer Originalbeleg';}],
 ['history order',v=>{v.events.push({id:id(6),recorded_at:'2026-10-11T10:00:00.000001Z',detail:'Weiteres Original'});v.events.reverse();}],
 ['unrelated clinical nested field',v=>{v.topics[0].personPerspective='Andere persönliche Perspektive';}],
])test(`same revision but changed ${label} is a real saved divergence`,()=>{
 let boundary=begin();const pending=captureCareAssessmentPendingRead(boundary),incoming=saved();change(incoming);
 boundary=acceptQuery(boundary,beginCareAssessmentRead(boundary),incoming).boundary;
 assert.equal(boundary.saved.draftRevision,pending.saved.draftRevision);
 assert.throws(()=>confirm(boundary,beginCareAssessmentRead(boundary),pending,saved(13)),/seit Beginn/);
});
test('ordinary authoritative query reads impose no maximum revision or timestamp ordering',()=>{
 let boundary=begin();const incoming=saved(2);incoming.updatedAt='2020-01-01T00:00:00.000001Z';
 const accepted=acceptQuery(boundary,beginCareAssessmentRead(boundary),incoming);boundary=accepted.boundary;
 assert.equal(boundary.saved.draftRevision,2);assert.equal(isCurrentCareAssessmentReadEnvelope(boundary,accepted.envelope),true);
 const pending=captureCareAssessmentPendingRead(boundary),decoded=saved(1);decoded.updatedAt='2019-01-01T00:00:00.000001Z';
 // Backend receipt checking remains the caller's separate responsibility.
 assert.equal(confirm(boundary,beginCareAssessmentRead(boundary),pending,decoded).boundary.saved.draftRevision,1);
});
for(const field of ['tenantId','profileId','roleKey','assessmentId','subjectType','canRead'])test(`changed native/query ${field} invalidates the old read and own provenance`,()=>{
 const boundary=begin(),ticket=beginCareAssessmentRead(boundary),pending=captureCareAssessmentPendingRead(boundary),different={...scope(),[field]:field==='roleKey'?'pflegefachperson':field==='subjectType'?'resident':field==='canRead'?false:id(99)};
 assert.throws(()=>acceptCareAssessmentQueryRead(boundary,ticket,saved(),different),/abgelöst/);
 const replacement=createCareAssessmentReadBoundary(different);
 assert.throws(()=>acceptCareAssessmentQueryRead(replacement,ticket,saved(),different),/abgelöst/);
 if(different.canRead)assert.throws(()=>acceptCareAssessmentConfirmedRead(replacement,beginCareAssessmentRead(replacement),pending,saved(13),{...different,subjectId:id(4)}),/Schreibkontext/);
});
test('revocation and restoration never revive old tickets; retained write provenance can use a fresh read ticket',()=>{
 const original=begin(),ticket=beginCareAssessmentRead(original),pending=captureCareAssessmentPendingRead(original);
 const revoked=createCareAssessmentReadBoundary({...scope(),canRead:false},saved());
 assert.throws(()=>beginCareAssessmentRead(revoked),/abgelöst/);
 const restored=createCareAssessmentReadBoundary(scope(),saved());
 assert.throws(()=>acceptQuery(restored,ticket,saved()),/abgelöst/);
 const fresh=confirm(restored,beginCareAssessmentRead(restored),pending,saved(13));
 assert.equal(fresh.boundary.saved.draftRevision,13);
});
test('fresh own reread after revocation/regrant can confirm original pending request when current read exactly equals its receipt',()=>{
 const original=begin(),pending=captureCareAssessmentPendingRead(original),oldTicket=beginCareAssessmentRead(original),request=makeAssessmentDraftRequest(original.saved,'save');
 const regranted=createCareAssessmentReadBoundary(scope()),loaded=saved(13);
 const query=acceptQuery(regranted,beginCareAssessmentRead(regranted),loaded);
 assert.doesNotThrow(()=>assertAssessmentDraftReceipt(request,{assessmentId:loaded.id,draftRevision:loaded.draftRevision,status:loaded.status}));
 assert.throws(()=>confirm(query.boundary,oldTicket,pending,loaded),/abgelöst/);
 const accepted=confirm(query.boundary,beginCareAssessmentRead(query.boundary),pending,loaded);
 assert.equal(accepted.boundary.saved.draftRevision,13);assert.equal(pending.saved.draftRevision,12);assert.equal(request.expectedRevision,'12');
});
test('same-key remount or caller lifetime reset invalidates an outstanding envelope',()=>{
 const first=begin(),loaded=acceptQuery(first,beginCareAssessmentRead(first),saved());
 const second=begin();assert.equal(isCurrentCareAssessmentReadEnvelope(second,loaded.envelope),false);
 assert.throws(()=>acceptQuery(second,loaded.envelope.receipt,saved()),/abgelöst/);
});
test('first decoded read binds actual native subject; later foreign subjects cannot replace it',()=>{
 let boundary=createCareAssessmentReadBoundary(scope());
 assert.throws(()=>captureCareAssessmentPendingRead(boundary),/Lesestand fehlt/);
 boundary=acceptQuery(boundary,beginCareAssessmentRead(boundary),saved()).boundary;
 const foreign={...saved(),subjectId:id(99)};
 assert.throws(()=>acceptQuery(boundary,beginCareAssessmentRead(boundary),foreign),/Personenbezug/);
 const pending=captureCareAssessmentPendingRead(boundary);
 assert.throws(()=>confirm(boundary,beginCareAssessmentRead(boundary),pending,foreign),/Personenbezug/);
 assert.throws(()=>acceptCareAssessmentConfirmedRead(boundary,beginCareAssessmentRead(boundary),pending,saved(13),{...context(),subjectId:id(99)}),/seit Beginn/);
});
for(const field of ['tenantId','id','subjectType','subjectId'])test(`foreign decoded native ${field} is rejected before publication`,()=>{
 const boundary=begin(),foreign={...saved(),[field]:field==='subjectType'?'resident':id(99)};
 assert.throws(()=>acceptQuery(boundary,beginCareAssessmentRead(boundary),foreign),/Personenbezug/);
 assert.throws(()=>confirm(boundary,beginCareAssessmentRead(boundary),captureCareAssessmentPendingRead(boundary),foreign),/Personenbezug/);
 assert.equal(boundary.saved.draftRevision,12);
});
test('scope and complete native saved/pending/envelope originals are cloned, deeply frozen and never mutate callers',()=>{
 const nativeScope=scope(),original=saved(),boundary=createCareAssessmentReadBoundary(nativeScope,original),pending=captureCareAssessmentPendingRead(boundary),ticket=beginCareAssessmentRead(boundary);
 original.events[0].detail.author='Mutated caller';nativeScope.roleKey='Mutated role';
 assert.equal(boundary.saved.events[0].detail.author,'Historische Fachperson');assert.equal(pending.saved.events[0].detail.author,'Historische Fachperson');assert.equal(ticket.scope.roleKey,'business_admin');
 assert.throws(()=>{pending.saved.events[0].detail.original='Changed provenance';},TypeError);
 assert.throws(()=>{boundary.scope.tenantId=id(99);},TypeError);
 const own=saved(13),before=structuredClone(own),accepted=confirm(boundary,ticket,pending,own);
 assert.deepEqual(own,before);assert.equal(boundary.saved.draftRevision,12);
 own.events[0].detail.original='Changed result';assert.equal(accepted.envelope.assessment.events[0].detail.original,'Vollständiger Originalbeleg');
 assert.notEqual(accepted.boundary.saved,accepted.envelope.assessment);assert.notEqual(pending.saved,boundary.saved);
});
test('accepted own boundary blocks stale tickets and conflicting originals but permits retained identical confirmation and subsequent writes',()=>{
 let boundary=begin();const originalPending=captureCareAssessmentPendingRead(boundary),ticket=beginCareAssessmentRead(boundary);
 boundary=confirm(boundary,ticket,originalPending,saved(13)).boundary;
 assert.throws(()=>confirm(boundary,ticket,originalPending,saved(13)),/abgelöst/);
 assert.throws(()=>confirm(boundary,beginCareAssessmentRead(boundary),originalPending,saved(14)),/seit Beginn/);
 const repeated=confirm(boundary,beginCareAssessmentRead(boundary),originalPending,saved(13));
 assert.equal(repeated.boundary.saved.draftRevision,13);
 const freshPending=captureCareAssessmentPendingRead(boundary),next=confirm(boundary,beginCareAssessmentRead(boundary),freshPending,saved(14));
 assert.equal(next.boundary.generation,2);assert.equal(isCurrentCareAssessmentReadEnvelope(next.boundary,next.envelope),true);
});
test('native scope requires genuine IDs and role but does not invent custom role restrictions',()=>{
 for(const field of ['tenantId','profileId','assessmentId'])assert.throws(()=>createCareAssessmentReadBoundary({...scope(),[field]:'bad'}),/Lesekontext/);
 assert.throws(()=>createCareAssessmentReadBoundary({...scope(),roleKey:''}),/Lesekontext/);
 assert.throws(()=>createCareAssessmentReadBoundary({...scope(),canRead:1}),/Lesekontext/);
 assert.equal(createCareAssessmentReadBoundary({...scope(),roleKey:'native_custom_role'}).scope.roleKey,'native_custom_role');
});
test('stale boundary error is non-transient to the existing query retry classifier',()=>{
 const boundary=begin(),old=beginCareAssessmentRead(boundary),pending=captureCareAssessmentPendingRead(boundary),next=confirm(boundary,old,pending,saved(13)).boundary;
 let message='';try{acceptQuery(next,old,saved());}catch(error){message=error.message;}
 assert.ok(message);assert.equal(/(network|netzwerk|fetch|timeout|zeit|verbindung|relay|temporar|vorübergehend)/i.test(message),false);
});
