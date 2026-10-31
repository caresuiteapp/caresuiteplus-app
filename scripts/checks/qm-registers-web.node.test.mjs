import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { mapQmRegisterRows, filterQmRegister, qmRegisterDate } from '../../src/lib/qm/qmRegisterDomain.web.ts';

const tenant = '77777777-7777-4777-8777-777777777777';
const audit = (n = 1) => ({ id: `audit-${n}`, tenant_id: tenant, title: `Prüfung ${n}`, status: 'planned', audit_type: 'internal', scheduled_at: '2026-11-03T10:00:00Z', auditor_name: 'Alex', findings_count: 0, summary: 'Hygiene', completed_at: null });
const source = readFileSync(new URL('../../src/lib/qm/qmRegisterService.web.ts', import.meta.url), 'utf8');
function fixture(tables = {}, settings = {}) {
  const calls = [];
  const client = { from(table) {
    const query = { table, filters: {}, orders: [] };
    const chain = {
      select(columns) { query.columns = columns; return chain; },
      eq(key, value) { query.filters[key] = value; return chain; },
      order(key, options) { query.orders.push([key, options]); return chain; },
      range(first, last) { query.range = [first, last]; return chain; },
      maybeSingle() { query.single = true; return chain; },
      then(resolve, reject) {
        calls.push(structuredClone(query));
        let data = tables[table] ?? [];
        if (settings.invalidEnvelope) return Promise.resolve({ data: null, error: null }).then(resolve, reject);
        if (settings.foreignResponse) data = settings.foreignResponse;
        else data = data.filter(row => Object.entries(query.filters).every(([key, value]) => row[key] === value));
        if (query.range) data = data.slice(query.range[0], query.range[1] + 1);
        if (query.single) data = data[0] ?? null;
        return Promise.resolve({ data, error: settings.error ?? null }).then(resolve, reject);
      },
    };
    return chain;
  } };
  const dependencies = {
    getSupabaseClient: () => client,
    fromUnknownTable: (db, table) => db.from(table),
    qmReadError: () => 'Abfrage fehlgeschlagen',
    guardServiceTenant: value => value === tenant ? null : { ok: false, error: 'Fremder Mandant' },
    getServiceMode: () => settings.mode ?? 'supabase',
    enforceQmPermission: role => role === 'business_admin' ? null : { ok: false, error: 'Keine Leseberechtigung' },
    QM_VIEW: 'qm.view', mapQmRegisterRows,
  };
  const code = stripTypeScriptTypes(source.replace(/^import[\s\S]*?;\n/gm, '').replace(/\bexport /g, ''));
  const service = new Function(...Object.keys(dependencies), `${code};return {fetchQmRegister,fetchQmMdPackageRead};`)(...Object.values(dependencies));
  return { ...service, calls };
}

test('All six registers map their actual snake_case columns without invented zero values', () => {
  const fields = {
    audits: audit(), measures: { ...audit(), due_at: null, assigned_to: '', description: 'Maßnahme', audit_id: null },
    compliance: { ...audit(), due_at: null, responsible_role: 'QMB', evidence_document_ids: ['doc-1'], notes: 'Nachweis' },
    changes: { ...audit(), change_type: 'legal_update', requested_by: 'Alex', description: 'Text', document_id: 'doc-1' },
    legal: { ...audit(), reference_code: 'REF', source: 'Quelle', summary: 'Text', document_ids: [] },
    md: { ...audit(), inspection_year: 2027, datenschutz_confirmed: false, notes: 'Mappe' },
  };
  for (const [kind, row] of Object.entries(fields)) {
    const result = mapQmRegisterRows(kind, [row], tenant);
    assert.equal(result.ok, true); assert.equal(result.data.length, 1); assert.equal(result.data[0].id, row.id);
  }
  assert.equal(mapQmRegisterRows('md', [fields.md], tenant).data[0].category, 'Prüfjahr 2027');
  assert.equal(mapQmRegisterRows('audits', [{ ...audit(), findings_count: undefined }], tenant).data[0].details[0].value, 'Nicht bestätigt');
});

test('Wrong-tenant and malformed rows fail closed instead of disappearing as zero entries', () => {
  for (const row of [null, [], {}, { ...audit(), tenant_id: 'other' }, { ...audit(), title: ' ' }]) assert.equal(mapQmRegisterRows('audits', [audit(), row], tenant).ok, false);
  assert.deepEqual(mapQmRegisterRows('audits', [], tenant), { ok: true, data: [] });
});

test('Search matches translated statuses and applies all words together with the status filter', () => {
  const rows = mapQmRegisterRows('audits', [audit(1), { ...audit(2), status: 'completed', auditor_name: 'Chris' }], tenant).data;
  assert.deepEqual(filterQmRegister(rows, 'geplant alex', 'all').map(row => row.id), ['audit-1']);
  assert.equal(filterQmRegister(rows, 'Hygiene', 'completed').length, 1);
  assert.equal(filterQmRegister(rows, 'geplant', 'completed').length, 0);
  assert.equal(qmRegisterDate(null), 'Nicht hinterlegt');
  assert.equal(qmRegisterDate('invalid'), 'Datum nicht bestätigt');
});

test('Read queries remain tenant scoped, explicitly projected and paginated beyond the first 250 rows', async () => {
  const f = fixture({ qm_audits: Array.from({ length: 251 }, (_, index) => audit(index)) });
  const result = await f.fetchQmRegister('audits', tenant, 'business_admin');
  assert.equal(result.ok, true); assert.equal(result.data.length, 251);
  assert.equal(f.calls.length, 2);
  assert.deepEqual(f.calls.map(call => call.range), [[0, 249], [250, 499]]);
  for (const call of f.calls) { assert.equal(call.filters.tenant_id, tenant); assert.ok(!call.columns.includes('*')); assert.equal(call.orders.at(-1)[0], 'id'); }
});

test('Missing permission, foreign tenant and demo mode never enter live SELECT', async () => {
  for (const [id, role, mode] of [[tenant, null, 'supabase'], ['other', 'business_admin', 'supabase'], [tenant, 'business_admin', 'demo']]) {
    const f = fixture({}, { mode }); assert.equal((await f.fetchQmRegister('audits', id, role)).ok, false); assert.equal(f.calls.length, 0);
  }
});

test('Query errors and malformed successful envelopes stay errors', async () => {
  for (const settings of [{ error: { code: '42501' } }, { invalidEnvelope: true }, { foreignResponse: [{ ...audit(), tenant_id: 'other' }] }]) {
    const f = fixture({}, settings); assert.equal((await f.fetchQmRegister('audits', tenant, 'business_admin')).ok, false);
  }
});

test('MD contents preserve the stored version reference and verify both tenant and package', async () => {
  const pkg = { ...audit(), id: 'package-1', inspection_year: 2027, datenschutz_confirmed: true };
  const item = { id: 'item-1', tenant_id: tenant, package_id: 'package-1', document_id: 'doc-1', included_version_id: 'older-version', notes: 'Gespeichert', sort_order: 1 };
  const f = fixture({ md_audit_packages: [pkg], md_audit_package_items: [item] });
  const result = await f.fetchQmMdPackageRead(tenant, 'package-1', 'business_admin');
  assert.equal(result.ok, true); assert.equal(result.data.items[0].includedVersionId, 'older-version');
  assert.deepEqual(f.calls[1].filters, { tenant_id: tenant, package_id: 'package-1' });
  assert.ok(f.calls.every(call => !call.table.includes('token')));
  const missing = await f.fetchQmMdPackageRead(tenant, 'other-package', 'business_admin'); assert.equal(missing.ok, false);
});
