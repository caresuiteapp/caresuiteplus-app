export type ProcessingLegalBasisEvidence = Readonly<{
  tenantId: string;
  processingActivityId: string;
  purposeSourceId: string;
  purpose: string;
  controllerProfileId: string;
  responsibleProfileId: string;
  dataCategories: readonly Readonly<{
    categoryId: string;
    label: string;
    classification: 'general' | 'special_category';
    assignedCandidateIds: readonly string[];
  }>[];
  candidates: readonly Readonly<{
    candidateId: string;
    layer: 'general' | 'special_category';
    reference: string;
    sourceUri: string;
    sourceVersion: string;
    sourceSha256: string;
  }>[];
  review: Readonly<{
    reviewId: string;
    reviewerProfileId: string;
    reviewerRoleSnapshot: string;
    decision: 'pending' | 'approved' | 'rejected';
    reviewedCandidateIds: readonly string[];
  }>;
  assignmentStatus: 'pending_review' | 'reviewed_candidate' | 'rejected';
  currentApplicability: 'not_verified';
  legalComplianceInferred: false;
}>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const INSTANT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d{1,6})(Z|([+-])(\d{2}):(\d{2}))$/;

function ownRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    throw new Error(`${label} ist kein unveraenderter Originaldatensatz.`);
  }
  return value as Record<string, unknown>;
}

function ownValue(record: Record<string, unknown>, key: string, label: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(record, key);
  if (!descriptor || !Object.hasOwn(descriptor, 'value')) {
    throw new Error(`${label} ${key} fehlt als Originalwert.`);
  }
  return descriptor.value;
}

function array(value: unknown, label: string, allowEmpty = false): unknown[] {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) {
    throw new Error(`${label} fehlt als ${allowEmpty ? '' : 'nichtleeres '}Originalarray.`);
  }
  return value;
}

function uuid(value: unknown, label: string): string {
  if (typeof value !== 'string' || !UUID.test(value)) throw new Error(`${label} ist keine native UUID.`);
  return value;
}

function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`${label} fehlt als Originaltext.`);
  return value;
}

function hash(value: unknown, label: string): string {
  if (typeof value !== 'string' || !SHA256.test(value)) throw new Error(`${label} ist kein SHA-256-Originalwert.`);
  return value;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], label: string): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) throw new Error(`${label} ist kein erlaubter Originalstatus.`);
  return value as T;
}

