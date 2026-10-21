import test from 'node:test';
import assert from 'node:assert/strict';
import {createCareAssessmentQueryAttempt,assertCareAssessmentQueryAttempt,assertCareAssessmentQueryLifetime} from '../../src/lib/careAssessment/careAssessmentQueryAttempt.web.ts';
import {withServiceQueryTimeout} from '../../src/lib/services/queryTimeout.ts';
import {createCareAssessmentReadBoundary,beginCareAssessmentRead,acceptCareAssessmentQueryRead,captureCareAssessmentPendingRead,acceptCareAssessmentConfirmedRead,isCurrentCareAssessmentReadEnvelope} from '../../src/lib/careAssessment/careAssessmentReadBoundary.web.ts';
import {captureCareAssessmentDraftBaseline} from '../../src/lib/careAssessment/careAssessmentDraftReadState.web.ts';
import {makeAssessmentDraftRequest,assertAssessmentDraftReceipt} from '../../src/lib/careAssessment/assessmentDraftRequestDomain.ts';
const id=n=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
const scope=()=>({tenantId:id(1),profileId:id(2),roleKey:'business_admin',assessmentId:id(3),subjectType:'client',canRead:true});
const context=()=>({...scope(),subjectId:id(4)});
const saved=(revision=12)=>({id:id(3),tenantId:id(1),subjectType:'client',subjectId:id(4),status:'draft',version:2,draftRevision:revision,reason:'initial',reasonDetail:'Originalgespräch',personStatement:'Gesicherter Originalton',statementSource:'person',statementSourceName:'',conversationParticipants:[],communicationSupport:'',informationSourceSummary:'',professionalSummary:'',changeSummary:'',destabilizationSummary:'',nextReviewAt:null,topics:[{topicKey:'self_care',personPerspective:'Eigenes Original'}],risks:[],measures:[],evaluations:[],events:[{id:id(5),recorded_at:'2026-10-11T10:00:00.000001Z',detail:{author:'Historische Fachperson',original:'Vollständiger Originalbeleg'}}],links:[],versionHistory:[{actorName:'Historische Planfachperson',createdAt:'2026-10-11T10:00:00.000001Z'}],updatedAt:'2026-10-11T10:00:00.000001Z'});
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}
/** The wrapper publishes before the existing shared hook can consume its returned envelope. */
function reader(){
 const state={boundary:createCareAssessmentReadBoundary(scope(),saved()),attempt:null,alive:true};
 function bindFetcher(){const capturedLifetime=state.boundary?.lifetime??null;return async function fetch(promise){
  if(!state.alive)throw Error('Lesekontext nicht mehr zugänglich.');
  assertCareAssessmentQueryLifetime(state.boundary?.lifetime??null,capturedLifetime);
  const attempt=createCareAssessmentQueryAttempt();state.attempt=attempt;
  const ticket=beginCareAssessmentRead(state.boundary),loaded=await promise;
  assertCareAssessmentQueryAttempt(state.attempt,attempt);
  if(!state.alive||!state.boundary)throw Error('Lesekontext nicht mehr zugänglich.');
  if(!loaded.ok)return loaded;
  const accepted=acceptCareAssessmentQueryRead(state.boundary,ticket,loaded.data,state.boundary.scope);
  state.boundary=accepted.boundary;return {ok:true,data:accepted.envelope};
 };}
 const fetch=bindFetcher();
 function invalidate(){state.attempt=null;state.boundary=null;}
 return {state,fetch,invalidate,bindFetcher};
}
const ok=data=>({ok:true,data});
async function timeOut(first){await assert.rejects(withServiceQueryTimeout(first,'Pflegeplan',1),/zu lange/);}

