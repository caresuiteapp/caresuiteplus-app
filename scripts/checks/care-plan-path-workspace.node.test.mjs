import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyCarePlanPathCommand,
  assertCarePlanPathSelectionCurrent,
  carePlanPathDefinitions,
  carePlanPathKinds,
  carePlanPathVersion,
  decodeCarePlanPathContext,
  decodeCarePlanPathHistory,
  decodeCarePlanPathReceipt,
  emptyCarePlanPathState,
  validateCarePlanPathCommand,
} from '../../src/lib/careAssessment/carePlanPathWorkspaceDomain.web.ts';
import { buildCarePlanPathCommand } from '../../src/lib/careAssessment/carePlanPathWorkspaceForm.web.ts';
import { carePlanPathDraftKey, restoreCarePlanPathDraft, saveCarePlanPathDraft } from '../../src/lib/careAssessment/carePlanPathWorkspaceDraft.web.ts';
import { CarePlanPathWorkflow } from '../../src/lib/careAssessment/carePlanPathWorkspaceWorkflow.web.ts';
import { createCarePlanPathRepository } from '../../src/lib/careAssessment/carePlanPathWorkspaceRepository.web.ts';

const ids = {
  tenant: '34100000-0000-4000-8000-000000000001',
  assessment: '34100000-0000-4000-8000-000000000002',
  actor: '34100000-0000-4000-8000-000000000003',
};
let serial = 100;
const next = () => `34100000-0000-4000-8000-${String(++serial).padStart(12, '0')}`;
const source = kind => {
  const id = next();
  return { kind, id, snapshot: { id, tenant_id: ids.tenant, assessment_id: ids.assessment, title: kind, status: 'current' } };
};
const value = rule => rule.type === 'uuid' ? next()
  : rule.type === 'instant' ? (['validUntil', 'endsAt'].includes(rule.key) ? '2026-11-16T16:30:00.123456+02:00' : '2026-10-16T16:30:00.123456+02:00')
  : rule.type === 'sha256' ? 'c'.repeat(64)
  : rule.type === 'enum' ? rule.values[0]
  : 'vollständiger Originalwert';
const command = (kind, over = {}) => {
  const definition = carePlanPathDefinitions[kind], payload = {};
  for (const rule of definition.sources) { payload[rule.key] = source(rule.kinds[0]); if(rule.eventKinds)payload[rule.key].snapshot.command={kind:rule.eventKinds[0]}; }
  for (const rule of definition.fields) payload[rule.key] = value(rule);
  return {
    version: carePlanPathVersion, requestId: next(), eventId: next(), tenantId: ids.tenant, assessmentId: ids.assessment,
    actorId: ids.actor, expectedHeadId: null, kind, occurredAt: '2026-10-16T16:00:00.654321+02:00',
    note: 'Nachvollziehbarer fallbezogener Anlass', payload, ...over,
  };
};
const eventOf = c => ({ id: c.eventId, sequence: 1, previousId: null, tenantId: ids.tenant, assessmentId: ids.assessment, actorId: ids.actor, actorName: 'Fachkraft', recordedAt: c.occurredAt, command: c });

for (const kind of carePlanPathKinds) test(`gültiger Pflegeplanpfadvorgang ${kind}`, () => assert.doesNotThrow(() => validateCarePlanPathCommand(command(kind))));

test('D-01 bis D-08 bilden sieben Bediengruppen plus Berichtigung', () => {
  assert.equal(carePlanPathKinds.length, 18);
  assert.deepEqual([...new Set(carePlanPathKinds.map(kind => carePlanPathDefinitions[kind].group))], ['Ziele & Maßnahmen','Ressourcen & Verantwortung','Fassung & Freigabe','Durchführung & Abweichung','Wirkung & Evaluation','Pflegevisite','Anpassung','Berichtigung']);
});

test('Assessment, Planung, Durchführung, Wirkung, Freigabe und Abnahme bleiben getrennt', () => {
  for (const kind of ['goal_plan','measure_plan','plan_review_request','plan_release_decision','execution_record','non_execution_record','deviation_assessment','effect_observation','regular_evaluation','visit_observation','visit_decision','change_order']) assert.ok(carePlanPathKinds.includes(kind));
  assert.notDeepEqual(carePlanPathDefinitions.execution_record.sources,carePlanPathDefinitions.effect_observation.sources);
  assert.notDeepEqual(carePlanPathDefinitions.plan_review_request.sources,carePlanPathDefinitions.plan_release_decision.sources);
  assert.notDeepEqual(carePlanPathDefinitions.visit_observation.sources,carePlanPathDefinitions.visit_decision.sources);
});

