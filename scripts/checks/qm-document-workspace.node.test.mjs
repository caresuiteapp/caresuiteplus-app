import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { filterQmDocuments, qmChapterParentPath, qmDisplayDate, qmMatchesSearch } from '../../src/lib/qm/qmDocumentWorkspace.web.ts';
import { mapHandbookRowToDetail, HANDBOOK_LIVE_SELECT_COLUMNS } from '../../src/lib/qm/qmHandbookMapper.ts';
import { CENTRAL_CATALOG_INDEX } from '../../src/data/seeds/documentCatalog/centralCatalogIndex.ts';

const document = (id, patch = {}) => ({ id, tenantId: 'tenant-a', title: 'Hygieneplan', documentNumber: 'HY-002', documentType: 'procedure', status: 'published', ownerRole: 'QMB', tags: ['Reinigung'], reviewDueAt: null, currentVersionId: null, chapterId: null, createdAt: '', updatedAt: '', ...patch });
const chapter = (id, parentId, patch = {}) => ({ id, parentId, handbookId: 'handbook-a', title: id, ...patch });

test('document search matches every word across title, number, tags, owner and translated type', () => {
  const docs = [document('a'), document('b', { title: 'Fortbildung', documentNumber: 'FO-001', tags: [] })];
  assert.deepEqual(filterQmDocuments(docs, 'HY-002   reinigung QmB Verfahren').map(item => item.id), ['a']);
  assert.deepEqual(filterQmDocuments(docs, 'HY-002 fehlend'), []);
  assert.equal(qmMatchesSearch('HÄNDE Hygiene', 'hände'), true);
});

test('status and document type filters combine with search without altering supplied records', () => {
  const docs = [document('a'), document('b', { status: 'draft' }), document('c', { status: 'draft', documentType: 'form' })];
  const before = structuredClone(docs);
  assert.deepEqual(filterQmDocuments(docs, 'hygiene', 'draft', 'procedure').map(item => item.id), ['b']);
  assert.deepEqual(filterQmDocuments(docs, ' ', '', '').map(item => item.id), ['a', 'b', 'c']);
  assert.deepEqual(docs, before);
});

test('parent path remains useful when a list search hides the parent', () => {
  const chapters = [chapter('Leitbild', null), chapter('Organisation', 'Leitbild'), chapter('Vertretung', 'Organisation')];
  assert.equal(qmChapterParentPath(chapters[2], chapters), 'Leitbild / Organisation');
  assert.equal(qmChapterParentPath(chapters[0], chapters), '');
});

test('cyclic or cross-handbook parent IDs cannot recurse or imply a foreign parent', () => {
  const child = chapter('a', 'b');
  assert.equal(qmChapterParentPath(child, [child, chapter('b', 'a')]), 'b');
  assert.equal(qmChapterParentPath(child, [child, chapter('b', null, { handbookId: 'other' })]), '');
  assert.equal(qmChapterParentPath(child, [child]), '');
});

test('dates preserve unknown and missing states instead of substituting today', () => {
  assert.equal(qmDisplayDate(null), 'Nicht hinterlegt');
  assert.equal(qmDisplayDate(undefined), 'Nicht hinterlegt');
  assert.equal(qmDisplayDate('not-a-date'), 'Datum ungeklärt');
  assert.match(qmDisplayDate('2026-10-23T12:00:00Z'), /23\.10\.2026/);
});

test('QM templates reuse actual central keys, including original-only inspection reports', () => {
  const entries = CENTRAL_CATALOG_INDEX.filter(item => ['qm', 'hygiene'].includes(item.categoryKey));
  assert.equal(entries.length, 43);
  assert.equal(new Set(entries.map(item => item.key)).size, entries.length);
  assert.equal(entries.find(item => item.key === 'csdc_qm_019').sourceMode, 'original');
  assert.ok(entries.every(item => item.target === 'company' && item.modules.includes('office')));
});

