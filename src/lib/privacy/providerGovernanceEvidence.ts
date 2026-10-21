export type ProviderGovernanceEvidence = Readonly<{
  tenantId: string;
  integrationId: string;
  change: Readonly<{
    changeId: string;
    currentProviderId: string | null;
    proposedProviderId: string;
    requestedByProfileId: string;
    requestedAt: string;
    reason: string;
  }>;
  provider: Readonly<{
    providerId: string;
    legalName: string;
    service: string;
    processingRegions: readonly string[];
  }>;
  agreement: Readonly<{
    agreementId: string;
    providerId: string;
    version: string;
    documentSha256: string;
    effectiveFrom: string;
    expiresAt: string | null;
  }>;
  technicalMeasures: Readonly<{
    assessmentId: string;
    providerId: string;
    version: string;
    documentSha256: string;
    assessedAt: string;
    areas: readonly string[];
  }>;
  subprocessors: readonly Readonly<{
    subprocessorId: string;
    legalName: string;
    processingRegions: readonly string[];
    disclosedAt: string;
  }>[];
  review: Readonly<{
    reviewId: string;
    reviewerProfileId: string;
    roleSnapshot: string;
    permissionKey: 'privacy.provider.review';
    permissionEvidenceId: string;
    decision: 'approved' | 'rejected';
    reviewedAt: string;
    changeId: string;
    providerId: string;
    agreementId: string;
    technicalMeasuresAssessmentId: string;
    subprocessorIds: readonly string[];
  }> | null;
  providerChangeGate: 'blocked_pending_review' | 'blocked_rejected' | 'reviewed_candidate';
  providerChangeReviewedBeforeRelease: boolean;
  legalComplianceInferred: false;
  productionReleaseInferred: false;
}>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const INSTANT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d{1,6})(Z|([+-])(\d{2}):(\d{2}))$/;

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    throw new Error(`${label} ist kein unveraenderter Originaldatensatz.`);
  }
  return value as Record<string, unknown>;
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

function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`${label} fehlt als Originaltext.`);
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

function strings(value: unknown, label: string): readonly string[] {
  if (!Array.isArray(value) || value.length === 0) throw new Error(`${label} fehlt als nichtleeres Originalarray.`);
  const result = value.map((entry) => text(entry, `${label}-Eintrag`));
  if (new Set(result).size !== result.length) throw new Error(`${label} enthaelt doppelte Originalwerte.`);
  return Object.freeze(result);
}

function nullableId(value: unknown, label: string): string | null {
  return value === null ? null : id(value, label);
}

/**
 * Binds a proposed provider change to the exact agreement, TOM assessment,
 * subprocessor disclosure and authorized review that were supplied. It never
 * turns those records into a legal-compliance or production-release decision.
 */
