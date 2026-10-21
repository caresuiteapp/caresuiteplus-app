import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes as strip } from 'node:module';
import {
  captureClientCareLevelEvidenceWeb as capture,
  clientCareLevelEvidenceOriginalsWeb as originals,
} from '../../src/lib/clients/clientCareLevelEvidence.web.ts';

const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const scope = () => ({ tenantId: id(1), clientId: id(4) });
const row = (number = 20) => ({
  id: id(number), tenant_id: id(1), client_id: id(4), grade: 'pg3',
  valid_from: '2025-10-26', valid_until: '2026-03-29',
  care_fund_name: ' Pflegekasse Original ', care_fund_member_id: '00-A B',
  md_assessment_date: '2025-10-25', notes: ' Unveränderter\nHinweis ',
  created_at: '2025-10-26 01:30:00.123456+02:00',
  updated_at: '2026-03-29T01:30:00.654321+01:00',
  extra: { nativeDecisionRef: id(90), unknownHistory: ['two', 'one'], ownUndefined: undefined },
});

test('Whole delivered pool keeps every row, extra and exact primitive without selecting a current entitlement', () => {
  const input = [row(10), row(20)];
  const before = structuredClone(input);
  const model = capture(input, scope());
  assert.ok(model);
  assert.equal(model.entries.length, 2);
  assert.deepEqual(originals(model), before);
  assert.deepEqual(input, before);
  assert.equal(model.currentEntitlement, 'not_inferred');
  assert.equal(model.authority, 'inspection_only');
  assert.deepEqual(model.entries.map(entry => entry.nativeId), [id(10), id(20)]);
  assert.ok(model.entries.every(entry => entry.entitlementInference === 'not_inferred'));
  for (const forbidden of ['current', 'active', 'approved', 'decision', 'billing', 'retroactive', 'originals']) {
    assert.equal(Object.hasOwn(model, forbidden), false);
  }
});

for (const [label, value, state, text] of [
  ['text', ' 2025-10-26 ', 'value', ' 2025-10-26 '], ['null', null, 'null', null],
  ['empty', '', 'empty', ''], ['undefined', undefined, 'undefined', null],
  ['zero', 0, 'unresolved', null], ['false', false, 'unresolved', null],
  ['object', { legacy: true }, 'unresolved', null], ['array', ['raw'], 'unresolved', null],
]) test(`Known field ${label} keeps its own state without date or entitlement inference`, () => {
  const input = [{ ...row(), valid_until: value }];
  const model = capture(input, scope());
  assert.ok(model);
  const field = model.entries[0].fields.find(item => item.key === 'valid_until');
  assert.deepEqual(field, { key: 'valid_until', state, text });
  assert.deepEqual(originals(model)[0].valid_until, value);
});

test('Missing and own undefined remain distinct, including the complete private original', () => {
  const missing = row();
  delete missing.valid_until;
  const missingModel = capture([missing], scope());
  assert.equal(missingModel.entries[0].fields.find(field => field.key === 'valid_until').state, 'missing');
  assert.equal(Object.hasOwn(originals(missingModel)[0], 'valid_until'), false);
  missing.valid_until = undefined;
  const undefinedModel = capture([missing], scope());
  assert.equal(undefinedModel.entries[0].fields.find(field => field.key === 'valid_until').state, 'undefined');
  assert.equal(Object.hasOwn(originals(undefinedModel)[0], 'valid_until'), true);
});

for (const [key, value] of [
  ['valid_from', '2024-02-29'], ['valid_until', '1900-01-01'],
  ['md_assessment_date', '9999-12-31'], ['created_at', '1969-12-31T23:59:59.999999-00:30'],
  ['updated_at', '2026-10-25 02:30:00.000001+02:00'],
]) test(`Raw calendar/timestamp ${key} is unchanged and not normalized`, () => {
  const input = [{ ...row(), [key]: value }];
  const model = capture(input, scope());
  assert.equal(model.entries[0].fields.find(field => field.key === key).text, value);
  assert.equal(originals(model)[0][key], value);
});

for (const pair of [
  ['2027-12-31', '2026-01-01'], [null, '2026-01-01'], ['2026-01-01', null], ['', ''],
]) test(`Contradictory or incomplete interval ${JSON.stringify(pair)} is retained without repair`, () => {
  const input = [{ ...row(), valid_from: pair[0], valid_until: pair[1] }];
  const model = capture(input, scope());
  assert.deepEqual(originals(model)[0].valid_from, pair[0]);
  assert.deepEqual(originals(model)[0].valid_until, pair[1]);
  assert.equal(Object.hasOwn(model.entries[0], 'validNow'), false);
  assert.equal(Object.hasOwn(model.entries[0], 'unbounded'), false);
});