test('actual timeout leaves first fetch alive: successful retry publishes14 and late12 cannot replace it or its full originals',async()=>{
 const {state,fetch}=reader(),original=structuredClone(state.boundary.saved),baseline=captureCareAssessmentDraftBaseline(original,context()),request=makeAssessmentDraftRequest(original,'save'),pending=captureCareAssessmentPendingRead(state.boundary);
 const first=deferred(),retry=deferred(),oldRead=fetch(first.promise);await timeOut(oldRead);
 const lateRejected=assert.rejects(oldRead,/Leseversuch.*abgelöst/),newRead=fetch(retry.promise),latest=saved(14);
 latest.events[0].detail.original='Separat neu gelesener vollständiger Beleg';latest.events[0].recorded_at='2026-10-11T10:00:00.000002Z';
 retry.resolve(ok(latest));const accepted=await newRead;
 assert.equal(accepted.data.receipt.generation,0);first.resolve(ok(saved()));await lateRejected;
 assert.deepEqual(state.boundary.saved,latest);assert.equal(isCurrentCareAssessmentReadEnvelope(state.boundary,accepted.data),true);
 assert.deepEqual(baseline.assessment,original);assert.deepEqual(pending.saved,original);assert.equal(request.expectedRevision,'12');
});
test('timed out earlier failure cannot return an obsolete error after successful retry',async()=>{
 const {state,fetch}=reader(),first=deferred(),retry=deferred(),old=fetch(first.promise);await timeOut(old);
 const rejected=assert.rejects(old,/Leseversuch.*abgelöst/),next=fetch(retry.promise);retry.resolve(ok(saved(14)));const accepted=await next;
 first.resolve({ok:false,error:'Veralteter Fehler aus erstem Versuch'});await rejected;
 assert.equal(state.boundary.saved.draftRevision,14);assert.equal(isCurrentCareAssessmentReadEnvelope(state.boundary,accepted.data),true);
});
test('a failed current retry stays an honest failure; earlier success never silently replaces the last valid saved snapshot',async()=>{
 const {state,fetch}=reader(),first=deferred(),retry=deferred(),old=fetch(first.promise);await timeOut(old);
 const rejected=assert.rejects(old,/Leseversuch.*abgelöst/),next=fetch(retry.promise);retry.resolve({ok:false,error:'Aktueller gespeicherter Stand nicht lesbar'});
 assert.deepEqual(await next,{ok:false,error:'Aktueller gespeicherter Stand nicht lesbar'});first.resolve(ok(saved(14)));await rejected;
 assert.deepEqual(state.boundary.saved,saved());
});
test('late rejected network Promise remains handled after timeout and cannot alter newer native originals',async()=>{
 const {state,fetch}=reader(),first=deferred(),retry=deferred(),old=fetch(first.promise);await timeOut(old);
 const rejected=assert.rejects(old,/Erste Verbindung/),next=fetch(retry.promise);retry.resolve(ok(saved(14)));await next;
 first.reject(Error('Erste Verbindung fehlgeschlagen'));await rejected;assert.deepEqual(state.boundary.saved,saved(14));
});
test('starting a newer actual invocation supersedes its predecessor even before the new result finishes',async()=>{
 const {state,fetch}=reader(),first=deferred(),second=deferred(),old=fetch(first.promise),rejected=assert.rejects(old,/Leseversuch.*abgelöst/),latest=fetch(second.promise);
 first.resolve(ok(saved(13)));await rejected;assert.deepEqual(state.boundary.saved,saved());
 second.resolve(ok(saved(14)));assert.equal((await latest).ok,true);assert.deepEqual(state.boundary.saved,saved(14));
});
test('revocation then same-native-scope regrant never revives a timed out attempt or its old boundary lifetime',async()=>{
 const {state,fetch,invalidate,bindFetcher}=reader(),first=deferred(),old=fetch(first.promise),oldLifetime=state.boundary.lifetime;await timeOut(old);
 const rejected=assert.rejects(old,/Leseversuch.*abgelöst/);invalidate();state.boundary=createCareAssessmentReadBoundary(scope(),saved());
 assert.notEqual(state.boundary.lifetime,oldLifetime);first.resolve(ok(saved(13)));await rejected;assert.deepEqual(state.boundary.saved,saved());
 const fresh=deferred(),next=bindFetcher()(fresh.promise);fresh.resolve(ok(saved(14)));assert.equal((await next).ok,true);
});
test('unmount invalidates an outstanding actual attempt without publishing its response',async()=>{
 const {state,fetch,invalidate}=reader(),first=deferred(),old=fetch(first.promise),rejected=assert.rejects(old,/Leseversuch.*abgelöst/);
 state.alive=false;invalidate();first.resolve(ok(saved(14)));await rejected;assert.equal(state.boundary,null);
});
test('current attempt cannot bypass own-confirmation generation: old pending query remains rejected after accepted13',async()=>{
 const {state,fetch}=reader(),pending=captureCareAssessmentPendingRead(state.boundary),first=deferred(),old=fetch(first.promise),rejected=assert.rejects(old,/abgelöst/),attempt=state.attempt;
 const confirmed=acceptCareAssessmentConfirmedRead(state.boundary,beginCareAssessmentRead(state.boundary),pending,saved(13),context());state.boundary=confirmed.boundary;
 assert.doesNotThrow(()=>assertCareAssessmentQueryAttempt(state.attempt,attempt));first.resolve(ok(saved()));await rejected;
 assert.deepEqual(state.boundary.saved,saved(13));assert.equal(isCurrentCareAssessmentReadEnvelope(state.boundary,confirmed.envelope),true);
});
test('successful retry14 blocks late own13 confirmation while preserving frozen full pending provenance and original request',async()=>{
 const {state,fetch}=reader(),pending=captureCareAssessmentPendingRead(state.boundary),request=makeAssessmentDraftRequest(state.boundary.saved,'save'),first=deferred(),old=fetch(first.promise);await timeOut(old);
 const rejected=assert.rejects(old,/Leseversuch.*abgelöst/),retry=deferred(),next=fetch(retry.promise);retry.resolve(ok(saved(14)));await next;
 const own=saved(13);assert.doesNotThrow(()=>assertAssessmentDraftReceipt(request,{assessmentId:own.id,draftRevision:own.draftRevision,status:own.status}));
 assert.throws(()=>acceptCareAssessmentConfirmedRead(state.boundary,beginCareAssessmentRead(state.boundary),pending,own,context()),/seit Beginn/);
 first.resolve(ok(saved()));await rejected;assert.deepEqual(pending.saved,saved());assert.equal(request.expectedRevision,'12');assert.deepEqual(state.boundary.saved,saved(14));
});
test('consumer guard still rejects a returned successful envelope if own confirmation publishes before the shared-hook consumption',async()=>{
 const {state,fetch}=reader(),pending=captureCareAssessmentPendingRead(state.boundary),first=deferred(),old=fetch(first.promise);
 first.resolve(ok(saved()));const earlier=await old;
 state.boundary=acceptCareAssessmentConfirmedRead(state.boundary,beginCareAssessmentRead(state.boundary),pending,saved(13),context()).boundary;
 assert.equal(isCurrentCareAssessmentReadEnvelope(state.boundary,earlier.data),false);assert.deepEqual(state.boundary.saved,saved(13));
});
test('latest successful attempt uses native ticket validation rather than introducing revision or timestamp ordering',async()=>{
 const {state,fetch}=reader(),incoming=saved(2);incoming.updatedAt='2020-01-01T10:00:00.000001Z';incoming.events[0].detail.original='Ausdrücklich gelesener Originalinhalt';
 const response=deferred(),latest=fetch(response.promise);response.resolve(ok(incoming));const accepted=await latest;
 assert.deepEqual(state.boundary.saved,incoming);assert.equal(isCurrentCareAssessmentReadEnvelope(state.boundary,accepted.data),true);
});
for(const field of ['tenantId','profileId','roleKey','assessmentId','subjectType'])test(`actual attempt identity never substitutes for changed native ${field} ticket validation`,async()=>{
 const {state,fetch}=reader(),first=deferred(),old=fetch(first.promise),rejected=assert.rejects(old,/abgelöst/);
 const different={...scope(),[field]:field==='roleKey'?'pflegefachperson':field==='subjectType'?'resident':id(99)};
 state.boundary=createCareAssessmentReadBoundary(different);first.resolve(ok(saved(14)));await rejected;assert.equal(state.boundary.saved,null);
});

