import assert from 'node:assert/strict';
import test from 'node:test';
import { projectLegalProfessionalReviewEvidence } from '../../src/lib/privacy/legalProfessionalReviewEvidence.ts';

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const at = (n) => `2026-10-14T20:00:00.${String(n).padStart(6, '0')}Z`;
const domains = ['sgb', 'hkp', 'documentation', 'contract', 'regional_rule'];
const requirement = (n, overrides = {}) => ({
  requirementId: id(10 + n), tenantId: id(1), reviewSubjectId: id(2), domain: domains[n],
  applicability: 'applicable', jurisdictionCode: n === 4 ? 'de.by' : 'de', ruleCode: `rule.${n}`,
  sourceId: id(20 + n), sourceUri: `https://example.invalid/source/${n}`, sourceVersion: `v${n}`,
  sourceSha256: String(n + 1).repeat(64), applicabilityEvidenceId: id(30 + n),
  applicabilityEvidenceSha256: String(n + 5).repeat(64), sourceCheckedAt: at(1), ...overrides,
});
const review = (overrides = {}) => ({
  reviewId: id(50), tenantId: id(1), reviewSubjectId: id(2), sequence: 1, supersedesReviewId: null,
  reviewedRequirementIds: [id(10), id(11), id(12), id(13), id(14)], decision: 'approved_candidate',
  findingsSha256: 'a'.repeat(64), reviewerProfileId: id(60), reviewerQualificationEvidenceId: id(61),
  permissionKey: 'privacy.legal.review', permissionEvidenceId: id(62), reviewedAt: at(2), ...overrides,
});
const base = (overrides = {}) => ({
  tenantId: id(1), reviewSubjectId: id(2), evaluatedAt: at(4),
  requirements: domains.map((_, index) => requirement(index)), reviews: [review()], ...overrides,
});

test('preserves complete legal review evidence without inferring completeness validity care or release', () => {
  const result = projectLegalProfessionalReviewEvidence(base());
  assert.equal(result.status, 'reviewed_candidate');
  assert.deepEqual([
    result.legalCompletenessInferred, result.currentLegalValidityInferred,
    result.careApprovalInferred, result.releaseApprovalInferred,
  ], [false, false, false, false]);
  assert.deepEqual(result.requirements.map(({ domain }) => domain), domains);
  assert.equal(result.requirements[4].jurisdictionCode, 'de.by');
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.requirements));
  assert.ok(Object.isFrozen(result.reviews[0].reviewedRequirementIds));
});

test('an empty immutable review history remains pending without a hidden decision', () => {
  const result = projectLegalProfessionalReviewEvidence(base({ reviews: [] }));
  assert.equal(result.status, 'pending_review');
  assert.equal(result.legalCompletenessInferred, false);
});

test('the required SGB HKP documentation contract and regional scopes must all be explicit', () => {
  assert.throws(() => projectLegalProfessionalReviewEvidence(base({ requirements: base().requirements.slice(0, 4) })), /regionale Regeln/);
  assert.throws(() => projectLegalProfessionalReviewEvidence(base({
    requirements: base().requirements.map((row, index) => index === 4 ? { ...row, domain: 'contract' } : row),
  })), /regionale Regeln/);
});

test('every completed revision covers the exact full requirement set', () => {
  assert.throws(() => projectLegalProfessionalReviewEvidence(base({
    reviews: [review({ reviewedRequirementIds: [id(10), id(11), id(12), id(13)] })],
  })), /vollstaendige Anforderungsmenge/);
  assert.throws(() => projectLegalProfessionalReviewEvidence(base({
    reviews: [review({ reviewedRequirementIds: [id(10), id(11), id(12), id(13), id(99)] })],
  })), /vollstaendige Anforderungsmenge|unbekannte Anforderung/);
});

test('revision history is contiguous linked and strictly ordered at microsecond precision', () => {
  const second = review({ reviewId: id(51), sequence: 2, supersedesReviewId: id(50), reviewedAt: at(3), decision: 'needs_changes' });
  assert.equal(projectLegalProfessionalReviewEvidence(base({ reviews: [review(), second] })).status, 'changes_required');
  assert.throws(() => projectLegalProfessionalReviewEvidence(base({ reviews: [review(), { ...second, sequence: 3 }] })), /lueckenlos/);
  assert.throws(() => projectLegalProfessionalReviewEvidence(base({ reviews: [review(), { ...second, supersedesReviewId: id(99) }] })), /Vorgaengerrevision/);
  assert.throws(() => projectLegalProfessionalReviewEvidence(base({ reviews: [review(), { ...second, reviewedAt: at(2) }] })), /Ereignisfolge/);
});

test('approval candidate fails while any applicability remains pending', () => {
  const requirements = base().requirements.map((row, index) => index === 1 ? { ...row, applicability: 'pending' } : row);
  assert.throws(() => projectLegalProfessionalReviewEvidence(base({ requirements })), /ungepruefte Anwendbarkeit/);
  const result = projectLegalProfessionalReviewEvidence(base({ requirements, reviews: [review({ decision: 'needs_changes' })] }));
  assert.equal(result.status, 'changes_required');
});

test('source checks and reviews remain inside their causal evaluation order', () => {
  assert.throws(() => projectLegalProfessionalReviewEvidence(base({
    requirements: base().requirements.map((row, index) => index === 0 ? { ...row, sourceCheckedAt: at(3) } : row),
  })), /vor einer ihrer Quellenpruefungen/);
  assert.throws(() => projectLegalProfessionalReviewEvidence(base({ reviews: [review({ reviewedAt: at(5) })] })), /Ereignisfolge/);
});

test('native own identities exact shapes HTTPS hashes permission and microseconds fail closed', () => {
  assert.throws(() => projectLegalProfessionalReviewEvidence(base({ tenantId: 'tenant' })), /native UUID/);
  assert.throws(() => projectLegalProfessionalReviewEvidence(base({ evaluatedAt: '2026-10-14T20:00:00Z' })), /ISO-Zeitpunkt/);
  assert.throws(() => projectLegalProfessionalReviewEvidence(base({ requirements: [requirement(0), requirement(0), ...base().requirements.slice(1)] })), /doppelte native Kennungen/);
  assert.throws(() => projectLegalProfessionalReviewEvidence(base({ reviews: [review({ permissionKey: 'privacy.manage' })] })), /Pruefberechtigung/);
  assert.throws(() => projectLegalProfessionalReviewEvidence(base({ requirements: base().requirements.map((row, index) => index === 0 ? { ...row, sourceUri: 'http://example.invalid' } : row) })), /HTTPS/);
  assert.throws(() => projectLegalProfessionalReviewEvidence({ ...base(), unexpected: true }), /nicht erlaubte Felder/);
  const getter = base(); Object.defineProperty(getter, 'tenantId', { get: () => id(1), enumerable: true });
  assert.throws(() => projectLegalProfessionalReviewEvidence(getter), /Originalwert/);
});
