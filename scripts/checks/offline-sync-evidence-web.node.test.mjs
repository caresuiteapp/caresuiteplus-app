import assert from 'node:assert/strict';
import test from 'node:test';
import { projectOfflineSyncEvidence } from '../../src/lib/offline/offlineSyncEvidence.web.ts';

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const at = (n) => `2026-10-14T21:00:00.${String(n).padStart(6, '0')}Z`;
const sha = (value) => value.repeat(64);
const attempt = (overrides = {}) => ({
  attemptId: id(20), sequence: 1, tenantId: id(1), workspaceId: id(2), operationId: id(3),
  requestId: id(8), payloadSha256: sha('a'), startedAt: at(2), completedAt: at(3), outcome: 'uncertain',
  responseSha256: null, serverReceiptId: null, serverVersion: null, serverPayloadSha256: null,
  conflictEvidenceId: null, conflictEvidenceSha256: null, ...overrides,
});
const entry = (overrides = {}) => ({
  operationId: id(3), tenantId: id(1), workspaceId: id(2), entityId: id(4), actorProfileId: id(5),
  deviceId: id(6), kind: 'update', requestId: id(8), payloadSha256: sha('a'), capturedAt: at(1),
  draftEvidenceId: id(9), localProtectionEvidenceId: id(10), localProtectionEvidenceSha256: sha('b'),
  permissionKey: 'pflege.offline.write', permissionEvidenceId: id(11), attempts: [attempt()], ...overrides,
});
const base = (overrides = {}) => ({ tenantId: id(1), workspaceId: id(2), evaluatedAt: at(9), entries: [entry()], ...overrides });

test('an uncertain offline write remains visibly retry-pending and never implies acceptance', () => {
  const result = projectOfflineSyncEvidence(base());
  assert.equal(result.entries[0].disposition, 'retry_pending');
  assert.equal(result.entries[0].serverAcceptanceConfirmed, false);
  assert.deepEqual([
    result.entries[0].serverAcceptanceInferred, result.entries[0].deletionInferred,
    result.entries[0].clinicalCompletionInferred,
  ], [false, false, false]);
  assert.ok(Object.isFrozen(result.entries[0].attempts));
});

test('only a matching complete server receipt confirms acceptance', () => {
  const accepted = attempt({
    outcome: 'accepted', responseSha256: sha('c'), serverReceiptId: id(30), serverVersion: 7,
    serverPayloadSha256: sha('a'),
  });
  const result = projectOfflineSyncEvidence(base({ entries: [entry({ attempts: [accepted] })] }));
  assert.equal(result.entries[0].disposition, 'server_accepted');
  assert.equal(result.entries[0].serverAcceptanceConfirmed, true);
  assert.equal(result.entries[0].deletionInferred, false);
  assert.throws(() => projectOfflineSyncEvidence(base({ entries: [entry({ attempts: [{ ...accepted, serverPayloadSha256: sha('d') }] })] })), /Serverannahme/);
});

test('rejected and never-attempted writes remain local and unconfirmed', () => {
  const rejected = attempt({ outcome: 'rejected', responseSha256: sha('c') });
  assert.equal(projectOfflineSyncEvidence(base({ entries: [entry({ attempts: [rejected] })] })).entries[0].disposition, 'local_unconfirmed');
  assert.equal(projectOfflineSyncEvidence(base({ entries: [entry({ attempts: [] })] })).entries[0].disposition, 'local_unconfirmed');
});

