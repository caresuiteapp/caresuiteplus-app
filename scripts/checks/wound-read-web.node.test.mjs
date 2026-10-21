import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { captureWoundListOriginal, filterWoundList, sameWoundReadOriginal } from '../../src/lib/pflege/woundReadOriginal.web.ts';
import { careAssessmentRuntimeAccess } from '../../src/lib/careAssessment/careAssessmentRuntimeAccess.web.ts';

const id = n => `11111111-1111-4111-8111-${String(n).padStart(12, '0')}`;
const owner = { tenantId: id(1), profileId: id(2), role: 'nurse' };
const props = () => ({ owner: structuredClone(owner), serviceTenant: owner.tenantId, runtimeTenant: owner.tenantId, runtimeRole: owner.role, canView: true, canManage: true });
const row = n => ({ row: { id: id(n), tenant_id: owner.tenantId, client_id: id(3), created_at: '2026-10-08T10:00:00.123456Z', updated_at: '2026-10-09T10:00:00.123457Z', status: 'active', body_location: 'Linker Unterschenkel', wound_type: 'Originalbefund', documentation_details: { original: ['  Rohtext  ', null, false], author: { name: 'Originalperson' } } }, clientName: 'Erika Mustermann' });
const rows = () => [row(10), row(11)];
test('Ganze Wundliste erhält Reihenfolge, Rohtexte und unbekannte Originalfelder als unabhängige Kopie', () => {
  const input = rows(), before = structuredClone(input), result = captureWoundListOriginal(input, owner.tenantId);
  assert.deepEqual(result, before); input[1].row.documentation_details.author.name = 'Geändert'; assert.deepEqual(result, before);
  result[0].row.documentation_details.original[0] = 'Kopie'; assert.equal(input[0].row.documentation_details.original[0], '  Rohtext  ');
});
for (const [key, value] of [['tenant_id', id(99)], ['client_id', 'unknown'], ['id', 'unknown'], ['status', 'unknown'], ['created_at', '2026-02-30T10:00:00Z'], ['updated_at', null]]) {
  test(`Verdeckter letzter Wundfall mit ungültigem ${key} verhindert eine bestätigte Teilliste`, () => {
    const input = rows(); input[1].row[key] = value; assert.throws(() => captureWoundListOriginal(input, owner.tenantId));
  });
}
for (const key of ['id', 'tenant_id', 'client_id', 'created_at', 'updated_at', 'status']) test(`Geerbter Wundkopf ${key} ersetzt keine eigene Originalangabe`, () => {
  const input = rows(), raw = input[1].row, value = raw[key]; delete raw[key]; Object.setPrototypeOf(raw, { [key]: value });
  assert.throws(() => captureWoundListOriginal(input, owner.tenantId));
});
test('Doppelte native Wund-ID wird auch mit abweichender Großschreibung verworfen', () => {
  const input = rows(); input[0].row.id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'; input[1].row.id = input[0].row.id.toUpperCase(); assert.throws(() => captureWoundListOriginal(input, owner.tenantId));
});
test('Sparse und malformed Wundlisten werden nicht als leere oder teilweise geladene Bestände bestätigt', () => {
  const sparse = rows(); sparse.length = 3;
  for (const input of [null, {}, sparse, [null], [{ row: [] }], [{ ...row(10), clientName: '' }]]) assert.throws(() => captureWoundListOriginal(input, owner.tenantId));
  assert.deepEqual(captureWoundListOriginal([], owner.tenantId), []);
});
test('PostgreSQL-Metadaten mit Leerzeichen bleiben im Original erhalten, ohne Millisekundenkürzung', () => {
  const input = rows(); input[0].row.updated_at = '2026-10-09 10:00:00.123457+00:00'; assert.equal(captureWoundListOriginal(input, owner.tenantId)[0].row.updated_at, input[0].row.updated_at);
});
test('Filter verändert keine Originale und trennt zwei Wunden derselben Person', () => {
  const input = rows(), before = structuredClone(input); input[1].row.status = 'healed'; before[1].row.status = 'healed';
  assert.deepEqual(filterWoundList(input, '  MUSTERMANN  ', 'active').map(x => x.row.id), [id(10)]);
  assert.deepEqual(filterWoundList(input, id(11), 'all').map(x => x.row.id), [id(11)]); assert.deepEqual(input, before);
});

