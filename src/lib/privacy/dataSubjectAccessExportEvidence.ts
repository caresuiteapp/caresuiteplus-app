export type DataSubjectAccessExportEvidence = Readonly<{
  tenantId: string;
  evaluatedAt: string;
  request: Readonly<{
    requestId: string;
    subjectType: 'client' | 'employee' | 'profile';
    subjectId: string;
    requestType: 'access_export';
    requestedCategories: readonly string[];
    requestedAt: string;
  }>;
  identity: Readonly<{
    verificationId: string;
    requestId: string;
    subjectId: string;
    verified: boolean;
    method: string;
    evidenceId: string;
    evidenceSha256: string;
    verifiedByProfileId: string;
    permissionKey: 'privacy.access.identity.verify';
    permissionEvidenceId: string;
    verifiedAt: string;
  }>;
  records: readonly Readonly<{
    recordId: string;
    tenantId: string;
    subjectId: string;
    category: string;
    sourceType: string;
    sourceVersion: string;
    contentSha256: string;
    occurredAt: string;
  }>[];
  exclusions: readonly Readonly<{
    exclusionId: string;
    recordId: string;
    reasonCode: string;
    reason: string;
    reviewedByProfileId: string;
    permissionKey: 'privacy.access.exclude';
    permissionEvidenceId: string;
    decidedAt: string;
  }>[];
  exportPackage: Readonly<{
    jobId: string;
    packageId: string;
    requestId: string;
    subjectId: string;
    categories: readonly string[];
    includedRecordIds: readonly string[];
    exclusionIds: readonly string[];
    manifestSha256: string;
    outputSha256: string;
    generatedByProfileId: string;
    permissionKey: 'privacy.access.export';
    permissionEvidenceId: string;
    generatedAt: string;
  }> | null;
  delivery: Readonly<{
    deliveryId: string;
    packageId: string;
    recipientSubjectId: string;
    channel: string;
    recipientSha256: string;
    secureDeliveryEvidenceId: string;
    deliveredByProfileId: string;
    permissionKey: 'privacy.access.deliver';
    permissionEvidenceId: string;
    deliveredAt: string;
    acknowledgedAt: string | null;
  }> | null;
  disposition: 'blocked_identity' | 'verified_not_prepared' | 'prepared_not_delivered'
    | 'delivered_unacknowledged' | 'delivered_acknowledged';
  requestCompletedInferred: false;
  legalCompletenessInferred: false;
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

function exactUniqueTextArray(value: unknown, label: string, allowEmpty = false): string[] {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) throw new Error(`${label} fehlt als vollstaendiges Originalarray.`);
  const items = value.map((item, index) => text(item, `${label} ${index + 1}`));
  if (new Set(items).size !== items.length) throw new Error(`${label} enthaelt doppelte Originalwerte.`);
  return items;
}

function sameSet(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value) => right.includes(value));
}

/**
 * Binds one access/export request to the verified subject, exact record scope,
 * exclusions, immutable package hashes and delivery evidence. It never infers
 * legal completeness, receipt or completion of the data-subject request.
 */
