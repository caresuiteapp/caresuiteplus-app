import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAssessmentPathCommand,
  assertAssessmentPathSelectionCurrent,
  assessmentPathDefinitions,
  assessmentPathKinds,
  assessmentPathVersion,
  decodeAssessmentPathContext,
  decodeAssessmentPathHistory,
  decodeAssessmentPathReceipt,
  emptyAssessmentPathState,
  validateAssessmentPathCommand,
} from '../../src/lib/careAssessment/assessmentPathWorkspaceDomain.web.ts';
import { buildAssessmentPathCommand } from '../../src/lib/careAssessment/assessmentPathWorkspaceForm.web.ts';
import { assessmentPathDraftKey, restoreAssessmentPathDraft, saveAssessmentPathDraft } from '../../src/lib/careAssessment/assessmentPathWorkspaceDraft.web.ts';
import { AssessmentPathWorkflow } from '../../src/lib/careAssessment/assessmentPathWorkspaceWorkflow.web.ts';
import { createAssessmentPathRepository } from '../../src/lib/careAssessment/assessmentPathWorkspaceRepository.web.ts';

const ids = {
  tenant: '34000000-0000-4000-8000-000000000001',
  assessment: '34000000-0000-4000-8000-000000000002',
  actor: '34000000-0000-4000-8000-000000000003',
};
let serial = 100;
const next = () => `34000000-0000-4000-8000-${String(++serial).padStart(12, '0')}`;
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
  const definition = assessmentPathDefinitions[kind], payload = {};
  for (const rule of definition.sources) payload[rule.key] = source(rule.kinds[0]);
  for (const rule of definition.fields) payload[rule.key] = value(rule);
  return {
    version: assessmentPathVersion, requestId: next(), eventId: next(), tenantId: ids.tenant, assessmentId: ids.assessment,
    actorId: ids.actor, expectedHeadId: null, kind, occurredAt: '2026-10-16T16:00:00.654321+02:00',
    note: 'Nachvollziehbarer fallbezogener Anlass', payload, ...over,
  };
};
const eventOf = c => ({ id: c.eventId, sequence: 1, previousId: null, tenantId: ids.tenant, assessmentId: ids.assessment, actorId: ids.actor, actorName: 'Fachkraft', recordedAt: c.occurredAt, command: c });

for (const kind of assessmentPathKinds) test(`gültiger Assessmentpfadvorgang ${kind}`, () => assert.doesNotThrow(() => validateAssessmentPathCommand(command(kind))));

test('C-01 bis C-10 bilden sieben Bediengruppen plus Berichtigung', () => {
  assert.equal(assessmentPathKinds.length, 20);
  assert.deepEqual([...new Set(assessmentPathKinds.map(kind => assessmentPathDefinitions[kind].group))], ['Modell & Originale','Person & Themenfelder','Risiken & Instrumente','Planung','Durchführung','Wirkung & Prüfung','Wiederholung','Berichtigung']);
});

test('Beobachtung, Einschätzung, Planung, Durchführung, Wirkung und Freigabe bleiben getrennt', () => {
  for (const kind of ['person_perspective_observation','cognition_assessment','risk_screening','measure_plan_revision','execution_observation','effect_evaluation','review_request','release_decision','reassessment_start']) assert.ok(assessmentPathKinds.includes(kind));
  assert.notDeepEqual(assessmentPathDefinitions.execution_observation.sources,assessmentPathDefinitions.effect_evaluation.sources);
  assert.notDeepEqual(assessmentPathDefinitions.review_request.sources,assessmentPathDefinitions.release_decision.sources);
});

test('Originalart, Fremdfeld, Fremdmandant, Fremdassessment, UUID, SHA und Mikrosekunden sperren', () => {
  const wrong=command('cognition_assessment');wrong.payload.topic=source('assessment_instrument');assert.throws(()=>validateAssessmentPathCommand(wrong),/falsche Originalart/);
  const extra=command('disease_demands_assessment');extra.payload.secret='x';assert.throws(()=>validateAssessmentPathCommand(extra),/Fremdfelder/);
  const foreignTenant=command('measure_plan_revision');foreignTenant.payload.measure.snapshot.tenant_id=next();assert.throws(()=>validateAssessmentPathCommand(foreignTenant),/aktuellen Mandanten/);
  const foreignAssessment=command('person_perspective_observation');foreignAssessment.payload.statement.snapshot.assessment_id=next();assert.throws(()=>validateAssessmentPathCommand(foreignAssessment),/aktuellen Assessment/);
  const time=command('reassessment_trigger');time.occurredAt='2026-10-16T16:00:00';assert.throws(()=>validateAssessmentPathCommand(time),/ungültig/);
  const hash=command('model_version_review');hash.payload.termsSha256='nicht';assert.throws(()=>validateAssessmentPathCommand(hash),/ungültig/);
});


