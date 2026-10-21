import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { isUuid } from '../../src/lib/validation/uuid.ts';

const read = path => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const source = stripTypeScriptTypes(read('src/lib/clients/clientIntakeWorkflow.web.ts')
  .replace(/^import[\s\S]*?;\n/gm, '').replace(/^export /gm, ''));
const { ClientIntakeWorkflow, withIntakeBrowserLock } = new Function('isUuid', 'hasIntakeDraftContent', 'mergeIntakeFormWithDefaults',
  `${source}; return {ClientIntakeWorkflow,withIntakeBrowserLock};`)(isUuid,
  snapshot => !!snapshot.form.firstName || snapshot.stepIndex > 0, form => structuredClone(form));
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const snapshot = (firstName = 'Anna', extra = {}) => ({ form: { firstName, intakeDocuments: [], ...extra }, stepIndex: 2 });
const receipt = id => ({ ok: true, data: { id } });
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const settle = async () => { for (let n = 0; n < 80; n++) await Promise.resolve(); };

const preparedIdentity=()=>({permits:()=>true,async assertCurrent(){},decision:()=>null,
 reservationReview:()=>({id:id(500),requestId:id(100),tenantId:id(1),actorId:id(2),inputKey:'input',candidateCount:1,
 preparedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+300000).toISOString()})});

const withDocuments = (label='Original') => snapshot('Anna', { intakeContractType:'ambulatory_care', intakeAssignmentEnabled:false,
  intakeDocuments:[{templateKey:'contract',title:label,status:'finalized',signatures:{client:{dataUrl:'original',signedAt:'2026-10-15T11:00:00.123456+00:00'}}}] });

function environment(patch = {}, store = new Map()) {
  const calls = [], key = `caresuite:client-intake-web-workflow:v1:${id(1)}:${id(2)}`;
  let sequence = 100, current = true, allowed = true;
  const storage = {
    async getItem(key) { calls.push(['read']); return store.get(key) ?? null; },
    async setItem(key, raw) { calls.push(['local', JSON.parse(raw).stage]); store.set(key, raw); },
    async removeItem(key) { calls.push(['clear']); store.delete(key); },
  };
  const deps = {
    tenantId: id(1), actorId: id(2), live: true, storage,
    isCurrent: () => current, canWrite: () => allowed, allocateId: () => id(sequence++),
    exclusive: async (_key, operation) => operation(),
    loadLegacy: async () => null, clearLegacy: async () => { calls.push(['clearLegacy']); },
    saveRemote: async (form, options) => {
      calls.push(['prepareRemote', structuredClone(form), options.clientId, options.newClientId]);
      if (!await options.beforeWrite()) return { ok: false, error: 'denied' };
      calls.push(['remote', options.clientId ? 'update' : 'insert', options.clientId ?? options.newClientId, structuredClone(form)]);
      return receipt(options.clientId ?? options.newClientId);
    },
    confirmRemote: async clientId => { calls.push(['confirm', clientId]); return receipt(clientId); },
    saveDocuments: async (clientId, _form, context) => { calls.push(['documents', clientId, context.requestId]); return { ok: true, data: {requestId:context.requestId} }; },
    confirmDocuments: async (clientId, _form, context) => { calls.push(['confirmDocuments', clientId, context.requestId]); return { ok: true, data: {requestId:context.requestId} }; },
    complete: async (clientId, form, guard, context) => { assert.equal(guard(), true); calls.push(['complete', clientId, form, context]); return receipt(clientId); },
    confirmCompletion: async (clientId, requestId) => { calls.push(['confirmCompletion', clientId, requestId]); return receipt(clientId); },
    ...patch,
  };
  const workflow = new ClientIntakeWorkflow(deps);
  return { workflow, deps, calls, store, key, journal: () => JSON.parse(store.get(key)),
    set current(value) { current = value; }, set allowed(value) { allowed = value; } };
}