// Execute the actual hook without React/DOM/layout. The adapter only supplies refs, cleanup and the existing query interface.
const hookSource = readFileSync(new URL('../../src/hooks/pflege/useWoundRead.web.ts', import.meta.url), 'utf8').replace(/^import .*;\n/gm, '');
const hookBody = stripTypeScriptTypes(hookSource).replace('export function useWoundRead', 'function useWoundRead');
const makeHook = new Function('useRef', 'useEffect', 'useAsyncQuery', 'careAssessmentRuntimeAccess', 'sameWoundReadOriginal', `${hookBody}\nreturn useWoundRead;`);
function harness(fetcher = async () => ({ ok: true, data: rows() }), capture = captureWoundListOriginal, resource = 'list') {
  const refs = []; let index = 0, cleanup = null, effectStarted = false, currentFetcher, enabled = true, queryKey;
  const query = { data: null, loading: true, refreshing: false, error: null, refreshError: null, previewData: false, tableMissing: false, cacheMeta: { fromCache: false }, refreshCalls: 0,
    refresh() { query.refreshCalls++; query.refreshing = true; return Promise.resolve(); } };
  const hook = makeHook(value => refs[index++] ??= { current: value }, fn => { if (!effectStarted) { effectStarted = true; cleanup = fn(); } }, (fn, deps, opts) => {
    currentFetcher = fn; enabled = opts.enabled;
    if (queryKey !== opts.queryKey) { query.data = null; query.loading = enabled; query.error = null; query.refreshError = null; queryKey = opts.queryKey; }
    return query;
  }, careAssessmentRuntimeAccess, sameWoundReadOriginal);
  let currentProps = props(), value;
  function render(next = currentProps, nextResource = resource) { currentProps = next; index = 0; value = hook(next, nextResource, fetcher, capture); return value; }
  async function load() { if (!enabled) return null; const result = await currentFetcher(); if (result.ok) query.data = result.data; else query.data ? query.refreshError = result.error : query.error = result.error; query.loading = false; query.refreshing = false; return result; }
  render(); return { render, load, query, dispose: () => cleanup?.(), get value() { return value; }, get fetch() { return currentFetcher; } };
}
async function ready(fetcher) { const h = harness(fetcher); assert.equal(h.value.ready, false); assert.equal((await h.load()).ok, true); assert.equal(h.render().ready, true); return h; }
test('Eigener abgeschlossener Vollread erlaubt Lesen und aktuelle Schreiböffnung', async () => {
  const h = await ready(); assert.deepEqual(h.value.current(), rows()); assert.equal(h.value.mayManage(), true);
});
for (const [key, value] of [['serviceTenant', id(99)], ['runtimeTenant', id(99)], ['runtimeRole', 'admin'], ['canView', false], ['owner', null]]) test(`Aktueller ${key} sperrt alte Wundlese- und Öffnen-Callbacks`, async () => {
  const h = await ready(), old = h.value; h.render({ ...props(), [key]: value }); assert.equal(h.value.canRead, false); assert.equal(old.current(), null); assert.equal(old.mayManage(), false); old.refresh(); assert.equal(h.query.refreshCalls, 0);
});
test('Benutzerwechsel derselben Rolle verwirft einen bereits geladenen Wundbestand', async () => {
  const h = await ready(), old = h.value; h.render({ ...props(), owner: { ...owner, profileId: id(99) } }); assert.equal(h.value.ready, false); assert.equal(old.current(), null);
});
test('Leserecht verlieren und zurückerhalten bestätigt keinen alten Beleg mit derselben sichtbaren Identität', async () => {
  const h = await ready(), old = h.value, oldEnvelope = h.query.data; h.render({ ...props(), canView: false }); h.render(props()); h.query.data = oldEnvelope;
  assert.equal(h.render().ready, false); assert.equal(old.current(), null); await h.load(); assert.equal(h.render().ready, true); assert.equal(old.current(), null);
});
test('Schreibrechtverlust lässt den aktuellen Lesebeleg erhalten und sperrt die alte Schreiböffnung', async () => {
  const h = await ready(), old = h.value; h.render({ ...props(), canManage: false }); assert.equal(h.value.ready, true); assert.ok(old.current()); assert.equal(old.mayManage(), false);
});
for (const key of ['loading', 'refreshing', 'error', 'refreshError', 'previewData', 'tableMissing']) test(`${key} sperrt die aktuelle Projektion und retained Wundaktionen`, async () => {
  const h = await ready(), old = h.value; h.query[key] = key.endsWith('Error') || key === 'error' ? 'Abfrage fehlgeschlagen' : true;
  assert.equal(h.render().ready, false); assert.equal(h.value.data, null); assert.equal(old.current(), null);
});
for (const key of ['fromCache', 'partialDetail']) test(`Ein ${key}-Bestand wird nicht als vollständiger aktueller Wundread freigegeben`, async () => {
  const h = await ready(), old = h.value; h.query.cacheMeta[key] = true; assert.equal(h.render().ready, false); assert.equal(old.current(), null);
});
test('Aktualisieren sperrt Öffnen noch vor einem React-Rerender und auch nach fehlgeschlagener Abfrage', async () => {
  const h = await ready(), old = h.value; old.refresh(); assert.equal(h.query.refreshCalls, 1); assert.equal(old.current(), null);
  h.query.refreshing = false; h.query.refreshError = 'Offline'; assert.equal(h.render().ready, false); assert.equal(old.mayManage(), false);
});
test('Stilles Nachladen sperrt alte Aktionen vor dem Await und nach erfolgreichem neuen Bestand', async () => {
  let resolve; const h = await ready(async () => ({ ok: true, data: rows() })), old = h.value;
  const next = harness(() => new Promise(r => { resolve = r; })); const pending = next.fetch(); assert.equal(next.value.current(), null); resolve({ ok: true, data: rows() }); await pending;
  const read = h.fetch(); assert.equal(old.current(), null); const result = await read; h.query.data = result.data; h.render(); assert.ok(h.value.current()); assert.equal(old.current(), null);
});
test('Späte Antwort nach Leserechtsverlust oder Unmount wird nicht bestätigt', async () => {
  for (const dispose of [false, true]) {
    let resolve; const h = harness(() => new Promise(r => { resolve = r; })); const pending = h.fetch();
    dispose ? h.dispose() : h.render({ ...props(), canView: false }); resolve({ ok: true, data: rows() }); assert.equal((await pending).ok, false); assert.equal(h.value.current(), null);
  }
});
test('Eine ältere parallele Antwort ersetzt keinen neueren abgeschlossenen Wundread', async () => {
  const resolves = [], h = harness(() => new Promise(r => resolves.push(r))); const a = h.fetch(), b = h.fetch();
  resolves[1]({ ok: true, data: rows() }); const latest = await b; h.query.data = latest.data; h.query.loading = false; assert.equal(h.render().ready, true);
  resolves[0]({ ok: true, data: [row(99)] }); assert.equal((await a).ok, false); assert.deepEqual(h.value.current(), rows());
});
test('Nachträgliche Änderung eines verdeckten Originals wird schon vor dem Rerender und weiterhin danach gesperrt', async () => {
  const h = await ready(), old = h.value; h.query.data.value[1].row.documentation_details.original[0] = 'Nachträglich geändert';
  assert.equal(old.current(), null); assert.equal(h.render().ready, false); assert.match(h.value.error, /geändert/);
});
test('Gleichwertige Objekt-Schlüsselreihenfolge bleibt lesbar, vertauschte Historienreihenfolge nicht', async () => {
  const h = await ready(); h.query.data.value[0].row = Object.fromEntries(Object.entries(h.query.data.value[0].row).reverse()); assert.ok(h.value.current());
  h.query.data.value.reverse(); assert.equal(h.value.current(), null);
});