test('CAS, doppelte Anfrage und append-only Berichtigung sperren', () => {
  const original = command('measure_plan_revision'), event = eventOf(original);
  const state = { headId: original.eventId, events: [event], corrected: [] };
  assert.throws(() => applyAssessmentPathCommand(state, command('mobility_assessment')), /zwischenzeitlich/);
  const correction = command('correction', { expectedHeadId: original.eventId }); correction.payload.targetId = original.eventId;
  const corrected = applyAssessmentPathCommand(state, correction);
  assert.deepEqual(corrected.corrected, [original.eventId]);
  const duplicate = command('correction', { expectedHeadId: original.eventId, requestId: original.requestId }); duplicate.payload.targetId = original.eventId;
  assert.throws(() => applyAssessmentPathCommand(state, duplicate), /bereits/);
});

function historyOf(commands) {
  let previous = null;
  return { version: assessmentPathVersion, tenantId: ids.tenant, assessmentId: ids.assessment, count: commands.length, headId: commands.at(-1)?.eventId ?? null,
    events: commands.map((c, index) => { c.expectedHeadId = previous; const event = { id: c.eventId, sequence: index + 1, previousId: previous, tenantId: ids.tenant, assessmentId: ids.assessment, actorId: ids.actor, actorName: 'Fachkraft', recordedAt: c.occurredAt, command: structuredClone(c) }; previous = c.eventId; return event; }) };
}

test('vollständiger Verlauf, Fallbindung und aktuelle Originalauswahl werden tief geprüft', () => {
  const commands = [command('risk_screening'), command('review_request')], history = historyOf(commands);
  const sources = structuredClone(commands.flatMap(c => assessmentPathDefinitions[c.kind].sources.map(rule => c.payload[rule.key])));
  const context = { version: assessmentPathVersion, tenantId: ids.tenant, assessmentId: ids.assessment, actorId: ids.actor, loadedAt: '2026-10-16T16:01:00.123456Z', sources: { count: sources.length, rows: sources }, history };
  assert.equal(decodeAssessmentPathHistory(history, context).state.headId, commands[1].eventId);
  assert.equal(decodeAssessmentPathContext(context, context).sources.count, sources.length);
  assert.doesNotThrow(() => assertAssessmentPathSelectionCurrent(commands[0], context));
  context.sources.rows[0].snapshot.status = 'changed';
  assert.throws(() => assertAssessmentPathSelectionCurrent(commands[0], context), /nicht mehr aktuell/);
  assert.throws(() => decodeAssessmentPathContext({ ...context, assessmentId: next() }, context), /originale/i);
});

test('Quittung bindet exakt dieselbe fallbezogene Anfrage', () => {
  const c = command('release_decision'), event = eventOf(c);
  const receipt = { version: assessmentPathVersion, requestId: c.requestId, command: c, event };
  assert.doesNotThrow(() => decodeAssessmentPathReceipt(receipt, c));
  assert.throws(() => decodeAssessmentPathReceipt({ ...receipt, event: { ...event, id: next() } }, c), /quittung/i);
});

const memory = () => { const values = new Map(); return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) }; };