test('initial concurrent autosaves serialize to one reserved insert followed by updates of that same person', async () => {
  const e = environment(); await e.workflow.load();
  const results = await Promise.all([e.workflow.save(snapshot('Anna')), e.workflow.save(snapshot('Anne')), e.workflow.save(snapshot('Anneliese'))]);
  assert.ok(results.every(result => result.ok));
  const writes = e.calls.filter(call => call[0] === 'remote');
  assert.deepEqual(writes.map(call => call[1]), ['insert', 'update', 'update']);
  assert.equal(new Set(writes.map(call => call[2])).size, 1);
  assert.equal(e.journal().form.firstName, 'Anneliese');
  assert.equal(e.journal().stage, 'ready');
  assert.ok(e.calls.findIndex(call => call[0] === 'local' && call[1] === 'draft-dispatched') < e.calls.findIndex(call => call[0] === 'remote'));
});

test('the complete packet request is durable before dispatch and unchanged autosaves reuse its receipt',async()=>{
  const e=environment({identity:preparedIdentity()});const normal=e.deps.saveDocuments;
  e.deps.saveDocuments=async(clientId,input,context)=>{
    const j=e.journal();assert.equal(j.stage,'documents-dispatched');assert.equal(j.documentsRequestId,context.requestId);
    assert.equal(j.documentsConfirmed,false);assert.equal(j.identityReviewId,id(500));assert.equal(context.isCurrent(),true);
    assert.deepEqual(j.form,input);return normal(clientId,input,context);
  };
  await e.workflow.load();assert.equal((await e.workflow.save(withDocuments())).ok,true);
  const first=e.journal();assert.equal(e.workflow.documentsMatch(withDocuments().form),true);
  assert.equal((await e.workflow.save(withDocuments())).ok,true);
  assert.equal(e.journal().documentsRequestId,first.documentsRequestId);assert.equal(e.journal().identityReviewId,id(500));
  assert.equal(e.calls.filter(call=>call[0]==='documents').length,1);assert.equal(e.calls.filter(call=>call[0]==='remote').length,2);
});
test('a changed document clears the displayed confirmation and receives its own request without retargeting the person',async()=>{
  const e=environment();await e.workflow.load();await e.workflow.save(withDocuments());const prior=e.journal();
  assert.equal(e.workflow.documentsMatch(withDocuments('Changed').form),false);
  assert.equal((await e.workflow.save(withDocuments('Changed'))).ok,true);
  assert.notEqual(e.journal().documentsRequestId,prior.documentsRequestId);assert.equal(e.journal().clientId,prior.clientId);
});
test('packet recovery across reload confirms the exact request and original, and never invokes the writer',async()=>{
  const e=environment({saveDocuments:async()=>({ok:false,error:'lost'})});await e.workflow.load();await e.workflow.save(withDocuments());
  const sent=e.journal();const next=environment({},e.store);let observed;
  next.deps.confirmDocuments=async(clientId,input,context)=>{observed={clientId,input,requestId:context.requestId};return{ok:true,data:{requestId:context.requestId}};};
  await next.workflow.load();assert.equal((await next.workflow.recover()).ok,true);
  assert.deepEqual(observed,{clientId:sent.clientId,input:sent.form,requestId:sent.documentsRequestId});
  assert.equal(next.journal().documentsConfirmed,true);assert.equal(next.journal().stage,'ready');
  assert.equal(next.calls.some(call=>['remote','documents','complete'].includes(call[0])),false);
});
test('an unknown packet reply cannot be bypassed by editing the form or attempting finish',async()=>{
  const e=environment({saveDocuments:async()=>({ok:false,error:'lost'})});await e.workflow.load();await e.workflow.save(withDocuments());
  const count=e.calls.filter(call=>call[0]==='remote').length;
  assert.equal((await e.workflow.save(withDocuments('Changed'))).ok,false);assert.equal((await e.workflow.finish(withDocuments())).ok,false);
  assert.equal(e.calls.filter(call=>call[0]==='remote').length,count);assert.equal(e.journal().form.intakeDocuments[0].title,'Original');
});
test('a positively rejected packet can be reviewed again using the same person and a different packet request',async()=>{
  const e=environment();const normal=e.deps.saveDocuments;let attempts=0;
  e.deps.saveDocuments=async(...args)=>attempts++===0?{ok:false,error:'original changed',documentWriteRejected:true}:normal(...args);
  await e.workflow.load();assert.equal((await e.workflow.save(withDocuments())).ok,false);const person=e.journal().clientId;
  assert.equal(e.journal().stage,'ready');assert.equal(e.journal().documentsRequestId,null);assert.equal(e.journal().documentsConfirmed,false);
  assert.equal((await e.workflow.save(withDocuments())).ok,true);assert.equal(e.journal().clientId,person);
});
test('a foreign or incomplete document receipt remains unresolved even after a successful RPC result',async()=>{
  for(const data of [{requestId:id(999)},{}]){
    const e=environment({saveDocuments:async()=>({ok:true,data})});await e.workflow.load();assert.equal((await e.workflow.save(withDocuments())).ok,false);
    assert.equal(e.journal().stage,'documents-dispatched');assert.equal(e.journal().documentsConfirmed,false);
  }
});
test('old dispatched document journals without a packet request cannot infer a complete receipt from existing rows',async()=>{
  const first=environment({saveDocuments:async()=>({ok:false,error:'lost'})});await first.workflow.load();await first.workflow.save(withDocuments());
  first.store.set(first.key,JSON.stringify({...first.journal(),documentsRequestId:null}));const next=environment({},first.store);await next.workflow.load();
  assert.equal((await next.workflow.recover()).ok,false);assert.equal(next.calls.some(call=>call[0]==='confirmDocuments'),false);
});
test('the final completion receives the confirmed packet id and original identity review across previous saves',async()=>{
  const e=environment({identity:preparedIdentity()});await e.workflow.load();await e.workflow.save(withDocuments());
  const packet=e.journal().documentsRequestId;assert.equal((await e.workflow.finish(withDocuments())).ok,true);
  const call=e.calls.find(call=>call[0]==='complete');assert.equal(call[3].documentsRequestId,packet);assert.equal(call[3].identityReviewId,id(500));
  assert.equal(e.calls.filter(call=>call[0]==='documents').length,1);
});
test('a journal failure before packet dispatch prevents its RPC and cannot be bypassed after reload',async()=>{
  const e=environment();const save=e.deps.storage.setItem;e.deps.storage.setItem=async(key,raw)=>{
    if(JSON.parse(raw).stage==='documents-dispatched')throw Error('no durable acknowledgement');return save(key,raw);
  };
  await e.workflow.load();assert.equal((await e.workflow.save(withDocuments())).ok,false);assert.equal(e.calls.some(call=>call[0]==='documents'),false);
  assert.equal((await e.workflow.save(withDocuments())).ok,false);
});
test('progress publishes only the acknowledged journal and never a speculative packet success',async()=>{
  const progress=[];const e=environment({onProgress:value=>progress.push(value),saveDocuments:async()=>({ok:false,error:'lost'})});
  await e.workflow.load();await e.workflow.save(withDocuments());assert.equal(progress.at(-1).stage,'documents-dispatched');
  assert.equal(progress.some(value=>value.documentsConfirmed),false);assert.equal(progress.at(-1).documentsRequestId,e.journal().documentsRequestId);
});

