import assert from 'node:assert/strict';
import test from 'node:test';
import { projectBackupRecoveryEvidence } from '../../src/lib/backup/backupRecoveryEvidence.web.ts';

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const at = (n) => `2026-10-14T23:00:00.${String(n).padStart(6, '0')}Z`;
const sha = (c) => c.repeat(64);
const content = (n, overrides = {}) => ({ contentId: id(20 + n), tenantId: id(1), backupId: id(2), entityType: n ? 'care.events' : 'client.records', sourceVersion: `source.v${n + 1}`, recordCount: n ? 7 : 3, contentSha256: sha(String(n + 2)), ...overrides });
const contents = () => [content(0), content(1)];
const drill = (items, overrides = {}) => ({ drillId: id(40), tenantId: id(1), backupId: id(2), sourceSystemId: id(3), targetEnvironmentId: id(4), targetEnvironmentKind: 'isolated_validation', recoveryPointAt: at(1), startedAt: at(5), completedAt: at(7), outcome: 'succeeded', archiveSha256: sha('a'), manifestSha256: sha('b'), restoredContents: items.map(({ contentId, recordCount, contentSha256 }) => ({ contentId, recordCount, contentSha256 })), verifierProfileId: id(50), permissionKey: 'backup.restore.verify', permissionEvidenceId: id(51), reportSha256: sha('f'), ...overrides });
const base = (overrides = {}) => { const items = contents(); return { tenantId: id(1), backupId: id(2), sourceSystemId: id(3), backupFormatVersion: 'backup.v3', snapshotAt: at(1), createdAt: at(2), archiveSha256: sha('a'), manifestSha256: sha('b'), creatorProfileId: id(10), creatorPermissionKey: 'backup.create', creatorPermissionEvidenceId: id(11), storage: { tenantId: id(1), backupId: id(2), objectId: id(12), locationCode: 'eu.primary', encryptionKeyVersion: 'kms.v9', archiveSha256: sha('a'), manifestSha256: sha('b'), accessEvidenceId: id(13), accessProfileId: id(14), permissionKey: 'backup.storage.read', verifiedAt: at(4) }, contents: items, restoreDrill: drill(items), evaluatedAt: at(9), ...overrides }; };

test('successful isolated restore verifies the backup without production legal or clinical inference', () => {
  const result = projectBackupRecoveryEvidence(base());
  assert.equal(result.status, 'restoration_verified');
  assert.equal(result.backupVerified, true);
  assert.deepEqual([result.productionRecoveryReadinessInferred, result.legalRetentionComplianceInferred, result.clinicalCompletenessInferred, result.sourceDeletionInferred], [false, false, false, false]);
  assert.ok(Object.isFrozen(result)); assert.ok(Object.isFrozen(result.contents)); assert.ok(Object.isFrozen(result.restoreDrill.restoredContents));
});

test('an existing backup and a failed drill remain explicitly unverified', () => {
  const missing = projectBackupRecoveryEvidence(base({ restoreDrill: null }));
  assert.deepEqual([missing.status, missing.backupVerified], ['backup_exists_unverified', false]);
  const b = base();
  const failed = projectBackupRecoveryEvidence({ ...b, restoreDrill: drill(b.contents, { outcome: 'failed', restoredContents: [] }) });
  assert.deepEqual([failed.status, failed.backupVerified], ['restoration_failed', false]);
});

test('tenant backup archive manifest and isolated target bindings fail closed', () => {
  const b = base();
  assert.throws(() => projectBackupRecoveryEvidence({ ...b, storage: { ...b.storage, tenantId: id(99) } }), /nicht exakt/);
  assert.throws(() => projectBackupRecoveryEvidence({ ...b, restoreDrill: { ...b.restoreDrill, archiveSha256: sha('c') } }), /nicht exakt und isoliert/);
  assert.throws(() => projectBackupRecoveryEvidence({ ...b, restoreDrill: { ...b.restoreDrill, targetEnvironmentId: id(3) } }), /nicht exakt und isoliert/);
});