// Execute the actual imperative list handlers; router and state setters are local probes, not a React/browser proof.
const listSource = readFileSync(new URL('../../src/screens/pflege/WoundDocumentationListScreen.web.tsx', import.meta.url), 'utf8');
const handlerSource = stripTypeScriptTypes(listSource.slice(listSource.indexOf('  function ownSelection()'), listSource.indexOf('  if (!q.canRead)')));
function listHandlers(q, selection = { current: { search: '', filter: 'all', visible: 50 } }) {
  const routes = [], setters = [], { search, filter, visible } = selection.current;
  const actions = new Function('q', 'selection', 'search', 'filter', 'visible', 'router', 'setSearch', 'setFilter', 'setVisible', 'woundUuid', 'filterWoundList', 'woundStatusLabels', `${handlerSource}\nreturn { open, create, changeSearch, changeFilter, showMore };`)
    (q, selection, search, filter, visible, { push: route => routes.push(route) }, v => setters.push(v), v => setters.push(v), v => setters.push(v), v => typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v), filterWoundList, { active: 'Aktiv', healed: 'Abgeheilt' });
  return { actions, routes, setters, selection };
}
test('Echte Listenaktion öffnet genau die gewählte sichtbare native Wund-ID', async () => {
  const h = await ready(), p = listHandlers(h.value); p.actions.open(id(11)); assert.deepEqual(p.routes, [`/pflege/wunden/${id(11)}`]);
  p.actions.open(id(99)); assert.equal(p.routes.length, 1);
});
test('Alte Listenöffnung, Filter und Mehr-Anzeige bleiben nach einer sofortigen Suchänderung wirkungslos', async () => {
  const h = await ready(), p = listHandlers(h.value); p.actions.changeSearch('unpassend'); p.actions.open(id(10)); p.actions.changeFilter('healed'); p.actions.showMore();
  assert.deepEqual(p.routes, []); assert.equal(p.selection.current.search, 'unpassend'); assert.equal(p.selection.current.filter, 'all'); assert.equal(p.selection.current.visible, 50);
});
test('Verdeckter Fall jenseits der sichtbaren 50 kann durch keinen alten Listenhandler geöffnet werden', async () => {
  const h = await ready(async () => ({ ok: true, data: Array.from({ length: 51 }, (_, i) => row(10 + i)) })), p = listHandlers(h.value);
  p.actions.open(id(60)); assert.deepEqual(p.routes, []); p.actions.showMore(); assert.equal(p.selection.current.visible, 100); p.actions.open(id(60)); assert.deepEqual(p.routes, []);
});
test('Echte Anlageaktion prüft aktuelles Leserecht und Schreibrecht erneut', async () => {
  const h = await ready(), p = listHandlers(h.value); p.actions.create(); assert.deepEqual(p.routes, ['/pflege/wunden/new']); h.render({ ...props(), canManage: false }); p.actions.create(); assert.equal(p.routes.length, 1);
});
test('Wundliste gibt Fehler-/Ladezustand vor der tatsächlichen Kartenprojektion zurück', () => {
  assert.ok(listSource.indexOf('if (!q.ready)') < listSource.indexOf('filtered.slice(0, visible).map'));
});
