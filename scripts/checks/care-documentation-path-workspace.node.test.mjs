import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyCareDocumentationPathCommand,
  assertCareDocumentationPathSelectionCurrent,
  careDocumentationPathDefinitions,
  careDocumentationPathKinds,
  careDocumentationPathVersion,
  decodeCareDocumentationPathContext,
  decodeCareDocumentationPathHistory,
  decodeCareDocumentationPathReceipt,
  emptyCareDocumentationPathState,
  validateCareDocumentationPathCommand,
} from '../../src/lib/pflege/careDocumentationPathWorkspaceDomain.web.ts';
import { buildCareDocumentationPathCommand } from '../../src/lib/pflege/careDocumentationPathWorkspaceForm.web.ts';
import { careDocumentationPathDraftKey, restoreCareDocumentationPathDraft, saveCareDocumentationPathDraft } from '../../src/lib/pflege/careDocumentationPathWorkspaceDraft.web.ts';
import { CareDocumentationPathWorkflow } from '../../src/lib/pflege/careDocumentationPathWorkspaceWorkflow.web.ts';
import { createCareDocumentationPathRepository } from '../../src/lib/pflege/careDocumentationPathWorkspaceRepository.web.ts';

const proof='sha256:'+'a'.repeat(64);
const ids = {
  tenant: '34200000-0000-4000-8000-000000000001',
  client: '34200000-0000-4000-8000-000000000002',
  actor: '34200000-0000-4000-8000-000000000003',
};
let serial = 100;
const next = () => `34200000-0000-4000-8000-${String(++serial).padStart(12, '0')}`;
const source = kind => {
  const id = kind==='client_record'?ids.client:next();
  return { kind, id, snapshot: { id, tenant_id: ids.tenant, client_id: ids.client, title: kind, status: 'current' } };
};
const value = rule => rule.type === 'uuid' ? next()
  : rule.type === 'instant' ? (['validUntil', 'endsAt'].includes(rule.key) ? '2026-11-16T16:30:00.123456+02:00' : '2026-10-16T16:30:00.123456+02:00')
  : rule.type === 'sha256' ? 'c'.repeat(64)
  : rule.type === 'enum' ? rule.values[0]
  : 'vollständiger Originalwert';
const command = (kind, over = {}) => {
  const definition = careDocumentationPathDefinitions[kind], payload = {};
  for (const rule of definition.sources) { payload[rule.key] = source(rule.kinds[0]); if(rule.eventKinds)payload[rule.key].snapshot.command={kind:rule.eventKinds[0]}; }
  for (const rule of definition.fields) payload[rule.key] = value(rule);
  return {
    version: careDocumentationPathVersion, requestId: next(), eventId: next(), tenantId: ids.tenant, clientId: ids.client,
    actorId: ids.actor, expectedHeadId: null, kind, occurredAt: '2026-10-16T16:00:00.654321+02:00',
    note: 'Nachvollziehbarer fallbezogener Anlass', payload, ...over,
  };
};
const eventOf = c => ({ id: c.eventId, sequence: 1, previousId: null, tenantId: ids.tenant, clientId: ids.client, actorId: ids.actor, actorName: 'Fachkraft', recordedAt: c.occurredAt, command: c });

for (const kind of careDocumentationPathKinds) test(`gültiger Dokumentationspfadvorgang ${kind}`, () => assert.doesNotThrow(() => validateCareDocumentationPathCommand(command(kind))));

test('E-01 bis E-10 bilden acht Bediengruppen plus Berichtigung', () => {
  assert.equal(careDocumentationPathKinds.length, 18);
  assert.deepEqual([...new Set(careDocumentationPathKinds.map(kind => careDocumentationPathDefinitions[kind].group))], ['Pflegebericht','Leistungsdokumentation','Ablehnung & Vorkommnis','Protokolle','Bestätigung & Verlauf','Kontrollprotokoll','Fremddokumentation','Fachprüfung','Berichtigung']);
});

test('Beobachtung, Planung, Durchführung, Bestätigung, Kontrolle und Fachentscheidung bleiben getrennt', () => {
  for (const kind of ['care_report','planned_service_record','partial_service_record','non_service_record','refusal_record','incident_report','content_confirmation','control_order','control_result','documentation_review_request','documentation_review_decision']) assert.ok(careDocumentationPathKinds.includes(kind));
  assert.notDeepEqual(careDocumentationPathDefinitions.planned_service_record.sources,careDocumentationPathDefinitions.partial_service_record.sources);
  assert.notDeepEqual(careDocumentationPathDefinitions.care_report.sources,careDocumentationPathDefinitions.content_confirmation.sources);
  assert.notDeepEqual(careDocumentationPathDefinitions.control_result.sources,careDocumentationPathDefinitions.documentation_review_decision.sources);
});

