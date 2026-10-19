import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyClientLifecycleCommand,
  assertClientLifecycleSelectionCurrent,
  clientLifecycleDefinitions,
  clientLifecycleKinds,
  clientLifecycleVersion,
  decodeClientLifecycleContext,
  decodeClientLifecycleHistory,
  decodeClientLifecycleReceipt,
  emptyClientLifecycleState,
  validateClientLifecycleCommand,
} from '../../src/lib/clients/clientLifecycleWorkspaceDomain.web.ts';
import { buildClientLifecycleCommand } from '../../src/lib/clients/clientLifecycleWorkspaceForm.web.ts';
import { clientLifecycleDraftKey, restoreClientLifecycleDraft, saveClientLifecycleDraft } from '../../src/lib/clients/clientLifecycleWorkspaceDraft.web.ts';
import { ClientLifecycleWorkflow } from '../../src/lib/clients/clientLifecycleWorkspaceWorkflow.web.ts';
import { createClientLifecycleRepository } from '../../src/lib/clients/clientLifecycleWorkspaceRepository.web.ts';

const ids = {
  tenant: '34000000-0000-4000-8000-000000000001',
  client: '34000000-0000-4000-8000-000000000002',
  actor: '34000000-0000-4000-8000-000000000003',
};
let serial = 100;
const next = () => `34000000-0000-4000-8000-${String(++serial).padStart(12, '0')}`;
const source = kind => {
  const id = next();
  return { kind, id, snapshot: { id, tenant_id: ids.tenant, client_id: ids.client, title: kind, status: 'current' } };
};
const value = rule => rule.type === 'uuid' ? next()
  : rule.type === 'instant' ? (['validUntil', 'endsAt'].includes(rule.key) ? '2026-11-16T16:30:00.123456+02:00' : '2026-10-16T16:30:00.123456+02:00')
  : rule.type === 'sha256' ? 'c'.repeat(64)
  : rule.type === 'enum' ? rule.values[0]
  : 'vollständiger Originalwert';
const command = (kind, over = {}) => {
  const definition = clientLifecycleDefinitions[kind], payload = {};
  for (const rule of definition.sources) payload[rule.key] = source(rule.kinds[0]);
  for (const rule of definition.fields) payload[rule.key] = value(rule);
  return {
    version: clientLifecycleVersion, requestId: next(), eventId: next(), tenantId: ids.tenant, clientId: ids.client,
    actorId: ids.actor, expectedHeadId: null, kind, occurredAt: '2026-10-16T16:00:00.654321+02:00',
    note: 'Nachvollziehbarer fallbezogener Anlass', payload, ...over,
  };
};
const eventOf = c => ({ id: c.eventId, sequence: 1, previousId: null, tenantId: ids.tenant, clientId: ids.client, actorId: ids.actor, actorName: 'Fachkraft', recordedAt: c.occurredAt, command: c });

for (const kind of clientLifecycleKinds) test(`gültiger Klientenvorgang ${kind}`, () => assert.doesNotThrow(() => validateClientLifecycleCommand(command(kind))));

test('A-10 und B-01 bis B-10 bilden sieben Bediengruppen plus Berichtigung', () => {
  assert.equal(clientLifecycleKinds.length, 21);
  assert.deepEqual([...new Set(clientLifecycleKinds.map(kind => clientLifecycleDefinitions[kind].group))],
    ['Funktionsinventar', 'Anfrage & Identität', 'Wohnen & Kontakte', 'Klinische Angaben', 'Dokumente', 'Notfall & Aufnahme', 'Unterbrechung & Austritt', 'Berichtigung']);
});

test('Anfrage, Identität, klinische Quelle, Dokumentinhalt, Aufnahme und Austritt bleiben getrennt', () => {
  for (const kind of ['inquiry_capture', 'inquiry_decision', 'identity_candidate', 'identity_resolution', 'diagnosis_revision',
    'document_ingest', 'document_content_confirmation', 'admission_prerequisite_review', 'admission_release_decision', 'exit_revision']) {
    assert.ok(clientLifecycleKinds.includes(kind));
  }
  assert.notDeepEqual(clientLifecycleDefinitions.document_ingest.sources, clientLifecycleDefinitions.document_content_confirmation.sources);
  assert.notDeepEqual(clientLifecycleDefinitions.admission_prerequisite_review.sources, clientLifecycleDefinitions.admission_release_decision.sources);
});

