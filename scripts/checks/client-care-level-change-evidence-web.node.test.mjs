import test from 'node:test';
import assert from 'node:assert/strict';
import {
  captureClientCareLevelChangeEvidenceWeb as capture,
  clientCareLevelChangeOriginalsWeb as originals,
} from '../../src/lib/clients/clientCareLevelChangeEvidence.web.ts';

const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const scope = () => ({ tenantId: id(1), clientId: id(4) });
const base = (n, extra = {}) => ({ id: id(n), tenant_id: id(1), client_id: id(4), ...extra });
const care = (n = 10, extra = {}) => base(n, { grade: 'pg3', valid_from: '2025-01-01', valid_until: null, ...extra });
const intake = (n, extra = {}) => base(n, { version: 2, status: 'pending_signature', title: 'Native Dokumentfassung', ...extra });
const canonical = (n, intakeId, extra = {}) => base(n, { intake_document_id: intakeId, title: 'Native Aktenfassung', ...extra });
const task = (n = 50, extra = {}) => base(n, { title: 'Pflegegrad pg3 nachhalten', description: '2025-01-01', ...extra });
const event = (n = 40, extra = {}) => base(n, {
  document_id: id(21), event_type: 'care_level_successor_generated', summary: 'Pflegegrad geändert',
  metadata_json: { previousCareLevel: 'pg2', nextCareLevel: 'pg3', replacedDocumentId: id(20), unknown: { whole: true } },
  actor_profile_id: id(2), created_at: '2026-10-12 08:30:00.123456+02:00', ...extra,
});
const input = (extra = {}) => ({
  careLevels: [care()], intakeDocuments: [intake(20, { version: 1, status: 'signed' }), intake(21)],
  documents: [canonical(30, id(21))], documentEvents: [event()], tasks: [task()], ...extra,
});

test('Exact event, predecessor, successor and canonical native IDs form a separate complete document chain', () => {
  const model = capture(input(), scope());
  assert.ok(model);
  assert.equal(model.entries.length, 1);
  assert.deepEqual(model.entries[0], {
    nativeEventId: id(40), previousCareLevel: { state: 'value', text: 'pg2' },
    nextCareLevel: { state: 'value', text: 'pg3' }, successorDocumentId: { state: 'value', text: id(21) },
    replacedDocumentId: { state: 'value', text: id(20) }, canonicalDocumentId: { state: 'value', text: id(30) },
    actorProfileId: { state: 'value', text: id(2) }, createdAt: { state: 'value', text: '2026-10-12 08:30:00.123456+02:00' },
    successorVersion: { state: 'value', text: '2' }, successorStatus: { state: 'value', text: 'pending_signature' },
    relationState: 'complete_native_chain', careLevelRowRelation: 'not_provided',
    consultationRelation: 'not_provided', followUpTaskRelation: 'not_provided',
  });
  assert.equal(model.careLevelRowsAreUnbound, true);
  assert.equal(model.taskPoolWasNotCorrelated, true);
});

test('Equal grade, title, text, date and technical order never bind a care-level row or task', () => {
  const supplied = input({
    careLevels: [care(10, { grade: 'pg3', notes: 'Pflegegrad geändert', created_at: '2026-10-12 08:30:00.123456+02:00' })],
    tasks: [task(50, { title: 'Pflegegrad geändert', description: 'pg2 pg3 2026-10-12 08:30:00.123456+02:00' })],
  });
  const model = capture(supplied, scope());
  assert.equal(model.entries[0].careLevelRowRelation, 'not_provided');
  assert.equal(model.entries[0].followUpTaskRelation, 'not_provided');
  assert.deepEqual(originals(model).careLevels, supplied.careLevels);
  assert.deepEqual(originals(model).tasks, supplied.tasks);
});

test('Unrelated document events are preserved privately but not projected as care-level changes', () => {
  const other = event(41, { event_type: 'signed', document_id: id(21) });
  const model = capture(input({ documentEvents: [event(), other] }), scope());
  assert.equal(model.entries.length, 1);
  assert.equal(originals(model).documentEvents.length, 2);
  assert.equal(originals(model).documentEvents[1].event_type, 'signed');
});

for (const [label, value, state, text] of [
  ['missing', Symbol.for('missing'), 'missing', null], ['undefined', undefined, 'undefined', null],
  ['null', null, 'null', null], ['empty', '', 'empty', ''], ['text', 'pg4', 'value', 'pg4'],
  ['number', 4, 'invalid', null], ['object', { raw: true }, 'invalid', null],
]) test(`Metadata nextCareLevel ${label} keeps its native state without deciding entitlement`, () => {
  const metadata = { previousCareLevel: 'pg2', replacedDocumentId: id(20) };
  if (label !== 'missing') metadata.nextCareLevel = value;
  const model = capture(input({ documentEvents: [event(40, { metadata_json: metadata })] }), scope());
  assert.deepEqual(model.entries[0].nextCareLevel, { state, text });
  assert.equal(model.entries[0].careLevelRowRelation, 'not_provided');
});