test('Originalart, Fremdfeld, Fremdmandant, Fremdassessment, UUID, SHA und Mikrosekunden sperren', () => {
  const wrong=command('goal_plan');wrong.payload.finding=source('assessment_instrument');assert.throws(()=>validateCarePlanPathCommand(wrong),/falsche Originalart/);
  const wrongEvent=command('execution_record');wrongEvent.payload.releasedPlan.snapshot.command.kind='goal_plan';assert.throws(()=>validateCarePlanPathCommand(wrongEvent),/falsche fachliche Vorgangsart/);
  const extra=command('measure_plan');extra.payload.secret='x';assert.throws(()=>validateCarePlanPathCommand(extra),/Fremdfelder/);
  const foreignTenant=command('responsibility_assignment');foreignTenant.payload.measure.snapshot.tenant_id=next();assert.throws(()=>validateCarePlanPathCommand(foreignTenant),/aktuellen Mandanten/);
  const foreignAssessment=command('daily_routine');foreignAssessment.payload.plan.snapshot.assessment_id=next();assert.throws(()=>validateCarePlanPathCommand(foreignAssessment),/aktuellen Assessment/);
  const time=command('change_order');time.occurredAt='2026-10-16T16:00:00';assert.throws(()=>validateCarePlanPathCommand(time),/ungültig/);
  const hash=command('plan_review_request');hash.payload.packetSha256='nicht';assert.throws(()=>validateCarePlanPathCommand(hash),/ungültig/);
});


test('CAS, doppelte Anfrage und append-only Berichtigung sperren', () => {
  const original = command('measure_plan'), event = eventOf(original);
  const state = { headId: original.eventId, events: [event], corrected: [] };
  assert.throws(() => applyCarePlanPathCommand(state, command('daily_routine')), /zwischenzeitlich/);
  const correction = command('correction', { expectedHeadId: original.eventId }); correction.payload.targetId = original.eventId;
  const corrected = applyCarePlanPathCommand(state, correction);
  assert.deepEqual(corrected.corrected, [original.eventId]);
  const duplicate = command('correction', { expectedHeadId: original.eventId, requestId: original.requestId }); duplicate.payload.targetId = original.eventId;
  assert.throws(() => applyCarePlanPathCommand(state, duplicate), /bereits/);
});

function historyOf(commands) {
  let previous = null;
  return { version: carePlanPathVersion, tenantId: ids.tenant, assessmentId: ids.assessment, count: commands.length, headId: commands.at(-1)?.eventId ?? null,
    events: commands.map((c, index) => { c.expectedHeadId = previous; const event = { id: c.eventId, sequence: index + 1, previousId: previous, tenantId: ids.tenant, assessmentId: ids.assessment, actorId: ids.actor, actorName: 'Fachkraft', recordedAt: c.occurredAt, command: structuredClone(c) }; previous = c.eventId; return event; }) };
}

test('vollständiger Verlauf, Fallbindung und aktuelle Originalauswahl werden tief geprüft', () => {
  const commands = [command('goal_plan'), command('plan_review_request')], history = historyOf(commands);
  const sources = structuredClone(commands.flatMap(c => carePlanPathDefinitions[c.kind].sources.map(rule => c.payload[rule.key])));
  const context = { version: carePlanPathVersion, tenantId: ids.tenant, assessmentId: ids.assessment, actorId: ids.actor, loadedAt: '2026-10-16T16:01:00.123456Z', sources: { count: sources.length, rows: sources }, history };
  assert.equal(decodeCarePlanPathHistory(history, context).state.headId, commands[1].eventId);
  assert.equal(decodeCarePlanPathContext(context, context).sources.count, sources.length);
  assert.doesNotThrow(() => assertCarePlanPathSelectionCurrent(commands[0], context));
  context.sources.rows[0].snapshot.status = 'changed';
  assert.throws(() => assertCarePlanPathSelectionCurrent(commands[0], context), /nicht mehr aktuell/);
  assert.throws(() => decodeCarePlanPathContext({ ...context, assessmentId: next() }, context), /originale/i);
});

test('Quittung bindet exakt dieselbe fallbezogene Anfrage', () => {
  const c = command('plan_release_decision'), event = eventOf(c);
  const receipt = { version: carePlanPathVersion, requestId: c.requestId, command: c, event };
  assert.doesNotThrow(() => decodeCarePlanPathReceipt(receipt, c));
  assert.throws(() => decodeCarePlanPathReceipt({ ...receipt, event: { ...event, id: next() } }, c), /quittung/i);
});

const memory = () => { const values = new Map(); return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) }; };

test('Entwurf bleibt konto-, mandanten- und fallgebunden und verwirft veraltete Auswahl', () => {
  const store = memory(), kind = 'responsibility_assignment', definition = carePlanPathDefinitions[kind];
  const selected = Object.fromEntries(definition.sources.map(rule => { const v = source(rule.kinds[0]); if(rule.eventKinds)v.snapshot.command={kind:rule.eventKinds[0]}; return [rule.key, { id: v.id, value: v }]; }));
  const draft = { version: carePlanPathVersion, scope: { tenantId: ids.tenant, assessmentId: ids.assessment, actorId: ids.actor }, headId: null, kind, occurredAt: '2026-10-16T16:00:00Z', note: 'Entwurf', values: {}, selected };
  saveCarePlanPathDraft(store, draft);
  assert.match(carePlanPathDraftKey(draft.scope), new RegExp(ids.assessment));
  assert.equal(restoreCarePlanPathDraft(store, draft.scope, null, () => true).changed, false);
  assert.deepEqual(restoreCarePlanPathDraft(store, draft.scope, next(), () => false).draft.selected, {});
});

