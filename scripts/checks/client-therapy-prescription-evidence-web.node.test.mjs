import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes as strip } from 'node:module';
import {
  captureClientTherapyPrescriptionEvidenceWeb as capture,
  clientTherapyPrescriptionOriginalsWeb as originals,
} from '../../src/lib/clients/clientTherapyPrescriptionEvidence.web.ts';

const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const scope = () => ({ tenantId: id(1), clientId: id(4) });
const row = (n = 20) => ({
  id: id(n), tenant_id: id(1), client_id: id(4), prescription_type: 'physiotherapy',
  title: ' Originale Verordnung ', issued_at: '2026-10-01', valid_until: '2027-01-01',
  doctor: 'Gespeicherte ärztliche Angabe', document_id: id(90), status: 'aktiv', note: 'Originalhinweis',
  created_at: '2026-10-01 08:00:00.123456+02:00', updated_at: '2026-10-02T09:00:00.654321+02:00',
  unknown: { history: ['two', 'one'], optional: undefined },
});

test('Whole prescription pool remains private and never invents coordination relations', () => {
  const input = [row(10), row(20)], before = structuredClone(input), model = capture(input, scope());
  assert.ok(model); assert.equal(model.entries.length, 2); assert.deepEqual(originals(model), before); assert.deepEqual(input, before);
  assert.equal(model.authority, 'inspection_only');
  for (const entry of model.entries) {
    assert.equal(entry.appointmentRelation, 'not_provided'); assert.equal(entry.providerRelation, 'not_provided');
    assert.equal(entry.followUpTaskRelation, 'not_provided'); assert.equal(entry.performanceInference, 'not_inferred');
  }
});

for (const [label, value, state, text] of [
  ['text', ' raw ', 'value', ' raw '], ['null', null, 'null', null], ['empty', '', 'empty', ''],
  ['undefined', undefined, 'undefined', null], ['zero', 0, 'unresolved', null], ['false', false, 'unresolved', null],
  ['object', { raw: true }, 'unresolved', null], ['array', ['raw'], 'unresolved', null],
]) test(`Known prescription field ${label} remains distinct`, () => {
  const model = capture([{ ...row(), valid_until: value }], scope());
  assert.deepEqual(model.entries[0].fields.find(item => item.key === 'valid_until'), { key: 'valid_until', state, text });
  assert.deepEqual(originals(model)[0].valid_until, value);
});

for (const [key, value] of [
  ['issued_at', '1900-01-01'], ['valid_until', '9999-12-31'],
  ['created_at', '2026-10-25 02:30:00.000001+02:00'], ['updated_at', '1969-12-31T23:59:59.999999-00:30'],
]) test(`Raw prescription time ${key} is not normalized`, () => {
  const model = capture([{ ...row(), [key]: value }], scope());
  assert.equal(model.entries[0].fields.find(item => item.key === key).text, value);
});

test('Missing and own undefined remain distinct', () => {
  const input = row(); delete input.doctor;
  assert.equal(capture([input], scope()).entries[0].fields.find(item => item.key === 'doctor').state, 'missing');
  input.doctor = undefined;
  assert.equal(capture([input], scope()).entries[0].fields.find(item => item.key === 'doctor').state, 'undefined');
});

test('Empty delivered pool is not proof that no therapy or prescription exists', () => {
  const model = capture([], scope()); assert.ok(model); assert.deepEqual(model.entries, []); assert.deepEqual(originals(model), []);
});

for (const expected of [null, undefined, {}, [], { tenantId: id(1) }, { tenantId: id(1), clientId: 'bad' }]) {
  test(`Malformed scope cannot mint prescription evidence ${JSON.stringify(expected)}`, () => assert.equal(capture([row()], expected), null));
}

for (const key of ['tenant_id', 'client_id']) for (const value of [id(99), undefined, null, '']) {
  test(`Prescription scope ${key}/${String(value)} is refused`, () => assert.equal(capture([{ ...row(), [key]: value }], scope()), null));
}

for (const value of ['bad', undefined, null, '']) test(`Prescription ID ${String(value)} is refused`, () => {
  assert.equal(capture([{ ...row(), id: value }], scope()), null);
});

test('Sparse, descending and duplicate pages are refused', () => {
  assert.equal(capture(Array(1), scope()), null); assert.equal(capture([row(20), row(10)], scope()), null);
  assert.equal(capture([row(10), row(10)], scope()), null);
});

test('Getters, hidden fields, symbols and unsupported unknowns cannot disappear', () => {
  for (const kind of ['getter', 'hidden', 'symbol', 'date', 'nan']) {
    const item = row(); let calls = 0;
    if (kind === 'getter') Object.defineProperty(item, 'title', { enumerable: true, get() { calls++; return 'unsafe'; } });
    if (kind === 'hidden') Object.defineProperty(item, 'hidden', { value: 1 });
    if (kind === 'symbol') item[Symbol('raw')] = 1;
    if (kind === 'date') item.extra = new Date();
    if (kind === 'nan') item.extra = NaN;
    assert.equal(capture([item], scope()), null); assert.equal(calls, 0);
  }
});

