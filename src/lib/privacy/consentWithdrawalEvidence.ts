export type ConsentWithdrawalEvidence = Readonly<{
  tenantId: string;
  subjectId: string;
  consentId: string;
  purposeId: string;
  purpose: string;
  scope: readonly string[];
  documentVersion: string;
  documentId: string;
  documentSha256: string;
  grant: Readonly<{
    eventId: string;
    actorProfileId: string;
    occurredAt: string;
  }>;
  withdrawal: Readonly<{
    eventId: string;
    actorProfileId: string;
    occurredAt: string;
  }> | null;
  state: 'granted' | 'withdrawn';
  consentDependentProcessingAllowed: boolean;
  records: readonly Readonly<{
    recordId: string;
    purposeId: string;
    relation: 'consent_dependent' | 'mandatory_record';
    createdAt: string;
    effect: 'available_for_purpose' | 'blocked_for_purpose' | 'retained_pending_legal_review';
  }>[];
  mandatoryRecordDeletionInferred: false;
  legalDeletionDecisionInferred: false;
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
  if (!descriptor || !Object.hasOwn(descriptor, 'value')) throw new Error(`${label} ${key} fehlt als Originalwert.`);
  return descriptor.value;
}

function array(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value) || value.length === 0) throw new Error(`${label} fehlt als nichtleeres Originalarray.`);
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
  if (new Set(values).size !== values.length) throw new Error(`${label} enthaelt doppelte Originalwerte.`);
}

/**
 * Projects the exact effect of a consent withdrawal on one purpose and scope.
 * The grant and withdrawal remain separate original events. A withdrawal blocks
 * consent-dependent use from its own time onward but never deletes a record or
 * decides whether a statutory/professional retention obligation applies.
 */
export function projectConsentWithdrawalEvidence(input: unknown): ConsentWithdrawalEvidence {
  const root = ownRecord(input, 'Einwilligungsverlauf');
  const tenantId = uuid(ownValue(root, 'tenantId', 'Einwilligungsverlauf'), 'Mandantenkennung');
  const subjectId = uuid(ownValue(root, 'subjectId', 'Einwilligungsverlauf'), 'Personenkennung');
  const consentId = uuid(ownValue(root, 'consentId', 'Einwilligungsverlauf'), 'Einwilligungskennung');
  const purposeId = uuid(ownValue(root, 'purposeId', 'Einwilligungsverlauf'), 'Zweckkennung');
  const purpose = text(ownValue(root, 'purpose', 'Einwilligungsverlauf'), 'Zwecktext');
  const scope = array(ownValue(root, 'scope', 'Einwilligungsverlauf'), 'Einwilligungsumfang')
    .map((item) => text(item, 'Einwilligungsumfangseintrag'));
  unique(scope, 'Einwilligungsumfang');
  const documentVersion = text(ownValue(root, 'documentVersion', 'Einwilligungsverlauf'), 'Dokumentfassung');
  const documentId = uuid(ownValue(root, 'documentId', 'Einwilligungsverlauf'), 'Dokumentkennung');
  const documentSha256 = hash(ownValue(root, 'documentSha256', 'Einwilligungsverlauf'), 'Dokumentsumme');

  const grantSource = ownRecord(ownValue(root, 'grant', 'Einwilligungsverlauf'), 'Einwilligungsereignis');
  const grantEventId = uuid(ownValue(grantSource, 'eventId', 'Einwilligungsereignis'), 'Einwilligungsereigniskennung');
  const grantActorProfileId = uuid(ownValue(grantSource, 'actorProfileId', 'Einwilligungsereignis'), 'Einwilligungsakteur');
  const grantedAtText = text(ownValue(grantSource, 'occurredAt', 'Einwilligungsereignis'), 'Einwilligungszeit');
  const grantedAt = instant(grantedAtText, 'Einwilligungszeit');
  const grant = Object.freeze({ eventId: grantEventId, actorProfileId: grantActorProfileId, occurredAt: grantedAtText });

  const withdrawalValue = ownValue(root, 'withdrawal', 'Einwilligungsverlauf');
  let withdrawal: ConsentWithdrawalEvidence['withdrawal'] = null;
  let withdrawnAt: bigint | null = null;
  if (withdrawalValue !== null) {
    const source = ownRecord(withdrawalValue, 'Widerrufsereignis');
    const eventId = uuid(ownValue(source, 'eventId', 'Widerrufsereignis'), 'Widerrufsereigniskennung');
    if (eventId === grantEventId) throw new Error('Einwilligung und Widerruf benoetigen getrennte Ereigniskennungen.');
    const actorProfileId = uuid(ownValue(source, 'actorProfileId', 'Widerrufsereignis'), 'Widerrufsakteur');
    const occurredAt = text(ownValue(source, 'occurredAt', 'Widerrufsereignis'), 'Widerrufszeit');
    withdrawnAt = instant(occurredAt, 'Widerrufszeit');
    if (withdrawnAt <= grantedAt) throw new Error('Widerruf liegt nicht nach der Einwilligung.');
    withdrawal = Object.freeze({ eventId, actorProfileId, occurredAt });
  }

  const recordRows = array(ownValue(root, 'records', 'Einwilligungsverlauf'), 'Betroffene Nachweise').map((value) => {
    const record = ownRecord(value, 'Nachweisbindung');
    const recordId = uuid(ownValue(record, 'recordId', 'Nachweisbindung'), 'Nachweiskennung');
    const boundPurposeId = uuid(ownValue(record, 'purposeId', 'Nachweisbindung'), 'Nachweiszweckkennung');
    if (boundPurposeId !== purposeId) throw new Error('Nachweis ist nicht an den betroffenen Zweck gebunden.');
    const relation = oneOf(ownValue(record, 'relation', 'Nachweisbindung'), ['consent_dependent', 'mandatory_record'] as const, 'Nachweisbeziehung');
    const createdAtText = text(ownValue(record, 'createdAt', 'Nachweisbindung'), 'Nachweiserstellungszeit');
    const createdAt = instant(createdAtText, 'Nachweiserstellungszeit');
    if (createdAt < grantedAt) throw new Error('Nachweis liegt vor der zugeordneten Einwilligung.');
    const effect = withdrawal === null
      ? 'available_for_purpose'
      : relation === 'consent_dependent' ? 'blocked_for_purpose' : 'retained_pending_legal_review';
    return Object.freeze({ recordId, purposeId: boundPurposeId, relation, createdAt: createdAtText, effect });
  });
  unique(recordRows.map((record) => record.recordId), 'Nachweisbindungen');

  return Object.freeze({
    tenantId,
    subjectId,
    consentId,
    purposeId,
    purpose,
    scope: Object.freeze(scope),
    documentVersion,
    documentId,
    documentSha256,
    grant,
    withdrawal,
    state: withdrawal === null ? 'granted' : 'withdrawn',
    consentDependentProcessingAllowed: withdrawal === null,
    records: Object.freeze(recordRows),
    mandatoryRecordDeletionInferred: false,
    legalDeletionDecisionInferred: false,
  });
}
