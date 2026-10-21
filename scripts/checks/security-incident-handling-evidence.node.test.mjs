import assert from 'node:assert/strict';
import test from 'node:test';
import { projectSecurityIncidentHandlingEvidence } from '../../src/lib/privacy/securityIncidentHandlingEvidence.ts';

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const at = (hour, micros = 1) => `2026-10-14T${String(hour).padStart(2, '0')}:00:00.${String(micros).padStart(6, '0')}Z`;
const assessment = (overrides = {}) => ({
  assessmentId: id(10), incidentId: id(2), sequence: 1, riskLevel: 'high', rightsAndFreedomsRisk: 'high',
  authorityNotificationDecision: 'required', subjectNotificationDecision: 'not_required', rationaleSha256: 'b'.repeat(64),
  assessedByProfileId: id(11), permissionKey: 'privacy.incident.assess', permissionEvidenceId: id(12), assessedAt: at(9, 200001),
  ...overrides,
});
const base = (overrides = {}) => ({
  tenantId: id(1), evaluatedAt: at(14, 9),
  incident: {
    incidentId: id(2), tenantId: id(1), categoryCode: 'confidentiality.disclosure', sourceSystemCode: 'web.desktop',
    sourceVersion: '2026.10.14', incidentEvidenceId: id(3), incidentEvidenceSha256: 'a'.repeat(64),
    reporterProfileId: id(4), permissionKey: 'privacy.incident.report', permissionEvidenceId: id(5),
    detectedAt: at(8, 123456), reportedAt: at(8, 200001),
  },
  assessments: [assessment()],
  deadlineReviews: [{
    deadlineReviewId: id(20), incidentId: id(2), assessmentId: id(10), deadlineType: 'authority_notification',
    ruleCode: 'dsgvo.art33', ruleVersion: '2026.1', deadlineAt: at(13), reviewedByProfileId: id(21),
    permissionKey: 'privacy.incident.deadline.review', permissionEvidenceId: id(22), reviewedAt: at(9, 300001),
  }],
  actions: [{
    actionId: id(30), incidentId: id(2), assessmentId: id(10), actionCode: 'access.revoke', assignedToProfileId: id(31),
    assignedAt: at(9, 400001), dueAt: at(11), completedAt: at(10, 500001), completionEvidenceId: id(32),
    completionEvidenceSha256: 'c'.repeat(64),
  }],
  notifications: [{
    notificationId: id(40), incidentId: id(2), assessmentId: id(10), deadlineReviewId: id(20),
    notificationType: 'authority_notification', recipientEvidenceSha256: 'd'.repeat(64), submittedByProfileId: id(41),
    permissionKey: 'privacy.incident.notify', permissionEvidenceId: id(42), submittedAt: at(11, 600001),
    acknowledgementEvidenceSha256: null,
  }],
  closure: {
    closureId: id(50), incidentId: id(2), latestAssessmentId: id(10), actionIds: [id(30)], notificationIds: [id(40)],
    outcome: 'mitigated', closureEvidenceId: id(51), closureEvidenceSha256: 'e'.repeat(64), closedByProfileId: id(52),
    permissionKey: 'privacy.incident.close', permissionEvidenceId: id(53), closedAt: at(12, 700001),
  },
  ...overrides,
});

test('complete incident preserves report assessment treatment notification and explicit closure without inference', () => {
  const result = projectSecurityIncidentHandlingEvidence(base());
  assert.equal(result.disposition, 'closed_with_evidence');
  assert.equal(result.incident.detectedAt, at(8, 123456));
  assert.equal(result.authorityNotificationComplianceInferred, false);
  assert.equal(result.securityRestoredInferred, false);
  assert.equal(result.legalClosureInferred, false);
  assert.equal(result.clinicalActionInferred, false);
  assert.ok(Object.isFrozen(result));
});

test('reported incident remains unassessed and cannot silently contain later histories', () => {
  const input = base({ assessments: [], deadlineReviews: [], actions: [], notifications: [], closure: null });
  assert.equal(projectSecurityIncidentHandlingEvidence(input).disposition, 'reported_unassessed');
  const invalid = base({ assessments: [], deadlineReviews: [], actions: base().actions, notifications: [], closure: null });
  assert.throws(() => projectSecurityIncidentHandlingEvidence(invalid), /keine vorhandene Bewertung/);
});

