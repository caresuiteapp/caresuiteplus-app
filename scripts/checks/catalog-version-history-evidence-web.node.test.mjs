import assert from 'node:assert/strict';
import test from 'node:test';
import { projectCatalogVersionHistoryEvidence } from '../../src/lib/organization/catalogVersionHistoryEvidence.web.ts';

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const sha = (character) => character.repeat(64);
const at = (day, micros = 0) => `2026-10-${String(day).padStart(2, '0')}T10:00:00.${String(micros).padStart(6, '0')}Z`;
const catalogItem = (label, itemSha256) => ({ itemId: id(20), code: 'care.basic', label, unit: 'visit', itemSha256 });
const catalogVersion = ({ version, versionId, validFrom, validUntil, label, itemSha256, revision, createdAt }) => ({
  catalogVersionId: id(versionId), tenantId: id(1), catalogId: id(10), version, validFrom, validUntil,
  changeReason: version === '1.0.0' ? 'Erstfassung' : 'Leistungsbezeichnung aktualisiert', responsibleProfileId: id(30),
  permissionKey: 'organization.catalog-version.publish', permissionEvidenceId: id(versionId + 100), items: [catalogItem(label, itemSha256)],
  recordSha256: version === '1.0.0' ? sha('a') : sha('b'), revision, createdAt,
});
const base = (override = {}) => ({
  tenantId: id(1), catalogId: id(10),
  catalogVersions: [
    catalogVersion({ version: '1.0.0', versionId: 11, validFrom: at(1), validUntil: at(10), label: 'Grundpflege alt', itemSha256: sha('c'), revision: 1, createdAt: at(1, 0) }),
    catalogVersion({ version: '2.0.0', versionId: 12, validFrom: at(10), validUntil: null, label: 'Grundpflege neu', itemSha256: sha('d'), revision: 2, createdAt: at(9) }),
  ],
  historicalDocument: {
    documentId: id(40), tenantId: id(1), subjectId: id(41), catalogId: id(10), catalogVersionId: id(11), catalogVersion: '1.0.0', catalogRecordSha256: sha('a'),
    itemSnapshot: catalogItem('Grundpflege alt', sha('c')), documentSha256: sha('e'), occurredAt: at(5, 1), recordedAt: at(12, 2), authorProfileId: id(42),
  },
  historicalResolution: {
    queryEvidenceId: id(50), tenantId: id(1), documentId: id(40), activeCatalogVersionId: id(12), activeCatalogVersion: '2.0.0',
    resolvedCatalogVersionId: id(11), resolvedCatalogVersion: '1.0.0', resolvedCatalogSha256: sha('a'), resolvedItemSnapshot: catalogItem('Grundpflege alt', sha('c')), queriedAt: at(13, 3),
  },
  evaluatedAt: at(14, 4), ...override,
});

test('historical document retains its exact former catalog and item while a newer version is active', () => {
  const result = projectCatalogVersionHistoryEvidence(base());
  assert.deepEqual([result.historicalCatalogVersion, result.activeCatalogVersion, result.historicalVersionRetained, result.catalogMigrationInferred], ['1.0.0', '2.0.0', true, false]);
  assert.deepEqual([result.functionalAcceptanceInferred, result.careAcceptanceInferred, result.designAcceptanceInferred, result.legalAcceptanceInferred], [false, false, false, false]);
  assert.ok(Object.isFrozen(result));
});

test('catalog versions preserve tenant, catalog, validity, change reason, responsible person, and permission', () => {
  const value = base();
  assert.throws(() => projectCatalogVersionHistoryEvidence({ ...value, catalogVersions: [{ ...value.catalogVersions[0], tenantId: id(9) }, value.catalogVersions[1]] }), /nicht zum belegten Mandanten/);
  assert.throws(() => projectCatalogVersionHistoryEvidence({ ...value, catalogVersions: [value.catalogVersions[0], { ...value.catalogVersions[1], changeReason: '' }] }), /Aenderungsgrund/);
  assert.throws(() => projectCatalogVersionHistoryEvidence({ ...value, catalogVersions: [value.catalogVersions[0], { ...value.catalogVersions[1], permissionKey: 'organization.catalog-version.read' }] }), /berechtigung fehlt/);
});

