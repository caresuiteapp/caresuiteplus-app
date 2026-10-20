export type LegalProfessionalReviewEvidence = Readonly<{
  tenantId: string;
  reviewSubjectId: string;
  evaluatedAt: string;
  requirements: readonly Readonly<{
    requirementId: string;
    domain: 'sgb' | 'hkp' | 'documentation' | 'contract' | 'regional_rule';
    applicability: 'applicable' | 'not_applicable' | 'pending';
    jurisdictionCode: string;
    ruleCode: string;
    sourceId: string;
    sourceUri: string;
    sourceVersion: string;
    sourceSha256: string;
    applicabilityEvidenceId: string;
    applicabilityEvidenceSha256: string;
    sourceCheckedAt: string;
  }>[];
  reviews: readonly Readonly<{
    reviewId: string;
    sequence: number;
    supersedesReviewId: string | null;
    reviewedRequirementIds: readonly string[];
    decision: 'needs_changes' | 'approved_candidate';
    findingsSha256: string;
    reviewerProfileId: string;
    reviewerQualificationEvidenceId: string;
    permissionKey: 'privacy.legal.review';
    permissionEvidenceId: string;
    reviewedAt: string;
  }>[];
  status: 'pending_review' | 'changes_required' | 'reviewed_candidate';
  legalCompletenessInferred: false;
  currentLegalValidityInferred: false;
  careApprovalInferred: false;
  releaseApprovalInferred: false;
}>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const CODE = /^[a-z0-9][a-z0-9._:-]{0,127}$/;
const INSTANT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d{1,6})(Z|([+-])(\d{2}):(\d{2}))$/;
const DOMAINS = ['sgb', 'hkp', 'documentation', 'contract', 'regional_rule'] as const;

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

function uri(value: unknown, label: string): string {
  if (typeof value !== 'string') throw new Error(`${label} ist keine vollstaendige HTTPS-Quellenadresse.`);
  let parsed: URL;
  try { parsed = new URL(value); } catch { throw new Error(`${label} ist keine vollstaendige HTTPS-Quellenadresse.`); }
  if (parsed.protocol !== 'https:' || !parsed.hostname) throw new Error(`${label} ist keine vollstaendige HTTPS-Quellenadresse.`);
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

function array(value: unknown, label: string, allowEmpty = false): unknown[] {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) {
    throw new Error(`${label} fehlt als ${allowEmpty ? '' : 'nichtleere '}Originalhistorie.`);
  }
  return value;
}

function unique(values: readonly string[], label: string): void {
  if (new Set(values).size !== values.length) throw new Error(`${label} enthaelt doppelte native Kennungen.`);
}

function sameSet(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value) => right.includes(value));
}

/**
 * Preserves the complete evidence chain of a professional legal review. The
 * projection proves only what was reviewed against which source version by an
 * identified and authorized reviewer. It never promotes that evidence to a
 * statement of current legal completeness, care approval or release approval.
 */
