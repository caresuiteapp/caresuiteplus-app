export type SecurityIncidentHandlingEvidence = Readonly<{
  tenantId: string;
  evaluatedAt: string;
  incident: Readonly<{
    incidentId: string;
    tenantId: string;
    categoryCode: string;
    sourceSystemCode: string;
    sourceVersion: string;
    incidentEvidenceId: string;
    incidentEvidenceSha256: string;
    reporterProfileId: string;
    permissionKey: 'privacy.incident.report';
    permissionEvidenceId: string;
    detectedAt: string;
    reportedAt: string;
  }>;
  assessments: readonly Readonly<{
    assessmentId: string;
    incidentId: string;
    sequence: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    rightsAndFreedomsRisk: 'unlikely' | 'possible' | 'high';
    authorityNotificationDecision: 'not_required' | 'required' | 'pending_legal_review';
    subjectNotificationDecision: 'not_required' | 'required' | 'pending_legal_review';
    rationaleSha256: string;
    assessedByProfileId: string;
    permissionKey: 'privacy.incident.assess';
    permissionEvidenceId: string;
    assessedAt: string;
  }>[];
  deadlineReviews: readonly Readonly<{
    deadlineReviewId: string;
    incidentId: string;
    assessmentId: string;
    deadlineType: 'authority_notification' | 'subject_notification';
    ruleCode: string;
    ruleVersion: string;
    deadlineAt: string;
    reviewedByProfileId: string;
    permissionKey: 'privacy.incident.deadline.review';
    permissionEvidenceId: string;
    reviewedAt: string;
  }>[];
  actions: readonly Readonly<{
    actionId: string;
    incidentId: string;
    assessmentId: string;
    actionCode: string;
    assignedToProfileId: string;
    assignedAt: string;
    dueAt: string;
    completedAt: string | null;
    completionEvidenceId: string | null;
    completionEvidenceSha256: string | null;
  }>[];
  notifications: readonly Readonly<{
    notificationId: string;
    incidentId: string;
    assessmentId: string;
    deadlineReviewId: string;
    notificationType: 'authority_notification' | 'subject_notification';
    recipientEvidenceSha256: string;
    submittedByProfileId: string;
    permissionKey: 'privacy.incident.notify';
    permissionEvidenceId: string;
    submittedAt: string;
    acknowledgementEvidenceSha256: string | null;
  }>[];
  closure: Readonly<{
    closureId: string;
    incidentId: string;
    latestAssessmentId: string;
    actionIds: readonly string[];
    notificationIds: readonly string[];
    outcome: 'mitigated' | 'accepted_residual_risk' | 'false_positive';
    closureEvidenceId: string;
    closureEvidenceSha256: string;
    closedByProfileId: string;
    permissionKey: 'privacy.incident.close';
    permissionEvidenceId: string;
    closedAt: string;
  }> | null;
  disposition: 'reported_unassessed' | 'treatment_pending' | 'closure_review_pending' | 'closed_with_evidence';
  authorityNotificationComplianceInferred: false;
  subjectNotificationComplianceInferred: false;
  securityRestoredInferred: false;
  legalClosureInferred: false;
  clinicalActionInferred: false;
}>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const CODE = /^[a-z0-9][a-z0-9._:-]{0,127}$/;
const INSTANT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d{1,6})(Z|([+-])(\d{2}):(\d{2}))$/;

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    throw new Error(`${label} ist kein unveraenderter Originaldatensatz.`);
  }
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, allowed: readonly string[], label: string): void {
  const actual = Object.keys(value);
  const unexpected = actual.filter((key) => !allowed.includes(key));
  if (unexpected.length) throw new Error(`${label} enthaelt nicht erlaubte Felder: ${unexpected.join(', ')}.`);
  const missing = allowed.filter((key) => !actual.includes(key));
  if (missing.length) throw new Error(`${label} ist unvollstaendig: ${missing.join(', ')}.`);
}