test('Originalart, Fremdfeld, Fremdmandant, Fremdklient, UUID, SHA und Mikrosekunden sperren', () => {
  const wrong = command('residence_revision'); wrong.payload.address = source('client_contact');
  assert.throws(() => validateClientLifecycleCommand(wrong), /falsche Originalart/);
  const extra = command('diagnosis_revision'); extra.payload.secret = 'x';
  assert.throws(() => validateClientLifecycleCommand(extra), /Fremdfelder/);
  const foreignTenant = command('contact_revision'); foreignTenant.payload.contact.snapshot.tenant_id = next();
  assert.throws(() => validateClientLifecycleCommand(foreignTenant), /aktuellen Mandanten/);
  const foreignClient = command('document_ingest'); foreignClient.payload.document.snapshot.client_id = next();
  assert.throws(() => validateClientLifecycleCommand(foreignClient), /aktuellen Klienten/);
  const time = command('interruption_revision'); time.occurredAt = '2026-10-16T16:00:00';
  assert.throws(() => validateClientLifecycleCommand(time), /ungültig/);
  const hash = command('function_inventory_review'); hash.payload.inventorySha256 = 'nicht';
  assert.throws(() => validateClientLifecycleCommand(hash), /ungültig/);
});

test('Vertretung und Unterbrechung verlangen chronologische Zeiträume', () => {
  const representation = command('representation_evidence'); representation.payload.validUntil = representation.payload.validFrom;
  assert.throws(() => validateClientLifecycleCommand(representation), /nicht chronologisch/);
  const interruption = command('interruption_revision'); interruption.payload.endsAt = interruption.payload.startsAt;
  assert.throws(() => validateClientLifecycleCommand(interruption), /nicht chronologisch/);
});

test('CAS, doppelte Anfrage und append-only Berichtigung sperren', () => {
  const original = command('contact_revision'), event = eventOf(original);
  const state = { headId: original.eventId, events: [event], corrected: [] };
  assert.throws(() => applyClientLifecycleCommand(state, command('residence_revision')), /zwischenzeitlich/);
  const correction = command('correction', { expectedHeadId: original.eventId }); correction.payload.targetId = original.eventId;
  const corrected = applyClientLifecycleCommand(state, correction);
  assert.deepEqual(corrected.corrected, [original.eventId]);
  const duplicate = command('correction', { expectedHeadId: original.eventId, requestId: original.requestId }); duplicate.payload.targetId = original.eventId;
  assert.throws(() => applyClientLifecycleCommand(state, duplicate), /bereits/);
});

function historyOf(commands) {
  let previous = null;
  return { version: clientLifecycleVersion, tenantId: ids.tenant, clientId: ids.client, count: commands.length, headId: commands.at(-1)?.eventId ?? null,
    events: commands.map((c, index) => { c.expectedHeadId = previous; const event = { id: c.eventId, sequence: index + 1, previousId: previous, tenantId: ids.tenant, clientId: ids.client, actorId: ids.actor, actorName: 'Fachkraft', recordedAt: c.occurredAt, command: structuredClone(c) }; previous = c.eventId; return event; }) };
}

test('vollständiger Verlauf, Fallbindung und aktuelle Originalauswahl werden tief geprüft', () => {
  const commands = [command('diagnosis_revision'), command('admission_prerequisite_review')], history = historyOf(commands);
  const sources = structuredClone(commands.flatMap(c => clientLifecycleDefinitions[c.kind].sources.map(rule => c.payload[rule.key])));
  const context = { version: clientLifecycleVersion, tenantId: ids.tenant, clientId: ids.client, actorId: ids.actor, loadedAt: '2026-10-16T16:01:00.123456Z', sources: { count: sources.length, rows: sources }, history };
  assert.equal(decodeClientLifecycleHistory(history, context).state.headId, commands[1].eventId);
  assert.equal(decodeClientLifecycleContext(context, context).sources.count, sources.length);
  assert.doesNotThrow(() => assertClientLifecycleSelectionCurrent(commands[0], context));
  context.sources.rows[0].snapshot.status = 'changed';
  assert.throws(() => assertClientLifecycleSelectionCurrent(commands[0], context), /nicht mehr aktuell/);
  assert.throws(() => decodeClientLifecycleContext({ ...context, clientId: next() }, context), /originale/i);
});

test('Quittung bindet exakt dieselbe fallbezogene Anfrage', () => {
  const c = command('admission_release_decision'), event = eventOf(c);
  const receipt = { version: clientLifecycleVersion, requestId: c.requestId, command: c, event };
  assert.doesNotThrow(() => decodeClientLifecycleReceipt(receipt, c));
  assert.throws(() => decodeClientLifecycleReceipt({ ...receipt, event: { ...event, id: next() } }, c), /quittung/i);
});

const memory = () => { const values = new Map(); return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) }; };

