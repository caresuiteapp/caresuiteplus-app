import assert from 'node:assert/strict';
import test from 'node:test';
import { projectImportVerificationEvidence } from '../../src/lib/import/importVerificationEvidence.web.ts';

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const at = (n) => `2026-10-14T22:00:00.${String(n).padStart(6, '0')}Z`;
const sha = (c) => c.repeat(64);
const row = (n, overrides = {}) => ({ sourceRowId: id(10 + n), tenantId: id(1), importRunId: id(2), sourceId: id(3), sourceOrdinal: n + 1, sourceRecordType: 'vital.measurement', sourceContentSha256: sha(String(n + 1)), sourceUnitCode: 'mg.dl', decision: 'imported', targetEntityId: id(30 + n), targetContentSha256: sha(String(n + 4)), targetUnitCode: 'mmol.l', unitMappingRuleVersion: 'glucose.v2', duplicateOfSourceRowId: null, reasonCode: null, ...overrides });
const rows = () => [row(0), row(1, { decision: 'rejected', targetEntityId: null, targetContentSha256: null, sourceUnitCode: null, targetUnitCode: null, unitMappingRuleVersion: null, reasonCode: 'invalid.date' }), row(2, { decision: 'duplicate', targetEntityId: null, targetContentSha256: null, sourceUnitCode: null, targetUnitCode: null, unitMappingRuleVersion: null, duplicateOfSourceRowId: id(10), reasonCode: 'same.source.content' })];
const sample = (n, source, overrides = {}) => ({ sampleId: id(60 + n), tenantId: id(1), importRunId: id(2), sourceRowId: source.sourceRowId, decision: source.decision, sourceContentSha256: source.sourceContentSha256, targetEntityId: source.targetEntityId, targetContentSha256: source.targetContentSha256, verifierProfileId: id(70), permissionKey: 'import.verify', permissionEvidenceId: id(71), checkedAt: at(2 + n), ...overrides });
const base = (overrides = {}) => { const sourceRows = rows(); return { tenantId: id(1), importRunId: id(2), sourceId: id(3), sourceVersion: 'legacy.v7', sourceSha256: sha('a'), evaluatedAt: at(9), declaredCounts: { sourceTotal: 3, imported: 1, rejected: 1, duplicate: 1 }, rows: sourceRows, samples: sourceRows.map((source, n) => sample(n, source)), ...overrides }; };

test('counts and representative contents are verified without completeness or release inference', () => {
  const result = projectImportVerificationEvidence(base());
  assert.deepEqual(result.counts, { sourceTotal: 3, imported: 1, rejected: 1, duplicate: 1 });
  assert.equal(result.status, 'counts_and_samples_verified');
  assert.deepEqual([result.importCompletenessInferred, result.semanticEquivalenceInferred, result.clinicalValidityInferred, result.releaseApprovalInferred], [false, false, false, false]);
  assert.ok(Object.isFrozen(result.rows)); assert.ok(Object.isFrozen(result.samples));
});

test('declared counts must equal every individual source-row decision', () => {
  assert.throws(() => projectImportVerificationEvidence(base({ declaredCounts: { sourceTotal: 3, imported: 2, rejected: 0, duplicate: 1 } })), /Importmengen/);
});

test('source order identities and target identities remain unique and exact', () => {
  const b = base();
  assert.throws(() => projectImportVerificationEvidence({ ...b, rows: b.rows.map((r, i) => i === 1 ? { ...r, sourceOrdinal: 3 } : r) }), /Originalreihenfolge/);
  assert.throws(() => projectImportVerificationEvidence({ ...b, rows: [b.rows[0], { ...b.rows[0], sourceOrdinal: 2 }, b.rows[2]] }), /doppelte Quellzeilen/);
  assert.throws(() => projectImportVerificationEvidence({ ...b, rows: b.rows.map((r, i) => i === 1 ? row(1, { targetEntityId: id(30) }) : r), declaredCounts: { sourceTotal: 3, imported: 2, rejected: 0, duplicate: 1 }, samples: [sample(0, b.rows[0]), sample(2, b.rows[2])] }), /dieselbe Zielkennung/);
});

test('unit mapping is either complete and versioned or explicitly absent', () => {
  const b = base();
  assert.throws(() => projectImportVerificationEvidence({ ...b, rows: b.rows.map((r, i) => i === 0 ? { ...r, targetUnitCode: null } : r) }), /vollstaendig zugeordnet/);
  const unitless = row(0, { sourceUnitCode: null, targetUnitCode: null, unitMappingRuleVersion: null });
  const adjusted = { ...b, rows: [unitless, ...b.rows.slice(1)], samples: [sample(0, unitless), ...b.samples.slice(1)] };
  assert.equal(projectImportVerificationEvidence(adjusted).rows[0].sourceUnitCode, null);
});

test('rejections and duplicates cannot masquerade as imported targets', () => {
  const b = base();
  assert.throws(() => projectImportVerificationEvidence({ ...b, rows: b.rows.map((r, i) => i === 1 ? { ...r, targetEntityId: id(99) } : r) }), /widerspruechliche Ziel/);
  assert.throws(() => projectImportVerificationEvidence({ ...b, rows: b.rows.map((r, i) => i === 2 ? { ...r, duplicateOfSourceRowId: id(99) } : r) }), /fruehere Quellzeile/);
});

test('samples must match source and target content and cover every decision present', () => {
  const b = base();
  assert.throws(() => projectImportVerificationEvidence({ ...b, samples: b.samples.map((s, i) => i === 0 ? { ...s, targetContentSha256: sha('f') } : s) }), /stimmt nicht exakt/);
  assert.throws(() => projectImportVerificationEvidence({ ...b, samples: [b.samples[0], b.samples[1]] }), /nicht jede vorhandene/);
});

test('sample permission and microsecond causal time are fail closed', () => {
  const b = base();
  assert.throws(() => projectImportVerificationEvidence({ ...b, samples: b.samples.map((s, i) => i === 0 ? { ...s, permissionKey: 'import.manage' } : s) }), /Pruefberechtigung/);
  assert.throws(() => projectImportVerificationEvidence({ ...b, samples: b.samples.map((s, i) => i === 0 ? { ...s, checkedAt: at(10) } : s) }), /Auswertungszeit/);
});

test('native scope exact shapes hashes technical codes and own fields fail closed', () => {
  assert.throws(() => projectImportVerificationEvidence(base({ tenantId: 'tenant' })), /native UUID/);
  assert.throws(() => projectImportVerificationEvidence(base({ sourceSha256: 'hash' })), /SHA-256/);
  assert.throws(() => projectImportVerificationEvidence({ ...base(), extra: true }), /nicht erlaubte Felder/);
  assert.throws(() => projectImportVerificationEvidence(base({ sourceVersion: 'Legacy V7' })), /technischer Code/);
  const getter = base(); Object.defineProperty(getter, 'sourceId', { get: () => id(3), enumerable: true });
  assert.throws(() => projectImportVerificationEvidence(getter), /Originalwert/);
});