test('a conflict preserves both local draft identity and complete server evidence', () => {
  const conflict = attempt({
    outcome: 'conflict', responseSha256: sha('c'), serverReceiptId: id(30), serverVersion: 8,
    serverPayloadSha256: sha('d'), conflictEvidenceId: id(31), conflictEvidenceSha256: sha('e'),
  });
  const result = projectOfflineSyncEvidence(base({ entries: [entry({ attempts: [conflict] })] }));
  assert.equal(result.entries[0].disposition, 'conflict_review');
  assert.equal(result.entries[0].draftEvidenceId, id(9));
  assert.equal(result.entries[0].attempts[0].serverPayloadSha256, sha('d'));
  assert.throws(() => projectOfflineSyncEvidence(base({ entries: [entry({ attempts: [{ ...conflict, conflictEvidenceId: null }] })] })), /Serverkonflikt/);
});

test('retries keep the exact operation request and payload and stop after acceptance', () => {
  const uncertain = attempt();
  const accepted = attempt({
    attemptId: id(21), sequence: 2, startedAt: at(4), completedAt: at(5), outcome: 'accepted',
    responseSha256: sha('c'), serverReceiptId: id(30), serverVersion: 7, serverPayloadSha256: sha('a'),
  });
  assert.equal(projectOfflineSyncEvidence(base({ entries: [entry({ attempts: [uncertain, accepted] })] })).entries[0].disposition, 'server_accepted');
  assert.throws(() => projectOfflineSyncEvidence(base({ entries: [entry({ attempts: [uncertain, { ...accepted, requestId: id(99) }] })] })), /unveraenderten Offline-Eintrag/);
  const acceptedFirst = { ...accepted, sequence: 1, startedAt: at(2), completedAt: at(3) };
  assert.throws(() => projectOfflineSyncEvidence(base({ entries: [entry({ attempts: [acceptedFirst, { ...accepted, attemptId: id(22), sequence: 2, startedAt: at(6), completedAt: at(7) }] })] })), /kein weiterer Synchronversuch/);
});

test('attempt history is contiguous and strictly ordered at microsecond precision', () => {
  assert.throws(() => projectOfflineSyncEvidence(base({ entries: [entry({ attempts: [attempt({ sequence: 2 })] })] })), /nicht lueckenlos/);
  assert.throws(() => projectOfflineSyncEvidence(base({ entries: [entry({ attempts: [attempt({ startedAt: at(0) })] })] })), /Ereignisfolge/);
  assert.throws(() => projectOfflineSyncEvidence(base({ entries: [entry({ attempts: [attempt({ completedAt: at(10) })] })] })), /Ereignisfolge/);
});

test('an accepted delete request still does not infer physical deletion', () => {
  const accepted = attempt({
    outcome: 'accepted', responseSha256: sha('c'), serverReceiptId: id(30), serverVersion: 9,
    serverPayloadSha256: sha('a'),
  });
  const result = projectOfflineSyncEvidence(base({ entries: [entry({ kind: 'delete', attempts: [accepted] })] }));
  assert.equal(result.entries[0].serverAcceptanceConfirmed, true);
  assert.equal(result.entries[0].deletionInferred, false);
});

test('native scope protection permission exact shape hashes and own fields fail closed', () => {
  assert.throws(() => projectOfflineSyncEvidence(base({ tenantId: 'tenant' })), /native UUID/);
  assert.throws(() => projectOfflineSyncEvidence(base({ entries: [entry({ tenantId: id(99) })] })), /anderen Mandanten/);
  assert.throws(() => projectOfflineSyncEvidence(base({ entries: [entry(), entry()] })), /doppelte Operations/);
  assert.throws(() => projectOfflineSyncEvidence(base({ entries: [entry({ localProtectionEvidenceSha256: 'hash' })] })), /SHA-256/);
  assert.throws(() => projectOfflineSyncEvidence({ ...base(), extra: true }), /nicht erlaubte Felder/);
  assert.throws(() => projectOfflineSyncEvidence(base({ entries: [entry({ permissionKey: 'Pflege Write' })] })), /technischer Code/);
  const getter = base(); Object.defineProperty(getter, 'tenantId', { get: () => id(1), enumerable: true });
  assert.throws(() => projectOfflineSyncEvidence(getter), /Originalwert/);
});