test('Entwurf bleibt konto-, mandanten- und fallgebunden und verwirft veraltete Auswahl', () => {
  const store = memory(), kind = 'instrument_selection', definition = assessmentPathDefinitions[kind];
  const selected = Object.fromEntries(definition.sources.map(rule => { const v = source(rule.kinds[0]); return [rule.key, { id: v.id, value: v }]; }));
  const draft = { version: assessmentPathVersion, scope: { tenantId: ids.tenant, assessmentId: ids.assessment, actorId: ids.actor }, headId: null, kind, occurredAt: '2026-10-16T16:00:00Z', note: 'Entwurf', values: {}, selected };
  saveAssessmentPathDraft(store, draft);
  assert.match(assessmentPathDraftKey(draft.scope), new RegExp(ids.assessment));
  assert.equal(restoreAssessmentPathDraft(store, draft.scope, null, () => true).changed, false);
  assert.deepEqual(restoreAssessmentPathDraft(store, draft.scope, next(), () => false).draft.selected, {});
});

test('Formular baut nur einen validierten fallbezogenen Befehl', () => {
  const kind = 'release_decision', definition = assessmentPathDefinitions[kind];
  const draft = { version: assessmentPathVersion, scope: { tenantId: ids.tenant, assessmentId: ids.assessment, actorId: ids.actor }, headId: null, kind, occurredAt: '2026-10-16T16:00:00Z', note: 'Gate',
    values: Object.fromEntries(definition.fields.map(rule => [rule.key, value(rule)])),
    selected: Object.fromEntries(definition.sources.map(rule => { const v = source(rule.kinds[0]); return [rule.key, { id: v.id, value: v }]; })) };
  assert.equal(buildAssessmentPathCommand(draft, emptyAssessmentPathState(), next(), next()).assessmentId, ids.assessment);
});

test('unklarer Ausgang wird ausschließlich lesend wiederaufgenommen', async () => {
  const store = memory(), c = command('execution_observation'); let commits = 0, confirms = 0;
  const workflow = new AssessmentPathWorkflow({ tenantId: ids.tenant, assessmentId: ids.assessment, actorId: ids.actor }, {
    storage: store, lock: async (_, action) => action(), isCurrent: () => true,
    commit: async () => { commits++; return { ok: false, uncertain: true, error: 'Antwort verloren' }; },
    confirm: async () => { confirms++; const event = eventOf(c); return { ok: true, data: { version: assessmentPathVersion, requestId: c.requestId, command: c, event } }; },
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
  const repository = createAssessmentPathRepository({ getSdk: () => sdk, query: request => Promise.resolve(request) });
  const authority = { tenantId: ids.tenant, assessmentId: ids.assessment, actorId: ids.actor, accessToken: 'token', expiresAt: 4102444800000, isCurrent: () => current };
  return { calls, repository, authority, expire: () => { current = false; } };
}

test('Repository bindet Kontext, Commit und Quittungslesen an denselben Fall', async () => {
  const c = command('release_decision'), event = eventOf(c), receipt = { version: assessmentPathVersion, requestId: c.requestId, command: c, event };
  const context = { version: assessmentPathVersion, tenantId: ids.tenant, assessmentId: ids.assessment, actorId: ids.actor, loadedAt: c.occurredAt, sources: { count: 0, rows: [] }, history: historyOf([]) };
  const h = repositoryHarness(name => name === 'web_assessment_path_workspace_context' ? { error: null, data: context } : { error: null, data: receipt });
  assert.equal((await h.repository.context(h.authority)).ok, true);
  assert.equal((await h.repository.commit(h.authority, c)).ok, true);
  assert.equal((await h.repository.confirm(h.authority, c)).ok, true);
  assert.deepEqual(h.calls.map(x => x.name), ['web_assessment_path_workspace_context', 'web_commit_assessment_path_event', 'web_confirm_assessment_path_event']);
  assert.deepEqual(h.calls[0].args, { p_tenant_id: ids.tenant, p_assessment_id: ids.assessment, p_actor_id: ids.actor });
});

test('Repository trennt bestätigten SQL-Abbruch, unklaren Ausgang und Rechtewechsel', async () => {
  const c = command('measure_plan_revision'), rejected = repositoryHarness(() => ({ error: { code: '23514' }, data: null })), unknown = repositoryHarness(() => ({ error: { code: '08006' }, data: null }));
  assert.equal((await rejected.repository.commit(rejected.authority, c)).rejected, true);
  assert.equal((await unknown.repository.commit(unknown.authority, c)).uncertain, true);
  rejected.expire();
  assert.equal((await rejected.repository.context(rejected.authority)).ok, false);
  assert.equal(rejected.calls.length, 1);
});

