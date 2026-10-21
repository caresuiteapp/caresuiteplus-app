import assert from 'node:assert/strict';
import test from 'node:test';
import { projectProcessingLegalBasisEvidence } from '../../src/lib/privacy/processingLegalBasisEvidence.ts';

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const at = (n) => `2026-10-14T18:00:00.${String(n).padStart(6, '0')}Z`;
const general = { candidateId: id(10), layer: 'general', reference: ' Art. 6 Kandidat im Original ', sourceUri: 'https://eur-lex.europa.eu/eli/reg/2016/679/oj', sourceVersion: ' Fassung im Original ', sourceSha256: 'a'.repeat(64), sourceCheckedAt: at(1) };
const special = { candidateId: id(11), layer: 'special_category', reference: ' Art. 9 Kandidat im Original ', sourceUri: 'https://eur-lex.europa.eu/eli/reg/2016/679/oj', sourceVersion: ' Fassung im Original ', sourceSha256: 'b'.repeat(64), sourceCheckedAt: at(1) };
const base = (overrides = {}) => ({
  tenantId: id(1), processingActivityId: id(2), purposeSourceId: id(3), purpose: ' Pflegebezogener Zweck im Original ',
  controllerProfileId: id(4), responsibleProfileId: id(5), recordedAt: at(2), candidates: [general, special],
  dataCategories: [
    { categoryId: id(20), label: ' Kontaktdaten im Original ', classification: 'general', assignedCandidateIds: [id(10)] },
    { categoryId: id(21), label: ' Gesundheitsdaten im Original ', classification: 'special_category', assignedCandidateIds: [id(10), id(11)] },
  ],
  review: { reviewId: id(30), reviewerProfileId: id(31), reviewerRoleSnapshot: ' Datenschutzrolle im Original ', permissionEvidenceId: id(32), permission: 'allowed', decision: 'approved', reviewedCandidateIds: [id(10), id(11)], reviewedAt: at(3), currentLawConfirmed: true },
  ...overrides,
});

test('preserves purpose, categories, sources and responsibility while keeping applicability unverified', () => {
  const result = projectProcessingLegalBasisEvidence(base());
  assert.equal(result.assignmentStatus, 'reviewed_candidate');
  assert.equal(result.currentApplicability, 'not_verified');
  assert.equal(result.legalComplianceInferred, false);
  assert.equal(result.purpose, ' Pflegebezogener Zweck im Original ');
  assert.equal(result.dataCategories[1].label, ' Gesundheitsdaten im Original ');
  assert.equal(result.candidates[0].reference, ' Art. 6 Kandidat im Original ');
  assert.equal(result.controllerProfileId, id(4));
  assert.equal(result.responsibleProfileId, id(5));
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.dataCategories));
  assert.ok(Object.isFrozen(result.review.reviewedCandidateIds));
});

test('special-category data needs separate general and special candidate assignments', () => {
  assert.throws(() => projectProcessingLegalBasisEvidence(base({
    dataCategories: [{ ...base().dataCategories[1], assignedCandidateIds: [id(10)] }],
  })), /getrennten besonderen/);
  assert.throws(() => projectProcessingLegalBasisEvidence(base({
    dataCategories: [{ ...base().dataCategories[0], assignedCandidateIds: [id(11)] }],
  })), /allgemeinen Rechtsgrundlagenkandidaten/);
});

test('arbitrary legacy legal-basis string cannot replace structured evidence', () => {
  assert.throws(() => projectProcessingLegalBasisEvidence({ tenantId: id(1), purpose: 'Zweck', legalBasis: 'Art. 6' }), /Originalwert|native UUID/);
  assert.throws(() => projectProcessingLegalBasisEvidence(base({ candidates: [{ ...general, sourceUri: 'Art. 6' }] })), /Quellenadresse/);
  assert.throws(() => projectProcessingLegalBasisEvidence(base({ candidates: [{ ...general, sourceSha256: 'hash' }] })), /SHA-256/);
});

test('pending review stays pending and may not carry a hidden decision', () => {
  const pending = { ...base().review, decision: 'pending', reviewedCandidateIds: [], reviewedAt: null, currentLawConfirmed: false };
  const result = projectProcessingLegalBasisEvidence(base({ review: pending }));
  assert.equal(result.assignmentStatus, 'pending_review');
  assert.equal(result.currentApplicability, 'not_verified');
  assert.throws(() => projectProcessingLegalBasisEvidence(base({ review: { ...pending, reviewedCandidateIds: [id(10)] } })), /Ausstehende Fachpruefung/);
  assert.throws(() => projectProcessingLegalBasisEvidence(base({ review: { ...pending, currentLawConfirmed: true } })), /Ausstehende Fachpruefung/);
});

test('completed review needs permission, later time, known assigned candidates and source chronology', () => {
  assert.throws(() => projectProcessingLegalBasisEvidence(base({ review: { ...base().review, permission: 'denied' } })), /Pruefberechtigung/);
  assert.throws(() => projectProcessingLegalBasisEvidence(base({ review: { ...base().review, reviewedAt: at(1) } })), /spaetere Pruefzeit/);
  assert.throws(() => projectProcessingLegalBasisEvidence(base({ review: { ...base().review, reviewedCandidateIds: [id(99)] } })), /unbekannten Rechtsgrundlagenkandidaten/);
  assert.throws(() => projectProcessingLegalBasisEvidence(base({ review: { ...base().review, reviewedCandidateIds: [id(10)] } })), /nicht alle zugeordneten/);
  assert.throws(() => projectProcessingLegalBasisEvidence(base({ candidates: [{ ...general, sourceCheckedAt: at(4) }, special] })), /nach der Erfassung/);
});

test('approval without an explicit currency confirmation does not become reviewed candidate', () => {
  const result = projectProcessingLegalBasisEvidence(base({ review: { ...base().review, currentLawConfirmed: false } }));
  assert.equal(result.assignmentStatus, 'pending_review');
  assert.equal(result.currentApplicability, 'not_verified');
});

test('rejected review stays rejected and still does not determine current applicability', () => {
  const result = projectProcessingLegalBasisEvidence(base({ review: { ...base().review, decision: 'rejected', currentLawConfirmed: false } }));
  assert.equal(result.assignmentStatus, 'rejected');
  assert.equal(result.currentApplicability, 'not_verified');
  assert.equal(result.legalComplianceInferred, false);
});

test('native own values, unique bindings and complete microsecond instants fail closed', () => {
  assert.throws(() => projectProcessingLegalBasisEvidence(base({ tenantId: 'tenant' })), /native UUID/);
  assert.throws(() => projectProcessingLegalBasisEvidence(base({ recordedAt: '2026-10-14T18:00:00Z' })), /ISO-Zeitpunkt/);
  assert.throws(() => projectProcessingLegalBasisEvidence(base({ dataCategories: [base().dataCategories[0], base().dataCategories[0]] })), /doppelte native Kennungen/);
  assert.throws(() => projectProcessingLegalBasisEvidence(base({ candidates: [general, general] })), /doppelte native Kennungen/);
  const getter = base();
  Object.defineProperty(getter, 'purpose', { get: () => 'Zweck', enumerable: true });
  assert.throws(() => projectProcessingLegalBasisEvidence(getter), /Originalwert/);
});