function own(value: Record<string, unknown>, key: string, label: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (!descriptor || !Object.hasOwn(descriptor, 'value')) throw new Error(`${label} ${key} fehlt als Originalwert.`);
  return descriptor.value;
}

function id(value: unknown, label: string): string {
  if (typeof value !== 'string' || !UUID.test(value)) throw new Error(`${label} ist keine native UUID.`);
  return value;
}

function code(value: unknown, label: string): string {
  if (typeof value !== 'string' || !CODE.test(value)) throw new Error(`${label} ist kein zulassiger technischer Code.`);
  return value;
}

function hash(value: unknown, label: string): string {
  if (typeof value !== 'string' || !SHA256.test(value)) throw new Error(`${label} ist kein SHA-256-Originalwert.`);
  return value;
}

function instant(value: unknown, label: string): { text: string; micros: bigint } {
  if (typeof value !== 'string') throw new Error(`${label} ist kein vollstaendiger ISO-Zeitpunkt.`);
  const match = INSTANT.exec(value);
  if (!match) throw new Error(`${label} ist kein vollstaendiger ISO-Zeitpunkt.`);
  const [, y, m, d, h, min, s, fraction, zone, sign, zh, zm] = match;
  const year = Number(y), month = Number(m), day = Number(d), hour = Number(h), minute = Number(min), second = Number(s);
  const zoneHour = Number(zh ?? 0), zoneMinute = Number(zm ?? 0);
  const monthDays = month >= 1 && month <= 12 ? new Date(Date.UTC(year, month, 0)).getUTCDate() : 0;
  if (year < 1 || day < 1 || day > monthDays || hour > 23 || minute > 59 || second > 59
    || zoneHour > 23 || zoneMinute > 59) throw new Error(`${label} enthaelt kein gueltiges Kalenderdatum.`);
  const offset = zone === 'Z' ? 0 : (sign === '-' ? -1 : 1) * (zoneHour * 60 + zoneMinute);
  return {
    text: value,
    micros: BigInt(Date.UTC(year, month - 1, day, hour, minute, second) - offset * 60_000) * 1000n
      + BigInt(fraction.padEnd(6, '0')),
  };
}

