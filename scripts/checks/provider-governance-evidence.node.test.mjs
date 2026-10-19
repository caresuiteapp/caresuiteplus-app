import assert from 'node:assert/strict';
import test from 'node:test';
import { projectProviderGovernanceEvidence } from '../../src/lib/privacy/providerGovernanceEvidence.ts';

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const at = (n) => `2026-10-14T20:00:00.${String(n).padStart(6, '0')}Z`;
const base = (overrides = {}) => ({
  tenantId: id(1),
  integrationId: id(2),
  change: {
    changeId: id(3), currentProviderId: id(4), proposedProviderId: id(5),
    requestedByProfileId: id(6), requestedAt: at(1), reason: ' Anbieterwechsel im Original ',
  },
  provider: {
    providerId: id(5), legalName: ' Anbieter GmbH ', service: ' Dokumentendienst ',
    processingRegions: [' eu-central ', ' eu-west '],
  },
  agreement: {
    agreementId: id(7), providerId: id(5), version: ' AVV 4 ', documentSha256: 'a'.repeat(64),
    effectiveFrom: at(1), expiresAt: null,
  },
  technicalMeasures: {
    assessmentId: id(8), providerId: id(5), version: ' TOM 9 ', documentSha256: 'b'.repeat(64),
    assessedAt: at(2), areas: [' Zugriff ', ' Verschluesselung '],
  },
  subprocessors: [
    { subprocessorId: id(9), legalName: ' Unterauftrag A ', processingRegions: [' eu-north '], disclosedAt: at(1) },
    { subprocessorId: id(10), legalName: ' Unterauftrag B ', processingRegions: [' eu-south '], disclosedAt: at(2) },
  ],
  review: {
    reviewId: id(11), reviewerProfileId: id(12), roleSnapshot: ' Datenschutzrolle ',
    permissionKey: 'privacy.provider.review', permissionEvidenceId: id(13),
    decision: 'approved', reviewedAt: at(3), changeId: id(3), providerId: id(5), agreementId: id(7),
    technicalMeasuresAssessmentId: id(8), subprocessorIds: [id(9), id(10)],
  },
  ...overrides,
});

test('exact authorized review marks only the provider-change candidate as reviewed', () => {
  const result = projectProviderGovernanceEvidence(base());
  assert.equal(result.providerChangeGate, 'reviewed_candidate');
  assert.equal(result.providerChangeReviewedBeforeRelease, true);
  assert.equal(result.legalComplianceInferred, false);
  assert.equal(result.productionReleaseInferred, false);
  assert.equal(result.provider.legalName, ' Anbieter GmbH ');
  assert.equal(result.agreement.documentSha256, 'a'.repeat(64));
  assert.deepEqual(result.technicalMeasures.areas, [' Zugriff ', ' Verschluesselung ']);
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.subprocessors));
});

test('missing review remains blocked without inventing approval', () => {
  const result = projectProviderGovernanceEvidence(base({ review: null }));
  assert.equal(result.review, null);
  assert.equal(result.providerChangeGate, 'blocked_pending_review');
  assert.equal(result.providerChangeReviewedBeforeRelease, false);
});

test('explicit rejection remains blocked and is not a release decision', () => {
  const input = base();
  input.review = { ...input.review, decision: 'rejected' };
  const result = projectProviderGovernanceEvidence(input);
  assert.equal(result.providerChangeGate, 'blocked_rejected');
  assert.equal(result.providerChangeReviewedBeforeRelease, false);
  assert.equal(result.productionReleaseInferred, false);
});

test('provider, agreement and technical measures must bind the proposed provider', () => {
  assert.throws(() => projectProviderGovernanceEvidence(base({ provider: { ...base().provider, providerId: id(99) } })), /vorgeschlagenen Anbieter/);
  assert.throws(() => projectProviderGovernanceEvidence(base({ agreement: { ...base().agreement, providerId: id(99) } })), /Vertragssnapshot/);
  assert.throws(() => projectProviderGovernanceEvidence(base({ technicalMeasures: { ...base().technicalMeasures, providerId: id(99) } })), /TOM-Pruefung/);
  assert.throws(() => projectProviderGovernanceEvidence(base({ change: { ...base().change, proposedProviderId: id(4) } })), /unterschiedliche Anbieterkennungen/);
});