test('Formular baut nur einen validierten fallbezogenen Befehl', () => {
  const kind = 'plan_release_decision', definition = carePlanPathDefinitions[kind];
  const draft = { version: carePlanPathVersion, scope: { tenantId: ids.tenant, assessmentId: ids.assessment, actorId: ids.actor }, headId: null, kind, occurredAt: '2026-10-16T16:00:00Z', note: 'Gate',
    values: Object.fromEntries(definition.fields.map(rule => [rule.key, value(rule)])),
    selected: Object.fromEntries(definition.sources.map(rule => { const v = source(rule.kinds[0]); if(rule.eventKinds)v.snapshot.command={kind:rule.eventKinds[0]}; return [rule.key, { id: v.id, value: v }]; })) };
  assert.equal(buildCarePlanPathCommand(draft, emptyCarePlanPathState(), next(), next()).assessmentId, ids.assessment);
});

test('unklarer Ausgang wird ausschließlich lesend wiederaufgenommen', async () => {
  const store = memory(), c = command('execution_record'); let commits = 0, confirms = 0;
  const workflow = new CarePlanPathWorkflow({ tenantId: ids.tenant, assessmentId: ids.assessment, actorId: ids.actor }, {
    storage: store, lock: async (_, action) => action(), isCurrent: () => true,
    commit: async () => { commits++; return { ok: false, uncertain: true, error: 'Antwort verloren' }; },
    confirm: async () => { confirms++; const event = eventOf(c); return { ok: true, data: { version: carePlanPathVersion, requestId: c.requestId, command: c, event } }; },
  });
  assert.equal((await workflow.dispatch(c)).ok, false);
  assert.equal(workflow.read().phase, 'dispatched');
  assert.equal((await workflow.confirm()).ok, true);
  assert.deepEqual([commits, confirms], [1, 1]);
});

function repositoryHarness(reply) {
  const calls = [], sdk = { auth: {
    getSession: async () => ({ error: null, data: { session: { user: { id: ids.actor }, access_token: 'token', expires_at: 4102444800 } } }),
    getUser: async () => ({ error: null, data: { user: { id: ids.actor } } }),
  }, rpc: (name, args) => { calls.push({ name, args }); return Promise.resolve(reply(name, args)); } };
  let current = true;
  const repository = createCarePlanPathRepository({ getSdk: () => sdk, query: request => Promise.resolve(request) });
  const authority = { tenantId: ids.tenant, assessmentId: ids.assessment, actorId: ids.actor, accessToken: 'token', expiresAt: 4102444800000, isCurrent: () => current };
  return { calls, repository, authority, expire: () => { current = false; } };
}

test('Repository bindet Kontext, Commit und Quittungslesen an denselben Fall', async () => {
  const c = command('plan_release_decision'), event = eventOf(c), receipt = { version: carePlanPathVersion, requestId: c.requestId, command: c, event };
  const context = { version: carePlanPathVersion, tenantId: ids.tenant, assessmentId: ids.assessment, actorId: ids.actor, loadedAt: c.occurredAt, sources: { count: 0, rows: [] }, history: historyOf([]) };
  const h = repositoryHarness(name => name === 'web_care_plan_path_workspace_context' ? { error: null, data: context } : { error: null, data: receipt });
  assert.equal((await h.repository.context(h.authority)).ok, true);
  assert.equal((await h.repository.commit(h.authority, c)).ok, true);
  assert.equal((await h.repository.confirm(h.authority, c)).ok, true);
  assert.deepEqual(h.calls.map(x => x.name), ['web_care_plan_path_workspace_context', 'web_commit_care_plan_path_event', 'web_confirm_care_plan_path_event']);
  assert.deepEqual(h.calls[0].args, { p_tenant_id: ids.tenant, p_assessment_id: ids.assessment, p_actor_id: ids.actor });
});

test('Repository trennt bestätigten SQL-Abbruch, unklaren Ausgang und Rechtewechsel', async () => {
  const c = command('measure_plan'), rejected = repositoryHarness(() => ({ error: { code: '23514' }, data: null })), unknown = repositoryHarness(() => ({ error: { code: '08006' }, data: null }));
  assert.equal((await rejected.repository.commit(rejected.authority, c)).rejected, true);
  assert.equal((await unknown.repository.commit(unknown.authority, c)).uncertain, true);
  rejected.expire();
  assert.equal((await rejected.repository.context(rejected.authority)).ok, false);
  assert.equal(rejected.calls.length, 1);
});