test('successful restore covers every manifest content exactly once with equal count and hash', () => {
  const b = base();
  assert.throws(() => projectBackupRecoveryEvidence({ ...b, restoreDrill: { ...b.restoreDrill, restoredContents: b.restoreDrill.restoredContents.slice(0, 1) } }), /nicht lueckenlos/);
  assert.throws(() => projectBackupRecoveryEvidence({ ...b, restoreDrill: { ...b.restoreDrill, restoredContents: b.restoreDrill.restoredContents.map((r, i) => i ? { ...r, recordCount: 8 } : r) } }), /nicht exakt/);
  assert.throws(() => projectBackupRecoveryEvidence({ ...b, restoreDrill: { ...b.restoreDrill, restoredContents: [...b.restoreDrill.restoredContents, b.restoreDrill.restoredContents[0]] } }), /doppelte Inhaltskennungen/);
});

test('backup and storage permissions remain separate from restore verification permission', () => {
  const b = base();
  assert.throws(() => projectBackupRecoveryEvidence({ ...b, creatorPermissionKey: 'backup.read' }), /Erstellberechtigung/);
  assert.throws(() => projectBackupRecoveryEvidence({ ...b, storage: { ...b.storage, permissionKey: 'backup.create' } }), /Leseberechtigung/);
  assert.throws(() => projectBackupRecoveryEvidence({ ...b, restoreDrill: { ...b.restoreDrill, permissionKey: 'backup.restore' } }), /Pruefberechtigung/);
});

test('snapshot creation storage restore and evaluation preserve microsecond causal order', () => {
  const b = base();
  assert.throws(() => projectBackupRecoveryEvidence({ ...b, createdAt: at(0) }), /nicht kausal/);
  assert.throws(() => projectBackupRecoveryEvidence({ ...b, storage: { ...b.storage, verifiedAt: at(1) } }), /ausserhalb der Sicherungsfolge/);
  assert.throws(() => projectBackupRecoveryEvidence({ ...b, restoreDrill: { ...b.restoreDrill, startedAt: at(3) } }), /kausalen Ereignisfolge/);
  assert.throws(() => projectBackupRecoveryEvidence({ ...b, restoreDrill: { ...b.restoreDrill, completedAt: at(10) } }), /kausalen Ereignisfolge/);
});

test('native identities exact shapes hashes technical codes and unique contents are required', () => {
  const b = base();
  assert.throws(() => projectBackupRecoveryEvidence({ ...b, backupId: 'backup' }), /native UUID/);
  assert.throws(() => projectBackupRecoveryEvidence({ ...b, archiveSha256: 'bad' }), /SHA-256/);
  assert.throws(() => projectBackupRecoveryEvidence({ ...b, backupFormatVersion: 'Bad value' }), /technischer Code/);
  assert.throws(() => projectBackupRecoveryEvidence({ ...b, extra: true }), /nicht erlaubte Felder/);
  assert.throws(() => projectBackupRecoveryEvidence({ ...b, contents: [b.contents[0], { ...b.contents[1], contentId: b.contents[0].contentId }] }), /doppelte Inhaltskennungen/);
});

test('getters prototype values invalid times and foreign content cannot supply original evidence', () => {
  const b = base();
  const getter = { ...b }; Object.defineProperty(getter, 'archiveSha256', { enumerable: true, get: () => sha('a') });
  assert.throws(() => projectBackupRecoveryEvidence(getter), /Originalwert/);
  const missing = { ...b }; delete missing.manifestSha256;
  const prior = Object.getOwnPropertyDescriptor(Object.prototype, 'manifestSha256'); Object.defineProperty(Object.prototype, 'manifestSha256', { value: sha('b'), configurable: true });
  try { assert.throws(() => projectBackupRecoveryEvidence(missing), /unvollstaendig/); } finally { if (prior) Object.defineProperty(Object.prototype, 'manifestSha256', prior); else delete Object.prototype.manifestSha256; }
  assert.throws(() => projectBackupRecoveryEvidence({ ...b, snapshotAt: '2026-02-30T00:00:00.000001Z' }), /Kalenderdatum/);
  assert.throws(() => projectBackupRecoveryEvidence({ ...b, contents: b.contents.map((c, i) => i ? { ...c, tenantId: id(99) } : c) }), /anderen Sicherungsumfang/);
});
