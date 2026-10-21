import assert from 'node:assert/strict';
import test from 'node:test';
import { projectRetentionDispositionEvidence } from '../../src/lib/privacy/retentionDispositionEvidence.ts';

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const at = (year, micros = 1) => `${year}-10-14T20:00:00.${String(micros).padStart(6, '0')}Z`;
const base = (overrides = {}) => ({
  tenantId: id(1),
  evaluatedAt: at(2037, 5),
  record: {
    recordId: id(2), documentTypeId: id(3), documentTypeVersion: ' Pflegeakte 4 ',
    contentSha256: 'a'.repeat(64), createdAt: at(2026, 1), classifiedAt: at(2026, 2),
    classifiedByProfileId: id(4),
    retentionTrigger: { eventId: id(5), eventType: ' Fallende ', occurredAt: at(2027, 1) },
  },
  rule: {
    ruleId: id(6), documentTypeId: id(3), version: ' Regel 7 ', legalSourceId: id(7),
    legalReference: ' Fachlich zu pruefende Quelle ', sourceVersion: ' Quelle 2 ', sourceSha256: 'b'.repeat(64),
    effectiveFrom: at(2026, 1), expiresAt: null, basisEventId: id(5), retentionUntil: at(2037, 1),
  },
  holds: [],
  review: {
    reviewId: id(8), recordId: id(2), ruleId: id(6), triggerEventId: id(5), reviewerProfileId: id(9),
    roleSnapshot: ' Datenschutzpruefung ', permissionKey: 'privacy.retention.review', permissionEvidenceId: id(10),
    reviewedAt: at(2037, 2), decision: 'delete_candidate', reason: ' Einzelfallpruefung abgeschlossen ',
  },
  ...overrides,
});

test('exact expired rule and authorized review produce only a deletion candidate', () => {
  const result = projectRetentionDispositionEvidence(base());
  assert.equal(result.disposition, 'reviewed_delete_candidate');
  assert.equal(result.deletionExecutedInferred, false);
  assert.equal(result.legalValidityInferred, false);
  assert.equal(result.record.documentTypeVersion, ' Pflegeakte 4 ');
  assert.equal(result.rule.legalReference, ' Fachlich zu pruefende Quelle ');
  assert.ok(Object.isFrozen(result));
});

test('retention remains active before the document-specific deadline', () => {
  assert.equal(projectRetentionDispositionEvidence(base({ evaluatedAt: at(2036, 9), review: null })).disposition, 'retention_active');
});

test('expired retention without review remains pending and never deletes automatically', () => {
  const result = projectRetentionDispositionEvidence(base({ review: null }));
  assert.equal(result.disposition, 'pending_review');
  assert.equal(result.deletionExecutedInferred, false);
});

test('active holds block deletion while released holds preserve their history', () => {
  const held = base({ review: null });
  held.holds = [{
    holdId: id(11), recordId: id(2), holdType: 'complaint', reason: ' Beschwerde offen ',
    imposedByProfileId: id(12), permissionKey: 'privacy.retention.hold', permissionEvidenceId: id(13),
    imposedAt: at(2036, 1), releasedAt: null,
  }];
  assert.equal(projectRetentionDispositionEvidence(held).disposition, 'blocked_active_hold');
  const released = base();
  released.holds = [{ ...held.holds[0], releasedAt: at(2036, 2) }];
  const result = projectRetentionDispositionEvidence(released);
  assert.equal(result.disposition, 'reviewed_delete_candidate');
  assert.equal(result.holds[0].releasedAt, at(2036, 2));
});

test('document type and trigger prevent a blanket rule from being substituted', () => {
  assert.throws(() => projectRetentionDispositionEvidence(base({ rule: { ...base().rule, documentTypeId: id(99) } })), /exakten Dokumentart/);
  assert.throws(() => projectRetentionDispositionEvidence(base({ rule: { ...base().rule, basisEventId: id(99) } })), /exakten Fristausloeser/);
  const early = base();
  early.rule = { ...early.rule, effectiveFrom: at(2028, 1) };
  assert.throws(() => projectRetentionDispositionEvidence(early), /nicht wirksam/);
});

test('deletion candidate fails closed before expiry or during an active hold', () => {
  const early = base();
  early.review = { ...early.review, reviewedAt: at(2036, 1) };
  assert.throws(() => projectRetentionDispositionEvidence(early), /vor dem Fristende/);
  const held = base();
  held.holds = [{
    holdId: id(11), recordId: id(2), holdType: 'legal', reason: ' Verfahren ',
    imposedByProfileId: id(12), permissionKey: 'privacy.retention.hold', permissionEvidenceId: id(13),
    imposedAt: at(2036, 1), releasedAt: null,
  }];
  assert.throws(() => projectRetentionDispositionEvidence(held), /aktiver Sperre/);
});

test('review binds exact record, rule, trigger and permission', () => {
  for (const change of [{ recordId: id(99) }, { ruleId: id(99) }, { triggerEventId: id(99) }]) {
    const input = base();
    input.review = { ...input.review, ...change };
    assert.throws(() => projectRetentionDispositionEvidence(input), /bindet nicht Dokument/);
  }
  const denied = base();
  denied.review = { ...denied.review, permissionKey: 'security.manage' };
  assert.throws(() => projectRetentionDispositionEvidence(denied), /Pruefberechtigung/);
});

test('native identities, hashes, microsecond times and own values are mandatory', () => {
  assert.throws(() => projectRetentionDispositionEvidence(base({ tenantId: 'tenant' })), /native UUID/);
  assert.throws(() => projectRetentionDispositionEvidence(base({ record: { ...base().record, contentSha256: 'hash' } })), /SHA-256/);
  assert.throws(() => projectRetentionDispositionEvidence(base({ evaluatedAt: '2037-10-14T20:00:00Z' })), /ISO-Zeitpunkt/);
  const getter = base();
  Object.defineProperty(getter, 'rule', { get: () => base().rule, enumerable: true });
  assert.throws(() => projectRetentionDispositionEvidence(getter), /Originalwert/);
  const futureReview = base();
  futureReview.review = { ...futureReview.review, reviewedAt: at(2038, 1) };
  assert.throws(() => projectRetentionDispositionEvidence(futureReview), /Auswertungsfolge/);
});
