import assert from 'node:assert/strict';
import test from 'node:test';
import { projectDataSubjectAccessExportEvidence } from '../../src/lib/privacy/dataSubjectAccessExportEvidence.ts';

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const at = (hour, micros = 1) => `2026-10-14T${String(hour).padStart(2, '0')}:00:00.${String(micros).padStart(6, '0')}Z`;
const base = (overrides = {}) => ({
  tenantId: id(1),
  evaluatedAt: at(20, 9),
  request: {
    requestId: id(2), subjectType: 'client', subjectId: id(3), requestType: 'access_export',
    requestedCategories: [' Pflegeakte ', ' Rechnungen '], requestedAt: at(10, 1),
  },
  identity: {
    verificationId: id(4), requestId: id(2), subjectId: id(3), verified: true, method: ' Vor-Ort-Pruefung ',
    evidenceId: id(5), evidenceSha256: 'a'.repeat(64), verifiedByProfileId: id(6),
    permissionKey: 'privacy.access.identity.verify', permissionEvidenceId: id(7), verifiedAt: at(11, 2),
  },
  records: [
    { recordId: id(10), tenantId: id(1), subjectId: id(3), category: ' Pflegeakte ', sourceType: ' visit ', sourceVersion: ' 4 ', contentSha256: 'b'.repeat(64), occurredAt: at(9, 1) },
    { recordId: id(11), tenantId: id(1), subjectId: id(3), category: ' Rechnungen ', sourceType: ' invoice ', sourceVersion: ' 2 ', contentSha256: 'c'.repeat(64), occurredAt: at(12, 3) },
  ],
  exclusions: [{
    exclusionId: id(12), recordId: id(11), reasonCode: ' third_party_review ', reason: ' Fremdrechte fachlich pruefen ',
    reviewedByProfileId: id(13), permissionKey: 'privacy.access.exclude', permissionEvidenceId: id(14), decidedAt: at(13, 4),
  }],
  exportPackage: {
    jobId: id(15), packageId: id(16), requestId: id(2), subjectId: id(3),
    categories: [' Pflegeakte ', ' Rechnungen '], includedRecordIds: [id(10)], exclusionIds: [id(12)],
    manifestSha256: 'd'.repeat(64), outputSha256: 'e'.repeat(64), generatedByProfileId: id(17),
    permissionKey: 'privacy.access.export', permissionEvidenceId: id(18), generatedAt: at(14, 5),
  },
  delivery: {
    deliveryId: id(19), packageId: id(16), recipientSubjectId: id(3), channel: ' persoenliches Portal ',
    recipientSha256: 'f'.repeat(64), secureDeliveryEvidenceId: id(20), deliveredByProfileId: id(21),
    permissionKey: 'privacy.access.deliver', permissionEvidenceId: id(22), deliveredAt: at(15, 6), acknowledgedAt: null,
  },
  ...overrides,
});

test('exact subject-bound package and delivery preserve originals without completing the request', () => {
  const result = projectDataSubjectAccessExportEvidence(base());
  assert.equal(result.disposition, 'delivered_unacknowledged');
  assert.equal(result.requestCompletedInferred, false);
  assert.equal(result.legalCompletenessInferred, false);
  assert.equal(result.records[0].category, ' Pflegeakte ');
  assert.equal(result.exportPackage.outputSha256, 'e'.repeat(64));
  assert.ok(Object.isFrozen(result));
});

test('failed identity blocks an export and verified identity alone remains unprepared', () => {
  const blocked = base({ records: [], exclusions: [], exportPackage: null, delivery: null });
  blocked.identity = { ...blocked.identity, verified: false };
  assert.equal(projectDataSubjectAccessExportEvidence(blocked).disposition, 'blocked_identity');
  const verified = base({ records: [], exclusions: [], exportPackage: null, delivery: null });
  assert.equal(projectDataSubjectAccessExportEvidence(verified).disposition, 'verified_not_prepared');
  const invalid = base();
  invalid.identity = { ...invalid.identity, verified: false };
  assert.throws(() => projectDataSubjectAccessExportEvidence(invalid), /ohne bestaetigte Identitaet/);
});

test('records from another tenant or subject fail closed', () => {
  const tenant = base();
  tenant.records = [{ ...tenant.records[0], tenantId: id(99) }];
  tenant.exclusions = [];
  tenant.exportPackage = { ...tenant.exportPackage, includedRecordIds: [id(10)], exclusionIds: [] };
  assert.throws(() => projectDataSubjectAccessExportEvidence(tenant), /anderen Mandanten/);
  const subject = base();
  subject.records = [{ ...subject.records[0], subjectId: id(99) }];
  subject.exclusions = [];
  subject.exportPackage = { ...subject.exportPackage, includedRecordIds: [id(10)], exclusionIds: [] };
  assert.throws(() => projectDataSubjectAccessExportEvidence(subject), /anderen betroffenen Person/);
});