test('the server review id is durable before dispatch and accompanies first-write recovery after reload',async()=>{
 const e=environment({identity:preparedIdentity(),saveRemote:async(_form,opts)=>{
  await opts.beforeWrite();assert.equal(e.journal().identityReviewId,id(500));assert.equal(opts.identityReview().id,id(500));
  return{ok:false,error:'lost reply'};
 }});await e.workflow.load();await e.workflow.save(snapshot('Anna',{specialNotes:'Original'}));
 const raw=e.store.get(e.key);assert.doesNotMatch(raw,/candidate_originals|prepared_session|access.token/);
 const fresh=environment({confirmRemote:async(clientId,form,context)=>{
  assert.deepEqual(context,{allocation:'new',identityReviewId:id(500)});assert.equal(form.specialNotes,'Original');return receipt(clientId);
 }},e.store);await fresh.workflow.load();assert.equal((await fresh.workflow.recover()).ok,true);assert.equal(fresh.journal().allocation,'existing');
});
test('a confirmed SQL rejection clears only the decision and retries the same reserved id after fresh review',async()=>{
 let approved=true,rejections=0,attempts=0;const identity={...preparedIdentity(),permits:()=>approved,rejectReservation:()=>{approved=false;rejections++;}};
 const e=environment({identity});const normal=e.deps.saveRemote;e.deps.saveRemote=async(form,opts)=>{
  if(attempts++===0){await opts.beforeWrite();return{ok:false,error:'review changed',identityReviewRejected:true};}return normal(form,opts);
 };
 await e.workflow.load();assert.match((await e.workflow.save(snapshot())).error,/review changed/);const original=e.journal().clientId;
 assert.equal(e.journal().stage,'ready');assert.equal(e.journal().identityReviewId,null);assert.equal(e.journal().identityDecision,null);assert.equal(rejections,1);
 assert.equal((await e.workflow.save(snapshot())).data.remote,false);assert.equal(attempts,1);
 approved=true;assert.equal((await e.workflow.save(snapshot())).ok,true);assert.equal(e.journal().clientId,original);
 assert.equal(e.calls.find(c=>c[0]==='remote')[2],original);
});
test('a rejection marker on an existing-lead update never reopens a possibly dispatched write',async()=>{
 const e=environment({loadLegacy:async()=>({...snapshot(),clientId:id(20)}),saveRemote:async(_form,opts)=>{
  await opts.beforeWrite();return{ok:false,error:'unclassified',identityReviewRejected:true};
 }});await e.workflow.load();assert.equal((await e.workflow.save(snapshot())).ok,false);
 assert.equal(e.journal().stage,'draft-dispatched');assert.equal((await e.workflow.save(snapshot())).ok,false);
});
test('an invalid review id in a restored dispatch journal cannot fall back or authorize a lookup',async()=>{
 const e=environment();await e.workflow.load();await e.workflow.save(snapshot());
 e.store.set(e.key,JSON.stringify({...e.journal(),stage:'draft-dispatched',identityReviewId:'legacy-name'}));
 const fresh=environment({},e.store);await assert.rejects(fresh.workflow.load());assert.equal(fresh.calls.some(c=>c[0]==='confirm'),false);
});