test('Originalart, Fremdfeld, Fremdmandant, Fremdpflegefall, UUID, SHA und Mikrosekunden sperren', () => {
  const wrong=command('care_report');wrong.payload.client=source('external_document');assert.throws(()=>validateCareDocumentationPathCommand(wrong),/falsche Originalart/);
  const wrongEvent=command('planned_service_record');wrongEvent.payload.plan.snapshot.command.kind='measure_plan';assert.throws(()=>validateCareDocumentationPathCommand(wrongEvent),/falsche fachliche Vorgangsart/);
  const extra=command('partial_service_record');extra.payload.secret='x';assert.throws(()=>validateCareDocumentationPathCommand(extra),/Fremdfelder/);
  const foreignTenant=command('refusal_record');foreignTenant.payload.measure.snapshot.tenant_id=next();assert.throws(()=>validateCareDocumentationPathCommand(foreignTenant),/aktuellen Mandanten/);
  const foreignClient=command('control_result');foreignClient.payload.order.snapshot.client_id=next();assert.throws(()=>validateCareDocumentationPathCommand(foreignClient),/aktuellen Pflegefall/);
  const time=command('external_document_review');time.occurredAt='2026-10-16T16:00:00';assert.throws(()=>validateCareDocumentationPathCommand(time),/ungültig/);
  const hash=command('documentation_review_request');hash.payload.packetSha256='nicht';assert.throws(()=>validateCareDocumentationPathCommand(hash),/ungültig/);
});


test('CAS, doppelte Anfrage und append-only Berichtigung sperren', () => {
  const original = command('care_report'), event = eventOf(original);
  const state = { headId: original.eventId, events: [event], corrected: [] };
  assert.throws(() => applyCareDocumentationPathCommand(state, command('protocol_record')), /zwischenzeitlich/);
  const correction = command('correction', { expectedHeadId: original.eventId }); correction.payload.targetId = original.eventId;
  const corrected = applyCareDocumentationPathCommand(state, correction);
  assert.deepEqual(corrected.corrected, [original.eventId]);
  const duplicate = command('correction', { expectedHeadId: original.eventId, requestId: original.requestId }); duplicate.payload.targetId = original.eventId;
  assert.throws(() => applyCareDocumentationPathCommand(state, duplicate), /bereits/);
});

function historyOf(commands) {
  let previous = null;
  return { version: careDocumentationPathVersion, tenantId: ids.tenant, clientId: ids.client, count: commands.length, headId: commands.at(-1)?.eventId ?? null,
    events: commands.map((c, index) => { c.expectedHeadId = previous; const event = { id: c.eventId, sequence: index + 1, previousId: previous, tenantId: ids.tenant, clientId: ids.client, actorId: ids.actor, actorName: 'Fachkraft', recordedAt: c.occurredAt, command: structuredClone(c) }; previous = c.eventId; return event; }) };
}

test('vollständiger Verlauf, Fallbindung und aktuelle Originalauswahl werden tief geprüft', () => {
  const commands = [command('care_report'), command('documentation_review_request')], history = historyOf(commands);
  const sources = structuredClone(commands.flatMap(c => careDocumentationPathDefinitions[c.kind].sources.map(rule => c.payload[rule.key])));
  const context = { version: careDocumentationPathVersion, tenantId: ids.tenant, clientId: ids.client, actorId: ids.actor, loadedAt: '2026-10-16T16:01:00.123456Z', sources: { count: sources.length, rows: sources, stateFingerprint:proof }, history };
  assert.equal(decodeCareDocumentationPathHistory(history, context).state.headId, commands[1].eventId);
  assert.equal(decodeCareDocumentationPathContext(context, context).sources.count, sources.length);
  assert.doesNotThrow(() => assertCareDocumentationPathSelectionCurrent(commands[0], context));
  context.sources.rows[0].snapshot.status = 'changed';
  assert.throws(() => assertCareDocumentationPathSelectionCurrent(commands[0], context), /nicht mehr aktuell/);
  assert.throws(() => decodeCareDocumentationPathContext({ ...context, clientId: next() }, context), /originale/i);
});

test('Quittung bindet exakt dieselbe fallbezogene Anfrage', () => {
  const c = command('documentation_review_decision'), event = eventOf(c);
  const receipt = { version: careDocumentationPathVersion, requestId: c.requestId, command: c, event };
  assert.doesNotThrow(() => decodeCareDocumentationPathReceipt(receipt, c));
  assert.throws(() => decodeCareDocumentationPathReceipt({ ...receipt, event: { ...event, id: next() } }, c), /quittung/i);
});