test('Entwurf bleibt konto-, mandanten- und fallgebunden und verwirft veraltete Auswahl', () => {
  const store = memory(), kind = 'document_ingest', definition = clientLifecycleDefinitions[kind];
  const selected = Object.fromEntries(definition.sources.map(rule => { const v = source(rule.kinds[0]); return [rule.key, { id: v.id, value: v }]; }));
  const draft = { version: clientLifecycleVersion, scope: { tenantId: ids.tenant, clientId: ids.client, actorId: ids.actor }, headId: null, kind, occurredAt: '2026-10-16T16:00:00Z', note: 'Entwurf', values: {}, selected };
  saveClientLifecycleDraft(store, draft);
  assert.match(clientLifecycleDraftKey(draft.scope), new RegExp(ids.client));
  assert.equal(restoreClientLifecycleDraft(store, draft.scope, null, () => true).changed, false);
  assert.deepEqual(restoreClientLifecycleDraft(store, draft.scope, next(), () => false).draft.selected, {});
});

test('Formular baut nur einen validierten fallbezogenen Befehl', () => {
  const kind = 'emergency_information_revision', definition = clientLifecycleDefinitions[kind];
  const draft = { version: clientLifecycleVersion, scope: { tenantId: ids.tenant, clientId: ids.client, actorId: ids.actor }, headId: null, kind, occurredAt: '2026-10-16T16:00:00Z', note: 'Gate',
    values: Object.fromEntries(definition.fields.map(rule => [rule.key, value(rule)])),
    selected: Object.fromEntries(definition.sources.map(rule => { const v = source(rule.kinds[0]); return [rule.key, { id: v.id, value: v }]; })) };
  assert.equal(buildClientLifecycleCommand(draft, emptyClientLifecycleState(), next(), next()).clientId, ids.client);
});

test('unklarer Ausgang wird ausschließlich lesend wiederaufgenommen', async () => {
  const store = memory(), c = command('interruption_revision'); let commits = 0, confirms = 0;
  const workflow = new ClientLifecycleWorkflow({ tenantId: ids.tenant, clientId: ids.client, actorId: ids.actor }, {
    storage: store, lock: async (_, action) => action(), isCurrent: () => true,
    commit: async () => { commits++; return { ok: false, uncertain: true, error: 'Antwort verloren' }; },
    confirm: async () => { confirms++; const event = eventOf(c); return { ok: true, data: { version: clientLifecycleVersion, requestId: c.requestId, command: c, event } }; },
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
  const repository = createClientLifecycleRepository({ getSdk: () => sdk, query: request => Promise.resolve(request) });
  const authority = { tenantId: ids.tenant, clientId: ids.client, actorId: ids.actor, accessToken: 'token', expiresAt: 4102444800000, isCurrent: () => current };
  return { calls, repository, authority, expire: () => { current = false; } };
}

test('Repository bindet Kontext, Commit und Quittungslesen an denselben Fall', async () => {
  const c = command('exit_revision'), event = eventOf(c), receipt = { version: clientLifecycleVersion, requestId: c.requestId, command: c, event };
  const context = { version: clientLifecycleVersion, tenantId: ids.tenant, clientId: ids.client, actorId: ids.actor, loadedAt: c.occurredAt, sources: { count: 0, rows: [] }, history: historyOf([]) };
  const h = repositoryHarness(name => name === 'web_client_lifecycle_workspace_context' ? { error: null, data: context } : { error: null, data: receipt });
  assert.equal((await h.repository.context(h.authority)).ok, true);
  assert.equal((await h.repository.commit(h.authority, c)).ok, true);
  assert.equal((await h.repository.confirm(h.authority, c)).ok, true);
  assert.deepEqual(h.calls.map(x => x.name), ['web_client_lifecycle_workspace_context', 'web_commit_client_lifecycle_event', 'web_confirm_client_lifecycle_event']);
  assert.deepEqual(h.calls[0].args, { p_tenant_id: ids.tenant, p_client_id: ids.client, p_actor_id: ids.actor });
});

test('Repository trennt bestätigten SQL-Abbruch, unklaren Ausgang und Rechtewechsel', async () => {
  const c = command('contact_revision'), rejected = repositoryHarness(() => ({ error: { code: '23514' }, data: null })), unknown = repositoryHarness(() => ({ error: { code: '08006' }, data: null }));
  assert.equal((await rejected.repository.commit(rejected.authority, c)).rejected, true);
  assert.equal((await unknown.repository.commit(unknown.authority, c)).uncertain, true);
  rejected.expire();
  assert.equal((await rejected.repository.context(rejected.authority)).ok, false);
  assert.equal(rejected.calls.length, 1);
});