test('Original snapshots are deeply frozen and copied models have no lookup authority', () => {
  const input = [row()], model = capture(input, scope()); input[0].unknown.history.reverse();
  assert.deepEqual(originals(model)[0].unknown.history, ['two', 'one']); assert.ok(Object.isFrozen(model));
  assert.ok(Object.isFrozen(originals(model)[0].unknown)); assert.equal(originals({ ...model }), null);
});

const source = readFileSync(new URL('../../src/screens/pflege/ClientRecordWorkspace365.web.tsx', import.meta.url), 'utf8');
const start = source.indexOf('  function captureTherapyPrescriptionEvidenceAtRender()');
const end = source.indexOf('  function capturePanelTimelineNote():', start);
assert.ok(start >= 0 && end > start);

function caller() {
  let right = true, closed = false, inner = 0, outer = 0, beforeProjection = null;
  let receipt = { scopeKey: 'own', owner: {}, recordTicket: 1, fullTicket: 2, record: {}, full: {}, recordNative: {},
    fullNative: { parts: { prescriptions: [row()] } }, scope: { ...scope(), canSensitive: true } };
  const deps = {
    currentParent: { current: { liveOriginalReceipt: () => right && !closed ? receipt : null } },
    capturePanelTimelineRead: () => { const a = inner, b = outer; if (!right || closed) return null; return { assertCurrentRead() {
      if (!right || closed || inner !== a || outer !== b) throw Error('lost');
    } }; },
    sameClientRecordActionOriginal: (a, b) => !!b && a.scopeKey === b.scopeKey && a.owner === b.owner
      && a.recordTicket === b.recordTicket && a.fullTicket === b.fullTicket && a.record === b.record
      && a.full === b.full && a.recordNative === b.recordNative && a.fullNative === b.fullNative,
    captureClientTherapyPrescriptionEvidenceWeb: (input, expected) => { beforeProjection?.(); return capture(input, expected); },
  };
  const api = new Function(...Object.keys(deps), strip(source.slice(start, end))
    + 'return {captureTherapyPrescriptionEvidenceAtRender,consumeTherapyPrescriptionEvidenceAtRender};')(...Object.values(deps));
  return { ...api, get receipt() { return receipt; }, set receipt(v) { receipt = v; }, set right(v) { right = v; },
    set closed(v) { closed = v; }, set beforeProjection(v) { beforeProjection = v; }, loseInner() { inner++; }, loseOuter() { outer++; } };
}

test('Actual Parent capture consumes only the current exact prescription pool', () => {
  const h = caller(), held = h.captureTherapyPrescriptionEvidenceAtRender(); assert.ok(held && Object.isFrozen(held));
  const model = h.consumeTherapyPrescriptionEvidenceAtRender(held); assert.equal(model.entries[0].nativeId, id(20));
});

for (const boundary of ['inner', 'outer', 'sensitive', 'closed', 'owner', 'recordTicket', 'fullTicket', 'fullNative', 'pool']) {
  test(`Actual Parent prescription capture closes on ${boundary}`, () => {
    const h = caller(), held = h.captureTherapyPrescriptionEvidenceAtRender(); assert.ok(held);
    if (boundary === 'inner') h.loseInner(); else if (boundary === 'outer') h.loseOuter(); else if (boundary === 'closed') h.closed = true;
    else if (boundary === 'sensitive') h.receipt = { ...h.receipt, scope: { ...h.receipt.scope, canSensitive: false } };
    else if (boundary === 'pool') h.receipt.fullNative.parts.prescriptions = [row()];
    else if (boundary === 'fullNative') h.receipt = { ...h.receipt, fullNative: { parts: { prescriptions: [row()] } } };
    else h.receipt = { ...h.receipt, [boundary]: boundary.endsWith('Ticket') ? 99 : {} };
    assert.equal(h.consumeTherapyPrescriptionEvidenceAtRender(held), null);
  });
}

test('Projection-time loss and matching regrant cannot revive stale prescription evidence', () => {
  const h = caller(); h.beforeProjection = () => { h.right = false; };
  assert.equal(h.captureTherapyPrescriptionEvidenceAtRender(), null);
  h.right = true; h.beforeProjection = null;
  const old = h.captureTherapyPrescriptionEvidenceAtRender(); h.loseInner(); h.loseOuter();
  assert.equal(h.consumeTherapyPrescriptionEvidenceAtRender(old), null);
  assert.ok(h.consumeTherapyPrescriptionEvidenceAtRender(h.captureTherapyPrescriptionEvidenceAtRender()));
  assert.equal(h.consumeTherapyPrescriptionEvidenceAtRender(old), null);
});
