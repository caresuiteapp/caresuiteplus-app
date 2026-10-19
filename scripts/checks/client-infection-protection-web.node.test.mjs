import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes as strip } from 'node:module';
import * as native from '../../src/lib/clients/clientRecordNativeOriginal.web.ts';
import {
  captureClientInfectionProtectionEvidenceWeb as capture,
} from '../../src/lib/clients/clientInfectionProtectionEvidence.web.ts';
import { withServiceQueryTimeout } from '../../src/lib/services/queryTimeout.ts';
import { assertClientTimelineCapture } from '../../src/lib/clients/clientTimelineNoteAction.web.ts';

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const scope = { tenantId: id(1), clientId: id(4) };
const row = () => ({
  id: id(20), tenant_id: scope.tenantId, client_id: scope.clientId,
  infection_notes: 'Verdacht laut Übergabe; Bestätigung nicht dokumentiert.',
  hygiene_notes: 'PSA-Hinweis im Freitext; konkrete Gültigkeit offen.',
  created_at: '2026-10-12T09:00:00.123456+00:00',
  updated_at: '2026-10-25T02:30:00.654321+02:00',
  extra_original: { source: 'legacy', history: ['whole', 0, false, null] },
});

test('Whole original is frozen privately while primitive evidence preserves exact fields', () => {
  const input = [row()], before = structuredClone(input), evidence = capture(input, scope), entry = evidence.entries[0];
  input[0].infection_notes = 'later mutation';
  input[0].extra_original.history.reverse();
  assert.deepEqual(evidence.originals, before);
  assert.equal(entry.infectionNotes.value, before[0].infection_notes);
  assert.equal(entry.hygieneNotes.value, before[0].hygiene_notes);
  assert.equal(entry.createdAt.value, before[0].created_at);
  assert.equal(entry.updatedAt.value, before[0].updated_at);
  assert.ok(Object.isFrozen(evidence));
  assert.ok(Object.isFrozen(evidence.originals[0].extra_original.history));
});

for (const [name, value, state, exact] of [
  ['missing', Symbol.for('delete'), 'missing', null],
  ['undefined', undefined, 'undefined', null],
  ['null', null, 'null', null],
  ['empty', '', 'empty', ''],
  ['space', '  \n ', 'value', '  \n '],
  ['zero-text', '0', 'value', '0'],
  ['false', false, 'unresolved', null],
  ['zero-number', 0, 'unresolved', null],
  ['object', { raw: 'unknown' }, 'unresolved', null],
]) test(`infection_notes ${name} remains a distinct original state`, () => {
  const input = row();
  if (typeof value === 'symbol') delete input.infection_notes;
  else input.infection_notes = value;
  const entry = capture([input], scope).entries[0];
  assert.equal(entry.infectionNotes.state, state);
  assert.equal(entry.infectionNotes.value, exact);
});

for (const text of [
  'MRSA bestätigt', 'MRE-Verdacht', 'kein MRE', 'Isolation beendet',
  'Schutzkittel tragen', 'Befund vom Labor', '<script>Original</script>',
  'Bestätigt? Nein? widersprüchlicher Originaltext', '⚕️'.repeat(2000),
]) test(`Free text never becomes status, source, measure or freshness: ${text.slice(0, 32)}`, () => {
  const entry = capture([{ ...row(), infection_notes: text, hygiene_notes: text }], scope).entries[0];
  assert.equal(entry.infectionNotes.value, text);
  assert.equal(entry.hygieneNotes.value, text);
  assert.equal(entry.suspectedStatus, 'not_provided');
  assert.equal(entry.confirmedStatus, 'not_provided');
  assert.equal(entry.statusSeparation, 'not_possible_from_current_schema');
  assert.equal(entry.sourceRelation, 'not_provided');
  assert.equal(entry.protectionMeasuresRelation, 'not_provided');
  assert.equal(entry.clinicalFreshness, 'not_inferred');
  assert.equal(Object.hasOwn(entry, 'confirmed'), false);
  assert.equal(Object.hasOwn(entry, 'isolation'), false);
});