function handbookReader({ response = { data: null, error: null }, denied = false, tenantDenied = false, clientAvailable = true, demo = false } = {}) {
  const calls = [];
  const query = {
    select: (...args) => { calls.push(['select', ...args]); return query; },
    eq: (...args) => { calls.push(['eq', ...args]); return query; },
    order: (...args) => { calls.push(['order', ...args]); return query; },
    limit: (...args) => { calls.push(['limit', ...args]); return query; },
    maybeSingle: async () => { calls.push(['maybeSingle']); return response; },
  };
  const deps = {
    guardServiceTenant: () => tenantDenied ? { ok: false, error: 'Tenant blocked' } : null,
    getServiceMode: () => demo ? 'demo' : 'supabase',
    getSupabaseClient: () => clientAvailable ? {} : null,
    fromUnknownTable: (_client, table) => { calls.push(['table', table]); return query; },
    toGermanSupabaseError: () => 'Abfrage fehlgeschlagen',
    enforceQmPermission: (_role, permission) => { assert.equal(permission, 'qm.view'); return denied ? { ok: false, error: 'Permission blocked' } : null; },
    QM_VIEW: 'qm.view',
    fetchQmHandbook: async () => { calls.push(['demo']); return { ok: true, data: { id: 'demo' } }; },
    HANDBOOK_LIVE_SELECT_COLUMNS, mapHandbookRowToDetail,
  };
  const source = readFileSync(new URL('../../src/lib/qm/qmHandbookRead.web.ts', import.meta.url), 'utf8').replace(/^import[\s\S]*?;\n/gm, '').replace(/\bexport /g, '');
  const read = new Function(...Object.keys(deps), stripTypeScriptTypes(source) + ';return fetchOptionalQmHandbook;')(...Object.values(deps));
  return { read, calls };
}

test('an explicitly successful empty active-handbook query is a normal empty state', async () => {
  const { read, calls } = handbookReader();
  assert.deepEqual(await read('tenant-a', 'business_admin'), { ok: true, data: null });
  assert.ok(calls.some(call => call[0] === 'eq' && call[1] === 'tenant_id' && call[2] === 'tenant-a'));
  assert.ok(calls.some(call => call[0] === 'eq' && call[1] === 'status' && call[2] === 'active'));
});

test('a failed query with data:null remains an error and cannot become an empty handbook', async () => {
  const { read } = handbookReader({ response: { data: null, error: { code: '42501' } } });
  assert.deepEqual(await read('tenant-a', 'business_admin'), { ok: false, error: 'Abfrage fehlgeschlagen' });
});

test('a malformed missing data response is not treated as confirmed absence', async () => {
  const { read } = handbookReader({ response: { error: null } });
  assert.equal((await read('tenant-a', 'business_admin')).ok, false);
});

for (const guard of ['denied', 'tenantDenied']) test(`${guard} cannot enter a handbook SELECT`, async () => {
  const { read, calls } = handbookReader({ [guard]: true });
  assert.equal((await read('tenant-a', 'billing')).ok, false);
  assert.deepEqual(calls, []);
});

test('missing connection cannot masquerade as an empty handbook', async () => {
  const { read } = handbookReader({ clientAvailable: false });
  assert.equal((await read('tenant-a', 'business_admin')).ok, false);
});

test('an actual supplied row retains mapped metadata', async () => {
  const row = { id: 'hb-1', tenant_id: 'tenant-a', title: 'Handbuch', version: '2.4', status: 'active', approved_at: null, approved_by: null, created_at: '2026-10-20', updated_at: '2026-10-23' };
  const { read } = handbookReader({ response: { data: row, error: null } });
  const result = await read('tenant-a', 'business_admin');
  assert.equal(result.ok, true);
  assert.equal(result.data.id, 'hb-1');
  assert.equal(result.data.version, '2.4');
  assert.equal(result.data.tenantId, 'tenant-a');
});

test('demo service stays explicit and does not enter live SQL', async () => {
  const { read, calls } = handbookReader({ demo: true });
  assert.deepEqual(await read('tenant-a', 'business_admin'), { ok: true, data: { id: 'demo' } });
  assert.deepEqual(calls, [['demo']]);
});
