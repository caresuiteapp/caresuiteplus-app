export type PartnerExchangeState =
  | 'not_sent'
  | 'sent_unconfirmed'
  | 'uncertain'
  | 'failed'
  | 'confirmed_correct_assignment';

export type PartnerExchangeEvidenceInput = Readonly<{
  tenantId: string;
  clientId: string;
  partner: Readonly<{
    partnerId: string;
    endpointId: string;
    providerKey: string;
    contractId: string;
    contractVersion: number;
    contractStatus: 'active' | 'suspended' | 'ended';
    checkedAt: string;
  }>;
  specification: Readonly<{
    specificationId: string;
    specificationVersion: string;
    schemaSha256: string;
    checkedAt: string;
  }>;
  assignment: Readonly<{
    assignmentId: string;
    sourceEntityId: string;
    partnerId: string;
    endpointId: string;
    contractId: string;
    contractVersion: number;
    specificationId: string;
    specificationVersion: string;
    schemaSha256: string;
    payloadSha256: string;
    recordCount: number;
    assignedAt: string;
  }>;
  transfer: Readonly<{
    transferId: string;
    assignmentId: string;
    actorId: string;
    state: 'not_sent' | 'sent' | 'failed' | 'uncertain';
    providerReceiptId: string | null;
    occurredAt: string;
  }>;
  acknowledgement: Readonly<{
    acknowledgementId: string;
    transferId: string;
    partnerId: string;
    endpointId: string;
    state: 'accepted' | 'partial' | 'rejected';
    payloadSha256: string;
    recordCount: number;
    acknowledgedAt: string;
  }> | null;
  reconciliation: Readonly<{
    reconciliationId: string;
    assignmentId: string;
    actorId: string;
    result: 'match' | 'mismatch' | 'pending';
    payloadSha256: string;
    recordCount: number;
    reconciledAt: string;
  }> | null;
  errors: readonly Readonly<{
    errorId: string;
    stage: 'assignment' | 'transfer' | 'acknowledgement' | 'reconciliation';
    code: string;
    recordedAt: string;
    resolvedAt: string | null;
  }>[];
}>;

export type PartnerExchangeEvidence = Readonly<{
  tenantId: string;
  clientId: string;
  partnerId: string;
  endpointId: string;
  providerKey: string;
  contractId: string;
  contractVersion: number;
  contractStatus: PartnerExchangeEvidenceInput['partner']['contractStatus'];
  specificationId: string;
  specificationVersion: string;
  schemaSha256: string;
  assignmentId: string;
  sourceEntityId: string;
  payloadSha256: string;
  recordCount: number;
  transferId: string;
  transferState: PartnerExchangeEvidenceInput['transfer']['state'];
  providerReceiptId: string | null;
  acknowledgementId: string | null;
  acknowledgementState: 'accepted' | 'partial' | 'rejected' | 'missing';
  reconciliationId: string | null;
  reconciliationResult: 'match' | 'mismatch' | 'pending' | 'missing';
  openErrorIds: readonly string[];
  state: PartnerExchangeState;
  successConfirmed: boolean;
  dataAtIntendedRecipient: 'confirmed' | 'not_confirmed';
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
    throw new Error(`${label} ${key} ist nicht als Originalwert geliefert.`);
  }
  return descriptor.value;
}

function uuid(value: unknown, label: string): string {
  if (typeof value !== 'string' || !UUID.test(value)) throw new Error(`${label} ist keine native UUID.`);
  return value;
}

function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`${label} fehlt als Originaltext.`);
  return value;
}

function nullableText(value: unknown, label: string): string | null {
  if (value === null) return null;
  return text(value, label);
}

function positiveInt(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${label} ist keine positive Originalzahl.`);
  }
  return value;
}

function nonnegativeInt(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} ist keine nichtnegative Originalzahl.`);
  }
  return value;
}

function hash(value: unknown, label: string): string {
  if (typeof value !== 'string' || !SHA256.test(value)) throw new Error(`${label} ist kein SHA-256-Originalwert.`);
  return value;
}

