export type EPADataScope =
  | 'document_metadata'
  | 'document_content'
  | 'document_upload'
  | 'document_replace'
  | 'document_delete';

export type EPAReviewState = 'not_provided' | 'pending' | 'approved';

export type EPAAccessReviewInput = Readonly<{
  tenantId: string;
  clientId: string;
  providerId: string;
  permission: Readonly<{
    actorId: string;
    permission: 'ti.epa.view';
    decision: 'allowed' | 'denied';
    checkedAt: string;
  }>;
  consent: Readonly<{
    consentId: string;
    scope: 'epa';
    status: 'pending' | 'granted' | 'revoked' | 'expired';
    version: number;
  }>;
  procedure: Readonly<{
    specificationId: string;
    specificationVersion: string;
    checkedAt: string;
  }>;
  requestedDataScope: readonly EPADataScope[];
  protocol: Readonly<{
    requestId: string;
    eventId: string;
    actorId: string;
    recordedAt: string;
    eventType: 'epa_access_prepared';
  }>;
  technicalReview: EPAReviewState;
  legalReview: EPAReviewState;
}>;

export type EPAAccessReviewProjection = Readonly<{
  tenantId: string;
  clientId: string;
  providerId: string;
  actorId: string;
  consentId: string;
  consentStatus: EPAAccessReviewInput['consent']['status'];
  consentVersion: number;
  permissionDecision: EPAAccessReviewInput['permission']['decision'];
  candidateSpecificationId: string;
  candidateSpecificationVersion: string;
  requestedDataScope: readonly EPADataScope[];
  protocolRequestId: string;
  protocolEventId: string;
  technicalReview: EPAReviewState;
  legalReview: EPAReviewState;
  procedureCurrency: 'not_verified';
  dataScopeApproval: 'not_confirmed';
  protocolEvidence: 'recorded';
  releaseStatus: 'not_released';
  accessExecution: 'not_performed';
}>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const INSTANT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d{1,6})(Z|([+-])(\d{2}):(\d{2}))$/;
const DATA_SCOPES = new Set<EPADataScope>([
  'document_metadata',
  'document_content',
  'document_upload',
  'document_replace',
  'document_delete',
]);
const REVIEW_STATES = new Set<EPAReviewState>(['not_provided', 'pending', 'approved']);

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
    throw new Error(`${label} ${key} ist nicht als Originalwert geliefert.`);
  }
  return descriptor.value;
}

function nativeUuid(value: unknown, label: string): string {
  if (typeof value !== 'string' || !UUID.test(value)) throw new Error(`${label} ist keine native UUID.`);
  return value;
}

function originalText(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`${label} fehlt als Originaltext.`);
  return value;
}

function positiveVersion(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) {
    throw new Error('ePA-Einwilligungsfassung ist keine positive Originalzahl.');
  }
  return value;
}

function instantMicros(value: unknown, label: string): bigint {
  if (typeof value !== 'string') throw new Error(`${label} ist kein vollstaendiger ISO-Zeitpunkt.`);
  const match = INSTANT.exec(value);
  if (!match) throw new Error(`${label} ist kein vollstaendiger ISO-Zeitpunkt.`);
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, fraction, zone, sign, zoneHourText, zoneMinuteText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const zoneHour = Number(zoneHourText ?? 0);
  const zoneMinute = Number(zoneMinuteText ?? 0);
  const daysInMonth = month >= 1 && month <= 12 ? new Date(Date.UTC(year, month, 0)).getUTCDate() : 0;
  if (year < 1 || day < 1 || day > daysInMonth || hour > 23 || minute > 59 || second > 59
    || zoneHour > 23 || zoneMinute > 59) {
    throw new Error(`${label} enthaelt kein gueltiges Kalenderdatum.`);
  }
  const offsetMinutes = zone === 'Z' ? 0 : (sign === '-' ? -1 : 1) * (zoneHour * 60 + zoneMinute);
  const seconds = BigInt(Date.UTC(year, month - 1, day, hour, minute, second) - offsetMinutes * 60_000) / 1000n;
  return seconds * 1_000_000n + BigInt(fraction.padEnd(6, '0'));
}

function oneOf<T extends string>(value: unknown, allowed: ReadonlySet<T>, label: string): T {
  if (typeof value !== 'string' || !allowed.has(value as T)) throw new Error(`${label} ist kein erlaubter Originalstatus.`);
  return value as T;
}

/**
 * Builds a fail-closed review record for a possible ePA access. It never performs
 * or releases access. Recorded permission, consent or review states remain
 * evidence facts and cannot substitute current procedure and data-scope approval.
 */