test('A delivered empty pool stays an empty delivered excerpt, not proof of no entitlement', () => {
  const model = capture([], scope());
  assert.ok(model);
  assert.deepEqual(model.entries, []);
  assert.deepEqual(originals(model), []);
  assert.equal(model.currentEntitlement, 'not_inferred');
});

for (const change of [
  null, undefined, {}, [], { tenantId: id(1) }, { tenantId: id(1), clientId: 'bad' },
  { tenantId: 'bad', clientId: id(4) }, { tenantId: id(1), clientId: id(4), extra: 'not authority' },
]) test(`Malformed expected scope cannot mint pool evidence ${JSON.stringify(change)}`, () => {
  assert.equal(capture([row()], change), null);
});

for (const key of ['tenantId', 'clientId', 'unknownScope']) test(`Expected own descriptor ${key} is checked without invoking a getter`, () => {
  const expected = scope();
  let called = 0;
  Object.defineProperty(expected, key, { enumerable: true, get() { called++; return id(1); } });
  assert.equal(capture([row()], expected), null);
  assert.equal(called, 0);
});

for (const key of ['tenant_id', 'client_id']) for (const value of [id(99), undefined, null, '']) {
  test(`Native own scope ${key}/${String(value)} cannot cross the client boundary`, () => {
    assert.equal(capture([{ ...row(), [key]: value }], scope()), null);
  });
}

for (const value of ['not-a-uuid', undefined, null, '']) test(`Native row id ${String(value)} must remain a valid own identifier`, () => {
  assert.equal(capture([{ ...row(), id: value }], scope()), null);
});

test('A different valid native row UUID is retained as identity, not confused with client identity', () => {
  const model = capture([{ ...row(), id: id(99) }], scope());
  assert.equal(model.entries[0].nativeId, id(99));
  assert.equal(originals(model)[0].client_id, id(4));
});

for (const key of ['id', 'tenant_id', 'client_id']) test(`Missing or inherited row ${key} is not accepted`, () => {
  const input = row();
  const value = input[key];
  delete input[key];
  assert.equal(capture([input], scope()), null);
  Object.setPrototypeOf(input, { [key]: value });
  assert.equal(capture([input], scope()), null);
});

for (const key of ['id', 'tenant_id', 'client_id', 'valid_from', 'extra']) test(`Whole row getter ${key} is rejected before invocation`, () => {
  const input = row();
  let called = 0;
  Object.defineProperty(input, key, { enumerable: true, get() { called++; return row()[key]; } });
  assert.equal(capture([input], scope()), null);
  assert.equal(called, 0);
});

for (const value of [NaN, Infinity, Array(1), Object.assign([1], { foreign: 'extra' }), new Date(), new Map(), Symbol('unknown')]) {
  test(`Unselected whole-pool value ${String(value)} cannot disappear`, () => {
    assert.equal(capture([{ ...row(), unknown: value }], scope()), null);
  });
}

test('Sparse, unordered and duplicate pools are refused rather than filtered or reordered', () => {
  assert.equal(capture(Array(1), scope()), null);
  assert.equal(capture([row(20), row(10)], scope()), null);
  assert.equal(capture([row(10), row(10)], scope()), null);
});

test('Unknown symbols and hidden row/pool fields cannot silently disappear', () => {
  for (const target of ['row-hidden', 'row-symbol', 'pool-hidden', 'pool-symbol']) {
    const item = row();
    const pool = [item];
    const holder = target.startsWith('row') ? item : pool;
    const key = target.endsWith('symbol') ? Symbol('hidden') : 'hidden';
    Object.defineProperty(holder, key, { value: 'preserve', enumerable: false });
    assert.equal(capture(pool, scope()), null);
  }
});

test('Captured originals are frozen snapshots and copied display models gain no original lookup', () => {
  const input = [row()];
  const model = capture(input, scope());
  input[0].notes = 'later';
  input[0].extra.unknownHistory.reverse();
  assert.equal(originals(model)[0].notes, ' Unveränderter\nHinweis ');
  assert.deepEqual(originals(model)[0].extra.unknownHistory, ['two', 'one']);
  assert.ok(Object.isFrozen(model));
  assert.ok(Object.isFrozen(model.entries));
  assert.ok(Object.isFrozen(originals(model)[0].extra));
  assert.equal(originals({ ...model }), null);
  assert.equal(originals(null), null);
});

// Execute the actual narrow Parent capture/consume functions with controlled already-owned leaves.
const source = readFileSync(new URL('../../src/screens/pflege/ClientRecordWorkspace365.web.tsx', import.meta.url), 'utf8');
const start = source.indexOf('  function captureCareLevelEvidenceAtRender()');
const end = source.indexOf('  function capturePanelTimelineNote():', start);
assert.ok(start >= 0 && end > start);

