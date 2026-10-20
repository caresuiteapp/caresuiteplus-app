import assert from 'node:assert/strict';
import test from 'node:test';
import { projectAccessAuditEvidence } from '../../src/lib/privacy/accessAuditEvidence.ts';

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const at = (hour, micros = 1) => `2026-10-14T${String(hour).padStart(2, '0')}:00:00.${String(micros).padStart(6, '0')}Z`;
const base = (overrides = {}) => ({
  tenantId: id(1),
  evaluatedAt: at(12, 9),
  event: {
    eventId: id(2), tenantId: id(1), actorProfileId: id(3), roleKey: 'pflege.fachkraft',
    permissionKey: 'pflege.clients.view_sensitive', permissionEvidenceId: id(4), action: 'read',
    objectType: 'care_record', objectId: id(5), subjectId: id(6),
    purpose: { purposeId: id(7), purposeCode: 'care.delivery', version: 'v3' },
    occurredAt: at(11, 123456), outcome: 'allowed', denialCode: null,
    technicalContext: { correlationId: id(8), sourceSystem: 'web.desktop', sourceVersion: '2026.10.14', itemCount: 1, contentSha256: 'a'.repeat(64) },
  },
  ...overrides,
});

test('allowed event binds actor action object time purpose and safe technical evidence only', () => {
  const result = projectAccessAuditEvidence(base());
  assert.equal(result.event.action, 'read');
  assert.equal(result.event.subjectId, id(6));
  assert.equal(result.event.purpose.purposeCode, 'care.delivery');
  assert.equal(result.sensitivePayloadCopied, false);
  assert.equal(result.accessAuthorizationInferred, false);
  assert.equal(result.clinicalActionInferred, false);
  assert.ok(Object.isFrozen(result));
});

test('denied event requires a technical denial code and never proves authorization', () => {
  const denied = base();
  denied.event = { ...denied.event, outcome: 'denied', denialCode: 'permission.denied' };
  const result = projectAccessAuditEvidence(denied);
  assert.equal(result.event.outcome, 'denied');
  assert.equal(result.accessAuthorizationInferred, false);
  const missing = base();
  missing.event = { ...missing.event, outcome: 'denied' };
  assert.throws(() => projectAccessAuditEvidence(missing), /benoetigt einen technischen Ablehnungscode/);
});

test('free-form details arbitrary metadata and business payload fields are rejected', () => {
  for (const extra of [
    { details: 'Diagnose und voller Name' },
    { metadata: { medication: 'Insulin' } },
    { patientName: 'Person A' },
  ]) {
    const input = base();
    input.event = { ...input.event, ...extra };
    assert.throws(() => projectAccessAuditEvidence(input), /nicht erlaubte Nutzdatenfelder/);
  }
  const root = { ...base(), payload: { woundDescription: 'Freitext' } };
  assert.throws(() => projectAccessAuditEvidence(root), /nicht erlaubte Nutzdatenfelder/);
});

test('technical context is an exact allowlist and cannot smuggle sensitive values', () => {
  const input = base();
  input.event = { ...input.event, technicalContext: { ...input.event.technicalContext, requesterName: 'Person B' } };
  assert.throws(() => projectAccessAuditEvidence(input), /nicht erlaubte Nutzdatenfelder/);
  const freeText = base();
  freeText.event = { ...freeText.event, technicalContext: { ...freeText.event.technicalContext, sourceSystem: 'Web von Person B' } };
  assert.throws(() => projectAccessAuditEvidence(freeText), /technischer Code/);
});

test('tenant object subject actor permission and purpose identities remain native and separate', () => {
  const foreign = base();
  foreign.event = { ...foreign.event, tenantId: id(99) };
  assert.throws(() => projectAccessAuditEvidence(foreign), /anderen Mandanten/);
  for (const change of [{ actorProfileId: 'user' }, { objectId: 'record' }, { subjectId: 'client' }, { permissionEvidenceId: 'permission' }]) {
    const input = base();
    input.event = { ...input.event, ...change };
    assert.throws(() => projectAccessAuditEvidence(input), /native UUID/);
  }
});

test('allowed and denied outcomes preserve exact permission and purpose codes without inference', () => {
  const allowedWithDenial = base();
  allowedWithDenial.event = { ...allowedWithDenial.event, denialCode: 'permission.denied' };
  assert.throws(() => projectAccessAuditEvidence(allowedWithDenial), /darf keinen Ablehnungscode/);
  const invalidAction = base();
  invalidAction.event = { ...invalidAction.event, action: 'dump_payload' };
  assert.throws(() => projectAccessAuditEvidence(invalidAction), /keine erlaubte Aktion/);
  const invalidPurpose = base();
  invalidPurpose.event = { ...invalidPurpose.event, purpose: { ...invalidPurpose.event.purpose, purposeCode: 'Freitext Zweck' } };
  assert.throws(() => projectAccessAuditEvidence(invalidPurpose), /technischer Code/);
});

test('event time keeps microseconds and cannot follow the evaluation', () => {
  const result = projectAccessAuditEvidence(base());
  assert.equal(result.event.occurredAt, at(11, 123456));
  const future = base();
  future.event = { ...future.event, occurredAt: at(13, 1) };
  assert.throws(() => projectAccessAuditEvidence(future), /nach der Auswertungszeit/);
  assert.throws(() => projectAccessAuditEvidence(base({ evaluatedAt: '2026-10-14T12:00:00Z' })), /ISO-Zeitpunkt/);
});

test('hash count own-value and exact-shape validation fail closed', () => {
  const hash = base();
  hash.event = { ...hash.event, technicalContext: { ...hash.event.technicalContext, contentSha256: 'hash' } };
  assert.throws(() => projectAccessAuditEvidence(hash), /SHA-256/);
  const count = base();
  count.event = { ...count.event, technicalContext: { ...count.event.technicalContext, itemCount: -1 } };
  assert.throws(() => projectAccessAuditEvidence(count), /nichtnegative Anzahl/);
  const getter = base();
  Object.defineProperty(getter.event, 'objectId', { get: () => id(5), enumerable: true });
  assert.throws(() => projectAccessAuditEvidence(getter), /Originalwert/);
});
