import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { woundUuid } from '../../src/lib/pflege/woundCareDomain.ts';
import { careAssessmentRuntimeAccess } from '../../src/lib/careAssessment/careAssessmentRuntimeAccess.web.ts';
import { captureWoundCareHistoricalOriginals, sameWoundCareHistoricalOriginals } from '../../src/lib/pflege/woundCareHistoricalOriginals.web.ts';

const id = n => `22222222-2222-4222-8222-${String(n).padStart(12, '0')}`;
const tenant = id(1), client = id(2), wound = id(3), actor = id(4), at = '2026-10-09T10:00:00.123456Z';
function original() {
  const common = { tenant_id: tenant, client_id: client, wound_case_id: wound, created_at: at, recorded_by: actor, recorded_by_name: 'Originalautorin' };
  const plans = Array.from({ length: 12 }, (_, i) => ({ ...common, id: id(100 + i), version: 12 - i, previous_id: i === 11 ? null : id(101 + i), effective_from: `2026-10-08T${String(23 - i).padStart(2, '0')}:00:00.123456Z`, effective_until: null, basis_state: 'pending', medical_order_id: null, order_snapshot: null, details: { plannedCare: `Historische Planung ${i}`, additionalOriginal: { retained: false } } }));
  const dressings = Array.from({ length: 22 }, (_, i) => ({ ...common, id: id(200 + i), execution_id: id(300 + i), plan_id: plans[11].id, plan_snapshot: structuredClone(plans[11]), occurred_at: at, outcome: 'performed', details: { materialsJson: '[]', painBeforeState: 'NRS', painBeforeScore: '0', painAfterState: 'not_assessable', painAfterReason: 'Nicht beurteilt', contact: 'Rückmeldung offen', additionalOriginal: { retained: false } } }));
  return { wound: { row: { ...common, id: wound, updated_at: at, status: 'active' }, assessments: [], lifecycle: [], clientName: 'Eigener Pflegefall' }, plans, orders: [], dressings, corrections: [], correctionLinks: [] };
}
const screen = readFileSync(new URL('../../src/screens/pflege/WoundCareScreen.web.tsx', import.meta.url), 'utf8');
const marker = 'export function WoundCareHistoryPanel(', start = screen.indexOf(marker), stop = screen.indexOf(' const fields=', start);
assert.ok(start >= 0 && stop > start);
const prefix = stripTypeScriptTypes(screen.slice(start, stop).replace('export ', '') + '\nreturn {readOriginals,currentOriginals,toggle,more,correct,refreshHistory:typeof refreshHistory === "function"?refreshHistory:q.refresh,captured,planCount,dressingCount,open};}');
const make = new Function('useServiceTenantId', 'useAuth', 'usePermissions', 'useStyles', 'useRef', 'useState', 'useEffect', 'useAsyncQuery', 'careAssessmentRuntimeAccess', 'woundUuid', 'fetchWoundCareWithTreatmentCorrections', 'captureWoundCareHistoricalOriginals', 'sameWoundCareHistoricalOriginals', `${prefix};return WoundCareHistoryPanel;`);

// Actual source-extracted callers with local hook/query adapters; no React, browser, SDK or database.
function workspace() {
  const slots = [], cleanups = [], launches = [];
  let index = 0, reads = 0, refreshes = 0;
  const env = { tenant, wound, profile: { id: actor, tenantId: tenant, roleKey: 'pflegefachkraft' }, runtimeTenant: tenant, role: 'pflegefachkraft', rights: new Set(['pflege.wounds.view', 'pflege.orders.view', 'pflege.treatment.view', 'pflege.wounds.manage', 'pflege.treatment.manage']), original: original(), response: null, deferred: null,
    query: { data: null, loading: false, refreshing: false, error: null, refreshError: null, previewData: false, tableMissing: false, cacheMeta: { fromCache: false, partialDetail: false } } };
  const useRef = value => { const i = index++; return slots[i] ??= { current: value }; };
  const useState = value => { const i = index++; if (!(i in slots)) slots[i] = value; return [slots[i], next => { slots[i] = typeof next === 'function' ? next(slots[i]) : next; }]; };
  const useEffect = fn => { const i = index++; if (!(i in slots)) { slots[i] = true; cleanups.push(fn()); } };
  const renderComponent = make(() => env.tenant, () => ({ profile: env.profile }), () => ({ tenantId: env.runtimeTenant, roleKey: env.role, can: key => env.rights.has(key) }), () => ({}), useRef, useState, useEffect,
    () => ({ ...env.query, refresh: () => { refreshes++; return Promise.resolve(); } }), careAssessmentRuntimeAccess, woundUuid,
    async (...args) => { reads++; const result = env.response ?? { ok: true, data: structuredClone(env.original) }; return env.deferred ? env.deferred(result, args) : result; }, captureWoundCareHistoricalOriginals, sameWoundCareHistoricalOriginals);
  const render = () => { index = 0; return renderComponent({ id: env.wound, onCorrect: execution => launches.push(execution) }); };
  const read = async () => { const result = await render().readOriginals(); if (result.ok) env.query.data = result.data; return result; };
  return { env, render, read, launches, dispose: () => cleanups.forEach(fn => fn?.()), get reads() { return reads; }, get refreshes() { return refreshes; } };
}
async function ready() { const w = workspace(); assert.equal((await w.read()).ok, true); assert.ok(w.render().captured); return w; }