export function projectProviderGovernanceEvidence(input: unknown): ProviderGovernanceEvidence {
  const root = record(input, 'Anbieterpruefung');
  const tenantId = id(own(root, 'tenantId', 'Anbieterpruefung'), 'Mandantenkennung');
  const integrationId = id(own(root, 'integrationId', 'Anbieterpruefung'), 'Integrationskennung');

  const changeSource = record(own(root, 'change', 'Anbieterpruefung'), 'Anbieterwechsel');
  const changeId = id(own(changeSource, 'changeId', 'Anbieterwechsel'), 'Wechselkennung');
  const currentProviderId = nullableId(own(changeSource, 'currentProviderId', 'Anbieterwechsel'), 'Bisherige Anbieterkennung');
  const proposedProviderId = id(own(changeSource, 'proposedProviderId', 'Anbieterwechsel'), 'Vorgeschlagene Anbieterkennung');
  if (currentProviderId === proposedProviderId) throw new Error('Anbieterwechsel benoetigt unterschiedliche Anbieterkennungen.');
  const requestedByProfileId = id(own(changeSource, 'requestedByProfileId', 'Anbieterwechsel'), 'Anfragende Profilkennung');
  const requestedAt = instant(own(changeSource, 'requestedAt', 'Anbieterwechsel'), 'Anfragezeit');
  const reason = text(own(changeSource, 'reason', 'Anbieterwechsel'), 'Wechselgrund');
  const change = Object.freeze({ changeId, currentProviderId, proposedProviderId, requestedByProfileId, requestedAt: requestedAt.text, reason });

  const providerSource = record(own(root, 'provider', 'Anbieterpruefung'), 'Anbietersnapshot');
  const providerId = id(own(providerSource, 'providerId', 'Anbietersnapshot'), 'Anbieterkennung');
  if (providerId !== proposedProviderId) throw new Error('Anbietersnapshot gehoert nicht zum vorgeschlagenen Anbieter.');
  const provider = Object.freeze({
    providerId,
    legalName: text(own(providerSource, 'legalName', 'Anbietersnapshot'), 'Anbietername'),
    service: text(own(providerSource, 'service', 'Anbietersnapshot'), 'Anbieterdienst'),
    processingRegions: strings(own(providerSource, 'processingRegions', 'Anbietersnapshot'), 'Verarbeitungsregionen'),
  });

  const agreementSource = record(own(root, 'agreement', 'Anbieterpruefung'), 'Vertragssnapshot');
  const agreementProviderId = id(own(agreementSource, 'providerId', 'Vertragssnapshot'), 'Vertragsanbieterkennung');
  if (agreementProviderId !== providerId) throw new Error('Vertragssnapshot gehoert nicht zum vorgeschlagenen Anbieter.');
  const effectiveFrom = instant(own(agreementSource, 'effectiveFrom', 'Vertragssnapshot'), 'Vertragsbeginn');
  const expiresValue = own(agreementSource, 'expiresAt', 'Vertragssnapshot');
  const expiresAt = expiresValue === null ? null : instant(expiresValue, 'Vertragsende');
  if (expiresAt && expiresAt.micros <= effectiveFrom.micros) throw new Error('Vertragsende liegt nicht nach dem Vertragsbeginn.');
  const agreement = Object.freeze({
    agreementId: id(own(agreementSource, 'agreementId', 'Vertragssnapshot'), 'Vertragskennung'),
    providerId: agreementProviderId,
    version: text(own(agreementSource, 'version', 'Vertragssnapshot'), 'Vertragsfassung'),
    documentSha256: hash(own(agreementSource, 'documentSha256', 'Vertragssnapshot'), 'Vertragssumme'),
    effectiveFrom: effectiveFrom.text,
    expiresAt: expiresAt?.text ?? null,
  });

  const measuresSource = record(own(root, 'technicalMeasures', 'Anbieterpruefung'), 'TOM-Pruefung');
  const measuresProviderId = id(own(measuresSource, 'providerId', 'TOM-Pruefung'), 'TOM-Anbieterkennung');
  if (measuresProviderId !== providerId) throw new Error('TOM-Pruefung gehoert nicht zum vorgeschlagenen Anbieter.');
  const assessedAt = instant(own(measuresSource, 'assessedAt', 'TOM-Pruefung'), 'TOM-Pruefzeit');
  const technicalMeasures = Object.freeze({
    assessmentId: id(own(measuresSource, 'assessmentId', 'TOM-Pruefung'), 'TOM-Pruefkennung'),
    providerId: measuresProviderId,
    version: text(own(measuresSource, 'version', 'TOM-Pruefung'), 'TOM-Fassung'),
    documentSha256: hash(own(measuresSource, 'documentSha256', 'TOM-Pruefung'), 'TOM-Dokumentsumme'),
    assessedAt: assessedAt.text,
    areas: strings(own(measuresSource, 'areas', 'TOM-Pruefung'), 'TOM-Pruefbereiche'),
  });

  const subprocessorsValue = own(root, 'subprocessors', 'Anbieterpruefung');
  if (!Array.isArray(subprocessorsValue)) throw new Error('Unterauftragnehmer fehlen als Originalarray.');
  const subprocessorTimes: bigint[] = [];
  const subprocessors = subprocessorsValue.map((value) => {
    const source = record(value, 'Unterauftragnehmersnapshot');
    const disclosedAt = instant(own(source, 'disclosedAt', 'Unterauftragnehmersnapshot'), 'Unterauftragnehmer-Offenlegungszeit');
    subprocessorTimes.push(disclosedAt.micros);
    return Object.freeze({
      subprocessorId: id(own(source, 'subprocessorId', 'Unterauftragnehmersnapshot'), 'Unterauftragnehmerkennung'),
      legalName: text(own(source, 'legalName', 'Unterauftragnehmersnapshot'), 'Unterauftragnehmername'),
      processingRegions: strings(own(source, 'processingRegions', 'Unterauftragnehmersnapshot'), 'Unterauftragnehmerregionen'),
      disclosedAt: disclosedAt.text,
    });
  });
  const subprocessorIds = subprocessors.map((item) => item.subprocessorId);
  if (new Set(subprocessorIds).size !== subprocessorIds.length) throw new Error('Unterauftragnehmer enthalten doppelte Originalkennungen.');

  const reviewValue = own(root, 'review', 'Anbieterpruefung');
  let review: ProviderGovernanceEvidence['review'] = null;
  let providerChangeGate: ProviderGovernanceEvidence['providerChangeGate'] = 'blocked_pending_review';
  if (reviewValue !== null) {
    const source = record(reviewValue, 'Anbieterfreigabepruefung');
    const reviewedAt = instant(own(source, 'reviewedAt', 'Anbieterfreigabepruefung'), 'Pruefzeit');
    const lastEvidenceAt = subprocessorTimes.reduce((latest, value) => value > latest ? value : latest, assessedAt.micros);
    if (reviewedAt.micros <= requestedAt.micros || reviewedAt.micros <= lastEvidenceAt) {
      throw new Error('Anbieterpruefung liegt nicht nach Anfrage und vollstaendigem Nachweisstand.');
    }
    if (expiresAt && expiresAt.micros <= reviewedAt.micros) throw new Error('Vertrag war zum Pruefzeitpunkt bereits beendet.');
    const decision = own(source, 'decision', 'Anbieterfreigabepruefung');
    if (decision !== 'approved' && decision !== 'rejected') throw new Error('Anbieterpruefung enthaelt keine erlaubte Entscheidung.');
    const reviewedSubprocessors = strings(own(source, 'subprocessorIds', 'Anbieterfreigabepruefung'), 'Gepruefte Unterauftragnehmer');
    if (JSON.stringify([...reviewedSubprocessors].sort()) !== JSON.stringify([...subprocessorIds].sort())) {
      throw new Error('Anbieterpruefung umfasst nicht den exakten Unterauftragnehmerbestand.');
    }
    const reviewedChangeId = id(own(source, 'changeId', 'Anbieterfreigabepruefung'), 'Gepruefte Wechselkennung');
    const reviewedProviderId = id(own(source, 'providerId', 'Anbieterfreigabepruefung'), 'Gepruefte Anbieterkennung');
    const reviewedAgreementId = id(own(source, 'agreementId', 'Anbieterfreigabepruefung'), 'Gepruefte Vertragskennung');
    const reviewedAssessmentId = id(own(source, 'technicalMeasuresAssessmentId', 'Anbieterfreigabepruefung'), 'Gepruefte TOM-Kennung');
    if (reviewedChangeId !== changeId || reviewedProviderId !== providerId
      || reviewedAgreementId !== agreement.agreementId || reviewedAssessmentId !== technicalMeasures.assessmentId) {
      throw new Error('Anbieterpruefung ist nicht an den exakten Wechsel- und Nachweisstand gebunden.');
    }
    const permissionKey = own(source, 'permissionKey', 'Anbieterfreigabepruefung');
    if (permissionKey !== 'privacy.provider.review') throw new Error('Anbieterpruefung besitzt keine gebundene Pruefberechtigung.');
    review = Object.freeze({
      reviewId: id(own(source, 'reviewId', 'Anbieterfreigabepruefung'), 'Pruefkennung'),
      reviewerProfileId: id(own(source, 'reviewerProfileId', 'Anbieterfreigabepruefung'), 'Prueferprofil'),
      roleSnapshot: text(own(source, 'roleSnapshot', 'Anbieterfreigabepruefung'), 'Prueferrolle'),
      permissionKey,
      permissionEvidenceId: id(own(source, 'permissionEvidenceId', 'Anbieterfreigabepruefung'), 'Berechtigungsbeleg'),
      decision,
      reviewedAt: reviewedAt.text,
      changeId: reviewedChangeId,
      providerId: reviewedProviderId,
      agreementId: reviewedAgreementId,
      technicalMeasuresAssessmentId: reviewedAssessmentId,
      subprocessorIds: reviewedSubprocessors,
    });
    providerChangeGate = decision === 'approved' ? 'reviewed_candidate' : 'blocked_rejected';
  }

  return Object.freeze({
    tenantId, integrationId, change, provider, agreement, technicalMeasures,
    subprocessors: Object.freeze(subprocessors), review, providerChangeGate,
    providerChangeReviewedBeforeRelease: providerChangeGate === 'reviewed_candidate',
    legalComplianceInferred: false,
    productionReleaseInferred: false,
  });
}