test('a native review revocation reopens only local review and preserves the original request UUID',async()=>{
 let allowed=true;const identity={...preparedIdentity(),permits:()=>allowed,rejectReservation:()=>{allowed=false;}};
 const first=environment({identity,saveRemote:async(_form,opts)=>{await opts.beforeWrite();return{ok:false,error:'network'};}});
 await first.workflow.load();await first.workflow.save(snapshot());const original=first.journal().clientId;
 const next=environment({identity,confirmRemote:async clientId=>({ok:true,data:{id:clientId,reviewRevoked:true}})},first.store);
 await next.workflow.load();const result=await next.workflow.recover();assert.equal(result.data.reviewRevoked,true);
 assert.equal(next.journal().clientId,original);assert.equal(next.journal().allocation,'new');assert.equal(next.journal().stage,'ready');
 assert.equal((await next.workflow.save(snapshot('Rechecked'))).data.remote,false);assert.equal(next.calls.some(c=>c[0]==='remote'),false);
});
test('a claimed revocation without an original review id cannot reopen a legacy unknown insert',async()=>{
 const first=environment({saveRemote:async(_form,opts)=>{await opts.beforeWrite();return{ok:false,error:'network'};}});
 await first.workflow.load();await first.workflow.save(snapshot());
 const next=environment({confirmRemote:async clientId=>({ok:true,data:{id:clientId,reviewRevoked:true}})},first.store);await next.workflow.load();
 assert.equal((await next.workflow.recover()).ok,false);assert.equal(next.journal().stage,'draft-dispatched');
});
test('runtime rights lost during reconciliation keep the journal unresolved',async()=>{
 const first=environment({identity:preparedIdentity(),saveRemote:async(_form,opts)=>{await opts.beforeWrite();return{ok:false,error:'network'};}});
 await first.workflow.load();await first.workflow.save(snapshot());const next=environment({},first.store);
 next.deps.confirmRemote=async clientId=>{next.allowed=false;return{ok:true,data:{id:clientId,reviewRevoked:true}};};await next.workflow.load();
 assert.equal((await next.workflow.recover()).ok,false);assert.equal(next.journal().stage,'draft-dispatched');
});
test('queued input includes its original nested signatures even when caller mutates the form', async () => {
  const e = environment(); await e.workflow.load(); const input = snapshot('Anna', { nested: { source: 'original' } });
  const pending = e.workflow.save(input); input.form.firstName = 'Changed'; input.form.nested.source = 'changed';
  assert.equal((await pending).ok, true);
  const saved = e.calls.find(call => call[0] === 'remote')[3];
  assert.equal(saved.firstName, 'Anna'); assert.equal(saved.nested.source, 'original');
});
test('finish waits for a running autosave, saves its latest snapshot with the same id and closes the save queue', async () => {
  const gate = deferred(), e = environment(); let first = true;
  const original = e.deps.saveRemote;
  e.deps.saveRemote = async (...args) => { if (first) { first = false; await gate.promise; } return original(...args); };
  await e.workflow.load(); const pending = e.workflow.save(snapshot('Old'));
  await settle(); const final = e.workflow.finish(snapshot('Final'));
  assert.equal((await e.workflow.save(snapshot('Too late'))).ok, false);
  assert.equal((await e.workflow.finish(snapshot('Double click'))).ok, false);
  assert.equal(e.calls.filter(call => call[0] === 'complete').length, 0);
  gate.resolve(); assert.equal((await pending).ok, true); const result = await final; assert.equal(result.ok, true);
  const writes = e.calls.filter(call => call[0] === 'remote'); assert.deepEqual(writes.map(call => call[1]), ['insert', 'update']);
  assert.equal(e.calls.find(call => call[0] === 'complete')[1], writes[0][2]);
  assert.equal(e.calls.find(call => call[0] === 'complete')[2].firstName, 'Final');
  assert.equal(e.journal().stage, 'complete');
});
test('a complete journal survives reload and never restarts a second intake', async () => {
  const e = environment(); await e.workflow.load(); const result = await e.workflow.finish(snapshot()); assert.equal(result.ok, true);
  const next = environment({}, e.store); const restored = await next.workflow.load();
  assert.equal(restored.completed, true); assert.equal(restored.clientId, result.data.id);
  assert.equal((await next.workflow.save(snapshot())).ok, false);
  assert.equal((await next.workflow.finish(snapshot())).ok, false);
  assert.equal(next.calls.filter(call => call[0] === 'remote' || call[0] === 'complete').length, 0);
});
test('legacy cleanup failure cannot erase durable completion', async () => {
  const e = environment({ clearLegacy: async () => { throw Error('disk'); } }); await e.workflow.load();
  assert.equal((await e.workflow.finish(snapshot())).ok, true); assert.equal(e.journal().stage, 'complete');
});
for (const kind of ['error-result', 'thrown-response', 'wrong-id']) test(`a ${kind} after dispatch survives reload with the original id and no automatic retry`, async () => {
  const e = environment({ saveRemote: async (_form, options) => {
    await options.beforeWrite();
    if (kind === 'thrown-response') throw Error('transport');
    return kind === 'wrong-id' ? receipt(id(99)) : { ok: false, error: 'lost response' };
  } });
  await e.workflow.load(); assert.equal((await e.workflow.save(snapshot())).ok, false);
  const dispatched = e.journal(); assert.equal(dispatched.stage, 'draft-dispatched'); assert.ok(isUuid(dispatched.clientId));
  assert.equal((await e.workflow.save(snapshot('Another'))).ok, false);
  assert.equal((await e.workflow.discard()).ok, false);
  const next = environment({}, e.store); const restored = await next.workflow.load();
  assert.equal(restored.blocked, true); assert.equal(restored.clientId, dispatched.clientId);
  assert.equal((await next.workflow.finish(snapshot())).ok, false);
  assert.equal(next.calls.filter(call => call[0] === 'remote').length, 0);
});
test('read-only matching recovery permits an update of the same id, never a fresh insert', async () => {
  const e = environment({ saveRemote: async (_form, options) => { await options.beforeWrite(); return { ok: false, error: 'lost' }; } });
  await e.workflow.load(); await e.workflow.save(snapshot()); const original = e.journal().clientId;
  const next = environment({}, e.store); await next.workflow.load();
  assert.equal((await next.workflow.recover()).ok, true); assert.equal((await next.workflow.save(snapshot('Corrected'))).ok, true);
  assert.deepEqual(next.calls.filter(call => call[0] === 'remote').map(call => [call[1], call[2]]), [['update', original]]);
});
for (const result of [{ ok: false, error: 'missing' }, receipt(id(99))]) test('missing or mismatched recovery cannot authorize a retry', async () => {
  const e = environment({ saveRemote: async (_form, options) => { await options.beforeWrite(); return { ok: false, error: 'lost' }; } });
  await e.workflow.load(); await e.workflow.save(snapshot());
  const next = environment({ confirmRemote: async () => result }, e.store); await next.workflow.load();
  assert.equal((await next.workflow.recover()).ok, false); assert.equal((await next.workflow.save(snapshot())).ok, false);
  assert.equal(next.journal().stage, 'draft-dispatched');
});
test('an error before dispatch retains a prepared UUID and can retry only that insert', async () => {
  const e = environment({ saveRemote: async () => ({ ok: false, error: 'identity conflict' }) }); await e.workflow.load();
  assert.match((await e.workflow.save(snapshot())).error, /identity conflict/); const original = e.journal().clientId;
  assert.equal(e.journal().stage, 'ready');
  const other = environment({}, e.store); await other.workflow.load(); assert.equal((await other.workflow.save(snapshot())).ok, true);
  assert.equal(other.calls.find(call => call[0] === 'remote')[2], original);
});
test('uncertain signed-document persistence keeps the person and blocks automatic final activation', async () => {
  const e = environment({ saveDocuments: async () => ({ ok: false, error: 'lost signature reply' }) }); await e.workflow.load();
  assert.equal((await e.workflow.save(snapshot('Anna', { intakeDocuments: [{ signatures: { client: { dataUrl: 'signature' } } }] }))).ok, false);
  assert.equal(e.journal().stage, 'documents-dispatched'); assert.equal((await e.workflow.finish(snapshot())).ok, false);
  assert.equal((await e.workflow.recover()).ok, true); assert.equal(e.journal().stage, 'ready');
  assert.equal(e.calls.filter(call => call[0] === 'complete').length, 0);
});
test('uncertain finalization remains blocked across reload rather than replaying derived clinical writes', async () => {
  const e = environment({ complete: async () => ({ ok: false, error: 'partial' }) }); await e.workflow.load();
  assert.equal((await e.workflow.finish(snapshot())).ok, false); assert.equal(e.journal().stage, 'submit-dispatched');
  const next = environment({}, e.store); await next.workflow.load();
  assert.equal((await next.workflow.recover()).ok, true); assert.equal(next.journal().stage, 'complete');
  assert.equal((await next.workflow.finish(snapshot())).ok, false);
  assert.equal(next.calls.filter(call => call[0] === 'remote' || call[0] === 'complete').length, 0);
});
for (const stage of ['ready', 'draft-dispatched']) test(`storage failure at ${stage} prevents remote dispatch`, async () => {
  const e = environment(); const normal = e.deps.storage.setItem;
  e.deps.storage.setItem = async (key, raw) => { if (JSON.parse(raw).stage === stage) throw Error('full disk'); return normal(key, raw); };
  await e.workflow.load(); assert.equal((await e.workflow.save(snapshot())).ok, false);
  assert.equal(e.calls.filter(call => call[0] === 'remote').length, 0);
  assert.equal((await e.workflow.save(snapshot())).ok, false);
});
test('a storage write that resolves without preserving the journal cannot reach the network', async () => {
  const e = environment(); await e.workflow.load(); e.deps.storage.setItem = async () => {};
  assert.equal((await e.workflow.save(snapshot())).ok, false); assert.equal(e.calls.filter(call => call[0] === 'remote').length, 0);
});
test('two windows that loaded the same original cannot overwrite the newer journal', async () => {
  const first = environment(), second = environment({}, first.store); await first.workflow.load(); await second.workflow.load();
  assert.equal((await first.workflow.save(snapshot('First window'))).ok, true);
  assert.match((await second.workflow.save(snapshot('Second window'))).error, /anderen Fenster/);
  assert.equal(second.calls.filter(call => call[0] === 'remote').length, 0); assert.equal(first.journal().form.firstName, 'First window');
});
for (const cause of ['owner-switch', 'disposed', 'revoked']) test(`${cause} while a save is awaiting prevents documents and finalization`, async () => {
  const gate = deferred(), e = environment(); const normal = e.deps.saveRemote;
  e.deps.saveRemote = async (...args) => { const receipt = await normal(...args); await gate.promise; return receipt; };
  await e.workflow.load(); const result = e.workflow.save(snapshot('Anna', { intakeDocuments: [{ signatures: { client: { dataUrl: 'signature' } } }] }));
  await settle(); if (cause === 'owner-switch') e.current = false; else if (cause === 'disposed') e.workflow.dispose(); else e.allowed = false;
  gate.resolve(); assert.equal((await result).ok, false); assert.equal(e.journal().stage, 'draft-dispatched');
  assert.equal(e.calls.filter(call => call[0] === 'documents' || call[0] === 'complete').length, 0);
});
test('unconfirmed runtime permissions allow local restoration but no save dispatch', async () => {
  const e = environment(); e.allowed = false; assert.equal(await e.workflow.load(), null);
  assert.equal((await e.workflow.save(snapshot())).ok, false); assert.equal(e.calls.filter(call => call[0] === 'local' || call[0] === 'remote').length, 0);
});
for (const value of ['{', '{}', 'null', '[]']) test(`a malformed current journal ${value} cannot fall back to legacy or create a person`, async () => {
  let legacy = 0; const e = environment({ loadLegacy: async () => { legacy++; return snapshot(); } }); e.store.set(e.key, value);
  await assert.rejects(e.workflow.load()); assert.equal((await e.workflow.save(snapshot())).ok, false); assert.equal(legacy, 0);
});
test('a legacy confirmed draft is restored with its original id and saved by update', async () => {
  const e = environment({ loadLegacy: async () => ({ ...snapshot(), clientId: id(30) }) });
  assert.equal((await e.workflow.load()).clientId, id(30)); assert.equal((await e.workflow.save(snapshot())).ok, true);
  assert.deepEqual(e.calls.filter(call => call[0] === 'remote').map(call => [call[1], call[2]]), [['update', id(30)]]);
});
test('discard never detaches an already existing live lead but clears completed local state', async () => {
  const e = environment(); await e.workflow.load(); await e.workflow.save(snapshot()); assert.equal((await e.workflow.discard()).ok, false);
  await e.workflow.finish(snapshot()); assert.equal((await e.workflow.discard()).ok, true); assert.equal(e.store.size, 0);
  assert.equal((await e.workflow.save(snapshot('New person'))).ok, true);
});
test('journal carries identity, full form and dispatch state without session credentials', async () => {
  const e = environment(); await e.workflow.load(); await e.workflow.save(snapshot());
  const j = e.journal(); assert.equal(j.tenantId, id(1)); assert.equal(j.actorId, id(2));
  assert.deepEqual(Object.keys(j).sort(), ['actorId','allocation','clientId','documentsConfirmed','documentsRequestId','form','identityReviewId','revision','stage','stepIndex','tenantId','version']);
});
test('browser lock is exclusive and unavailable locks never execute the writer', async () => {
  const lockSource = new Function('navigator', `${source}; return withIntakeBrowserLock;`);
  const unavailable = lockSource({ locks: { request: async (key, options, operation) => {
    assert.equal(key, 'own-key'); assert.deepEqual(options, { mode: 'exclusive', ifAvailable: true }); return operation(null);
  } } }); let writes = 0;
  await assert.rejects(unavailable('own-key', async () => { writes++; }), /anderen Fenster/); assert.equal(writes, 0);
  await assert.rejects(lockSource({})('own-key', async () => { writes++; }), /Browser/); assert.equal(writes, 0);
});