function caller() {
  let right = true, closed = false, innerOrigin = 0, outerOrigin = 0, beforeProjection = null, readChecks = 0;
  let receipt = { scopeKey: 'native own key', owner: {}, recordTicket: 1, fullTicket: 2,
    record: {}, full: {}, recordNative: {}, fullNative: { parts: { careLevels: [row()] } },
    scope: { ...scope(), canSensitive: true } };
  const deps = {
    currentParent: { current: { liveOriginalReceipt: () => right && !closed ? receipt : null } },
    capturePanelTimelineRead: () => { const inner = innerOrigin, outer = outerOrigin; if (!right || closed) return null;
      return { assertCurrentRead() { readChecks++; if (!right || closed || innerOrigin !== inner || outerOrigin !== outer) throw Error('native authority lost'); } }; },
    sameClientRecordActionOriginal: (a, b) => !!b && a.scopeKey === b.scopeKey && a.owner === b.owner
      && a.recordTicket === b.recordTicket && a.fullTicket === b.fullTicket && a.record === b.record
      && a.full === b.full && a.recordNative === b.recordNative && a.fullNative === b.fullNative,
    captureClientCareLevelEvidenceWeb: (input, expected) => { beforeProjection?.(); return capture(input, expected); },
  };
  const functions = new Function(...Object.keys(deps), strip(source.slice(start, end))
    + 'return {captureCareLevelEvidenceAtRender,consumeCareLevelEvidenceAtRender};')(...Object.values(deps));
  return { ...functions, get receipt() { return receipt; }, set receipt(value) { receipt = value; },
    get readChecks() { return readChecks; }, set right(value) { right = value; }, set closed(value) { closed = value; },
    set beforeProjection(value) { beforeProjection = value; }, loseInner() { innerOrigin++; }, loseOuter() { outerOrigin++; } };
}

test('Actual Parent capture consumes the complete primitive pool for the current exact Fullroot', () => {
  const harness = caller();
  const held = harness.captureCareLevelEvidenceAtRender();
  assert.ok(held && Object.isFrozen(held));
  const evidence = harness.consumeCareLevelEvidenceAtRender(held);
  assert.equal(evidence.entries.length, 1);
  assert.equal(evidence.entries[0].nativeId, harness.receipt.fullNative.parts.careLevels[0].id);
  assert.ok(harness.readChecks >= 8);
  assert.equal(evidence.raw, undefined);
});

for (const boundary of ['inner', 'outer', 'sensitive', 'closed', 'owner', 'recordTicket', 'fullTicket', 'record', 'full', 'recordNative', 'fullNative', 'pool']) {
  test(`Captured Parent pool is denied on current ${boundary} loss without retargeting`, () => {
    const harness = caller();
    const held = harness.captureCareLevelEvidenceAtRender();
    assert.ok(held);
    if (boundary === 'inner') harness.loseInner();
    else if (boundary === 'outer') harness.loseOuter();
    else if (boundary === 'sensitive') harness.receipt = { ...harness.receipt, scope: { ...harness.receipt.scope, canSensitive: false } };
    else if (boundary === 'closed') harness.closed = true;
    else if (boundary === 'pool') harness.receipt.fullNative.parts.careLevels = [row()];
    else if (boundary === 'fullNative') harness.receipt = { ...harness.receipt, fullNative: { parts: { careLevels: [row()] } } };
    else harness.receipt = { ...harness.receipt, [boundary]: boundary.endsWith('Ticket') ? 99 : {} };
    assert.equal(harness.consumeCareLevelEvidenceAtRender(held), null);
  });
}

test('Projection-time authority or native-pool loss denies initial delivery', () => {
  for (const loss of ['right', 'pool']) {
    const harness = caller();
    harness.beforeProjection = () => {
      if (loss === 'right') harness.right = false;
      else harness.receipt.fullNative.parts.careLevels = [row()];
    };
    assert.equal(harness.captureCareLevelEvidenceAtRender(), null);
  }
});

test('Matching inner/outer regrant cannot revive the old pool capture', () => {
  const harness = caller();
  const old = harness.captureCareLevelEvidenceAtRender();
  harness.loseInner();
  harness.loseOuter();
  assert.equal(harness.consumeCareLevelEvidenceAtRender(old), null);
  const fresh = harness.captureCareLevelEvidenceAtRender();
  assert.ok(harness.consumeCareLevelEvidenceAtRender(fresh));
  assert.equal(harness.consumeCareLevelEvidenceAtRender(old), null);
});

test('Sensitive denial suppresses evidence without changing the delivered native pool', () => {
  const harness = caller();
  const before = structuredClone(harness.receipt.fullNative.parts.careLevels);
  harness.receipt.scope.canSensitive = false;
  assert.equal(harness.captureCareLevelEvidenceAtRender(), null);
  assert.deepEqual(harness.receipt.fullNative.parts.careLevels, before);
});
