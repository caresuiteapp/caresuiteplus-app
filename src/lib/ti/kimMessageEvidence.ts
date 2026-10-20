import type { KIMMessage, KIMMessageStatus } from '@/types/modules/ti';

export type KIMMessageEvidenceContext = Readonly<{
  tenantId: string;
  mailboxId?: string;
}>;

export type KIMMessageVerificationProjection = Readonly<{
  messageId: string;
  tenantId: string;
  nativeMailboxId: string;
  senderAddress: string;
  messageStatus: KIMMessageStatus;
  storedKIMMessage: 'confirmed';
  senderIdentity: 'not_verified';
  certificate: 'not_verified';
  deliveryReceipt: 'not_provided';
  taskCompletion: 'not_determined';
}>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const INSTANT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d{1,6})(Z|([+-])(\d{2}):(\d{2}))$/;
const STATUS = new Set<KIMMessageStatus>(['unread', 'read', 'archived', 'error']);

function ownRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
    && [Object.prototype, null].includes(Object.getPrototypeOf(value));
}

function ownValue(row: Record<string, unknown>, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(row, key);
  if (!descriptor || !Object.hasOwn(descriptor, 'value')) {
    throw new Error(`KIM-Feld ${key} ist nicht als unveränderter Originalwert geliefert.`);
  }
  return descriptor.value;
}

function nativeUuid(value: unknown, label: string): string {
  if (typeof value !== 'string' || !UUID.test(value)) {
    throw new Error(`${label} ist keine native UUID.`);
  }
  return value;
}

function originalText(value: unknown, label: string): string {
  if (typeof value !== 'string') throw new Error(`${label} ist kein Originaltext.`);
  return value;
}

function optionalOriginalText(value: unknown, label: string): string | null {
  if (value !== null && typeof value !== 'string') throw new Error(`${label} ist kein Originaltext.`);
  return value;
}

function exactBoolean(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${label} ist kein ursprünglicher Wahrheitswert.`);
  return value;
}

function instantMicros(value: unknown, label: string): bigint {
  if (typeof value !== 'string') throw new Error(`${label} ist kein vollständiger ISO-Zeitpunkt.`);
  const match = INSTANT.exec(value);
  if (!match) throw new Error(`${label} ist kein vollständiger ISO-Zeitpunkt.`);

  const [, yearText, monthText, dayText, hourText, minuteText, secondText, fraction, zone, sign, zoneHourText, zoneMinuteText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const zoneHour = Number(zoneHourText ?? 0);
  const zoneMinute = Number(zoneMinuteText ?? 0);
  const daysInMonth = month >= 1 && month <= 12
    ? new Date(Date.UTC(year, month, 0)).getUTCDate()
    : 0;
  if (year < 1 || day < 1 || day > daysInMonth || hour > 23 || minute > 59 || second > 59
    || zoneHour > 23 || zoneMinute > 59) {
    throw new Error(`${label} enthält kein gültiges Kalenderdatum.`);
  }

  const offsetMinutes = zone === 'Z' ? 0 : (sign === '-' ? -1 : 1) * (zoneHour * 60 + zoneMinute);
  const epochSeconds = BigInt(Date.UTC(year, month - 1, day, hour, minute, second) - offsetMinutes * 60_000) / 1000n;
  return epochSeconds * 1_000_000n + BigInt(fraction.padEnd(6, '0'));
}

export function assertKIMMessageEvidenceContext(context: KIMMessageEvidenceContext): void {
  nativeUuid(context.tenantId, 'KIM-Mandantenkennung');
  if (context.mailboxId !== undefined) nativeUuid(context.mailboxId, 'KIM-Postfachkennung');
}

/**
 * Maps one complete database original without coercion or replacement values.
 * Any malformed row rejects the caller's whole delivered result set.
 */
export function mapKIMMessageEvidenceRow(
  input: unknown,
  context: KIMMessageEvidenceContext,
): Readonly<KIMMessage> {
  assertKIMMessageEvidenceContext(context);
  if (!ownRecord(input)) throw new Error('KIM-Nachricht ist nicht als vollständige Originalzeile geliefert.');

  const id = nativeUuid(ownValue(input, 'id'), 'KIM-Nachrichtenkennung');
  const tenantId = nativeUuid(ownValue(input, 'tenant_id'), 'KIM-Mandantenkennung');
  const mailboxId = nativeUuid(ownValue(input, 'mailbox_id'), 'KIM-Postfachkennung');
  if (tenantId !== context.tenantId || context.mailboxId !== undefined && mailboxId !== context.mailboxId) {
    throw new Error('KIM-Nachricht gehört nicht zum angeforderten Mandanten- und Postfachkontext.');
  }

  const status = ownValue(input, 'status');
  if (typeof status !== 'string' || !STATUS.has(status as KIMMessageStatus)) {
    throw new Error('KIM-Nachricht hat keinen erlaubten Originalstatus.');
  }
  const receivedAt = ownValue(input, 'received_at');
  const createdAt = ownValue(input, 'created_at');
  const updatedAt = ownValue(input, 'updated_at');
  const receivedMicros = instantMicros(receivedAt, 'KIM-Empfangszeit');
  const createdMicros = instantMicros(createdAt, 'KIM-Speicherzeit');
  const updatedMicros = instantMicros(updatedAt, 'KIM-Aktualisierungszeit');
  if (receivedMicros > createdMicros || createdMicros > updatedMicros) {
    throw new Error('KIM-Nachricht hat eine widersprüchliche Originalzeitfolge.');
  }

  return Object.freeze({
    id,
    tenantId,
    mailboxId,
    sender: originalText(ownValue(input, 'sender'), 'KIM-Absenderadresse'),
    senderName: optionalOriginalText(ownValue(input, 'sender_name'), 'KIM-Absendername'),
    subject: originalText(ownValue(input, 'subject'), 'KIM-Betreff'),
    preview: originalText(ownValue(input, 'preview'), 'KIM-Vorschau'),
    body: originalText(ownValue(input, 'body'), 'KIM-Nachrichtentext'),
    status: status as KIMMessageStatus,
    receivedAt: receivedAt as string,
    hasAttachments: exactBoolean(ownValue(input, 'has_attachments'), 'KIM-Anhangskennzeichen'),
    isMedical: exactBoolean(ownValue(input, 'is_medical'), 'KIM-Medizinkennzeichen'),
    createdAt: createdAt as string,
    updatedAt: updatedAt as string,
  });
}

/** Stored message facts do not prove sender identity, certificates, delivery or task completion. */
export function projectKIMMessageVerification(
  message: Readonly<KIMMessage>,
): KIMMessageVerificationProjection {
  const verified = mapKIMMessageEvidenceRow({
    id: message.id,
    tenant_id: message.tenantId,
    mailbox_id: message.mailboxId,
    sender: message.sender,
    sender_name: message.senderName,
    subject: message.subject,
    preview: message.preview,
    body: message.body,
    status: message.status,
    received_at: message.receivedAt,
    has_attachments: message.hasAttachments,
    is_medical: message.isMedical,
    created_at: message.createdAt,
    updated_at: message.updatedAt,
  }, { tenantId: message.tenantId, mailboxId: message.mailboxId });
  return Object.freeze({
    messageId: verified.id,
    tenantId: verified.tenantId,
    nativeMailboxId: verified.mailboxId,
    senderAddress: verified.sender,
    messageStatus: verified.status,
    storedKIMMessage: 'confirmed',
    senderIdentity: 'not_verified',
    certificate: 'not_verified',
    deliveryReceipt: 'not_provided',
    taskCompletion: 'not_determined',
  });
}