for (const key of ['created_at', 'updated_at']) for (const value of [
  '1969-12-31T23:59:59.999999Z', '2026-10-25T02:30:00.123456+02:00',
  '2026-10-25T02:30:00.123456+01:00', '', null, undefined,
]) test(`${key} ${String(value)} is generic raw metadata, not a clinical instant`, () => {
  const entry = capture([{ ...row(), [key]: value }], scope).entries[0];
  const projected = key === 'created_at' ? entry.createdAt : entry.updatedAt;
  assert.equal(projected.value, typeof value === 'string' ? value : null);
  assert.equal(entry.clinicalFreshness, 'not_inferred');
  assert.equal(Object.hasOwn(entry, 'assessedAt'), false);
  assert.equal(Object.hasOwn(entry, 'validAt'), false);
});

test('Empty delivered pool remains empty without asserting absence of infection or MRE', () => {
  const evidence = capture([], scope);
  assert.deepEqual(evidence.entries, []);
  assert.deepEqual(evidence.originals, []);
});

test('Multiple one-to-one rows are rejected instead of selecting by order or timestamp', () => {
  assert.throws(() => capture([row(), { ...row(), id: id(21) }], scope), /Mehrere native/);
});

for (const [key, value] of [['tenant_id', id(99)], ['client_id', id(99)], ['id', 'invalid']]) {
  test(`Foreign or invalid ${key} cannot deliver infection evidence`, () => {
    assert.throws(() => capture([{ ...row(), [key]: value }], scope));
  });
}

for (const key of ['id', 'tenant_id', 'client_id', 'infection_notes']) test(`Getter ${key} is rejected before invocation`, () => {
  const input = row(); let called = 0;
  Object.defineProperty(input, key, { enumerable: true, get() { called++; return row()[key]; } });
  assert.throws(() => capture([input], scope));
  assert.equal(called, 0);
});

const readerSource = readFileSync(new URL('../../src/lib/clients/clientInfectionProtectionOriginalRead.web.ts', import.meta.url), 'utf8');
const readerBody = strip(readerSource.replace(/^import[\s\S]*?;\n/gm, '').replace(/\bexport /g, ''));

function readerHarness(patch = {}) {
  const state = { rows: [row()], calls: [], current: true, response: null, before: null, ...patch };
  class Query {
    constructor(table) { this.table = table; this.filters = []; }
    select(selector) { this.selector = selector; return this; }
    eq(key, value) { this.filters.push([key, value]); return this; }
    order(key, options) { this.orderKey = key; this.ascending = options.ascending; return this; }
    limit(limit) { this.limitN = limit; return this; }
    then(resolve, reject) {
      const call = { table: this.table, selector: this.selector, filters: [...this.filters], orderKey: this.orderKey, ascending: this.ascending, limit: this.limitN };
      state.calls.push(call);
      return Promise.resolve().then(async () => {
        await state.before?.(call, state.calls.length);
        if (state.response) return state.response(call, state.calls.length);
        return { error: null, data: structuredClone(state.rows) };
      }).then(resolve, reject);
    }
  }
  const db = { from: (table) => new Query(table) };
  const deps = {
    ...native,
    captureClientInfectionProtectionEvidenceWeb: capture,
    getSupabaseClient: () => db,
    fromUnknownTable: (client, table) => client.from(table),
    toGermanSupabaseError: (error) => error.message ?? 'native error',
    withServiceQueryTimeout,
  };
  const read = new Function(...Object.keys(deps), `${readerBody};return fetchClientInfectionProtectionOriginalReadWeb;`)(...Object.values(deps));
  const options = () => ({ canRead: true, canViewSensitive: true, assertCurrentRead: () => { if (!state.current) throw Error('current lost'); } });
  return { state, read, options };
}

test('Actual reader performs two exact scoped SELECTs and no write or RPC', async () => {
  const h = readerHarness(), result = await h.read(scope.tenantId, scope.clientId, h.options());
  assert.equal(result.ok, true, result.error);
  assert.equal(h.state.calls.length, 2);
  for (const call of h.state.calls) {
    assert.equal(call.table, 'client_ambulatory_details');
    assert.equal(call.selector, 'id,tenant_id,client_id,infection_notes,hygiene_notes,created_at,updated_at');
    assert.deepEqual(call.filters, [['tenant_id', scope.tenantId], ['client_id', scope.clientId]]);
    assert.equal(call.orderKey, 'id');
    assert.equal(call.ascending, true);
    assert.equal(call.limit, 2);
  }
  assert.equal(result.data.snapshot, 'verified_row_repeat_non_atomic');
  assert.equal(result.data.collection.entries[0].confirmedStatus, 'not_provided');
});