test('review must cover the exact change, agreement, measures and subprocessor set', () => {
  const changedContract = base();
  changedContract.review = { ...changedContract.review, agreementId: id(98) };
  assert.throws(() => projectProviderGovernanceEvidence(changedContract), /exakten Wechsel/);
  const incomplete = base();
  incomplete.review = { ...incomplete.review, subprocessorIds: [id(9)] };
  assert.throws(() => projectProviderGovernanceEvidence(incomplete), /exakten Unterauftragnehmerbestand/);
  const duplicate = base();
  duplicate.subprocessors = [duplicate.subprocessors[0], duplicate.subprocessors[0]];
  assert.throws(() => projectProviderGovernanceEvidence(duplicate), /doppelte Originalkennungen/);
});

test('review chronology and agreement interval fail closed at microsecond precision', () => {
  const early = base();
  early.review = { ...early.review, reviewedAt: at(1) };
  assert.throws(() => projectProviderGovernanceEvidence(early), /nicht nach Anfrage/);
  const expired = base();
  expired.agreement = { ...expired.agreement, expiresAt: at(1) };
  assert.throws(() => projectProviderGovernanceEvidence(expired), /nicht nach dem Vertragsbeginn/);
  const expiredBeforeReview = base();
  expiredBeforeReview.agreement = { ...expiredBeforeReview.agreement, expiresAt: at(2) };
  assert.throws(() => projectProviderGovernanceEvidence(expiredBeforeReview), /zum Pruefzeitpunkt bereits beendet/);
  const undisclosedAtReview = base();
  undisclosedAtReview.subprocessors = [
    undisclosedAtReview.subprocessors[0],
    { ...undisclosedAtReview.subprocessors[1], disclosedAt: at(3) },
  ];
  assert.throws(() => projectProviderGovernanceEvidence(undisclosedAtReview), /nicht nach Anfrage/);
  const missingMicros = base();
  missingMicros.change = { ...missingMicros.change, requestedAt: '2026-10-14T20:00:00Z' };
  assert.throws(() => projectProviderGovernanceEvidence(missingMicros), /ISO-Zeitpunkt/);
});

test('native identities, hashes, nonempty arrays and allowed decisions are mandatory', () => {
  assert.throws(() => projectProviderGovernanceEvidence(base({ tenantId: 'tenant' })), /native UUID/);
  assert.throws(() => projectProviderGovernanceEvidence(base({ agreement: { ...base().agreement, documentSha256: 'hash' } })), /SHA-256/);
  assert.throws(() => projectProviderGovernanceEvidence(base({ provider: { ...base().provider, processingRegions: [] } })), /nichtleeres Originalarray/);
  const pending = base();
  pending.review = { ...pending.review, decision: 'pending' };
  assert.throws(() => projectProviderGovernanceEvidence(pending), /erlaubte Entscheidung/);
  const unboundPermission = base();
  unboundPermission.review = { ...unboundPermission.review, permissionKey: 'connect.configure' };
  assert.throws(() => projectProviderGovernanceEvidence(unboundPermission), /Pruefberechtigung/);
});

test('getter and replacement values cannot masquerade as native governance evidence', () => {
  const input = base();
  Object.defineProperty(input, 'agreement', { get: () => base().agreement, enumerable: true });
  assert.throws(() => projectProviderGovernanceEvidence(input), /Originalwert/);
  const result = projectProviderGovernanceEvidence(base());
  assert.equal(result.change.reason, ' Anbieterwechsel im Original ');
  assert.equal(result.subprocessors[0].disclosedAt, at(1));
});