function identityGate(patch={}) {
 return {permits:()=>false,assertCurrent:async()=>{},decision:()=>null,
  selectExisting:async()=>({resolution:'open_existing',inputKey:'own-input',candidateCount:1,reason:'Explicit existing selection'}),...patch};
}
test('an unreviewed Web intake saves its full draft locally without a single native person read/write',async()=>{
 const e=environment({identity:identityGate()});await e.workflow.load();const result=await e.workflow.save(snapshot('Local original'));
 assert.equal(result.ok,true);assert.equal(result.data.remote,false);assert.equal(e.journal().form.firstName,'Local original');assert.equal(e.journal().stage,'ready');
 assert.equal(e.calls.some(call=>['prepareRemote','remote','documents','complete'].includes(call[0])),false);
});
test('completion before explicit identity choice keeps the local original and never starts activation',async()=>{
 const e=environment({identity:identityGate()});await e.workflow.load();assert.equal((await e.workflow.finish(snapshot())).ok,false);
 assert.equal(e.journal().stage,'ready');assert.equal(e.calls.some(call=>call[0]==='remote'||call[0]==='complete'),false);
});
test('a changed candidate pool is checked before dispatch journaling or native mutation',async()=>{
 const e=environment({identity:identityGate({permits:()=>true,assertCurrent:async()=>{throw Error('candidate changed');}})});await e.workflow.load();
 assert.equal((await e.workflow.save(snapshot())).ok,false);assert.equal(e.journal().stage,'ready');assert.equal(e.calls.some(call=>call[0]==='remote'),false);
});
test('after explicit current review the already reserved local id is used for the one first insert',async()=>{
 let allowed=false;const e=environment({identity:identityGate({permits:()=>allowed})});await e.workflow.load();await e.workflow.save(snapshot());const original=e.journal().clientId;
 allowed=true;const result=await e.workflow.save(snapshot());assert.equal(result.ok,true);assert.equal(result.data.remote,true);
 assert.equal(e.calls.find(call=>call[0]==='remote')[2],original);assert.equal(e.journal().allocation,'existing');
});
test('an existing-person choice preserves unmerged input locally and never becomes created/completed',async()=>{
 const e=environment({identity:identityGate()});await e.workflow.load();await e.workflow.save(snapshot('Unmerged input'));
 const result=await e.workflow.openExisting(id(20),snapshot('Unmerged input'));assert.equal(result.ok,true);assert.equal(result.data.id,id(20));
 assert.equal(e.journal().stage,'existing-selected');assert.equal(e.journal().selectedExistingId,id(20));assert.equal(e.journal().form.firstName,'Unmerged input');
 assert.equal(e.calls.some(call=>['remote','documents','complete'].includes(call[0])),false);
 const next=environment({identity:identityGate()},e.store);const restored=await next.workflow.load();assert.equal(restored.selectedExistingId,id(20));assert.equal(restored.completed,false);
 assert.equal((await next.workflow.finish(snapshot())).ok,false);assert.equal((await next.workflow.discard()).ok,true);
});
test('a person choice before the first autosave can be restored without pretending a native lead was created',async()=>{
 const e=environment({identity:identityGate()});await e.workflow.load();assert.equal((await e.workflow.openExisting(id(20),snapshot())).ok,true);
 assert.equal(e.journal().clientId,null);const next=environment({identity:identityGate()},e.store);assert.equal((await next.workflow.load()).selectedExistingId,id(20));
});
test('failure to persist the selected-person journal prevents navigation success',async()=>{
 const e=environment({identity:identityGate()});await e.workflow.load();e.deps.storage.setItem=async()=>{throw Error('disk');};
 assert.equal((await e.workflow.openExisting(id(20),snapshot())).ok,false);assert.equal(e.calls.some(call=>call[0]==='remote'),false);
});
test('a native-bound lead cannot be replaced by another selected record',async()=>{
 let selected=0;const e=environment({identity:identityGate({permits:()=>true,selectExisting:async()=>{selected++;throw Error('must not be reached');}})});
 await e.workflow.load();await e.workflow.save(snapshot());assert.equal((await e.workflow.openExisting(id(20),snapshot())).ok,false);assert.equal(selected,0);
});
test('an unknown native insert cannot be escaped by selecting another existing person',async()=>{
 const e=environment({identity:identityGate({permits:()=>true}),saveRemote:async(_form,options)=>{await options.beforeWrite();return{ok:false,error:'lost'};}});
 await e.workflow.load();await e.workflow.save(snapshot());const original=e.journal().clientId;
 assert.equal((await e.workflow.openExisting(id(20),snapshot())).ok,false);assert.equal(e.journal().clientId,original);assert.equal(e.journal().stage,'draft-dispatched');
});