function bool(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${label} ist kein nativer Wahrheitswert.`);
  return value;
}

function instant(value: unknown, label: string): bigint {
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
  return BigInt(Date.UTC(year, month - 1, day, hour, minute, second) - offset * 60_000) * 1000n
    + BigInt(fraction.padEnd(6, '0'));
}

function unique(values: readonly string[], label: string): void {
  if (new Set(values).size !== values.length) throw new Error(`${label} enthaelt doppelte native Kennungen.`);
}

function httpUri(value: unknown, label: string): string {
  const uri = text(value, label);
  let parsed: URL;
  try {
    parsed = new URL(uri);
  } catch {
    throw new Error(`${label} ist keine vollstaendige HTTP-Quellenadresse.`);
  }
  if (!['https:', 'http:'].includes(parsed.protocol) || !parsed.hostname) {
    throw new Error(`${label} ist keine vollstaendige HTTP-Quellenadresse.`);
  }
  return uri;
}

/**
 * Builds a fail-closed evidence projection for a processing activity's legal-
 * basis candidates. It preserves the original purpose, categories, sources,
 * responsibility and professional review separately. Even an approved review
 * remains a reviewed candidate: this local projection never asserts that the
 * source is still current, applicable to the individual case, or legally
 * sufficient.
 */
export function projectProcessingLegalBasisEvidence(input: unknown): ProcessingLegalBasisEvidence {
  const root = ownRecord(input, 'Verarbeitungstaetigkeit');
  const tenantId = uuid(ownValue(root, 'tenantId', 'Verarbeitungstaetigkeit'), 'Mandantenkennung');
  const processingActivityId = uuid(ownValue(root, 'processingActivityId', 'Verarbeitungstaetigkeit'), 'Verarbeitungstaetigkeitskennung');
  const purposeSourceId = uuid(ownValue(root, 'purposeSourceId', 'Verarbeitungstaetigkeit'), 'Zweckquellenkennung');
  const purpose = text(ownValue(root, 'purpose', 'Verarbeitungstaetigkeit'), 'Verarbeitungszweck');
  const controllerProfileId = uuid(ownValue(root, 'controllerProfileId', 'Verarbeitungstaetigkeit'), 'Verantwortlichenprofil');
  const responsibleProfileId = uuid(ownValue(root, 'responsibleProfileId', 'Verarbeitungstaetigkeit'), 'Zustaendigenprofil');
  const recordedAt = instant(ownValue(root, 'recordedAt', 'Verarbeitungstaetigkeit'), 'Erfassungszeit');

  const candidates = array(ownValue(root, 'candidates', 'Verarbeitungstaetigkeit'), 'Rechtsgrundlagenkandidaten').map((value) => {
    const candidate = ownRecord(value, 'Rechtsgrundlagenkandidat');
    const candidateId = uuid(ownValue(candidate, 'candidateId', 'Rechtsgrundlagenkandidat'), 'Kandidatenkennung');
    const layer = oneOf(ownValue(candidate, 'layer', 'Rechtsgrundlagenkandidat'), ['general', 'special_category'] as const, 'Kandidatenebene');
    const reference = text(ownValue(candidate, 'reference', 'Rechtsgrundlagenkandidat'), 'Fundstellenbezeichnung');
    const sourceUri = httpUri(ownValue(candidate, 'sourceUri', 'Rechtsgrundlagenkandidat'), 'Quellenadresse');
    const sourceVersion = text(ownValue(candidate, 'sourceVersion', 'Rechtsgrundlagenkandidat'), 'Quellenfassung');
    const sourceSha256 = hash(ownValue(candidate, 'sourceSha256', 'Rechtsgrundlagenkandidat'), 'Quellensumme');
    const sourceCheckedAt = instant(ownValue(candidate, 'sourceCheckedAt', 'Rechtsgrundlagenkandidat'), 'Quellenpruefzeit');
    if (sourceCheckedAt > recordedAt) throw new Error('Quellenpruefung liegt nach der Erfassung der Verarbeitungstaetigkeit.');
    return Object.freeze({ candidateId, layer, reference, sourceUri, sourceVersion, sourceSha256 });
  });
  unique(candidates.map((candidate) => candidate.candidateId), 'Rechtsgrundlagenkandidaten');
  if (!candidates.some((candidate) => candidate.layer === 'general')) {
    throw new Error('Mindestens ein allgemeiner Rechtsgrundlagenkandidat fehlt.');
  }
  const candidatesById = new Map(candidates.map((candidate) => [candidate.candidateId, candidate]));

  const dataCategories = array(ownValue(root, 'dataCategories', 'Verarbeitungstaetigkeit'), 'Datenkategorien').map((value) => {
    const category = ownRecord(value, 'Datenkategorie');
    const categoryId = uuid(ownValue(category, 'categoryId', 'Datenkategorie'), 'Datenkategoriekennung');
    const label = text(ownValue(category, 'label', 'Datenkategorie'), 'Datenkategoriebezeichnung');
    const classification = oneOf(ownValue(category, 'classification', 'Datenkategorie'), ['general', 'special_category'] as const, 'Datenkategorieklassifikation');
    const assignedCandidateIds = array(ownValue(category, 'assignedCandidateIds', 'Datenkategorie'), 'Kandidatenzuordnung')
      .map((candidateId) => uuid(candidateId, 'Zugeordnete Kandidatenkennung'));
    unique(assignedCandidateIds, 'Kandidatenzuordnung');
    for (const candidateId of assignedCandidateIds) {
      if (!candidatesById.has(candidateId)) throw new Error('Datenkategorie verweist auf einen unbekannten Rechtsgrundlagenkandidaten.');
    }
    if (!assignedCandidateIds.some((candidateId) => candidatesById.get(candidateId)?.layer === 'general')) {
      throw new Error('Jede Datenkategorie benoetigt einen allgemeinen Rechtsgrundlagenkandidaten.');
    }
    if (classification === 'special_category'
      && !assignedCandidateIds.some((candidateId) => candidatesById.get(candidateId)?.layer === 'special_category')) {
      throw new Error('Besondere Datenkategorie benoetigt einen getrennten besonderen Rechtsgrundlagenkandidaten.');
    }
    return Object.freeze({ categoryId, label, classification, assignedCandidateIds: Object.freeze(assignedCandidateIds) });
  });
  unique(dataCategories.map((category) => category.categoryId), 'Datenkategorien');

  const reviewSource = ownRecord(ownValue(root, 'review', 'Verarbeitungstaetigkeit'), 'Fachpruefung');
  const reviewId = uuid(ownValue(reviewSource, 'reviewId', 'Fachpruefung'), 'Pruefkennung');
  const reviewerProfileId = uuid(ownValue(reviewSource, 'reviewerProfileId', 'Fachpruefung'), 'Prueferprofil');
  const reviewerRoleSnapshot = text(ownValue(reviewSource, 'reviewerRoleSnapshot', 'Fachpruefung'), 'Prueferrollensnapshot');
  uuid(ownValue(reviewSource, 'permissionEvidenceId', 'Fachpruefung'), 'Pruefberechtigungsbeleg');
  const permission = oneOf(ownValue(reviewSource, 'permission', 'Fachpruefung'), ['allowed', 'denied'] as const, 'Pruefberechtigung');
  const decision = oneOf(ownValue(reviewSource, 'decision', 'Fachpruefung'), ['pending', 'approved', 'rejected'] as const, 'Pruefentscheidung');
  const reviewedCandidateIds = array(ownValue(reviewSource, 'reviewedCandidateIds', 'Fachpruefung'), 'Gepruefte Kandidaten', true)
    .map((candidateId) => uuid(candidateId, 'Gepruefte Kandidatenkennung'));
  unique(reviewedCandidateIds, 'Gepruefte Kandidaten');
  const reviewedAtValue = ownValue(reviewSource, 'reviewedAt', 'Fachpruefung');
  const reviewedAt = reviewedAtValue === null ? null : instant(reviewedAtValue, 'Fachpruefzeit');
  const currentLawConfirmed = bool(ownValue(reviewSource, 'currentLawConfirmed', 'Fachpruefung'), 'Aktualitaetsbestaetigung');

  if (decision === 'pending') {
    if (reviewedAt !== null || reviewedCandidateIds.length > 0 || currentLawConfirmed) {
      throw new Error('Ausstehende Fachpruefung darf keine geprueften Kandidaten oder Aktualitaetsbestaetigung enthalten.');
    }
  } else {
    if (permission !== 'allowed') throw new Error('Abgeschlossene Fachpruefung besitzt keine erlaubte Pruefberechtigung.');
    if (reviewedAt === null || reviewedAt < recordedAt) throw new Error('Abgeschlossene Fachpruefung benoetigt eine spaetere Pruefzeit.');
    if (reviewedCandidateIds.length === 0) throw new Error('Abgeschlossene Fachpruefung benoetigt gepruefte Kandidaten.');
    for (const candidateId of reviewedCandidateIds) {
      if (!candidatesById.has(candidateId)) throw new Error('Fachpruefung verweist auf einen unbekannten Rechtsgrundlagenkandidaten.');
    }
    const assigned = new Set(dataCategories.flatMap((category) => category.assignedCandidateIds));
    if (reviewedCandidateIds.some((candidateId) => !assigned.has(candidateId))) {
      throw new Error('Fachpruefung enthaelt einen keiner Datenkategorie zugeordneten Kandidaten.');
    }
    if (decision === 'approved' && [...assigned].some((candidateId) => !reviewedCandidateIds.includes(candidateId))) {
      throw new Error('Freigebende Fachpruefung deckt nicht alle zugeordneten Rechtsgrundlagenkandidaten ab.');
    }
  }
  if (permission === 'denied' && decision !== 'pending') {
    throw new Error('Verweigerte Pruefberechtigung darf keine Fachentscheidung tragen.');
  }

  const review = Object.freeze({
    reviewId,
    reviewerProfileId,
    reviewerRoleSnapshot,
    decision,
    reviewedCandidateIds: Object.freeze(reviewedCandidateIds),
  });
  const assignmentStatus = decision === 'approved' && currentLawConfirmed
    ? 'reviewed_candidate'
    : decision === 'rejected' ? 'rejected' : 'pending_review';

  return Object.freeze({
    tenantId,
    processingActivityId,
    purposeSourceId,
    purpose,
    controllerProfileId,
    responsibleProfileId,
    dataCategories: Object.freeze(dataCategories),
    candidates: Object.freeze(candidates),
    review,
    assignmentStatus,
    currentApplicability: 'not_verified',
    legalComplianceInferred: false,
  });
}