test('actual timeout retry from an old closure after regrant cannot start a request or supersede the fresh permitted attempt',async()=>{
 const {state,fetch:oldFetcher,invalidate,bindFetcher}=reader(),first=deferred(),old=oldFetcher(first.promise);await timeOut(old);
 const oldResponseRejected=assert.rejects(old,/Leseversuch.*abgelöst/);invalidate();state.boundary=createCareAssessmentReadBoundary(scope(),saved());
 const freshResponse=deferred(),fresh=bindFetcher()(freshResponse.promise),freshAttempt=state.attempt;
 // The unchanged shared hook may retry its old fetcher closure after its timeout delay.
 let oldRpcStarted=false;const oldRetry=oldFetcher({then(resolve){oldRpcStarted=true;resolve(ok(saved()));}});
 await assert.rejects(oldRetry,/ursprüngliche.*Lesekontext.*abgelöst/);
 assert.equal(oldRpcStarted,false);assert.equal(state.attempt,freshAttempt);
 freshResponse.resolve(ok(saved(14)));const accepted=await fresh;
 first.resolve(ok(saved()));await oldResponseRejected;
 assert.deepEqual(state.boundary.saved,saved(14));assert.equal(isCurrentCareAssessmentReadEnvelope(state.boundary,accepted.data),true);
});
test('a mounted same-lifetime fetcher can refresh after own-confirmation generation advances',async()=>{
 const {state,fetch}=reader(),pending=captureCareAssessmentPendingRead(state.boundary),lifetime=state.boundary.lifetime;
 state.boundary=acceptCareAssessmentConfirmedRead(state.boundary,beginCareAssessmentRead(state.boundary),pending,saved(13),context()).boundary;
 assert.equal(state.boundary.lifetime,lifetime);const response=deferred(),fresh=fetch(response.promise);response.resolve(ok(saved(14)));const accepted=await fresh;
 assert.equal(accepted.data.receipt.generation,1);assert.deepEqual(state.boundary.saved,saved(14));
});
test('read closure captured while disabled cannot start an attempt when read access is later granted',async()=>{
 const {state,invalidate,bindFetcher}=reader();invalidate();const disabledFetcher=bindFetcher();state.boundary=createCareAssessmentReadBoundary(scope(),saved());
 const freshResponse=deferred(),fresh=bindFetcher()(freshResponse.promise),freshAttempt=state.attempt;
 await assert.rejects(disabledFetcher(Promise.resolve(ok(saved()))),/ursprüngliche.*Lesekontext.*abgelöst/);assert.equal(state.attempt,freshAttempt);
 freshResponse.resolve(ok(saved(14)));await fresh;assert.deepEqual(state.boundary.saved,saved(14));
});