export function projectEPAAccessReview(input: unknown): EPAAccessReviewProjection {
  const row = ownRecord(input, 'ePA-Prueffall');
  const tenantId = nativeUuid(ownValue(row, 'tenantId', 'ePA-Prueffall'), 'ePA-Mandantenkennung');
  const clientId = nativeUuid(ownValue(row, 'clientId', 'ePA-Prueffall'), 'ePA-Pflegefallkennung');
  const providerId = nativeUuid(ownValue(row, 'providerId', 'ePA-Prueffall'), 'ePA-Providerkennung');

  const permission = ownRecord(ownValue(row, 'permission', 'ePA-Prueffall'), 'ePA-Berechtigungsbeleg');
  const actorId = nativeUuid(ownValue(permission, 'actorId', 'ePA-Berechtigungsbeleg'), 'ePA-Akteurkennung');
  if (ownValue(permission, 'permission', 'ePA-Berechtigungsbeleg') !== 'ti.epa.view') {
    throw new Error('ePA-Berechtigungsbeleg nennt nicht ti.epa.view.');
  }
  const permissionDecision = oneOf(
    ownValue(permission, 'decision', 'ePA-Berechtigungsbeleg'),
    new Set(['allowed', 'denied'] as const),
    'ePA-Berechtigungsentscheidung',
  );
  const permissionAt = instantMicros(ownValue(permission, 'checkedAt', 'ePA-Berechtigungsbeleg'), 'ePA-Berechtigungszeit');

  const consent = ownRecord(ownValue(row, 'consent', 'ePA-Prueffall'), 'ePA-Einwilligungsbeleg');
  const consentId = nativeUuid(ownValue(consent, 'consentId', 'ePA-Einwilligungsbeleg'), 'ePA-Einwilligungskennung');
  if (ownValue(consent, 'scope', 'ePA-Einwilligungsbeleg') !== 'epa') {
    throw new Error('ePA-Einwilligungsbeleg ist nicht an den ePA-Umfang gebunden.');
  }
  const consentStatus = oneOf(
    ownValue(consent, 'status', 'ePA-Einwilligungsbeleg'),
    new Set(['pending', 'granted', 'revoked', 'expired'] as const),
    'ePA-Einwilligungsstatus',
  );
  const consentVersion = positiveVersion(ownValue(consent, 'version', 'ePA-Einwilligungsbeleg'));

  const procedure = ownRecord(ownValue(row, 'procedure', 'ePA-Prueffall'), 'ePA-Verfahrensbeleg');
  const candidateSpecificationId = originalText(
    ownValue(procedure, 'specificationId', 'ePA-Verfahrensbeleg'),
    'ePA-Spezifikationskennung',
  );
  const candidateSpecificationVersion = originalText(
    ownValue(procedure, 'specificationVersion', 'ePA-Verfahrensbeleg'),
    'ePA-Spezifikationsfassung',
  );
  const procedureAt = instantMicros(ownValue(procedure, 'checkedAt', 'ePA-Verfahrensbeleg'), 'ePA-Verfahrenspruefzeit');

  const scopeValue = ownValue(row, 'requestedDataScope', 'ePA-Prueffall');
  if (!Array.isArray(scopeValue) || scopeValue.length === 0) throw new Error('ePA-Datenumfang fehlt.');
  const requestedDataScope = scopeValue.map((scope) => oneOf(scope, DATA_SCOPES, 'ePA-Datenumfang'));
  if (new Set(requestedDataScope).size !== requestedDataScope.length) {
    throw new Error('ePA-Datenumfang enthaelt doppelte Eintraege.');
  }

  const protocol = ownRecord(ownValue(row, 'protocol', 'ePA-Prueffall'), 'ePA-Protokollbeleg');
  const protocolRequestId = nativeUuid(ownValue(protocol, 'requestId', 'ePA-Protokollbeleg'), 'ePA-Anforderungskennung');
  const protocolEventId = nativeUuid(ownValue(protocol, 'eventId', 'ePA-Protokollbeleg'), 'ePA-Ereigniskennung');
  const protocolActorId = nativeUuid(ownValue(protocol, 'actorId', 'ePA-Protokollbeleg'), 'ePA-Protokollakteurkennung');
  if (protocolActorId !== actorId) throw new Error('ePA-Protokoll und Berechtigungsbeleg nennen verschiedene Akteure.');
  if (ownValue(protocol, 'eventType', 'ePA-Protokollbeleg') !== 'epa_access_prepared') {
    throw new Error('ePA-Protokoll behauptet keinen reinen Vorbereitungsvorgang.');
  }
  const recordedAt = instantMicros(ownValue(protocol, 'recordedAt', 'ePA-Protokollbeleg'), 'ePA-Protokollzeit');
  if (permissionAt > recordedAt || procedureAt > recordedAt) {
    throw new Error('ePA-Protokoll liegt vor seinem Berechtigungs- oder Verfahrensbeleg.');
  }

  const technicalReview = oneOf(ownValue(row, 'technicalReview', 'ePA-Prueffall'), REVIEW_STATES, 'ePA-Technikpruefung');
  const legalReview = oneOf(ownValue(row, 'legalReview', 'ePA-Prueffall'), REVIEW_STATES, 'ePA-Rechtspruefung');

  return Object.freeze({
    tenantId,
    clientId,
    providerId,
    actorId,
    consentId,
    consentStatus,
    consentVersion,
    permissionDecision,
    candidateSpecificationId,
    candidateSpecificationVersion,
    requestedDataScope: Object.freeze([...requestedDataScope]),
    protocolRequestId,
    protocolEventId,
    technicalReview,
    legalReview,
    procedureCurrency: 'not_verified',
    dataScopeApproval: 'not_confirmed',
    protocolEvidence: 'recorded',
    releaseStatus: 'not_released',
    accessExecution: 'not_performed',
  });
}