export function projectLegalProfessionalReviewEvidence(input: unknown): LegalProfessionalReviewEvidence {
  const root = record(input, 'Rechtliche Fachpruefung');
  exactKeys(root, ['tenantId', 'reviewSubjectId', 'evaluatedAt', 'requirements', 'reviews'], 'Rechtliche Fachpruefung');
  const tenantId = id(own(root, 'tenantId', 'Rechtliche Fachpruefung'), 'Mandantenkennung');
  const reviewSubjectId = id(own(root, 'reviewSubjectId', 'Rechtliche Fachpruefung'), 'Pruefgegenstandskennung');
  const evaluatedAt = instant(own(root, 'evaluatedAt', 'Rechtliche Fachpruefung'), 'Auswertungszeit');

  const requirements = array(own(root, 'requirements', 'Rechtliche Fachpruefung'), 'Pruefanforderungen').map((value) => {
    const row = record(value, 'Pruefanforderung');
    exactKeys(row, [
      'requirementId', 'tenantId', 'reviewSubjectId', 'domain', 'applicability', 'jurisdictionCode',
      'ruleCode', 'sourceId', 'sourceUri', 'sourceVersion', 'sourceSha256', 'applicabilityEvidenceId',
      'applicabilityEvidenceSha256', 'sourceCheckedAt',
    ], 'Pruefanforderung');
    if (id(own(row, 'tenantId', 'Pruefanforderung'), 'Anforderungsmandant') !== tenantId
      || id(own(row, 'reviewSubjectId', 'Pruefanforderung'), 'Anforderungspruefgegenstand') !== reviewSubjectId) {
      throw new Error('Pruefanforderung gehoert zu einem anderen Mandanten oder Pruefgegenstand.');
    }
    const domain = own(row, 'domain', 'Pruefanforderung');
    if (typeof domain !== 'string' || !DOMAINS.includes(domain as typeof DOMAINS[number])) {
      throw new Error('Pruefanforderung enthaelt keinen erlaubten Pruefbereich.');
    }
    const applicability = own(row, 'applicability', 'Pruefanforderung');
    if (!['applicable', 'not_applicable', 'pending'].includes(String(applicability))) {
      throw new Error('Pruefanforderung enthaelt keinen erlaubten Anwendungsstatus.');
    }
    const sourceCheckedAt = instant(own(row, 'sourceCheckedAt', 'Pruefanforderung'), 'Quellenpruefzeit');
    if (sourceCheckedAt.micros > evaluatedAt.micros) throw new Error('Quellenpruefung liegt nach der Auswertungszeit.');
    return Object.freeze({
      requirementId: id(own(row, 'requirementId', 'Pruefanforderung'), 'Anforderungskennung'),
      domain: domain as typeof DOMAINS[number],
      applicability: applicability as 'applicable' | 'not_applicable' | 'pending',
      jurisdictionCode: code(own(row, 'jurisdictionCode', 'Pruefanforderung'), 'Zustaendigkeitscode'),
      ruleCode: code(own(row, 'ruleCode', 'Pruefanforderung'), 'Regelcode'),
      sourceId: id(own(row, 'sourceId', 'Pruefanforderung'), 'Quellenkennung'),
      sourceUri: uri(own(row, 'sourceUri', 'Pruefanforderung'), 'Quellenadresse'),
      sourceVersion: code(own(row, 'sourceVersion', 'Pruefanforderung'), 'Quellenfassung'),
      sourceSha256: hash(own(row, 'sourceSha256', 'Pruefanforderung'), 'Quellensumme'),
      applicabilityEvidenceId: id(own(row, 'applicabilityEvidenceId', 'Pruefanforderung'), 'Anwendbarkeitsbelegkennung'),
      applicabilityEvidenceSha256: hash(own(row, 'applicabilityEvidenceSha256', 'Pruefanforderung'), 'Anwendbarkeitsbelegsumme'),
      sourceCheckedAt: sourceCheckedAt.text,
    });
  });
  unique(requirements.map((row) => row.requirementId), 'Pruefanforderungen');
  const coveredDomains = new Set(requirements.map((row) => row.domain));
  if (DOMAINS.some((domain) => !coveredDomains.has(domain))) {
    throw new Error('Pruefumfang deckt SGB, HKP, Dokumentation, Vertraege und regionale Regeln nicht vollstaendig ab.');
  }
  const requirementsById = new Map(requirements.map((row) => [row.requirementId, row]));

  let previousReviewId: string | null = null;
  let previousReviewedAt: bigint | null = null;
  const reviews = array(own(root, 'reviews', 'Rechtliche Fachpruefung'), 'Pruefhistorie', true).map((value, index) => {
    const row = record(value, 'Fachpruefrevision');
    exactKeys(row, [
      'reviewId', 'tenantId', 'reviewSubjectId', 'sequence', 'supersedesReviewId', 'reviewedRequirementIds',
      'decision', 'findingsSha256', 'reviewerProfileId', 'reviewerQualificationEvidenceId', 'permissionKey',
      'permissionEvidenceId', 'reviewedAt',
    ], 'Fachpruefrevision');
    if (id(own(row, 'tenantId', 'Fachpruefrevision'), 'Revisionsmandant') !== tenantId
      || id(own(row, 'reviewSubjectId', 'Fachpruefrevision'), 'Revisionspruefgegenstand') !== reviewSubjectId) {
      throw new Error('Fachpruefrevision gehoert zu einem anderen Mandanten oder Pruefgegenstand.');
    }
    const sequence = own(row, 'sequence', 'Fachpruefrevision');
    if (typeof sequence !== 'number' || !Number.isSafeInteger(sequence) || sequence !== index + 1) {
      throw new Error('Pruefhistorie ist nicht lueckenlos und original geordnet.');
    }
    const reviewId = id(own(row, 'reviewId', 'Fachpruefrevision'), 'Revisionskennung');
    const supersedesValue = own(row, 'supersedesReviewId', 'Fachpruefrevision');
    const supersedesReviewId = supersedesValue === null ? null : id(supersedesValue, 'Vorgaengerrevision');
    if (supersedesReviewId !== previousReviewId) throw new Error('Fachpruefrevision verweist nicht exakt auf ihre Vorgaengerrevision.');
    const reviewedRequirementIds = array(own(row, 'reviewedRequirementIds', 'Fachpruefrevision'), 'Gepruefte Anforderungen')
      .map((candidate) => id(candidate, 'Gepruefte Anforderungskennung'));
    unique(reviewedRequirementIds, 'Gepruefte Anforderungen');
    if (!sameSet(reviewedRequirementIds, requirements.map((requirement) => requirement.requirementId))) {
      throw new Error('Fachpruefrevision deckt nicht die vollstaendige Anforderungsmenge ab.');
    }
    if (reviewedRequirementIds.some((candidate) => !requirementsById.has(candidate))) {
      throw new Error('Fachpruefrevision verweist auf eine unbekannte Anforderung.');
    }
    const decision = own(row, 'decision', 'Fachpruefrevision');
    if (!['needs_changes', 'approved_candidate'].includes(String(decision))) {
      throw new Error('Fachpruefrevision enthaelt keine erlaubte Entscheidung.');
    }
    if (own(row, 'permissionKey', 'Fachpruefrevision') !== 'privacy.legal.review') {
      throw new Error('Fachpruefrevision enthaelt keine gebundene Pruefberechtigung.');
    }
    const reviewedAt = instant(own(row, 'reviewedAt', 'Fachpruefrevision'), 'Fachpruefzeit');
    if (reviewedAt.micros > evaluatedAt.micros || (previousReviewedAt !== null && reviewedAt.micros <= previousReviewedAt)) {
      throw new Error('Fachpruefrevision liegt ausserhalb der lueckenlosen Ereignisfolge.');
    }
    if (requirements.some((requirement) => instant(requirement.sourceCheckedAt, 'Quellenpruefzeit').micros > reviewedAt.micros)) {
      throw new Error('Fachpruefrevision liegt vor einer ihrer Quellenpruefungen.');
    }
    if (decision === 'approved_candidate' && requirements.some((requirement) => requirement.applicability === 'pending')) {
      throw new Error('Freigabekandidat enthaelt noch ungepruefte Anwendbarkeit.');
    }
    previousReviewId = reviewId;
    previousReviewedAt = reviewedAt.micros;
    return Object.freeze({
      reviewId,
      sequence,
      supersedesReviewId,
      reviewedRequirementIds: Object.freeze(reviewedRequirementIds),
      decision: decision as 'needs_changes' | 'approved_candidate',
      findingsSha256: hash(own(row, 'findingsSha256', 'Fachpruefrevision'), 'Feststellungssumme'),
      reviewerProfileId: id(own(row, 'reviewerProfileId', 'Fachpruefrevision'), 'Prueferprofil'),
      reviewerQualificationEvidenceId: id(own(row, 'reviewerQualificationEvidenceId', 'Fachpruefrevision'), 'Qualifikationsbeleg'),
      permissionKey: 'privacy.legal.review' as const,
      permissionEvidenceId: id(own(row, 'permissionEvidenceId', 'Fachpruefrevision'), 'Pruefberechtigungsbeleg'),
      reviewedAt: reviewedAt.text,
    });
  });
  unique(reviews.map((row) => row.reviewId), 'Pruefhistorie');

  const latest = reviews.at(-1);
  const status = !latest ? 'pending_review'
    : latest.decision === 'needs_changes' ? 'changes_required' : 'reviewed_candidate';
  return Object.freeze({
    tenantId,
    reviewSubjectId,
    evaluatedAt: evaluatedAt.text,
    requirements: Object.freeze(requirements),
    reviews: Object.freeze(reviews),
    status,
    legalCompletenessInferred: false,
    currentLegalValidityInferred: false,
    careApprovalInferred: false,
    releaseApprovalInferred: false,
  });
}
