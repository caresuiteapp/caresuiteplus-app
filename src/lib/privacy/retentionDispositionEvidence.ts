export type RetentionDispositionEvidence = Readonly<{
  tenantId: string;
  evaluatedAt: string;
  record: Readonly<{
    recordId: string;
    documentTypeId: string;
    documentTypeVersion: string;
    contentSha256: string;
    createdAt: string;
    classifiedAt: string;
    classifiedByProfileId: string;
    retentionTrigger: Readonly<{ eventId: string; eventType: string; occurredAt: string }>;
  }>;
  rule: Readonly<{
    ruleId: string;
    documentTypeId: string;
    version: string;
    legalSourceId: string;
    legalReference: string;
    sourceVersion: string;
    sourceSha256: string;
    effectiveFrom: string;
    expiresAt: string | null;
    basisEventId: string;
    retentionUntil: string;
  }>;
  holds: readonly Readonly<{
    holdId: string;
    recordId: string;
    holdType: 'legal' | 'audit' | 'complaint' | 'care_continuity';
    reason: string;
    imposedByProfileId: string;
    permissionKey: 'privacy.retention.hold';
    permissionEvidenceId: string;
    imposedAt: string;
    releasedAt: string | null;
  }>[];
  review: Readonly<{
    reviewId: string;
    recordId: string;
    ruleId: string;
    triggerEventId: string;
    reviewerProfileId: string;
    roleSnapshot: string;
    permissionKey: 'privacy.retention.review';
    permissionEvidenceId: string;
    reviewedAt: string;
    decision: 'retain' | 'delete_candidate';
    reason: string;
  }> | null;
  disposition: 'retention_active' | 'blocked_active_hold' | 'pending_review' | 'reviewed_retain' | 'reviewed_delete_candidate';
  deletionExecutedInferred: false;
  legalValidityInferred: false;
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

/**
 * Binds a single record to its exact document type, trigger event, versioned
 * source, holds and authorized review. It never performs or legally authorizes
 * deletion.
 */
export function projectRetentionDispositionEvidence(input: unknown): RetentionDispositionEvidence {
  const root = record(input, 'Aufbewahrungspruefung');
  const tenantId = id(own(root, 'tenantId', 'Aufbewahrungspruefung'), 'Mandantenkennung');
  const evaluatedAt = instant(own(root, 'evaluatedAt', 'Aufbewahrungspruefung'), 'Auswertungszeit');

  const recordSource = record(own(root, 'record', 'Aufbewahrungspruefung'), 'Dokumentsnapshot');
  const recordId = id(own(recordSource, 'recordId', 'Dokumentsnapshot'), 'Dokumentkennung');
  const documentTypeId = id(own(recordSource, 'documentTypeId', 'Dokumentsnapshot'), 'Dokumentartkennung');
  const createdAt = instant(own(recordSource, 'createdAt', 'Dokumentsnapshot'), 'Erstellungszeit');
  const classifiedAt = instant(own(recordSource, 'classifiedAt', 'Dokumentsnapshot'), 'Klassifizierungszeit');
  if (classifiedAt.micros < createdAt.micros) throw new Error('Dokumentart wurde vor der Dokumenterstellung klassifiziert.');
  const triggerSource = record(own(recordSource, 'retentionTrigger', 'Dokumentsnapshot'), 'Fristausloeser');
  const triggerEventId = id(own(triggerSource, 'eventId', 'Fristausloeser'), 'Ausloeserkennung');
  const triggerOccurredAt = instant(own(triggerSource, 'occurredAt', 'Fristausloeser'), 'Ausloeserzeit');
  if (triggerOccurredAt.micros < createdAt.micros) throw new Error('Fristausloeser liegt vor der Dokumenterstellung.');
  const retainedRecord = Object.freeze({
    recordId,
    documentTypeId,
    documentTypeVersion: text(own(recordSource, 'documentTypeVersion', 'Dokumentsnapshot'), 'Dokumentartfassung'),
    contentSha256: hash(own(recordSource, 'contentSha256', 'Dokumentsnapshot'), 'Dokumentsumme'),
    createdAt: createdAt.text,
    classifiedAt: classifiedAt.text,
    classifiedByProfileId: id(own(recordSource, 'classifiedByProfileId', 'Dokumentsnapshot'), 'Klassifizierende Profilkennung'),
    retentionTrigger: Object.freeze({
      eventId: triggerEventId,
      eventType: text(own(triggerSource, 'eventType', 'Fristausloeser'), 'Ausloeserart'),
      occurredAt: triggerOccurredAt.text,
    }),
  });

  const ruleSource = record(own(root, 'rule', 'Aufbewahrungspruefung'), 'Regelsnapshot');
  const ruleDocumentTypeId = id(own(ruleSource, 'documentTypeId', 'Regelsnapshot'), 'Regel-Dokumentartkennung');
  if (ruleDocumentTypeId !== documentTypeId) throw new Error('Aufbewahrungsregel gehoert nicht zur exakten Dokumentart.');
  const basisEventId = id(own(ruleSource, 'basisEventId', 'Regelsnapshot'), 'Regel-Ausloeserkennung');
  if (basisEventId !== triggerEventId) throw new Error('Aufbewahrungsregel bindet nicht den exakten Fristausloeser.');
  const effectiveFrom = instant(own(ruleSource, 'effectiveFrom', 'Regelsnapshot'), 'Regelbeginn');
  const expiresValue = own(ruleSource, 'expiresAt', 'Regelsnapshot');
  const expiresAt = expiresValue === null ? null : instant(expiresValue, 'Regelende');
  if (effectiveFrom.micros > triggerOccurredAt.micros
    || (expiresAt && expiresAt.micros <= triggerOccurredAt.micros)) {
    throw new Error('Aufbewahrungsregel war am Fristausloeser nicht wirksam.');
  }
  const retentionUntil = instant(own(ruleSource, 'retentionUntil', 'Regelsnapshot'), 'Fristende');
  if (retentionUntil.micros <= triggerOccurredAt.micros) throw new Error('Fristende liegt nicht nach dem Fristausloeser.');
  const rule = Object.freeze({
    ruleId: id(own(ruleSource, 'ruleId', 'Regelsnapshot'), 'Regelkennung'),
    documentTypeId: ruleDocumentTypeId,
    version: text(own(ruleSource, 'version', 'Regelsnapshot'), 'Regelfassung'),
    legalSourceId: id(own(ruleSource, 'legalSourceId', 'Regelsnapshot'), 'Quellenkennung'),
    legalReference: text(own(ruleSource, 'legalReference', 'Regelsnapshot'), 'Rechtsquellenreferenz'),
    sourceVersion: text(own(ruleSource, 'sourceVersion', 'Regelsnapshot'), 'Quellenfassung'),
    sourceSha256: hash(own(ruleSource, 'sourceSha256', 'Regelsnapshot'), 'Quellensumme'),
    effectiveFrom: effectiveFrom.text,
    expiresAt: expiresAt?.text ?? null,
    basisEventId,
    retentionUntil: retentionUntil.text,
  });

  const holdsValue = own(root, 'holds', 'Aufbewahrungspruefung');
  if (!Array.isArray(holdsValue)) throw new Error('Sperren fehlen als vollstaendiges Originalarray.');
  const holdIds = new Set<string>();
  const internalHolds = holdsValue.map((value, index) => {
    const source = record(value, `Sperre ${index + 1}`);
    const holdId = id(own(source, 'holdId', `Sperre ${index + 1}`), 'Sperrkennung');
    if (holdIds.has(holdId)) throw new Error('Sperren enthalten doppelte Originalkennungen.');
    holdIds.add(holdId);
    if (id(own(source, 'recordId', `Sperre ${index + 1}`), 'Sperr-Dokumentkennung') !== recordId) {
      throw new Error('Sperre gehoert nicht zum exakten Dokument.');
    }
    const holdType = own(source, 'holdType', `Sperre ${index + 1}`);
    if (!['legal', 'audit', 'complaint', 'care_continuity'].includes(String(holdType))) {
      throw new Error('Sperre enthaelt keine erlaubte Sperrart.');
    }
    if (own(source, 'permissionKey', `Sperre ${index + 1}`) !== 'privacy.retention.hold') {
      throw new Error('Sperre enthaelt keine gebundene Sperrberechtigung.');
    }
    const imposedAt = instant(own(source, 'imposedAt', `Sperre ${index + 1}`), 'Sperrzeit');
    if (imposedAt.micros > evaluatedAt.micros) throw new Error('Sperre liegt nach der Auswertungszeit.');
    const releasedValue = own(source, 'releasedAt', `Sperre ${index + 1}`);
    const releasedAt = releasedValue === null ? null : instant(releasedValue, 'Sperrfreigabezeit');
    if (releasedAt && releasedAt.micros <= imposedAt.micros) throw new Error('Sperrfreigabe liegt nicht nach der Sperre.');
    if (releasedAt && releasedAt.micros > evaluatedAt.micros) throw new Error('Sperrfreigabe liegt nach der Auswertungszeit.');
    return {
      public: Object.freeze({
        holdId,
        recordId,
        holdType: holdType as 'legal' | 'audit' | 'complaint' | 'care_continuity',
        reason: text(own(source, 'reason', `Sperre ${index + 1}`), 'Sperrgrund'),
        imposedByProfileId: id(own(source, 'imposedByProfileId', `Sperre ${index + 1}`), 'Sperrprofilkennung'),
        permissionKey: 'privacy.retention.hold' as const,
        permissionEvidenceId: id(own(source, 'permissionEvidenceId', `Sperre ${index + 1}`), 'Sperrberechtigungsbeleg'),
        imposedAt: imposedAt.text,
        releasedAt: releasedAt?.text ?? null,
      }),
      releasedMicros: releasedAt?.micros ?? null,
    };
  });
  const activeHold = internalHolds.some((hold) => hold.releasedMicros === null || hold.releasedMicros > evaluatedAt.micros);

  const reviewValue = own(root, 'review', 'Aufbewahrungspruefung');
  let review: RetentionDispositionEvidence['review'] = null;
  if (reviewValue !== null) {
    const source = record(reviewValue, 'Loeschpruefung');
    if (id(own(source, 'recordId', 'Loeschpruefung'), 'Pruef-Dokumentkennung') !== recordId
      || id(own(source, 'ruleId', 'Loeschpruefung'), 'Pruef-Regelkennung') !== rule.ruleId
      || id(own(source, 'triggerEventId', 'Loeschpruefung'), 'Pruef-Ausloeserkennung') !== triggerEventId) {
      throw new Error('Loeschpruefung bindet nicht Dokument, Regel und Fristausloeser exakt.');
    }
    if (own(source, 'permissionKey', 'Loeschpruefung') !== 'privacy.retention.review') {
      throw new Error('Loeschpruefung enthaelt keine gebundene Pruefberechtigung.');
    }
    const reviewedAt = instant(own(source, 'reviewedAt', 'Loeschpruefung'), 'Pruefzeit');
    if (reviewedAt.micros < classifiedAt.micros || reviewedAt.micros > evaluatedAt.micros) {
      throw new Error('Loeschpruefung liegt ausserhalb der belegten Auswertungsfolge.');
    }
    const decision = own(source, 'decision', 'Loeschpruefung');
    if (!['retain', 'delete_candidate'].includes(String(decision))) throw new Error('Loeschpruefung enthaelt keine erlaubte Entscheidung.');
    if (decision === 'delete_candidate' && reviewedAt.micros < retentionUntil.micros) {
      throw new Error('Loeschkandidat wurde vor dem Fristende gebildet.');
    }
    if (decision === 'delete_candidate' && activeHold) throw new Error('Loeschkandidat ist trotz aktiver Sperre unzulaessig.');
    review = Object.freeze({
      reviewId: id(own(source, 'reviewId', 'Loeschpruefung'), 'Pruefkennung'),
      recordId,
      ruleId: rule.ruleId,
      triggerEventId,
      reviewerProfileId: id(own(source, 'reviewerProfileId', 'Loeschpruefung'), 'Prueferprofilkennung'),
      roleSnapshot: text(own(source, 'roleSnapshot', 'Loeschpruefung'), 'Prueferrolle'),
      permissionKey: 'privacy.retention.review',
      permissionEvidenceId: id(own(source, 'permissionEvidenceId', 'Loeschpruefung'), 'Pruefberechtigungsbeleg'),
      reviewedAt: reviewedAt.text,
      decision: decision as 'retain' | 'delete_candidate',
      reason: text(own(source, 'reason', 'Loeschpruefung'), 'Pruefgrund'),
    });
  }

  let disposition: RetentionDispositionEvidence['disposition'];
  if (evaluatedAt.micros < retentionUntil.micros) disposition = 'retention_active';
  else if (activeHold) disposition = 'blocked_active_hold';
  else if (!review) disposition = 'pending_review';
  else disposition = review.decision === 'retain' ? 'reviewed_retain' : 'reviewed_delete_candidate';

  return Object.freeze({
    tenantId,
    evaluatedAt: evaluatedAt.text,
    record: retainedRecord,
    rule,
    holds: Object.freeze(internalHolds.map((hold) => hold.public)),
    review,
    disposition,
    deletionExecutedInferred: false,
    legalValidityInferred: false,
  });
}