test('Changing row between repeated reads is rejected instead of presenting stale status', async () => {
  const h = readerHarness();
  h.state.response = (_call, count) => ({ error: null, data: [{ ...row(), infection_notes: count === 1 ? 'first' : 'changed' }] });
  const result = await h.read(scope.tenantId, scope.clientId, h.options());
  assert.equal(result.ok, false);
  assert.match(result.error, /geändert/);
});

for (const gate of ['canRead', 'canViewSensitive']) test(`Reader denies ${gate}=false before SDK work`, async () => {
  const h = readerHarness(), options = h.options(); options[gate] = false;
  const result = await h.read(scope.tenantId, scope.clientId, options);
  assert.equal(result.ok, false);
  assert.equal(h.state.calls.length, 0);
});

test('Reader denies async access assertion before SDK work', async () => {
  const h = readerHarness(), result = await h.read(scope.tenantId, scope.clientId,
    { canRead: true, canViewSensitive: true, assertCurrentRead: async () => {} });
  assert.equal(result.ok, false);
  assert.equal(h.state.calls.length, 0);
});

test('Access loss after first native response blocks the repeated read and delivery', async () => {
  const h = readerHarness();
  h.state.before = (_call, count) => { if (count === 1) h.state.current = false; };
  const result = await h.read(scope.tenantId, scope.clientId, h.options());
  assert.equal(result.ok, false);
  assert.equal(h.state.calls.length, 1);
});

for (const response of [
  { error: { message: 'RLS denied' }, data: null },
  { error: null },
  [],
  null,
]) test(`Malformed/error response ${JSON.stringify(response)} never becomes an empty clinical fact`, async () => {
  const h = readerHarness({ response: () => response });
  const result = await h.read(scope.tenantId, scope.clientId, h.options());
  assert.equal(result.ok, false);
});

test('Actual Office screen mounts the sensitive panel from its existing current sensitive capture', () => {
  const source = readFileSync(new URL('../../src/screens/pflege/ClientRecordWorkspace365.web.tsx', import.meta.url), 'utf8');
  assert.match(source, /ClientRecordInfectionProtectionPanel captureRead=\{capturePanelTimelineRead\}/);
  assert.match(source, /captureTimelineBase\(true\)/);
});

const panelSource = readFileSync(new URL('../../src/screens/business/office/ClientRecordInfectionProtectionPanel.web.tsx', import.meta.url), 'utf8');
const panelHelpers = strip(panelSource.slice(panelSource.indexOf('type Props'), panelSource.indexOf('/** Sensitive original excerpt')));
const panelStart = panelSource.indexOf('export function ClientRecordInfectionProtectionPanel(');
const panelBody = strip(panelSource.slice(panelStart, panelSource.indexOf('  return <SectionPanel', panelStart)).replace('export ', '')
  + 'return {read,generation,query,projectionData,projectionTicket,mayRead,retry,ownPool,currentRead};}');