function array(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label} fehlt als vollstaendige Originalhistorie.`);
  return value;
}

function sequence(value: unknown, expected: number, label: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value !== expected) {
    throw new Error(`${label} ist nicht lueckenlos und original geordnet.`);
  }
  return value;
}

function nullableId(value: unknown, label: string): string | null {
  return value === null ? null : id(value, label);
}

function nullableHash(value: unknown, label: string): string | null {
  return value === null ? null : hash(value, label);
}

function sameSet(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value) => right.includes(value));
}

/**
 * Preserves a tenant-bound incident, every assessment, deadline review,
 * treatment action, notification and the optional explicit closure. Recorded
 * decisions remain evidence only: notification compliance, restoration and
 * legal closure are never inferred.
 */
export function projectSecurityIncidentHandlingEvidence(input: unknown): SecurityIncidentHandlingEvidence {
  const root = record(input, 'Sicherheitsvorfall');
  exactKeys(root, ['tenantId', 'evaluatedAt', 'incident', 'assessments', 'deadlineReviews', 'actions', 'notifications', 'closure'], 'Sicherheitsvorfall');
  const tenantId = id(own(root, 'tenantId', 'Sicherheitsvorfall'), 'Mandantenkennung');
  const evaluatedAt = instant(own(root, 'evaluatedAt', 'Sicherheitsvorfall'), 'Auswertungszeit');

  const incidentSource = record(own(root, 'incident', 'Sicherheitsvorfall'), 'Vorfallmeldung');
  exactKeys(incidentSource, [
    'incidentId', 'tenantId', 'categoryCode', 'sourceSystemCode', 'sourceVersion',
    'incidentEvidenceId', 'incidentEvidenceSha256', 'reporterProfileId', 'permissionKey',
    'permissionEvidenceId', 'detectedAt', 'reportedAt',
  ], 'Vorfallmeldung');
  if (id(own(incidentSource, 'tenantId', 'Vorfallmeldung'), 'Vorfall-Mandantenkennung') !== tenantId) {
    throw new Error('Vorfallmeldung gehoert zu einem anderen Mandanten.');
  }
  if (own(incidentSource, 'permissionKey', 'Vorfallmeldung') !== 'privacy.incident.report') {
    throw new Error('Vorfallmeldung enthaelt keine gebundene Meldeberechtigung.');
  }
  const incidentId = id(own(incidentSource, 'incidentId', 'Vorfallmeldung'), 'Vorfallkennung');
  const detectedAt = instant(own(incidentSource, 'detectedAt', 'Vorfallmeldung'), 'Erkennungszeit');
  const reportedAt = instant(own(incidentSource, 'reportedAt', 'Vorfallmeldung'), 'Meldezeit');
  if (reportedAt.micros < detectedAt.micros || reportedAt.micros > evaluatedAt.micros) {
    throw new Error('Vorfallmeldung liegt ausserhalb der belegten Ereignisfolge.');
  }
  const incident = Object.freeze({
    incidentId,
    tenantId,
    categoryCode: code(own(incidentSource, 'categoryCode', 'Vorfallmeldung'), 'Vorfallkategorie'),
    sourceSystemCode: code(own(incidentSource, 'sourceSystemCode', 'Vorfallmeldung'), 'Quellsystemcode'),
    sourceVersion: code(own(incidentSource, 'sourceVersion', 'Vorfallmeldung'), 'Quellsystemfassung'),
    incidentEvidenceId: id(own(incidentSource, 'incidentEvidenceId', 'Vorfallmeldung'), 'Vorfallbelegkennung'),
    incidentEvidenceSha256: hash(own(incidentSource, 'incidentEvidenceSha256', 'Vorfallmeldung'), 'Vorfallbelegsumme'),
    reporterProfileId: id(own(incidentSource, 'reporterProfileId', 'Vorfallmeldung'), 'Meldeprofilkennung'),
    permissionKey: 'privacy.incident.report' as const,
    permissionEvidenceId: id(own(incidentSource, 'permissionEvidenceId', 'Vorfallmeldung'), 'Meldeberechtigungsbeleg'),
    detectedAt: detectedAt.text,
    reportedAt: reportedAt.text,
  });

  const assessmentIds = new Set<string>();
  let priorAssessmentAt = reportedAt.micros;
  const assessments = array(own(root, 'assessments', 'Sicherheitsvorfall'), 'Bewertungshistorie').map((value, index) => {
    const source = record(value, `Bewertung ${index + 1}`);
    exactKeys(source, [
      'assessmentId', 'incidentId', 'sequence', 'riskLevel', 'rightsAndFreedomsRisk',
      'authorityNotificationDecision', 'subjectNotificationDecision', 'rationaleSha256',
      'assessedByProfileId', 'permissionKey', 'permissionEvidenceId', 'assessedAt',
    ], `Bewertung ${index + 1}`);
    if (id(own(source, 'incidentId', `Bewertung ${index + 1}`), 'Bewertungs-Vorfallkennung') !== incidentId) {
      throw new Error('Bewertung bindet nicht den exakten Vorfall.');
    }
    const assessmentId = id(own(source, 'assessmentId', `Bewertung ${index + 1}`), 'Bewertungskennung');
    if (assessmentIds.has(assessmentId)) throw new Error('Bewertungshistorie enthaelt doppelte Originalkennungen.');
    assessmentIds.add(assessmentId);
    const riskLevel = own(source, 'riskLevel', `Bewertung ${index + 1}`);
    const rightsRisk = own(source, 'rightsAndFreedomsRisk', `Bewertung ${index + 1}`);
    const authorityDecision = own(source, 'authorityNotificationDecision', `Bewertung ${index + 1}`);
    const subjectDecision = own(source, 'subjectNotificationDecision', `Bewertung ${index + 1}`);
    if (!['low', 'medium', 'high', 'critical'].includes(String(riskLevel))
      || !['unlikely', 'possible', 'high'].includes(String(rightsRisk))
      || !['not_required', 'required', 'pending_legal_review'].includes(String(authorityDecision))
      || !['not_required', 'required', 'pending_legal_review'].includes(String(subjectDecision))) {
      throw new Error('Bewertung enthaelt keine erlaubten Originalentscheidungen.');
    }
    if (own(source, 'permissionKey', `Bewertung ${index + 1}`) !== 'privacy.incident.assess') {
      throw new Error('Bewertung enthaelt keine gebundene Bewertungsberechtigung.');
    }
    const assessedAt = instant(own(source, 'assessedAt', `Bewertung ${index + 1}`), 'Bewertungszeit');
    if (assessedAt.micros < priorAssessmentAt || assessedAt.micros > evaluatedAt.micros) {
      throw new Error('Bewertungshistorie ist nicht kausal geordnet.');
    }
    priorAssessmentAt = assessedAt.micros;
    return Object.freeze({
      assessmentId,
      incidentId,
      sequence: sequence(own(source, 'sequence', `Bewertung ${index + 1}`), index + 1, 'Bewertungsfolge'),
      riskLevel: riskLevel as 'low' | 'medium' | 'high' | 'critical',
      rightsAndFreedomsRisk: rightsRisk as 'unlikely' | 'possible' | 'high',
      authorityNotificationDecision: authorityDecision as 'not_required' | 'required' | 'pending_legal_review',
      subjectNotificationDecision: subjectDecision as 'not_required' | 'required' | 'pending_legal_review',
      rationaleSha256: hash(own(source, 'rationaleSha256', `Bewertung ${index + 1}`), 'Bewertungsbegruendungssumme'),
      assessedByProfileId: id(own(source, 'assessedByProfileId', `Bewertung ${index + 1}`), 'Bewertungsprofilkennung'),
      permissionKey: 'privacy.incident.assess' as const,
      permissionEvidenceId: id(own(source, 'permissionEvidenceId', `Bewertung ${index + 1}`), 'Bewertungsberechtigungsbeleg'),
      assessedAt: assessedAt.text,
    });
  });

  const deadlineReviewIds = new Set<string>();
  const deadlineById = new Map<string, { assessmentId: string; type: string; reviewedMicros: bigint }>();
  const deadlineReviews = array(own(root, 'deadlineReviews', 'Sicherheitsvorfall'), 'Fristpruefungshistorie').map((value, index) => {
    const source = record(value, `Fristpruefung ${index + 1}`);
    exactKeys(source, [
      'deadlineReviewId', 'incidentId', 'assessmentId', 'deadlineType', 'ruleCode', 'ruleVersion',
      'deadlineAt', 'reviewedByProfileId', 'permissionKey', 'permissionEvidenceId', 'reviewedAt',
    ], `Fristpruefung ${index + 1}`);
    if (id(own(source, 'incidentId', `Fristpruefung ${index + 1}`), 'Frist-Vorfallkennung') !== incidentId) {
      throw new Error('Fristpruefung bindet nicht den exakten Vorfall.');
    }
    const assessmentId = id(own(source, 'assessmentId', `Fristpruefung ${index + 1}`), 'Frist-Bewertungskennung');
    if (!assessmentIds.has(assessmentId)) throw new Error('Fristpruefung bindet keine vorhandene Bewertung.');
    const deadlineReviewId = id(own(source, 'deadlineReviewId', `Fristpruefung ${index + 1}`), 'Fristpruefkennung');
    if (deadlineReviewIds.has(deadlineReviewId)) throw new Error('Fristpruefungshistorie enthaelt doppelte Originalkennungen.');
    deadlineReviewIds.add(deadlineReviewId);
    const deadlineType = own(source, 'deadlineType', `Fristpruefung ${index + 1}`);
    if (!['authority_notification', 'subject_notification'].includes(String(deadlineType))) {
      throw new Error('Fristpruefung enthaelt keine erlaubte Fristart.');
    }
    if (own(source, 'permissionKey', `Fristpruefung ${index + 1}`) !== 'privacy.incident.deadline.review') {
      throw new Error('Fristpruefung enthaelt keine gebundene Fristpruefberechtigung.');
    }
    const reviewedAt = instant(own(source, 'reviewedAt', `Fristpruefung ${index + 1}`), 'Fristpruefzeit');
    const assessment = assessments.find((item) => item.assessmentId === assessmentId)!;
    const assessmentAt = instant(assessment.assessedAt, 'Gebundene Bewertungszeit');
    if (reviewedAt.micros < assessmentAt.micros || reviewedAt.micros > evaluatedAt.micros) {
      throw new Error('Fristpruefung liegt ausserhalb der belegten Bewertungsfolge.');
    }
    const deadlineAt = instant(own(source, 'deadlineAt', `Fristpruefung ${index + 1}`), 'Gepruefte Frist');
    deadlineById.set(deadlineReviewId, { assessmentId, type: String(deadlineType), reviewedMicros: reviewedAt.micros });
    return Object.freeze({
      deadlineReviewId,
      incidentId,
      assessmentId,
      deadlineType: deadlineType as 'authority_notification' | 'subject_notification',
      ruleCode: code(own(source, 'ruleCode', `Fristpruefung ${index + 1}`), 'Fristregelcode'),
      ruleVersion: code(own(source, 'ruleVersion', `Fristpruefung ${index + 1}`), 'Fristregelfassung'),
      deadlineAt: deadlineAt.text,
      reviewedByProfileId: id(own(source, 'reviewedByProfileId', `Fristpruefung ${index + 1}`), 'Fristprueferprofilkennung'),
      permissionKey: 'privacy.incident.deadline.review' as const,
      permissionEvidenceId: id(own(source, 'permissionEvidenceId', `Fristpruefung ${index + 1}`), 'Fristberechtigungsbeleg'),
      reviewedAt: reviewedAt.text,
    });
  });

  const actionIds = new Set<string>();
  const actions = array(own(root, 'actions', 'Sicherheitsvorfall'), 'Massnahmenhistorie').map((value, index) => {
    const source = record(value, `Massnahme ${index + 1}`);
    exactKeys(source, [
      'actionId', 'incidentId', 'assessmentId', 'actionCode', 'assignedToProfileId', 'assignedAt',
      'dueAt', 'completedAt', 'completionEvidenceId', 'completionEvidenceSha256',
    ], `Massnahme ${index + 1}`);
    if (id(own(source, 'incidentId', `Massnahme ${index + 1}`), 'Massnahmen-Vorfallkennung') !== incidentId) {
      throw new Error('Massnahme bindet nicht den exakten Vorfall.');
    }
    const assessmentId = id(own(source, 'assessmentId', `Massnahme ${index + 1}`), 'Massnahmen-Bewertungskennung');
    if (!assessmentIds.has(assessmentId)) throw new Error('Massnahme bindet keine vorhandene Bewertung.');
    const actionId = id(own(source, 'actionId', `Massnahme ${index + 1}`), 'Massnahmenkennung');
    if (actionIds.has(actionId)) throw new Error('Massnahmenhistorie enthaelt doppelte Originalkennungen.');
    actionIds.add(actionId);
    const assignedAt = instant(own(source, 'assignedAt', `Massnahme ${index + 1}`), 'Massnahmenzuweisungszeit');
    const dueAt = instant(own(source, 'dueAt', `Massnahme ${index + 1}`), 'Massnahmenfrist');
    const assessmentAt = instant(assessments.find((item) => item.assessmentId === assessmentId)!.assessedAt, 'Gebundene Bewertungszeit');
    if (assignedAt.micros < assessmentAt.micros || assignedAt.micros > evaluatedAt.micros || dueAt.micros < assignedAt.micros) {
      throw new Error('Massnahme liegt ausserhalb der belegten Ereignisfolge.');
    }
    const completedValue = own(source, 'completedAt', `Massnahme ${index + 1}`);
    const completedAt = completedValue === null ? null : instant(completedValue, 'Massnahmenabschlusszeit');
    const completionEvidenceId = nullableId(own(source, 'completionEvidenceId', `Massnahme ${index + 1}`), 'Massnahmenabschlussbelegkennung');
    const completionEvidenceSha256 = nullableHash(own(source, 'completionEvidenceSha256', `Massnahme ${index + 1}`), 'Massnahmenabschlussbelegsumme');
    if (completedAt && (completedAt.micros < assignedAt.micros || completedAt.micros > evaluatedAt.micros)) {
      throw new Error('Massnahmenabschluss liegt ausserhalb der belegten Ereignisfolge.');
    }
    if (Boolean(completedAt) !== Boolean(completionEvidenceId) || Boolean(completedAt) !== Boolean(completionEvidenceSha256)) {
      throw new Error('Massnahmenabschluss benoetigt Zeitpunkt, Belegkennung und Belegsumme gemeinsam.');
    }
    return Object.freeze({
      actionId,
      incidentId,
      assessmentId,
      actionCode: code(own(source, 'actionCode', `Massnahme ${index + 1}`), 'Massnahmencode'),
      assignedToProfileId: id(own(source, 'assignedToProfileId', `Massnahme ${index + 1}`), 'Massnahmenverantwortlichenkennung'),
      assignedAt: assignedAt.text,
      dueAt: dueAt.text,
      completedAt: completedAt?.text ?? null,
      completionEvidenceId,
      completionEvidenceSha256,
    });
  });

  const notificationIds = new Set<string>();
  const notifications = array(own(root, 'notifications', 'Sicherheitsvorfall'), 'Benachrichtigungshistorie').map((value, index) => {
    const source = record(value, `Benachrichtigung ${index + 1}`);
    exactKeys(source, [
      'notificationId', 'incidentId', 'assessmentId', 'deadlineReviewId', 'notificationType',
      'recipientEvidenceSha256', 'submittedByProfileId', 'permissionKey', 'permissionEvidenceId',
      'submittedAt', 'acknowledgementEvidenceSha256',
    ], `Benachrichtigung ${index + 1}`);
    if (id(own(source, 'incidentId', `Benachrichtigung ${index + 1}`), 'Benachrichtigungs-Vorfallkennung') !== incidentId) {
      throw new Error('Benachrichtigung bindet nicht den exakten Vorfall.');
    }
    const assessmentId = id(own(source, 'assessmentId', `Benachrichtigung ${index + 1}`), 'Benachrichtigungs-Bewertungskennung');
    const assessment = assessments.find((item) => item.assessmentId === assessmentId);
    if (!assessment) throw new Error('Benachrichtigung bindet keine vorhandene Bewertung.');
    const deadlineReviewId = id(own(source, 'deadlineReviewId', `Benachrichtigung ${index + 1}`), 'Benachrichtigungs-Fristpruefkennung');
    const deadline = deadlineById.get(deadlineReviewId);
    const notificationType = own(source, 'notificationType', `Benachrichtigung ${index + 1}`);
    if (!deadline || deadline.assessmentId !== assessmentId || deadline.type !== notificationType) {
      throw new Error('Benachrichtigung bindet keine passende Fristpruefung.');
    }
    const required = notificationType === 'authority_notification'
      ? assessment.authorityNotificationDecision : assessment.subjectNotificationDecision;
    if (required !== 'required') throw new Error('Benachrichtigung besitzt keine ausdrueckliche erforderliche Bewertungsentscheidung.');
    if (own(source, 'permissionKey', `Benachrichtigung ${index + 1}`) !== 'privacy.incident.notify') {
      throw new Error('Benachrichtigung enthaelt keine gebundene Benachrichtigungsberechtigung.');
    }
    const submittedAt = instant(own(source, 'submittedAt', `Benachrichtigung ${index + 1}`), 'Benachrichtigungszeit');
    if (submittedAt.micros < deadline.reviewedMicros || submittedAt.micros > evaluatedAt.micros) {
      throw new Error('Benachrichtigung liegt ausserhalb der belegten Fristpruefungsfolge.');
    }
    const notificationId = id(own(source, 'notificationId', `Benachrichtigung ${index + 1}`), 'Benachrichtigungskennung');
    if (notificationIds.has(notificationId)) throw new Error('Benachrichtigungshistorie enthaelt doppelte Originalkennungen.');
    notificationIds.add(notificationId);
    return Object.freeze({
      notificationId,
      incidentId,
      assessmentId,
      deadlineReviewId,
      notificationType: notificationType as 'authority_notification' | 'subject_notification',
      recipientEvidenceSha256: hash(own(source, 'recipientEvidenceSha256', `Benachrichtigung ${index + 1}`), 'Empfaengerbelegsumme'),
      submittedByProfileId: id(own(source, 'submittedByProfileId', `Benachrichtigung ${index + 1}`), 'Benachrichtigungsprofilkennung'),
      permissionKey: 'privacy.incident.notify' as const,
      permissionEvidenceId: id(own(source, 'permissionEvidenceId', `Benachrichtigung ${index + 1}`), 'Benachrichtigungsberechtigungsbeleg'),
      submittedAt: submittedAt.text,
      acknowledgementEvidenceSha256: nullableHash(own(source, 'acknowledgementEvidenceSha256', `Benachrichtigung ${index + 1}`), 'Empfangsbelegsumme'),
    });
  });

  const closureValue = own(root, 'closure', 'Sicherheitsvorfall');
  let closure: SecurityIncidentHandlingEvidence['closure'] = null;
  if (closureValue !== null) {
    const source = record(closureValue, 'Vorfallabschluss');
    exactKeys(source, [
      'closureId', 'incidentId', 'latestAssessmentId', 'actionIds', 'notificationIds', 'outcome',
      'closureEvidenceId', 'closureEvidenceSha256', 'closedByProfileId', 'permissionKey',
      'permissionEvidenceId', 'closedAt',
    ], 'Vorfallabschluss');
    if (id(own(source, 'incidentId', 'Vorfallabschluss'), 'Abschluss-Vorfallkennung') !== incidentId) {
      throw new Error('Vorfallabschluss bindet nicht den exakten Vorfall.');
    }
    const latestAssessment = assessments.at(-1);
    const latestAssessmentId = id(own(source, 'latestAssessmentId', 'Vorfallabschluss'), 'Abschluss-Bewertungskennung');
    if (!latestAssessment || latestAssessment.assessmentId !== latestAssessmentId) {
      throw new Error('Vorfallabschluss bindet nicht die letzte Bewertung.');
    }
    const closureActionIds = array(own(source, 'actionIds', 'Vorfallabschluss'), 'Abschluss-Massnahmen').map((value) => id(value, 'Abschluss-Massnahmenkennung'));
    const closureNotificationIds = array(own(source, 'notificationIds', 'Vorfallabschluss'), 'Abschluss-Benachrichtigungen').map((value) => id(value, 'Abschluss-Benachrichtigungskennung'));
    if (new Set(closureActionIds).size !== closureActionIds.length || !sameSet(closureActionIds, [...actionIds])) {
      throw new Error('Vorfallabschluss bildet die Massnahmenhistorie nicht vollstaendig ab.');
    }
    if (new Set(closureNotificationIds).size !== closureNotificationIds.length || !sameSet(closureNotificationIds, [...notificationIds])) {
      throw new Error('Vorfallabschluss bildet die Benachrichtigungshistorie nicht vollstaendig ab.');
    }
    if (actions.some((action) => action.completedAt === null)) throw new Error('Vorfallabschluss ist bei offener Massnahme unzulaessig.');
    if (latestAssessment.authorityNotificationDecision === 'pending_legal_review'
      || latestAssessment.subjectNotificationDecision === 'pending_legal_review') {
      throw new Error('Vorfallabschluss ist bei offener Rechtspruefung unzulaessig.');
    }
    for (const [type, decision] of [
      ['authority_notification', latestAssessment.authorityNotificationDecision],
      ['subject_notification', latestAssessment.subjectNotificationDecision],
    ] as const) {
      if (decision === 'required' && !notifications.some((item) => item.assessmentId === latestAssessmentId && item.notificationType === type)) {
        throw new Error('Vorfallabschluss fehlt eine ausdruecklich erforderliche Benachrichtigung.');
      }
    }
    if (own(source, 'permissionKey', 'Vorfallabschluss') !== 'privacy.incident.close') {
      throw new Error('Vorfallabschluss enthaelt keine gebundene Abschlussberechtigung.');
    }
    const outcome = own(source, 'outcome', 'Vorfallabschluss');
    if (!['mitigated', 'accepted_residual_risk', 'false_positive'].includes(String(outcome))) {
      throw new Error('Vorfallabschluss enthaelt kein erlaubtes Ergebnis.');
    }
    const closedAt = instant(own(source, 'closedAt', 'Vorfallabschluss'), 'Vorfallabschlusszeit');
    if (closedAt.micros < priorAssessmentAt || closedAt.micros > evaluatedAt.micros
      || actions.some((action) => instant(action.completedAt!, 'Massnahmenabschlusszeit').micros > closedAt.micros)
      || notifications.some((item) => instant(item.submittedAt, 'Benachrichtigungszeit').micros > closedAt.micros)) {
      throw new Error('Vorfallabschluss liegt ausserhalb der belegten Behandlungsfolge.');
    }
    closure = Object.freeze({
      closureId: id(own(source, 'closureId', 'Vorfallabschluss'), 'Vorfallabschlusskennung'),
      incidentId,
      latestAssessmentId,
      actionIds: Object.freeze(closureActionIds),
      notificationIds: Object.freeze(closureNotificationIds),
      outcome: outcome as 'mitigated' | 'accepted_residual_risk' | 'false_positive',
      closureEvidenceId: id(own(source, 'closureEvidenceId', 'Vorfallabschluss'), 'Abschlussbelegkennung'),
      closureEvidenceSha256: hash(own(source, 'closureEvidenceSha256', 'Vorfallabschluss'), 'Abschlussbelegsumme'),
      closedByProfileId: id(own(source, 'closedByProfileId', 'Vorfallabschluss'), 'Abschlussprofilkennung'),
      permissionKey: 'privacy.incident.close' as const,
      permissionEvidenceId: id(own(source, 'permissionEvidenceId', 'Vorfallabschluss'), 'Abschlussberechtigungsbeleg'),
      closedAt: closedAt.text,
    });
  }

  const disposition = assessments.length === 0 ? 'reported_unassessed'
    : actions.some((action) => action.completedAt === null) ? 'treatment_pending'
      : closure ? 'closed_with_evidence' : 'closure_review_pending';
  return Object.freeze({
    tenantId,
    evaluatedAt: evaluatedAt.text,
    incident,
    assessments: Object.freeze(assessments),
    deadlineReviews: Object.freeze(deadlineReviews),
    actions: Object.freeze(actions),
    notifications: Object.freeze(notifications),
    closure,
    disposition,
    authorityNotificationComplianceInferred: false,
    subjectNotificationComplianceInferred: false,
    securityRestoredInferred: false,
    legalClosureInferred: false,
    clinicalActionInferred: false,
  });
}
