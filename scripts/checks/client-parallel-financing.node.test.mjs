import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {
  assessClientFinancingPath,
  assessParallelClientFinancingPaths,
} from '../../src/lib/clients/clientParallelFinancingDomain.ts';

const day = '2026-10-13';
const path = (overrides = {}) => ({
  id: 'path-xi-1',
  logicalPathId: 'logical-xi',
  tenantId: 'tenant-native',
  clientId: 'client-native',
  financingKind: 'sgb_xi',
  payerAssignmentId: 'assignment-native-xi',
  payerName: 'Pflegekasse Beispiel',
  payerIk: '123456789',
  basisReference: 'vertrag-xi-v2',
  validFrom: '2026-01-01',
  validUntil: null,
  status: 'active',
  version: 2,
  supersedesPathId: 'path-xi-0',
  createdAt: '2026-01-01T08:15:00.123456Z',
  ...overrides,
});

test('zeitgleich gültige SGB-XI-, SGB-V- und Privatwege bleiben drei eigenständige Ergebnisse', () => {
  const paths = [
    path(),
    path({ id: 'path-v-1', logicalPathId: 'logical-v', financingKind: 'sgb_v', payerAssignmentId: 'assignment-native-v', payerName: 'Krankenkasse Beispiel', basisReference: 'verordnung-original' }),
    path({ id: 'path-private-1', logicalPathId: 'logical-private', financingKind: 'private', payerAssignmentId: null, payerName: 'Selbstzahler', payerIk: null, basisReference: 'privatvereinbarung-original' }),
  ];
  const result = assessParallelClientFinancingPaths(paths, day);
  assert.equal(result.length, 3);
  assert.deepEqual(result.map((entry) => entry.path.id), ['path-private-1', 'path-v-1', 'path-xi-1']);
  assert.ok(result.every((entry) => entry.state === 'current'));
  assert.deepEqual(result.map((entry) => entry.path.financingKind).sort(), ['private', 'sgb_v', 'sgb_xi']);
});

test('zwei Wege derselben Rechtsgrundlage werden nicht nach Art verschmolzen', () => {
  const result = assessParallelClientFinancingPaths([
    path(),
    path({ id: 'path-xi-2', logicalPathId: 'logical-xi-2', payerName: 'Sozialhilfeträger', payerIk: null, basisReference: 'kostenuebernahme-77' }),
  ], day);
  assert.equal(result.length, 2);
  assert.notEqual(result[0].path.payerName, result[1].path.payerName);
  assert.notEqual(result[0].path.basisReference, result[1].path.basisReference);
});

test('Beginn und Ende sind am jeweiligen Kalendertag einschließlich aktuell', () => {
  assert.equal(assessClientFinancingPath(path({ validFrom: day }), day).state, 'current');
  assert.equal(assessClientFinancingPath(path({ validUntil: day }), day).state, 'current');
});

test('künftiger, abgelaufener und nicht aktiver Weg bleiben einzeln nicht aktuell', () => {
  const future = assessClientFinancingPath(path({ validFrom: '2026-10-14' }), day);
  const expired = assessClientFinancingPath(path({ validUntil: '2026-10-12' }), day);
  const draft = assessClientFinancingPath(path({ status: 'draft' }), day);
  assert.equal(future.state, 'not_current');
  assert.ok(future.issues.includes('not_started'));
  assert.ok(expired.issues.includes('expired'));
  assert.ok(draft.issues.includes('not_active'));
});

test('fehlendes Ende ist nicht dasselbe wie ausdrücklich unbefristet', () => {
  const missing = path();
  delete missing.validUntil;
  const result = assessClientFinancingPath(missing, day);
  assert.equal(result.state, 'incomplete');
  assert.ok(result.issues.includes('valid_until_invalid'));
  assert.equal(assessClientFinancingPath(path({ validUntil: null }), day).state, 'current');
});