test('open action keeps treatment pending and completion needs time id and hash together', () => {
  const input = base({
    notifications: [], closure: null,
    actions: [{ ...base().actions[0], completedAt: null, completionEvidenceId: null, completionEvidenceSha256: null }],
  });
  assert.equal(projectSecurityIncidentHandlingEvidence(input).disposition, 'treatment_pending');
  const partial = base({ actions: [{ ...base().actions[0], completionEvidenceSha256: null }] });
  assert.throws(() => projectSecurityIncidentHandlingEvidence(partial), /Zeitpunkt, Belegkennung und Belegsumme gemeinsam/);
});

test('closure requires latest assessment complete actions notifications and no pending legal review', () => {
  const missingAction = base(); missingAction.closure = { ...missingAction.closure, actionIds: [] };
  assert.throws(() => projectSecurityIncidentHandlingEvidence(missingAction), /Massnahmenhistorie nicht vollstaendig/);
  const missingNotification = base(); missingNotification.closure = { ...missingNotification.closure, notificationIds: [] };
  assert.throws(() => projectSecurityIncidentHandlingEvidence(missingNotification), /Benachrichtigungshistorie nicht vollstaendig/);
  const pending = base({ assessments: [assessment({ subjectNotificationDecision: 'pending_legal_review' })] });
  assert.throws(() => projectSecurityIncidentHandlingEvidence(pending), /offener Rechtspruefung/);
});

test('assessment history is unique consecutive causal and closure binds the latest version', () => {
  const second = assessment({
    assessmentId: id(13), sequence: 2, assessedAt: at(10, 100001),
    authorityNotificationDecision: 'not_required', subjectNotificationDecision: 'not_required',
  });
  const input = base({ assessments: [assessment(), second] });
  input.closure = { ...input.closure, latestAssessmentId: id(13) };
  assert.equal(projectSecurityIncidentHandlingEvidence(input).closure.latestAssessmentId, id(13));
  const gap = base({ assessments: [assessment({ sequence: 2 })] });
  assert.throws(() => projectSecurityIncidentHandlingEvidence(gap), /nicht lueckenlos/);
  const duplicate = base({ assessments: [assessment(), assessment({ sequence: 2 })] });
  assert.throws(() => projectSecurityIncidentHandlingEvidence(duplicate), /doppelte Originalkennungen/);
});

test('tenant incident assessment deadline and notification identities remain exact and native', () => {
  const foreign = base(); foreign.incident = { ...foreign.incident, tenantId: id(99) };
  assert.throws(() => projectSecurityIncidentHandlingEvidence(foreign), /anderen Mandanten/);
  const wrongIncident = base(); wrongIncident.assessments = [assessment({ incidentId: id(99) })];
  assert.throws(() => projectSecurityIncidentHandlingEvidence(wrongIncident), /exakten Vorfall/);
  const wrongDeadline = base(); wrongDeadline.notifications = [{ ...wrongDeadline.notifications[0], deadlineReviewId: id(99) }];
  assert.throws(() => projectSecurityIncidentHandlingEvidence(wrongDeadline), /passende Fristpruefung/);
});

test('recorded deadline and notification decisions never become legal compliance', () => {
  const notRequired = base({
    assessments: [assessment({ authorityNotificationDecision: 'not_required' })], deadlineReviews: [], notifications: [], closure: null,
  });
  const result = projectSecurityIncidentHandlingEvidence(notRequired);
  assert.equal(result.disposition, 'closure_review_pending');
  assert.equal(result.authorityNotificationComplianceInferred, false);
  const forbidden = base({ assessments: [assessment({ authorityNotificationDecision: 'not_required' })] });
  assert.throws(() => projectSecurityIncidentHandlingEvidence(forbidden), /keine ausdrueckliche erforderliche/);
});

test('microseconds hashes own values exact shapes and chronology fail closed', () => {
  const future = base(); future.incident = { ...future.incident, reportedAt: at(15) };
  assert.throws(() => projectSecurityIncidentHandlingEvidence(future), /Ereignisfolge/);
  const badHash = base(); badHash.incident = { ...badHash.incident, incidentEvidenceSha256: 'hash' };
  assert.throws(() => projectSecurityIncidentHandlingEvidence(badHash), /SHA-256/);
  const extra = { ...base(), patientName: 'Person A' };
  assert.throws(() => projectSecurityIncidentHandlingEvidence(extra), /nicht erlaubte Felder/);
  const getter = base(); Object.defineProperty(getter.incident, 'incidentId', { get: () => id(2), enumerable: true });
  assert.throws(() => projectSecurityIncidentHandlingEvidence(getter), /Originalwert/);
  assert.throws(() => projectSecurityIncidentHandlingEvidence(base({ evaluatedAt: '2026-10-14T14:00:00Z' })), /ISO-Zeitpunkt/);
});