const memory = () => { const values = new Map(); return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) }; };

test('Entwurf bleibt konto-, mandanten- und fallgebunden und verwirft veraltete Auswahl', () => {
  const store = memory(), kind = 'content_confirmation', definition = careDocumentationPathDefinitions[kind];
  const selected = Object.fromEntries(definition.sources.map(rule => { const v = source(rule.kinds[0]); if(rule.eventKinds)v.snapshot.command={kind:rule.eventKinds[0]}; return [rule.key, { id: v.id, value: v }]; }));
  const draft = { version: careDocumentationPathVersion, scope: { tenantId: ids.tenant, clientId: ids.client, actorId: ids.actor }, headId: null, kind, occurredAt: '2026-10-16T16:00:00Z', note: 'Entwurf', values: {}, selected };
  saveCareDocumentationPathDraft(store, draft);
  assert.match(careDocumentationPathDraftKey(draft.scope), new RegExp(ids.client));
  assert.equal(restoreCareDocumentationPathDraft(store, draft.scope, null, () => true).changed, false);
  assert.deepEqual(restoreCareDocumentationPathDraft(store, draft.scope, next(), () => false).draft.selected, {});
});

test('Formular baut nur einen validierten fallbezogenen Befehl', () => {
  const kind = 'documentation_review_decision', definition = careDocumentationPathDefinitions[kind];
  const draft = { version: careDocumentationPathVersion, scope: { tenantId: ids.tenant, clientId: ids.client, actorId: ids.actor }, headId: null, kind, occurredAt: '2026-10-16T16:00:00Z', note: 'Gate',
    values: Object.fromEntries(definition.fields.map(rule => [rule.key, value(rule)])),
    selected: Object.fromEntries(definition.sources.map(rule => { const v = source(rule.kinds[0]); if(rule.eventKinds)v.snapshot.command={kind:rule.eventKinds[0]}; return [rule.key, { id: v.id, value: v }]; })) };
  assert.equal(buildCareDocumentationPathCommand(draft, emptyCareDocumentationPathState(), next(), next()).clientId, ids.client);
});

test('unklarer Ausgang wird ausschließlich lesend wiederaufgenommen', async () => {
  const store = memory(), c = command('planned_service_record'); let commits = 0, confirms = 0;
  const workflow = new CareDocumentationPathWorkflow({ tenantId: ids.tenant, clientId: ids.client, actorId: ids.actor }, {
    storage: store, lock: async (_, action) => action(), isCurrent: () => true,
    commit: async () => { commits++; return { ok: false, uncertain: true, error: 'Antwort verloren' }; },
    confirm: async () => { confirms++; const event = eventOf(c); return { ok: true, data: { version: careDocumentationPathVersion, requestId: c.requestId, command: c, event } }; },
  });
  assert.equal((await workflow.dispatch(c)).ok, false);
  assert.equal(workflow.read().phase, 'dispatched');
  assert.equal((await workflow.confirm()).ok, true);
  assert.deepEqual([commits, confirms], [1, 1]);
});

function repositoryHarness(reply) {
  const calls = [], sdk = { auth: {
    getSession: async () => ({ error: null, data: { session: { user: { id: '34200000-0000-4000-8000-000000000004' }, access_token: 'token', expires_at: 4102444800 } } }),
    getUser: async () => ({ error: null, data: { user: { id: '34200000-0000-4000-8000-000000000004' } } }),
  }, rpc: (name, args) => { calls.push({ name, args }); return Promise.resolve(name==='resolve_current_profile_id'?{data:ids.actor,error:null}:name==='current_tenant_id'?{data:ids.tenant,error:null}:reply(name, args)); } };
  let current = true;
  const repository = createCareDocumentationPathRepository({ getSdk: () => sdk, query: request => Promise.resolve(request) });
  const authority = { tenantId: ids.tenant, clientId: ids.client, actorId: ids.actor, accessToken: 'token', expiresAt: 4102444800000, isCurrent: () => current };
  return { calls, repository, authority, expire: () => { current = false; } };
}