test('Ende vor Beginn und ungültige Kalenderdaten werden nicht normalisiert', () => {
  const reversed = assessClientFinancingPath(path({ validUntil: '2025-12-31' }), day);
  const impossible = assessClientFinancingPath(path({ validFrom: '2026-02-30' }), day);
  assert.ok(reversed.issues.includes('valid_until_invalid'));
  assert.ok(impossible.issues.includes('valid_from_invalid'));
});

for (const [field, issue] of [
  ['id', 'path_identity_missing'],
  ['logicalPathId', 'logical_identity_missing'],
  ['tenantId', 'tenant_identity_missing'],
  ['clientId', 'client_identity_missing'],
  ['payerName', 'payer_name_missing'],
  ['basisReference', 'basis_reference_missing'],
]) {
  test(`fehlende Originalzuordnung ${field} bleibt unvollständig`, () => {
    const result = assessClientFinancingPath(path({ [field]: '' }), day);
    assert.equal(result.state, 'incomplete');
    assert.ok(result.issues.includes(issue));
  });
}

test('unbekannte Finanzierungsart und ungültige Version werden nicht als aktuell ausgegeben', () => {
  const kind = assessClientFinancingPath(path({ financingKind: 'mixed' }), day);
  const version = assessClientFinancingPath(path({ version: 1.5 }), day);
  assert.ok(kind.issues.includes('financing_kind_invalid'));
  assert.ok(version.issues.includes('version_invalid'));
});

test('doppelte native Pfadidentität wird statt stiller Zusammenführung verweigert', () => {
  assert.throws(() => assessParallelClientFinancingPaths([path(), path()], day), /Doppelte/);
});

test('Prüftag selbst wird als Kalenderdatum streng validiert', () => {
  assert.throws(() => assessClientFinancingPath(path(), '2026-02-30'));
  assert.throws(() => assessParallelClientFinancingPaths([path()], '2026-10-13T00:00:00Z'));
});

test('SQL erlaubt parallele Wege, bleibt append-only und erzeugt keine Altdaten', async () => {
  const sql = await fs.readFile(new URL('../../supabase/patches/ambulatory_client_parallel_financing.sql', import.meta.url), 'utf8');
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.client_financing_paths/);
  assert.match(sql, /financing_kind IN \('sgb_xi', 'sgb_v', 'private', 'other'\)/);
  assert.match(sql, /UNIQUE \(tenant_id, logical_path_id, version\)/);
  assert.match(sql, /WHERE replaced_at IS NULL/);
  assert.doesNotMatch(sql, /UNIQUE[^;]+tenant_id,\s*client_id[^;]*;/i);
  assert.doesNotMatch(sql, /GRANT[^;]*(UPDATE|DELETE)/i);
  assert.doesNotMatch(sql, /INSERT INTO public\.client_financing_paths\s*\([^;]+SELECT/is);
  assert.doesNotMatch(sql, /UPDATE\s+public\.client_financing_paths/i);
  assert.match(sql, /tenant_id = public\.current_tenant_id\(\)/);
});

test('Web erhält die getrennte Übersicht, während die native Standardimplementierung leer bleibt', async () => {
  const [web, nativeDefault, host] = await Promise.all([
    fs.readFile(new URL('../../src/components/office/ClientParallelFinancingSummary.web.tsx', import.meta.url), 'utf8'),
    fs.readFile(new URL('../../src/components/office/ClientParallelFinancingSummary.tsx', import.meta.url), 'utf8'),
    fs.readFile(new URL('../../src/components/office/ClientRecordContractsPanel.tsx', import.meta.url), 'utf8'),
  ]);
  assert.match(web, /assessParallelClientFinancingPaths/);
  assert.match(web, /listClientParallelFinancingPaths/);
  assert.match(nativeDefault, /return null/);
  assert.match(host, /<ClientParallelFinancingSummary clientId=\{clientId\}/);
});