for (const [key, value, state] of [
  ['document_id', undefined, 'undefined'], ['document_id', null, 'null'], ['document_id', '', 'empty'],
  ['document_id', 'not-a-uuid', 'invalid'], ['actor_profile_id', undefined, 'undefined'],
  ['actor_profile_id', null, 'null'], ['actor_profile_id', 'not-a-uuid', 'invalid'],
  ['created_at', undefined, 'undefined'], ['created_at', null, 'null'], ['created_at', 123, 'invalid'],
]) test(`${key} ${String(value)} keeps ${state} without document, author or event-time inference`, () => {
  const model = capture(input({ documentEvents: [event(40, { [key]: value })] }), scope());
  const field = key === 'document_id' ? model.entries[0].successorDocumentId
    : key === 'actor_profile_id' ? model.entries[0].actorProfileId : model.entries[0].createdAt;
  assert.equal(field.state, state);
  assert.equal(model.entries[0].relationState === 'complete_native_chain', key !== 'document_id');
});

test('Missing, partial, duplicate and self-replacing relation targets never become a complete chain', () => {
  const cases = [
    input({ intakeDocuments: [intake(21)] }), input({ documents: [] }),
    input({ documents: [canonical(30, id(21)), canonical(31, id(21))] }),
    input({ documentEvents: [event(40, { metadata_json: { previousCareLevel: 'pg2', nextCareLevel: 'pg3', replacedDocumentId: id(21) } })] }),
  ];
  for (const supplied of cases) assert.notEqual(capture(supplied, scope()).entries[0].relationState, 'complete_native_chain');
});

test('Raw microseconds, offsets, version zero, status whitespace and unknown originals stay exact', () => {
  const at = '1969-12-31T23:59:59.000001-00:30';
  const supplied = input({
    intakeDocuments: [intake(20), intake(21, { version: 0, status: ' pending ', private_extra: { order: [3, 1] } })],
    documentEvents: [event(40, { created_at: at })],
  });
  const model = capture(supplied, scope());
  assert.equal(model.entries[0].createdAt.text, at);
  assert.equal(model.entries[0].successorVersion.text, '0');
  assert.equal(model.entries[0].successorStatus.text, ' pending ');
  assert.deepEqual(originals(model).intakeDocuments[1].private_extra.order, [3, 1]);
});

for (const pool of ['careLevels', 'intakeDocuments', 'documents', 'documentEvents', 'tasks']) {
  test(`Foreign ${pool} row rejects the whole evidence rather than clipping it`, () => {
    const supplied = input();
    supplied[pool] = supplied[pool].map(row => ({ ...row, tenant_id: id(99) }));
    assert.equal(capture(supplied, scope()), null);
  });
  test(`Duplicate or descending native IDs in ${pool} reject the whole evidence`, () => {
    const supplied = input();
    supplied[pool] = [supplied[pool][0], { ...structuredClone(supplied[pool][0]) }];
    assert.equal(capture(supplied, scope()), null);
  });
}

for (const target of ['root-extra', 'missing-pool', 'getter', 'symbol', 'hidden']) test(`Unresolved whole input ${target} cannot yield partial evidence`, () => {
  const supplied = input();
  if (target === 'root-extra') supplied.extra = [];
  if (target === 'missing-pool') delete supplied.tasks;
  if (target === 'getter') Object.defineProperty(supplied.documentEvents[0], 'unknown', { enumerable: true, get() { throw Error('must not read'); } });
  if (target === 'symbol') supplied.documentEvents[0][Symbol('unknown')] = 'raw';
  if (target === 'hidden') Object.defineProperty(supplied.documentEvents[0], 'unknown', { value: 'raw', enumerable: false });
  assert.equal(capture(supplied, scope()), null);
});

test('Snapshots and all five private original pools are deeply frozen; copied displays expose no originals', () => {
  const supplied = input();
  const model = capture(supplied, scope());
  supplied.documentEvents[0].metadata_json.unknown.whole = false;
  supplied.tasks[0].title = 'later';
  assert.equal(originals(model).documentEvents[0].metadata_json.unknown.whole, true);
  assert.equal(originals(model).tasks[0].title, 'Pflegegrad pg3 nachhalten');
  assert.ok(Object.isFrozen(model) && Object.isFrozen(model.entries) && Object.isFrozen(originals(model).documentEvents[0].metadata_json));
  assert.equal(originals({ ...model }), null);
  assert.equal(originals(null), null);
});