test('Erneutes Laden sperrt alte Berichtigung und Originalansicht vor jedem Rerender', async () => {
  const w = await ready(), old = w.render(); old.refreshHistory(); assert.equal(w.refreshes, 1); old.correct(id(200)); old.toggle('raw', id(100), false); old.more(true);
  assert.equal(old.currentOriginals(), null); assert.deepEqual(w.launches, []); assert.deepEqual(w.render().open.raw, []); assert.equal(w.render().dressingCount, 20);
});
test('Berichtigung öffnet nur einen tatsächlich sichtbaren eigenen Verbandwechsel', async () => {
  const w = await ready(), ui = w.render(); ui.correct(id(221)); assert.deepEqual(w.launches, []); ui.correct(id(200)); assert.deepEqual(w.launches, [id(300)]);
  ui.more(true); w.render().correct(id(221)); assert.deepEqual(w.launches, [id(300), id(321)]);
});
test('Verdeckte Plan- und Versorgungsoriginale werden erst nach Anzeigen bedienbar', async () => {
  const w = await ready(), ui = w.render(); ui.toggle('raw', id(111), false); ui.toggle('details', id(221), true); assert.deepEqual(w.render().open.raw, []); assert.deepEqual(w.render().open.details, []);
  w.render().more(false); w.render().more(true); const next = w.render(); next.toggle('raw', id(111), false); next.toggle('details', id(221), true);
  assert.deepEqual(w.render().open.raw, [`plan:${id(111)}`]); assert.deepEqual(w.render().open.details, [`dressing:${id(221)}`]);
});
test('Retry verwirft auch eine bereits ausstehende ältere Antwort unmittelbar', async () => {
  const w = await ready(); let release; w.env.deferred = result => new Promise(resolve => { release = () => resolve(result); });
  const pending = w.render().readOriginals(); w.render().refreshHistory(); release(); assert.equal((await pending).ok, false); assert.equal(w.render().captured, null);
});
test('Frischer Vollread nach Retry öffnet nur neue Callback-Generation', async () => {
  const w = await ready(), old = w.render(); old.refreshHistory(); await w.read(); old.correct(id(200)); assert.deepEqual(w.launches, []); w.render().correct(id(200)); assert.deepEqual(w.launches, [id(300)]);
});
for (const flag of ['loading', 'refreshing', 'error', 'refreshError', 'previewData', 'tableMissing', 'fromCache', 'partialDetail']) test(`Aktuelles ${flag} sperrt zurückbehaltene Verlaufsaktionen`, async () => {
  const w = await ready(), old = w.render(); if (flag === 'fromCache' || flag === 'partialDetail') w.env.query.cacheMeta[flag] = true; else w.env.query[flag] = /error/i.test(flag) ? 'Lesefehler' : true;
  w.render(); old.correct(id(200)); old.more(false); old.toggle('raw', id(100), false); assert.equal(old.currentOriginals(), null); assert.deepEqual(w.launches, []); assert.equal(w.render().planCount, 10); assert.deepEqual(w.render().open.raw, []);
});
for (const pool of ['plans', 'dressings', 'orders']) test(`Auch eine Änderung im verdeckten ganzen Originalbestand ${pool} sperrt Berichtigung`, async () => {
  const w = await ready(), old = w.render(); if (pool === 'orders') w.env.query.data.orders.push({ id: id(999) }); else w.env.query.data[pool].at(-1).details.additionalOriginal.retained = true;
  old.correct(id(200)); assert.equal(old.currentOriginals(), null); assert.deepEqual(w.launches, []); assert.equal(w.render().captured, null);
});
for (const change of ['owner', 'serviceTenant', 'runtimeTenant', 'wound', 'role']) test(`Geänderter ${change} sperrt alte Retry- und Berichtigungsaktionen`, async () => {
  const w = await ready(), old = w.render(); if (change === 'owner') w.env.profile = { ...w.env.profile, id: id(99) }; else if (change === 'role') w.env.role = 'verwaltung'; else w.env[change === 'serviceTenant' ? 'tenant' : change] = id(99);
  w.render(); old.correct(id(200)); old.refreshHistory(); assert.deepEqual(w.launches, []); assert.equal(w.refreshes, 0);
});
test('Entzug und Rückkehr der Leserechte beleben keine alten Aktionen', async () => {
  const w = await ready(), old = w.render(); w.env.rights.delete('pflege.orders.view'); w.render(); w.env.rights.add('pflege.orders.view'); w.render(); await w.read(); old.correct(id(200)); old.refreshHistory(); assert.deepEqual(w.launches, []); assert.equal(w.refreshes, 0); w.render().correct(id(200)); assert.deepEqual(w.launches, [id(300)]);
});
test('Reine Planleser laden keine tatsächlichen Versorgungsoriginale', async () => {
  const w = workspace(); w.env.rights.delete('pflege.treatment.view'); w.env.original.dressings = []; assert.equal((await w.read()).ok, true); assert.equal(w.render().captured.plans.length, 12); assert.deepEqual(w.render().captured.dressings, []); w.render().correct(id(200)); assert.deepEqual(w.launches, []);
});
test('Verlorenes Schreibrecht verhindert Berichtigung, lässt Originaltexte erreichbar', async () => {
  const w = await ready(), old = w.render(); w.env.rights.delete('pflege.treatment.manage'); w.render(); old.correct(id(200)); assert.deepEqual(w.launches, []); w.render().toggle('raw', id(200), true); assert.deepEqual(w.render().open.raw, [`dressing:${id(200)}`]);
});
test('Unmount beendet alte Lese-, Retry- und Berichtigungsaktionen', async () => {
  const w = await ready(), old = w.render(); w.dispose(); old.correct(id(200)); old.refreshHistory(); assert.equal((await old.readOriginals()).ok, false); assert.deepEqual(w.launches, []); assert.equal(w.refreshes, 0);
});