test('version intervals are contiguous, ordered, uniquely versioned, and current at evaluation', () => {
  const value = base();
  assert.throws(() => projectCatalogVersionHistoryEvidence({ ...value, catalogVersions: [{ ...value.catalogVersions[0], validUntil: at(9) }, value.catalogVersions[1]] }), /keine eindeutige geschlossene Historie/);
  assert.throws(() => projectCatalogVersionHistoryEvidence({ ...value, catalogVersions: [value.catalogVersions[0], { ...value.catalogVersions[1], version: '1.0.0' }] }), /keine eindeutige geschlossene Historie/);
  assert.throws(() => projectCatalogVersionHistoryEvidence({ ...value, evaluatedAt: at(9) }), /keine eindeutige geschlossene Historie/);
});

test('catalog items require native distinct identity, stable order, codes, units, and checksums', () => {
  const value = base(), second = { itemId: id(21), code: 'care.extra', label: 'Zusatz', unit: 'visit', itemSha256: sha('f') };
  assert.throws(() => projectCatalogVersionHistoryEvidence({ ...value, catalogVersions: [{ ...value.catalogVersions[0], items: [second, value.catalogVersions[0].items[0]] }, value.catalogVersions[1]] }), /stabil/);
  assert.throws(() => projectCatalogVersionHistoryEvidence({ ...value, catalogVersions: [{ ...value.catalogVersions[0], items: [value.catalogVersions[0].items[0], { ...second, itemId: id(20) }] }, value.catalogVersions[1]] }), /Dubletten/);
  assert.throws(() => projectCatalogVersionHistoryEvidence({ ...value, catalogVersions: [{ ...value.catalogVersions[0], items: [{ ...value.catalogVersions[0].items[0], unit: '' }] }, value.catalogVersions[1]] }), /stabiler Code/);
});

test('historical document binds former catalog identity, version, checksum, and original item snapshot', () => {
  const value = base();
  assert.throws(() => projectCatalogVersionHistoryEvidence({ ...value, historicalDocument: { ...value.historicalDocument, catalogVersionId: id(12) } }), /nicht exakt an/);
  assert.throws(() => projectCatalogVersionHistoryEvidence({ ...value, historicalDocument: { ...value.historicalDocument, catalogRecordSha256: sha('b') } }), /nicht exakt an/);
  assert.throws(() => projectCatalogVersionHistoryEvidence({ ...value, historicalDocument: { ...value.historicalDocument, itemSnapshot: catalogItem('Grundpflege neu', sha('d')) } }), /nicht die damalige Katalogposition/);
});

test('actual event selects historical validity while later recording stays a separate time', () => {
  const value = base();
  assert.throws(() => projectCatalogVersionHistoryEvidence({ ...value, historicalDocument: { ...value.historicalDocument, occurredAt: at(10) } }), /damaligen Gueltigkeitszeitraum/);
  assert.throws(() => projectCatalogVersionHistoryEvidence({ ...value, historicalDocument: { ...value.historicalDocument, recordedAt: at(4) } }), /Ereignisfolge/);
  const late = projectCatalogVersionHistoryEvidence(value);
  assert.equal(late.historicalVersionRetained, true);
});

test('historical resolution names active version but resolves only the document former version and item', () => {
  const value = base();
  assert.throws(() => projectCatalogVersionHistoryEvidence({ ...value, historicalResolution: { ...value.historicalResolution, activeCatalogVersionId: id(11) } }), /nicht die aktuelle/);
  assert.throws(() => projectCatalogVersionHistoryEvidence({ ...value, historicalResolution: { ...value.historicalResolution, resolvedCatalogVersionId: id(12), resolvedCatalogVersion: '2.0.0', resolvedCatalogSha256: sha('b') } }), /ersetzt die damalige Katalogfassung/);
  assert.throws(() => projectCatalogVersionHistoryEvidence({ ...value, historicalResolution: { ...value.historicalResolution, resolvedItemSnapshot: catalogItem('Grundpflege neu', sha('d')) } }), /ersetzt die damalige Katalogposition/);
});

test('creation, event, recording, activation, query, and evaluation preserve exact own microsecond values', () => {
  const value = base();
  assert.throws(() => projectCatalogVersionHistoryEvidence({ ...value, historicalResolution: { ...value.historicalResolution, queriedAt: at(9) } }), /Mikrosekundenfolge/);
  assert.throws(() => projectCatalogVersionHistoryEvidence({ ...value, historicalDocument: { ...value.historicalDocument, migrated: true } }), /nicht erlaubte Felder/);
  const getter = { ...value.catalogVersions[0] };
  Object.defineProperty(getter, 'changeReason', { enumerable: true, get: () => 'Erstfassung' });
  assert.throws(() => projectCatalogVersionHistoryEvidence({ ...value, catalogVersions: [getter, value.catalogVersions[1]] }), /Originalwert/);
});