function panelHarness(patch = {}) {
  let slots = [], cursor = 0, effects = [], fetcher, api;
  const reader = readerHarness();
  const state = {
    allowed: true, alive: true, token: Object.freeze({}), key: 'own-infection-A',
    tenantId: scope.tenantId, clientId: scope.clientId,
    query: { data: null, loading: false, refreshing: false, error: null, refreshError: null,
      previewData: false, tableMissing: false, cacheMeta: { fromCache: false, partialDetail: false } },
    ...patch,
  };
  const factory = () => {
    if (state.customFactory) return state.customFactory();
    if (!state.allowed || !state.alive) return null;
    const owner = state.token, key = state.key, tenantId = state.tenantId, clientId = state.clientId;
    return Object.freeze({ tenantId, clientId, owner, key, assertCurrentRead: () => {
      if (!state.allowed || !state.alive || state.token !== owner || state.key !== key
        || state.tenantId !== tenantId || state.clientId !== clientId) throw Error('current lost');
    } });
  };
  const useRef = (value) => { const i = cursor++; if (!(i in slots)) slots[i] = { current: value }; return slots[i]; };
  const useEffect = (fn) => { const i = cursor++; if (!(i in slots)) { slots[i] = { cleanup: null }; effects.push(() => { slots[i].cleanup = fn(); }); } };
  const invoke = async (fn = fetcher) => {
    state.query.refreshing = true;
    const result = await fn();
    state.query.refreshing = false;
    if (result.ok) { state.query.data = result.data; state.query.error = null; state.query.refreshError = null; }
    else state.query.error = result.error;
    return result;
  };
  const useAsyncQuery = (fn, _deps, config) => {
    fetcher = fn; state.config = config;
    return { ...state.query, refresh: () => invoke(fn) };
  };
  const deps = {
    useEffect, useRef, useAsyncQuery,
    assertClientTimelineCapture,
    fetchClientInfectionProtectionOriginalReadWeb: reader.read,
    useAuroraAdaptiveText: () => ({}),
  };
  const panel = new Function(...Object.keys(deps), panelHelpers + panelBody
    + ';return {ClientRecordInfectionProtectionPanel,captureSensitiveRead,sameCapture,label};')(...Object.values(deps));
  const render = () => { cursor = 0; api = panel.ClientRecordInfectionProtectionPanel({ captureRead: factory }); return api; };
  render(); effects.splice(0).forEach((fn) => fn());
  return {
    state, reader, render, invoke,
    ready: async () => { const result = await invoke(); render(); assert.equal(result.ok, true, result.error); return result; },
    unmount: () => slots.forEach((slot) => slot?.cleanup?.()),
    get api() { return api; }, get fetcher() { return fetcher; },
  };
}

test('Actual panel exposes only primitive projection while retaining whole originals privately', async () => {
  const h = panelHarness(), result = await h.ready(), entry = h.api.projectionData.entries[0];
  assert.equal(h.api.mayRead(entry), true);
  assert.equal(entry.infectionNotes.value, row().infection_notes);
  assert.equal(JSON.stringify(h.api.projectionData).includes('extra_original'), false);
  assert.equal(JSON.stringify(h.api.generation.trusted.originals).includes('extra_original'), true);
  assert.equal(result.data.entries[0].confirmedStatus, 'not_provided');
  h.unmount();
});

for (const flag of ['allowed', 'alive']) test(`Loss of ${flag} blocks retained sensitive infection projection and retry`, async () => {
  const h = panelHarness(); await h.ready(); const held = h.api, before = h.reader.state.calls.length;
  h.state[flag] = false;
  assert.equal(held.mayRead(), false);
  await held.retry();
  assert.equal(h.reader.state.calls.length, before);
  h.unmount();
});

test('New opaque owner with same text key cannot revive cached infection evidence', async () => {
  const h = panelHarness(); await h.ready(); const held = h.api;
  h.state.token = Object.freeze({});
  assert.equal(held.mayRead(), false);
  h.render();
  assert.equal(h.api.ownPool, false);
  h.unmount();
});

for (const [flag, value] of [['loading', true], ['refreshing', true], ['error', 'x'], ['refreshError', 'x'], ['previewData', true], ['tableMissing', true]]) {
  test(`Panel query state ${flag} cannot expose cached sensitive infection evidence`, async () => {
    const h = panelHarness(); await h.ready(); h.state.query[flag] = value; h.render();
    assert.equal(h.api.mayRead(), false); h.unmount();
  });
}

for (const cacheMeta of [{ fromCache: true, partialDetail: false }, { fromCache: false, partialDetail: true }, {}]) {
  test(`Panel cache provenance ${JSON.stringify(cacheMeta)} cannot expose infection evidence`, async () => {
    const h = panelHarness(); await h.ready(); h.state.query.cacheMeta = cacheMeta; h.render();
    assert.equal(h.api.mayRead(), false); h.unmount();
  });
}

test('Injected same-key projection without private original receipt is rejected', async () => {
  const h = panelHarness(); await h.ready();
  h.state.query.data = { ...h.api.projectionData, entries: [...h.api.projectionData.entries] };
  h.render(); assert.equal(h.api.mayRead(), false); h.unmount();
});

test('Unmount permanently closes retained infection evidence and retry', async () => {
  const h = panelHarness(); await h.ready(); const held = h.api, before = h.reader.state.calls.length;
  h.unmount(); assert.equal(held.mayRead(), false); await held.retry();
  assert.equal(h.reader.state.calls.length, before);
});