test('package must cover every record and exclusion exactly once', () => {
  const missing = base();
  missing.exportPackage = { ...missing.exportPackage, includedRecordIds: [], exclusionIds: [id(12)] };
  assert.throws(() => projectDataSubjectAccessExportEvidence(missing), /eingeschlossenen Akten/);
  const missingExclusion = base();
  missingExclusion.exportPackage = { ...missingExclusion.exportPackage, exclusionIds: [] };
  assert.throws(() => projectDataSubjectAccessExportEvidence(missingExclusion), /Ausschluesse/);
  const duplicate = base();
  duplicate.exportPackage = { ...duplicate.exportPackage, includedRecordIds: [id(10), id(10)] };
  assert.throws(() => projectDataSubjectAccessExportEvidence(duplicate), /doppelte Originalwerte/);
});

test('requested categories and explicit exclusions cannot be widened or substituted', () => {
  const category = base();
  category.records = [{ ...category.records[0], category: ' Personalakte ' }];
  category.exclusions = [];
  category.exportPackage = { ...category.exportPackage, includedRecordIds: [id(10)], exclusionIds: [] };
  assert.throws(() => projectDataSubjectAccessExportEvidence(category), /ausserhalb des angefragten Umfangs/);
  const packageCategory = base();
  packageCategory.exportPackage = { ...packageCategory.exportPackage, categories: [' Pflegeakte '] };
  assert.throws(() => projectDataSubjectAccessExportEvidence(packageCategory), /Kategorienumfang/);
  const exclusion = base();
  exclusion.exclusions = [{ ...exclusion.exclusions[0], recordId: id(99) }];
  assert.throws(() => projectDataSubjectAccessExportEvidence(exclusion), /keinen Akteneintrag/);
});

test('request, identity, exclusions, generation and delivery preserve chronology', () => {
  const identity = base();
  identity.identity = { ...identity.identity, verifiedAt: at(9, 1) };
  assert.throws(() => projectDataSubjectAccessExportEvidence(identity), /Anfragefolge/);
  const packageBeforeRecord = base();
  packageBeforeRecord.exportPackage = { ...packageBeforeRecord.exportPackage, generatedAt: at(11, 9) };
  assert.throws(() => projectDataSubjectAccessExportEvidence(packageBeforeRecord), /vor seinem gebundenen Aktenumfang/);
  const delivery = base();
  delivery.delivery = { ...delivery.delivery, deliveredAt: at(13, 9) };
  assert.throws(() => projectDataSubjectAccessExportEvidence(delivery), /Exportfolge/);
});

test('package and delivery bind request subject permissions hashes and acknowledgements', () => {
  const request = base();
  request.exportPackage = { ...request.exportPackage, requestId: id(99) };
  assert.throws(() => projectDataSubjectAccessExportEvidence(request), /Anfrage und betroffene Person/);
  const permission = base();
  permission.delivery = { ...permission.delivery, permissionKey: 'security.manage' };
  assert.throws(() => projectDataSubjectAccessExportEvidence(permission), /Auslieferungsberechtigung/);
  const acknowledged = base();
  acknowledged.delivery = { ...acknowledged.delivery, acknowledgedAt: at(16, 7) };
  const result = projectDataSubjectAccessExportEvidence(acknowledged);
  assert.equal(result.disposition, 'delivered_acknowledged');
  assert.equal(result.requestCompletedInferred, false);
});

test('native identities, hashes, microsecond times and own values are mandatory', () => {
  assert.throws(() => projectDataSubjectAccessExportEvidence(base({ tenantId: 'tenant' })), /native UUID/);
  const digest = base();
  digest.exportPackage = { ...digest.exportPackage, manifestSha256: 'hash' };
  assert.throws(() => projectDataSubjectAccessExportEvidence(digest), /SHA-256/);
  assert.throws(() => projectDataSubjectAccessExportEvidence(base({ evaluatedAt: '2026-10-14T20:00:00Z' })), /ISO-Zeitpunkt/);
  const getter = base();
  Object.defineProperty(getter, 'request', { get: () => base().request, enumerable: true });
  assert.throws(() => projectDataSubjectAccessExportEvidence(getter), /Originalwert/);
});