test('Repository liest gemappten eigenen Kontext und sendet gesperrte Pfadschritte nicht', async () => {
  const c = command('documentation_review_decision'), event = eventOf(c), receipt = { version: careDocumentationPathVersion, requestId: c.requestId, command: c, event };
  const context = { version: careDocumentationPathVersion, tenantId: ids.tenant, clientId: ids.client, actorId: ids.actor, loadedAt: c.occurredAt, sources: { count: 0, rows: [], stateFingerprint:proof }, history: historyOf([]) };
  const h = repositoryHarness(name => name === 'web_care_documentation_path_workspace_context' ? { error: null, data: context } : { error: null, data: receipt });
  assert.equal((await h.repository.context(h.authority)).ok, true);
  assert.equal((await h.repository.commit(h.authority, c)).rejected, true);
  assert.equal((await h.repository.confirm(h.authority, c)).uncertain, true);
  assert.deepEqual(h.calls.filter(x=>x.name.startsWith('web_')).map(x => x.name), ['web_care_documentation_path_workspace_context']);
  assert.deepEqual(h.calls.find(x=>x.name==='web_care_documentation_path_workspace_context').args, { p_tenant_id: ids.tenant, p_client_id: ids.client, p_actor_id: ids.actor });
});

test('Repository hält fehlende Fachbelege lokal gesperrt und verwirft Rechtewechsel', async () => {
  const c = command('care_report'), rejected = repositoryHarness(() => ({ error: { code: '23514' }, data: null })), unknown = repositoryHarness(() => ({ error: { code: '08006' }, data: null }));
  assert.equal((await rejected.repository.commit(rejected.authority, c)).rejected, true);
  assert.equal((await unknown.repository.commit(unknown.authority, c)).rejected, true);
  assert.equal((await unknown.repository.confirm(unknown.authority,c)).uncertain,true);
  rejected.expire();
  assert.equal((await rejected.repository.context(rejected.authority)).ok, false);
  assert.equal(rejected.calls.length, 0);
  assert.equal(unknown.calls.length, 0);
});

const completeContext=()=>({version:careDocumentationPathVersion,tenantId:ids.tenant,clientId:ids.client,actorId:ids.actor,loadedAt:'2026-10-16T16:01:00.123456Z',sources:{count:0,rows:[],stateFingerprint:proof},history:historyOf([])});
for(const [name,mutate] of [
 ['missing ledger proof',c=>{delete c.sources.stateFingerprint;}],
 ['malformed ledger proof',c=>{c.sources.stateFingerprint='unknown';}],
 ['unknown source envelope field',c=>{c.sources.hidden='unproved';}],
 ['unknown history field',c=>{c.history.hidden='unproved';}],
 ['foreign camel-case native tenant',c=>{const s=source('care_documentation');delete s.snapshot.tenant_id;s.snapshot.tenantId=next();c.sources={count:1,rows:[s],stateFingerprint:proof};}],
 ['foreign camel-case native client',c=>{const s=source('care_documentation');delete s.snapshot.client_id;s.snapshot.clientId=next();c.sources={count:1,rows:[s],stateFingerprint:proof};}],
 ['missing native tenant/client scope',c=>{const s=source('care_documentation');delete s.snapshot.tenant_id;delete s.snapshot.client_id;c.sources={count:1,rows:[s],stateFingerprint:proof};}],
 ['another client-record identity',c=>{const s=source('client_record');s.id=next();s.snapshot.id=s.id;c.sources={count:1,rows:[s],stateFingerprint:proof};}],
 ['invalid actual calendar date',c=>{c.loadedAt='2026-02-29T16:01:00.123456Z';}],
])test('native path context rejects '+name,()=>{const c=completeContext();assert.doesNotThrow(()=>decodeCareDocumentationPathContext(c,c));mutate(c);assert.throws(()=>decodeCareDocumentationPathContext(c,{tenantId:ids.tenant,clientId:ids.client,actorId:ids.actor}));});

for(const [name,mutate] of [
 ['event actor differs from retained command',h=>{h.events[0].actorId=next();}],
 ['event author name missing',h=>{h.events[0].actorName='';}],
 ['recorded before actual occurrence by one microsecond',h=>{h.events[0].recordedAt='2026-10-16T16:00:00.654320+02:00';}],
 ['unknown historical event field',h=>{h.events[0].hidden='unproved';}],
 ['unknown retained command field',h=>{h.events[0].command.hidden='unproved';}],
])test('complete path history rejects '+name,()=>{const h=historyOf([command('care_report')]);assert.doesNotThrow(()=>decodeCareDocumentationPathHistory(h,idsScope()));mutate(h);assert.throws(()=>decodeCareDocumentationPathHistory(h,idsScope()));});
function idsScope(){return{tenantId:ids.tenant,clientId:ids.client,actorId:ids.actor};}