function oneOf<T extends string>(value: unknown, values: readonly T[], label: string): T {
  if (typeof value !== 'string' || !values.includes(value as T)) throw new Error(`${label} ist kein erlaubter Originalstatus.`);
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

function same(actual: unknown, expected: string | number, label: string): void {
  if (actual !== expected) throw new Error(`${label} stimmt nicht mit der gebundenen Originalzuordnung ueberein.`);
}

/**
 * Projects immutable evidence for an external partner exchange. A transport
 * receipt never proves delivery. Success exists only when the intended partner
 * acknowledges the exact payload and a later reconciliation confirms the same
 * assignment, hash and record count without an open error.
 */
export function projectPartnerExchangeEvidence(input: unknown): PartnerExchangeEvidence {
  const root = ownRecord(input, 'Schnittstellenfall');
  const tenantId = uuid(ownValue(root, 'tenantId', 'Schnittstellenfall'), 'Mandantenkennung');
  const clientId = uuid(ownValue(root, 'clientId', 'Schnittstellenfall'), 'Pflegefallkennung');

  const partner = ownRecord(ownValue(root, 'partner', 'Schnittstellenfall'), 'Partnerbeleg');
  const partnerId = uuid(ownValue(partner, 'partnerId', 'Partnerbeleg'), 'Partnerkennung');
  const endpointId = uuid(ownValue(partner, 'endpointId', 'Partnerbeleg'), 'Empfaengerendpunkt');
  const providerKey = text(ownValue(partner, 'providerKey', 'Partnerbeleg'), 'Anbieterkennung');
  const contractId = uuid(ownValue(partner, 'contractId', 'Partnerbeleg'), 'Vertragskennung');
  const contractVersion = positiveInt(ownValue(partner, 'contractVersion', 'Partnerbeleg'), 'Vertragsfassung');
  const contractStatus = oneOf(ownValue(partner, 'contractStatus', 'Partnerbeleg'), ['active', 'suspended', 'ended'] as const, 'Vertragsstatus');
  const partnerCheckedAt = instant(ownValue(partner, 'checkedAt', 'Partnerbeleg'), 'Partnerpruefzeit');

  const specification = ownRecord(ownValue(root, 'specification', 'Schnittstellenfall'), 'Spezifikationsbeleg');
  const specificationId = uuid(ownValue(specification, 'specificationId', 'Spezifikationsbeleg'), 'Spezifikationskennung');
  const specificationVersion = text(ownValue(specification, 'specificationVersion', 'Spezifikationsbeleg'), 'Spezifikationsfassung');
  const schemaSha256 = hash(ownValue(specification, 'schemaSha256', 'Spezifikationsbeleg'), 'Schemasumme');
  const specificationCheckedAt = instant(ownValue(specification, 'checkedAt', 'Spezifikationsbeleg'), 'Spezifikationspruefzeit');

  const assignment = ownRecord(ownValue(root, 'assignment', 'Schnittstellenfall'), 'Zuordnungsbeleg');
  const assignmentId = uuid(ownValue(assignment, 'assignmentId', 'Zuordnungsbeleg'), 'Zuordnungskennung');
  const sourceEntityId = uuid(ownValue(assignment, 'sourceEntityId', 'Zuordnungsbeleg'), 'Quelldatensatzkennung');
  same(ownValue(assignment, 'partnerId', 'Zuordnungsbeleg'), partnerId, 'Zuordnungspartner');
  same(ownValue(assignment, 'endpointId', 'Zuordnungsbeleg'), endpointId, 'Zuordnungsempfaenger');
  same(ownValue(assignment, 'contractId', 'Zuordnungsbeleg'), contractId, 'Zuordnungsvertrag');
  same(ownValue(assignment, 'contractVersion', 'Zuordnungsbeleg'), contractVersion, 'Zuordnungsvertragsfassung');
  same(ownValue(assignment, 'specificationId', 'Zuordnungsbeleg'), specificationId, 'Zuordnungsspezifikation');
  same(ownValue(assignment, 'specificationVersion', 'Zuordnungsbeleg'), specificationVersion, 'Zuordnungsspezifikationsfassung');
  same(ownValue(assignment, 'schemaSha256', 'Zuordnungsbeleg'), schemaSha256, 'Zuordnungsschema');
  const payloadSha256 = hash(ownValue(assignment, 'payloadSha256', 'Zuordnungsbeleg'), 'Nutzdatensumme');
  const recordCount = nonnegativeInt(ownValue(assignment, 'recordCount', 'Zuordnungsbeleg'), 'Datensatzanzahl');
  const assignedAt = instant(ownValue(assignment, 'assignedAt', 'Zuordnungsbeleg'), 'Zuordnungszeit');
  if (partnerCheckedAt > assignedAt || specificationCheckedAt > assignedAt) {
    throw new Error('Zuordnung liegt vor Partner- oder Spezifikationsbeleg.');
  }

  const transfer = ownRecord(ownValue(root, 'transfer', 'Schnittstellenfall'), 'Uebertragungsbeleg');
  const transferId = uuid(ownValue(transfer, 'transferId', 'Uebertragungsbeleg'), 'Uebertragungskennung');
  same(ownValue(transfer, 'assignmentId', 'Uebertragungsbeleg'), assignmentId, 'Uebertragungszuordnung');
  uuid(ownValue(transfer, 'actorId', 'Uebertragungsbeleg'), 'Uebertragungsakteur');
  const transferState = oneOf(ownValue(transfer, 'state', 'Uebertragungsbeleg'), ['not_sent', 'sent', 'failed', 'uncertain'] as const, 'Uebertragungsstatus');
  const providerReceiptId = nullableText(ownValue(transfer, 'providerReceiptId', 'Uebertragungsbeleg'), 'Providerbelegkennung');
  if (transferState === 'sent' && providerReceiptId === null) throw new Error('Gesendete Uebertragung benoetigt einen Providerbeleg.');
  if (transferState !== 'sent' && providerReceiptId !== null) throw new Error('Nicht gesendete Uebertragung darf keinen Versandbeleg behaupten.');
  const transferAt = instant(ownValue(transfer, 'occurredAt', 'Uebertragungsbeleg'), 'Uebertragungszeit');
  if (assignedAt > transferAt) throw new Error('Uebertragung liegt vor ihrer Zuordnung.');

  const acknowledgementValue = ownValue(root, 'acknowledgement', 'Schnittstellenfall');
  let acknowledgementId: string | null = null;
  let acknowledgementState: 'accepted' | 'partial' | 'rejected' | 'missing' = 'missing';
  let acknowledgementExact = false;
  let acknowledgementAt: bigint | null = null;
  if (acknowledgementValue !== null) {
    const acknowledgement = ownRecord(acknowledgementValue, 'Empfangsbestaetigung');
    acknowledgementId = uuid(ownValue(acknowledgement, 'acknowledgementId', 'Empfangsbestaetigung'), 'Empfangsbestaetigungskennung');
    same(ownValue(acknowledgement, 'transferId', 'Empfangsbestaetigung'), transferId, 'Empfangsbestaetigungsuebertragung');
    same(ownValue(acknowledgement, 'partnerId', 'Empfangsbestaetigung'), partnerId, 'Bestaetigungspartner');
    same(ownValue(acknowledgement, 'endpointId', 'Empfangsbestaetigung'), endpointId, 'Bestaetigungsempfaenger');
    acknowledgementState = oneOf(ownValue(acknowledgement, 'state', 'Empfangsbestaetigung'), ['accepted', 'partial', 'rejected'] as const, 'Empfangsbestaetigungsstatus');
    acknowledgementExact = hash(ownValue(acknowledgement, 'payloadSha256', 'Empfangsbestaetigung'), 'Empfangsnutzdatensumme') === payloadSha256
      && nonnegativeInt(ownValue(acknowledgement, 'recordCount', 'Empfangsbestaetigung'), 'Empfangsdatensatzanzahl') === recordCount;
    acknowledgementAt = instant(ownValue(acknowledgement, 'acknowledgedAt', 'Empfangsbestaetigung'), 'Empfangsbestaetigungszeit');
    if (transferState !== 'sent' || transferAt > acknowledgementAt) {
      throw new Error('Empfangsbestaetigung liegt ohne passenden vorherigen Versand vor.');
    }
  }

  const reconciliationValue = ownValue(root, 'reconciliation', 'Schnittstellenfall');
  let reconciliationId: string | null = null;
  let reconciliationResult: 'match' | 'mismatch' | 'pending' | 'missing' = 'missing';
  let reconciliationExact = false;
  let reconciliationAt: bigint | null = null;
  if (reconciliationValue !== null) {
    const reconciliation = ownRecord(reconciliationValue, 'Abgleichbeleg');
    reconciliationId = uuid(ownValue(reconciliation, 'reconciliationId', 'Abgleichbeleg'), 'Abgleichkennung');
    same(ownValue(reconciliation, 'assignmentId', 'Abgleichbeleg'), assignmentId, 'Abgleichzuordnung');
    uuid(ownValue(reconciliation, 'actorId', 'Abgleichbeleg'), 'Abgleichakteur');
    reconciliationResult = oneOf(ownValue(reconciliation, 'result', 'Abgleichbeleg'), ['match', 'mismatch', 'pending'] as const, 'Abgleichergebnis');
    reconciliationExact = hash(ownValue(reconciliation, 'payloadSha256', 'Abgleichbeleg'), 'Abgleichnutzdatensumme') === payloadSha256
      && nonnegativeInt(ownValue(reconciliation, 'recordCount', 'Abgleichbeleg'), 'Abgleichdatensatzanzahl') === recordCount;
    reconciliationAt = instant(ownValue(reconciliation, 'reconciledAt', 'Abgleichbeleg'), 'Abgleichzeit');
    if (acknowledgementAt === null || acknowledgementAt > reconciliationAt) {
      throw new Error('Abgleich liegt ohne passende vorherige Empfangsbestaetigung vor.');
    }
  }

  const errorsValue = ownValue(root, 'errors', 'Schnittstellenfall');
  if (!Array.isArray(errorsValue)) throw new Error('Fehlerhistorie fehlt als Originalarray.');
  const seenErrors = new Set<string>();
  const openErrorIds: string[] = [];
  for (const value of errorsValue) {
    const error = ownRecord(value, 'Fehlerbeleg');
    const errorId = uuid(ownValue(error, 'errorId', 'Fehlerbeleg'), 'Fehlerkennung');
    if (seenErrors.has(errorId)) throw new Error('Fehlerhistorie enthaelt eine doppelte Fehlerkennung.');
    seenErrors.add(errorId);
    oneOf(ownValue(error, 'stage', 'Fehlerbeleg'), ['assignment', 'transfer', 'acknowledgement', 'reconciliation'] as const, 'Fehlerstufe');
    text(ownValue(error, 'code', 'Fehlerbeleg'), 'Fehlercode');
    const recordedAt = instant(ownValue(error, 'recordedAt', 'Fehlerbeleg'), 'Fehlerzeit');
    const resolved = ownValue(error, 'resolvedAt', 'Fehlerbeleg');
    if (resolved === null) openErrorIds.push(errorId);
    else if (instant(resolved, 'Fehlerloesungszeit') < recordedAt) throw new Error('Fehlerloesung liegt vor dem Fehler.');
  }

  const successConfirmed = contractStatus === 'active'
    && transferState === 'sent'
    && acknowledgementState === 'accepted'
    && acknowledgementExact
    && reconciliationResult === 'match'
    && reconciliationExact
    && reconciliationAt !== null
    && openErrorIds.length === 0;
  const state: PartnerExchangeState = successConfirmed
    ? 'confirmed_correct_assignment'
    : transferState === 'not_sent'
      ? 'not_sent'
      : transferState === 'uncertain'
        ? 'uncertain'
        : transferState === 'failed' || acknowledgementState === 'rejected' || reconciliationResult === 'mismatch'
          ? 'failed'
          : 'sent_unconfirmed';

  return Object.freeze({
    tenantId, clientId, partnerId, endpointId, providerKey, contractId, contractVersion, contractStatus,
    specificationId, specificationVersion, schemaSha256, assignmentId, sourceEntityId, payloadSha256,
    recordCount, transferId, transferState, providerReceiptId, acknowledgementId, acknowledgementState,
    reconciliationId, reconciliationResult, openErrorIds: Object.freeze(openErrorIds), state, successConfirmed,
    dataAtIntendedRecipient: successConfirmed ? 'confirmed' : 'not_confirmed',
  });
}
