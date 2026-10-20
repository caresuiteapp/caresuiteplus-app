export type AccessAuditEvidence = Readonly<{
  tenantId: string;
  evaluatedAt: string;
  event: Readonly<{
    eventId: string;
    tenantId: string;
    actorProfileId: string;
    roleKey: string;
    permissionKey: string;
    permissionEvidenceId: string;
    action: 'read' | 'create' | 'update' | 'export' | 'delete_review';
    objectType: string;
    objectId: string;
    subjectId: string | null;
    purpose: Readonly<{ purposeId: string; purposeCode: string; version: string }>;
    occurredAt: string;
    outcome: 'allowed' | 'denied';
    denialCode: string | null;
    technicalContext: Readonly<{
      correlationId: string;
      sourceSystem: string;
      sourceVersion: string;
      itemCount: number;
      contentSha256: string | null;
    }>;
  }>;
  sensitivePayloadCopied: false;
  accessAuthorizationInferred: false;
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
  if (unexpected.length > 0) throw new Error(`${label} enthaelt nicht erlaubte Nutzdatenfelder: ${unexpected.join(', ')}.`);
  const missing = allowed.filter((key) => !actual.includes(key));
  if (missing.length > 0) throw new Error(`${label} ist unvollstaendig: ${missing.join(', ')}.`);
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

/**
 * Projects one access event through an exact allowlist. Free-form details,
 * arbitrary metadata and business payloads are rejected instead of copied to
 * a technical log. The event itself never proves authorization or care.
 */
export function projectAccessAuditEvidence(input: unknown): AccessAuditEvidence {
  const root = record(input, 'Zugriffsprotokoll');
  exactKeys(root, ['tenantId', 'evaluatedAt', 'event'], 'Zugriffsprotokoll');
  const tenantId = id(own(root, 'tenantId', 'Zugriffsprotokoll'), 'Mandantenkennung');
  const evaluatedAt = instant(own(root, 'evaluatedAt', 'Zugriffsprotokoll'), 'Auswertungszeit');

  const source = record(own(root, 'event', 'Zugriffsprotokoll'), 'Zugriffsereignis');
  exactKeys(source, [
    'eventId', 'tenantId', 'actorProfileId', 'roleKey', 'permissionKey', 'permissionEvidenceId',
    'action', 'objectType', 'objectId', 'subjectId', 'purpose', 'occurredAt', 'outcome',
    'denialCode', 'technicalContext',
  ], 'Zugriffsereignis');
  if (id(own(source, 'tenantId', 'Zugriffsereignis'), 'Ereignis-Mandantenkennung') !== tenantId) {
    throw new Error('Zugriffsereignis gehoert zu einem anderen Mandanten.');
  }
  const action = own(source, 'action', 'Zugriffsereignis');
  if (!['read', 'create', 'update', 'export', 'delete_review'].includes(String(action))) {
    throw new Error('Zugriffsereignis enthaelt keine erlaubte Aktion.');
  }
  const subjectValue = own(source, 'subjectId', 'Zugriffsereignis');
  const subjectId = subjectValue === null ? null : id(subjectValue, 'Betroffenenkennung');
  const outcome = own(source, 'outcome', 'Zugriffsereignis');
  if (!['allowed', 'denied'].includes(String(outcome))) throw new Error('Zugriffsereignis enthaelt kein erlaubtes Ergebnis.');
  const denialValue = own(source, 'denialCode', 'Zugriffsereignis');
  const denialCode = denialValue === null ? null : code(denialValue, 'Ablehnungscode');
  if (outcome === 'allowed' && denialCode !== null) throw new Error('Erlaubter Zugriff darf keinen Ablehnungscode tragen.');
  if (outcome === 'denied' && denialCode === null) throw new Error('Abgelehnter Zugriff benoetigt einen technischen Ablehnungscode.');
  const occurredAt = instant(own(source, 'occurredAt', 'Zugriffsereignis'), 'Ereigniszeit');
  if (occurredAt.micros > evaluatedAt.micros) throw new Error('Zugriffsereignis liegt nach der Auswertungszeit.');

  const purposeSource = record(own(source, 'purpose', 'Zugriffsereignis'), 'Zweckbezug');
  exactKeys(purposeSource, ['purposeId', 'purposeCode', 'version'], 'Zweckbezug');
  const purpose = Object.freeze({
    purposeId: id(own(purposeSource, 'purposeId', 'Zweckbezug'), 'Zweckkennung'),
    purposeCode: code(own(purposeSource, 'purposeCode', 'Zweckbezug'), 'Zweckcode'),
    version: code(own(purposeSource, 'version', 'Zweckbezug'), 'Zweckfassung'),
  });

  const contextSource = record(own(source, 'technicalContext', 'Zugriffsereignis'), 'Technischer Kontext');
  exactKeys(contextSource, ['correlationId', 'sourceSystem', 'sourceVersion', 'itemCount', 'contentSha256'], 'Technischer Kontext');
  const itemCount = own(contextSource, 'itemCount', 'Technischer Kontext');
  if (typeof itemCount !== 'number' || !Number.isSafeInteger(itemCount) || itemCount < 0) {
    throw new Error('Technischer Kontext enthaelt keine sichere nichtnegative Anzahl.');
  }
  const digestValue = own(contextSource, 'contentSha256', 'Technischer Kontext');
  const contentSha256 = digestValue === null ? null : hash(digestValue, 'Technische Inhaltssumme');
  const technicalContext = Object.freeze({
    correlationId: id(own(contextSource, 'correlationId', 'Technischer Kontext'), 'Korrelationskennung'),
    sourceSystem: code(own(contextSource, 'sourceSystem', 'Technischer Kontext'), 'Quellsystemcode'),
    sourceVersion: code(own(contextSource, 'sourceVersion', 'Technischer Kontext'), 'Quellsystemfassung'),
    itemCount,
    contentSha256,
  });

  return Object.freeze({
    tenantId,
    evaluatedAt: evaluatedAt.text,
    event: Object.freeze({
      eventId: id(own(source, 'eventId', 'Zugriffsereignis'), 'Ereigniskennung'),
      tenantId,
      actorProfileId: id(own(source, 'actorProfileId', 'Zugriffsereignis'), 'Akteurprofilkennung'),
      roleKey: code(own(source, 'roleKey', 'Zugriffsereignis'), 'Rollencode'),
      permissionKey: code(own(source, 'permissionKey', 'Zugriffsereignis'), 'Berechtigungscode'),
      permissionEvidenceId: id(own(source, 'permissionEvidenceId', 'Zugriffsereignis'), 'Berechtigungsbelegkennung'),
      action: action as 'read' | 'create' | 'update' | 'export' | 'delete_review',
      objectType: code(own(source, 'objectType', 'Zugriffsereignis'), 'Objekttypcode'),
      objectId: id(own(source, 'objectId', 'Zugriffsereignis'), 'Objektkennung'),
      subjectId,
      purpose,
      occurredAt: occurredAt.text,
      outcome: outcome as 'allowed' | 'denied',
      denialCode,
      technicalContext,
    }),
    sensitivePayloadCopied: false,
    accessAuthorizationInferred: false,
    clinicalActionInferred: false,
  });
}