for(const target of ['context','history','command','source'])test('path '+target+' descriptors are checked without invoking native getters',()=>{
 let invoked=0;const c=command('control_order'),h=historyOf([c]),context={...completeContext(),history:h};
 if(target==='context')Object.defineProperty(context,'tenantId',{enumerable:true,get(){invoked++;return ids.tenant;}});
 if(target==='history')Object.defineProperty(h.events[0],'actorId',{enumerable:true,get(){invoked++;return ids.actor;}});
 if(target==='command')Object.defineProperty(c,'actorId',{enumerable:true,get(){invoked++;return ids.actor;}});
 if(target==='source')Object.defineProperty(c.payload.basis.snapshot,'tenant_id',{enumerable:true,get(){invoked++;return ids.tenant;}});
 assert.throws(()=>target==='context'?decodeCareDocumentationPathContext(context,idsScope()):target==='history'?decodeCareDocumentationPathHistory(h,idsScope()):validateCareDocumentationPathCommand(c));assert.equal(invoked,0);
});

function mappedRepository(hook=()=>{}){
 const state={account:'34200000-0000-4000-8000-000000000004',profile:ids.actor,tenant:ids.tenant,token:'original-token',expires:4102444800,current:true,getterCalls:0,clinical:0};
 const sdk={auth:{getSession:async()=>({error:null,data:{session:{user:{id:state.account},access_token:state.token,expires_at:state.expires}}}),getUser:async()=>({error:null,data:{user:{id:state.account}}})},rpc:async(name)=>{
  if(name==='resolve_current_profile_id')return{error:null,data:state.profile};if(name==='current_tenant_id')return{error:null,data:state.tenant};
  state.clinical++;const response={error:null,data:completeContext(),status:200};hook(state,response);return response;
 }};state.sdk=sdk;
 const authority={...idsScope(),accessToken:'original-token',expiresAt:4102444800000,isCurrent:()=>state.current};
 return{state,authority,repository:createCareDocumentationPathRepository({getSdk:()=>state.sdk,query:p=>Promise.resolve(p)})};
}
for(const [name,change] of [
 ['raw account',s=>{s.account=next();}],['profile',s=>{s.profile=next();}],['tenant',s=>{s.tenant=next();}],
 ['token',s=>{s.token+=' changed';}],['expiry',s=>{s.expires++;}],['current owner',s=>{s.current=false;}],['SDK',s=>{s.sdk={...s.sdk};}],
])test('path publication rejects '+name+' replacement after actual context await',async()=>{const h=mappedRepository(change);assert.equal((await h.repository.context(h.authority)).ok,false);assert.equal(h.state.clinical,1);});
for(const field of ['data','error','status'])test('whole path SDK response rejects '+field+' getter without invoking it',async()=>{const h=mappedRepository((state,response)=>{const retained=response[field];Object.defineProperty(response,field,{enumerable:true,get(){state.getterCalls++;return retained;}});});assert.equal((await h.repository.context(h.authority)).ok,false);assert.equal(h.state.getterCalls,0);});
test('unknown expected path session expiry does not invent a live authority',async()=>{const h=mappedRepository();h.authority.expiresAt=null;assert.equal((await h.repository.context(h.authority)).ok,false);assert.equal(h.state.clinical,0);});
test('uppercase UUID variants cannot bypass path event/request identity validation',()=>{const c=command('care_report');c.eventId='ABCDEF12-3456-4789-8ABC-ABCDEF123456';assert.throws(()=>validateCareDocumentationPathCommand(c));c.eventId='abcdef12-3456-4789-8abc-abcdef123456';c.requestId=c.eventId.toUpperCase();assert.throws(()=>validateCareDocumentationPathCommand(c));});
test('uppercase native-source UUID variants cannot bypass exact path source identity validation',()=>{const context=completeContext(),id='abcdef12-3456-4789-8abc-abcdef123456';context.sources.rows=[{kind:'care_documentation',id,snapshot:{id,tenant_id:ids.tenant,client_id:ids.client}},{kind:'care_documentation',id:id.toUpperCase(),snapshot:{id:id.toUpperCase(),tenant_id:ids.tenant,client_id:ids.client}}];context.sources.count=2;assert.throws(()=>decodeCareDocumentationPathContext(context,idsScope()));});
test('retained path source must equal the complete actual event rather than detached display metadata',()=>{const history=historyOf([command('care_report')]),event=history.events[0],context={...completeContext(),history,sources:{count:1,rows:[{kind:'care_documentation_path_event',id:event.id,snapshot:{...structuredClone(event),client_id:ids.client}}],stateFingerprint:proof}};assert.doesNotThrow(()=>decodeCareDocumentationPathContext(context,idsScope()));context.sources.rows[0].snapshot.actorName='Changed retained author';assert.throws(()=>decodeCareDocumentationPathContext(context,idsScope()));});

