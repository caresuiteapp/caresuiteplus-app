import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { projectConsentWithdrawalEvidence } from '../../src/lib/privacy/consentWithdrawalEvidence.ts';

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const at = (n) => `2026-10-14T19:00:00.${String(n).padStart(6, '0')}Z`;
const base = (overrides = {}) => ({
  tenantId: id(1), subjectId: id(2), consentId: id(3), purposeId: id(4), purpose: ' Zweck im Original ',
  scope: [' Umfang A ', ' Umfang B '], documentVersion: ' Fassung 7 ', documentId: id(5), documentSha256: 'a'.repeat(64),
  grant: { eventId: id(6), actorProfileId: id(7), occurredAt: at(1) },
  withdrawal: { eventId: id(8), actorProfileId: id(9), occurredAt: at(3) },
  records: [
    { recordId: id(10), purposeId: id(4), relation: 'consent_dependent', createdAt: at(2) },
    { recordId: id(11), purposeId: id(4), relation: 'mandatory_record', createdAt: at(2) },
  ],
  ...overrides,
});

test('withdrawal blocks only consent-dependent purpose use and never deletes mandatory records', () => {
  const result = projectConsentWithdrawalEvidence(base());
  assert.equal(result.state, 'withdrawn');
  assert.equal(result.consentDependentProcessingAllowed, false);
  assert.equal(result.records[0].effect, 'blocked_for_purpose');
  assert.equal(result.records[1].effect, 'retained_pending_legal_review');
  assert.equal(result.mandatoryRecordDeletionInferred, false);
  assert.equal(result.legalDeletionDecisionInferred, false);
  assert.equal(result.grant.occurredAt, at(1));
  assert.equal(result.withdrawal?.occurredAt, at(3));
  assert.equal(result.documentId, id(5));
  assert.equal(result.documentSha256, 'a'.repeat(64));
  assert.deepEqual(result.records[0], {
    recordId: id(10), purposeId: id(4), relation: 'consent_dependent', createdAt: at(2), effect: 'blocked_for_purpose',
  });
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.records));
});

test('unwithdrawn consent remains granted without inventing a withdrawal', () => {
  const result = projectConsentWithdrawalEvidence(base({ withdrawal: null }));
  assert.equal(result.state, 'granted');
  assert.equal(result.consentDependentProcessingAllowed, true);
  assert.equal(result.withdrawal, null);
  assert.deepEqual(result.records.map((record) => record.effect), ['available_for_purpose', 'available_for_purpose']);
});

test('purpose, scope, document version and original event times remain exact', () => {
  const result = projectConsentWithdrawalEvidence(base());
  assert.equal(result.purpose, ' Zweck im Original ');
  assert.deepEqual(result.scope, [' Umfang A ', ' Umfang B ']);
  assert.equal(result.documentVersion, ' Fassung 7 ');
  assert.equal(result.grant.actorProfileId, id(7));
  assert.equal(result.withdrawal?.actorProfileId, id(9));
});

test('withdrawal requires its own later native event and does not overwrite grant history', () => {
  assert.throws(() => projectConsentWithdrawalEvidence(base({ withdrawal: { ...base().withdrawal, eventId: id(6) } })), /getrennte Ereigniskennungen/);
  assert.throws(() => projectConsentWithdrawalEvidence(base({ withdrawal: { ...base().withdrawal, occurredAt: at(0) } })), /nicht nach der Einwilligung/);
  assert.throws(() => projectConsentWithdrawalEvidence(base({ withdrawal: { ...base().withdrawal, occurredAt: at(1) } })), /nicht nach der Einwilligung/);
  const result = projectConsentWithdrawalEvidence(base());
  assert.equal(result.grant.eventId, id(6));
  assert.equal(result.withdrawal?.eventId, id(8));
});

test('only records exactly bound to the affected purpose are projected', () => {
  assert.throws(() => projectConsentWithdrawalEvidence(base({ records: [{ ...base().records[0], purposeId: id(99) }] })), /betroffenen Zweck/);
  assert.throws(() => projectConsentWithdrawalEvidence(base({ records: [base().records[0], base().records[0]] })), /doppelte Originalwerte/);
  assert.throws(() => projectConsentWithdrawalEvidence(base({ records: [{ ...base().records[0], createdAt: at(0) }] })), /vor der zugeordneten Einwilligung/);
});

test('native identities, source hashes and complete microsecond instants fail closed', () => {
  assert.throws(() => projectConsentWithdrawalEvidence(base({ subjectId: 'person' })), /native UUID/);
  assert.throws(() => projectConsentWithdrawalEvidence(base({ documentSha256: 'hash' })), /SHA-256/);
  assert.throws(() => projectConsentWithdrawalEvidence(base({ grant: { ...base().grant, occurredAt: '2026-10-14T19:00:00Z' } })), /ISO-Zeitpunkt/);
  const getter = base();
  Object.defineProperty(getter, 'scope', { get: () => ['Umfang'], enumerable: true });
  assert.throws(() => projectConsentWithdrawalEvidence(getter), /Originalwert/);
});

test('live TI revocation writes revoked_at and preserves original grant fields', async () => {
  const repository = await readFile(new URL('../../src/lib/ti/repositories/tiConsents.supabase.ts', import.meta.url), 'utf8');
  const service = await readFile(new URL('../../src/lib/ti/tiConsentService.ts', import.meta.url), 'utf8');
  assert.match(repository, /Object\.hasOwn\(patch, 'revokedAt'\).*update\.revoked_at = patch\.revokedAt/s);
  const revokeBlock = service.match(/export async function revokeTIConsentService[\s\S]*?export function getConsentStatusLabel/)?.[0] ?? '';
  assert.match(revokeBlock, /status: 'revoked',[\s\S]*revokedAt: new Date\(\)\.toISOString\(\)/);
  assert.doesNotMatch(revokeBlock, /grantedAt: null|grantedBy: null/);
});

test('grant clears only a previous revocation marker while retaining explicit grant evidence', async () => {
  const service = await readFile(new URL('../../src/lib/ti/tiConsentService.ts', import.meta.url), 'utf8');
  const grantBlock = service.match(/export async function grantTIConsentService[\s\S]*?export async function revokeTIConsentService/)?.[0] ?? '';
  assert.match(grantBlock, /status: 'granted',[\s\S]*grantedAt: new Date\(\)\.toISOString\(\),[\s\S]*grantedBy,[\s\S]*revokedAt: null/);
});