export function projectDataSubjectAccessExportEvidence(input: unknown): DataSubjectAccessExportEvidence {
  const root = record(input, 'Auskunftsexport');
  const tenantId = id(own(root, 'tenantId', 'Auskunftsexport'), 'Mandantenkennung');
  const evaluatedAt = instant(own(root, 'evaluatedAt', 'Auskunftsexport'), 'Auswertungszeit');

  const requestSource = record(own(root, 'request', 'Auskunftsexport'), 'Anfragesnapshot');
  const requestId = id(own(requestSource, 'requestId', 'Anfragesnapshot'), 'Anfragekennung');
  const subjectId = id(own(requestSource, 'subjectId', 'Anfragesnapshot'), 'Betroffenenkennung');
  const subjectType = own(requestSource, 'subjectType', 'Anfragesnapshot');
  if (!['client', 'employee', 'profile'].includes(String(subjectType))) throw new Error('Anfrage enthaelt keine erlaubte Betroffenenart.');
  if (own(requestSource, 'requestType', 'Anfragesnapshot') !== 'access_export') throw new Error('Anfrage ist kein gebundener Auskunftsexport.');
  const requestedCategories = exactUniqueTextArray(own(requestSource, 'requestedCategories', 'Anfragesnapshot'), 'Angefragte Kategorien');
  const requestedAt = instant(own(requestSource, 'requestedAt', 'Anfragesnapshot'), 'Anfragezeit');
  if (requestedAt.micros > evaluatedAt.micros) throw new Error('Anfrage liegt nach der Auswertungszeit.');
  const request = Object.freeze({
    requestId,
    subjectType: subjectType as 'client' | 'employee' | 'profile',
    subjectId,
    requestType: 'access_export' as const,
    requestedCategories: Object.freeze(requestedCategories),
    requestedAt: requestedAt.text,
  });

  const identitySource = record(own(root, 'identity', 'Auskunftsexport'), 'Identitaetspruefung');
  if (id(own(identitySource, 'requestId', 'Identitaetspruefung'), 'Identitaets-Anfragekennung') !== requestId
    || id(own(identitySource, 'subjectId', 'Identitaetspruefung'), 'Identitaets-Betroffenenkennung') !== subjectId) {
    throw new Error('Identitaetspruefung bindet Anfrage und betroffene Person nicht exakt.');
  }
  if (own(identitySource, 'permissionKey', 'Identitaetspruefung') !== 'privacy.access.identity.verify') {
    throw new Error('Identitaetspruefung enthaelt keine gebundene Pruefberechtigung.');
  }
  const verified = own(identitySource, 'verified', 'Identitaetspruefung');
  if (typeof verified !== 'boolean') throw new Error('Identitaetspruefung enthaelt keinen originalen Wahrheitswert.');
  const verifiedAt = instant(own(identitySource, 'verifiedAt', 'Identitaetspruefung'), 'Identitaetspruefzeit');
  if (verifiedAt.micros < requestedAt.micros || verifiedAt.micros > evaluatedAt.micros) {
    throw new Error('Identitaetspruefung liegt ausserhalb der belegten Anfragefolge.');
  }
  const identity = Object.freeze({
    verificationId: id(own(identitySource, 'verificationId', 'Identitaetspruefung'), 'Identitaetspruefkennung'),
    requestId,
    subjectId,
    verified,
    method: text(own(identitySource, 'method', 'Identitaetspruefung'), 'Identitaetspruefmethode'),
    evidenceId: id(own(identitySource, 'evidenceId', 'Identitaetspruefung'), 'Identitaetsbelegkennung'),
    evidenceSha256: hash(own(identitySource, 'evidenceSha256', 'Identitaetspruefung'), 'Identitaetsbelegsumme'),
    verifiedByProfileId: id(own(identitySource, 'verifiedByProfileId', 'Identitaetspruefung'), 'Prueferprofilkennung'),
    permissionKey: 'privacy.access.identity.verify' as const,
    permissionEvidenceId: id(own(identitySource, 'permissionEvidenceId', 'Identitaetspruefung'), 'Identitaetsberechtigungsbeleg'),
    verifiedAt: verifiedAt.text,
  });

  const recordsValue = own(root, 'records', 'Auskunftsexport');
  if (!Array.isArray(recordsValue)) throw new Error('Aktenumfang fehlt als vollstaendiges Originalarray.');
  const recordIds = new Set<string>();
  const records = recordsValue.map((value, index) => {
    const source = record(value, `Akteneintrag ${index + 1}`);
    const recordId = id(own(source, 'recordId', `Akteneintrag ${index + 1}`), 'Aktenkennung');
    if (recordIds.has(recordId)) throw new Error('Aktenumfang enthaelt doppelte Originalkennungen.');
    recordIds.add(recordId);
    if (id(own(source, 'tenantId', `Akteneintrag ${index + 1}`), 'Akten-Mandantenkennung') !== tenantId) {
      throw new Error('Akteneintrag gehoert zu einem anderen Mandanten.');
    }
    if (id(own(source, 'subjectId', `Akteneintrag ${index + 1}`), 'Akten-Betroffenenkennung') !== subjectId) {
      throw new Error('Akteneintrag gehoert zu einer anderen betroffenen Person.');
    }
    const category = text(own(source, 'category', `Akteneintrag ${index + 1}`), 'Aktenkategorie');
    if (!requestedCategories.includes(category)) throw new Error('Akteneintrag liegt ausserhalb des angefragten Umfangs.');
    const occurredAt = instant(own(source, 'occurredAt', `Akteneintrag ${index + 1}`), 'Aktenereigniszeit');
    if (occurredAt.micros > evaluatedAt.micros) throw new Error('Akteneintrag liegt nach der Auswertungszeit.');
    return Object.freeze({
      recordId,
      tenantId,
      subjectId,
      category,
      sourceType: text(own(source, 'sourceType', `Akteneintrag ${index + 1}`), 'Aktenquellentyp'),
      sourceVersion: text(own(source, 'sourceVersion', `Akteneintrag ${index + 1}`), 'Aktenquellenfassung'),
      contentSha256: hash(own(source, 'contentSha256', `Akteneintrag ${index + 1}`), 'Akteninhaltssumme'),
      occurredAt: occurredAt.text,
    });
  });

  const exclusionsValue = own(root, 'exclusions', 'Auskunftsexport');
  if (!Array.isArray(exclusionsValue)) throw new Error('Ausschluesse fehlen als vollstaendiges Originalarray.');
  const exclusionIds = new Set<string>();
  const excludedRecordIds = new Set<string>();
  const exclusions = exclusionsValue.map((value, index) => {
    const source = record(value, `Ausschluss ${index + 1}`);
    const exclusionId = id(own(source, 'exclusionId', `Ausschluss ${index + 1}`), 'Ausschlusskennung');
    const recordId = id(own(source, 'recordId', `Ausschluss ${index + 1}`), 'Ausschluss-Aktenkennung');
    if (exclusionIds.has(exclusionId) || excludedRecordIds.has(recordId)) throw new Error('Ausschluesse enthalten doppelte Originalkennungen.');
    if (!recordIds.has(recordId)) throw new Error('Ausschluss bindet keinen Akteneintrag des exakten Umfangs.');
    if (own(source, 'permissionKey', `Ausschluss ${index + 1}`) !== 'privacy.access.exclude') {
      throw new Error('Ausschluss enthaelt keine gebundene Ausschlussberechtigung.');
    }
    const decidedAt = instant(own(source, 'decidedAt', `Ausschluss ${index + 1}`), 'Ausschlusszeit');
    if (decidedAt.micros < verifiedAt.micros || decidedAt.micros > evaluatedAt.micros) {
      throw new Error('Ausschluss liegt ausserhalb der belegten Exportfolge.');
    }
    exclusionIds.add(exclusionId);
    excludedRecordIds.add(recordId);
    return Object.freeze({
      exclusionId,
      recordId,
      reasonCode: text(own(source, 'reasonCode', `Ausschluss ${index + 1}`), 'Ausschlussgrundcode'),
      reason: text(own(source, 'reason', `Ausschluss ${index + 1}`), 'Ausschlussgrund'),
      reviewedByProfileId: id(own(source, 'reviewedByProfileId', `Ausschluss ${index + 1}`), 'Ausschlussprueferprofil'),
      permissionKey: 'privacy.access.exclude' as const,
      permissionEvidenceId: id(own(source, 'permissionEvidenceId', `Ausschluss ${index + 1}`), 'Ausschlussberechtigungsbeleg'),
      decidedAt: decidedAt.text,
    });
  });

  const packageValue = own(root, 'exportPackage', 'Auskunftsexport');
  let exportPackage: DataSubjectAccessExportEvidence['exportPackage'] = null;
  let generatedMicros: bigint | null = null;
  if (packageValue !== null) {
    if (!verified) throw new Error('Exportpaket ist ohne bestaetigte Identitaet unzulaessig.');
    const source = record(packageValue, 'Exportpaket');
    if (id(own(source, 'requestId', 'Exportpaket'), 'Paket-Anfragekennung') !== requestId
      || id(own(source, 'subjectId', 'Exportpaket'), 'Paket-Betroffenenkennung') !== subjectId) {
      throw new Error('Exportpaket bindet Anfrage und betroffene Person nicht exakt.');
    }
    if (own(source, 'permissionKey', 'Exportpaket') !== 'privacy.access.export') {
      throw new Error('Exportpaket enthaelt keine gebundene Exportberechtigung.');
    }
    const categories = exactUniqueTextArray(own(source, 'categories', 'Exportpaket'), 'Paketkategorien');
    if (!sameSet(categories, requestedCategories)) throw new Error('Exportpaket bildet den angefragten Kategorienumfang nicht exakt ab.');
    const includedRecordIds = exactUniqueTextArray(own(source, 'includedRecordIds', 'Exportpaket'), 'Enthaltene Aktenkennungen', true);
    const packageExclusionIds = exactUniqueTextArray(own(source, 'exclusionIds', 'Exportpaket'), 'Paket-Ausschlusskennungen', true);
    const expectedIncluded = [...recordIds].filter((recordId) => !excludedRecordIds.has(recordId));
    if (!sameSet(includedRecordIds, expectedIncluded)) throw new Error('Exportpaket bildet die eingeschlossenen Akten nicht vollstaendig und exakt ab.');
    if (!sameSet(packageExclusionIds, [...exclusionIds])) throw new Error('Exportpaket bildet die Ausschluesse nicht vollstaendig und exakt ab.');
    const generatedAt = instant(own(source, 'generatedAt', 'Exportpaket'), 'Paketerstellungszeit');
    if (generatedAt.micros < verifiedAt.micros || generatedAt.micros > evaluatedAt.micros) {
      throw new Error('Exportpaket liegt ausserhalb der belegten Exportfolge.');
    }
    if (exclusions.some((item) => instant(item.decidedAt, 'Ausschlusszeit').micros > generatedAt.micros)
      || records.some((item) => instant(item.occurredAt, 'Aktenereigniszeit').micros > generatedAt.micros)) {
      throw new Error('Exportpaket wurde vor seinem gebundenen Aktenumfang erzeugt.');
    }
    generatedMicros = generatedAt.micros;
    exportPackage = Object.freeze({
      jobId: id(own(source, 'jobId', 'Exportpaket'), 'Exportauftragkennung'),
      packageId: id(own(source, 'packageId', 'Exportpaket'), 'Exportpaketkennung'),
      requestId,
      subjectId,
      categories: Object.freeze(categories),
      includedRecordIds: Object.freeze(includedRecordIds),
      exclusionIds: Object.freeze(packageExclusionIds),
      manifestSha256: hash(own(source, 'manifestSha256', 'Exportpaket'), 'Manifestssumme'),
      outputSha256: hash(own(source, 'outputSha256', 'Exportpaket'), 'Ausgabesumme'),
      generatedByProfileId: id(own(source, 'generatedByProfileId', 'Exportpaket'), 'Exportprofilkennung'),
      permissionKey: 'privacy.access.export',
      permissionEvidenceId: id(own(source, 'permissionEvidenceId', 'Exportpaket'), 'Exportberechtigungsbeleg'),
      generatedAt: generatedAt.text,
    });
  }

  const deliveryValue = own(root, 'delivery', 'Auskunftsexport');
  let delivery: DataSubjectAccessExportEvidence['delivery'] = null;
  let acknowledged = false;
  if (deliveryValue !== null) {
    if (!exportPackage || generatedMicros === null) throw new Error('Auslieferung ist ohne exaktes Exportpaket unzulaessig.');
    const source = record(deliveryValue, 'Auslieferung');
    if (id(own(source, 'packageId', 'Auslieferung'), 'Auslieferungs-Paketkennung') !== exportPackage.packageId
      || id(own(source, 'recipientSubjectId', 'Auslieferung'), 'Empfaenger-Betroffenenkennung') !== subjectId) {
      throw new Error('Auslieferung bindet Paket und betroffene Person nicht exakt.');
    }
    if (own(source, 'permissionKey', 'Auslieferung') !== 'privacy.access.deliver') {
      throw new Error('Auslieferung enthaelt keine gebundene Auslieferungsberechtigung.');
    }
    const deliveredAt = instant(own(source, 'deliveredAt', 'Auslieferung'), 'Auslieferungszeit');
    if (deliveredAt.micros < generatedMicros || deliveredAt.micros > evaluatedAt.micros) {
      throw new Error('Auslieferung liegt ausserhalb der belegten Exportfolge.');
    }
    const acknowledgedValue = own(source, 'acknowledgedAt', 'Auslieferung');
    const acknowledgedAt = acknowledgedValue === null ? null : instant(acknowledgedValue, 'Bestaetigungszeit');
    if (acknowledgedAt && (acknowledgedAt.micros < deliveredAt.micros || acknowledgedAt.micros > evaluatedAt.micros)) {
      throw new Error('Bestaetigung liegt ausserhalb der belegten Auslieferungsfolge.');
    }
    acknowledged = acknowledgedAt !== null;
    delivery = Object.freeze({
      deliveryId: id(own(source, 'deliveryId', 'Auslieferung'), 'Auslieferungskennung'),
      packageId: exportPackage.packageId,
      recipientSubjectId: subjectId,
      channel: text(own(source, 'channel', 'Auslieferung'), 'Auslieferungskanal'),
      recipientSha256: hash(own(source, 'recipientSha256', 'Auslieferung'), 'Empfaengersumme'),
      secureDeliveryEvidenceId: id(own(source, 'secureDeliveryEvidenceId', 'Auslieferung'), 'Sicherheitsbelegkennung'),
      deliveredByProfileId: id(own(source, 'deliveredByProfileId', 'Auslieferung'), 'Auslieferungsprofilkennung'),
      permissionKey: 'privacy.access.deliver',
      permissionEvidenceId: id(own(source, 'permissionEvidenceId', 'Auslieferung'), 'Auslieferungsberechtigungsbeleg'),
      deliveredAt: deliveredAt.text,
      acknowledgedAt: acknowledgedAt?.text ?? null,
    });
  }

  if (!verified && (records.length > 0 || exclusions.length > 0 || deliveryValue !== null)) {
    throw new Error('Aktenumfang oder Auslieferung ist ohne bestaetigte Identitaet unzulaessig.');
  }

  let disposition: DataSubjectAccessExportEvidence['disposition'];
  if (!verified) disposition = 'blocked_identity';
  else if (!exportPackage) disposition = 'verified_not_prepared';
  else if (!delivery) disposition = 'prepared_not_delivered';
  else disposition = acknowledged ? 'delivered_acknowledged' : 'delivered_unacknowledged';

  return Object.freeze({
    tenantId,
    evaluatedAt: evaluatedAt.text,
    request,
    identity,
    records: Object.freeze(records),
    exclusions: Object.freeze(exclusions),
    exportPackage,
    delivery,
    disposition,
    requestCompletedInferred: false,
    legalCompletenessInferred: false,
  });
}
