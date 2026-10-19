export type InquiryFirstContactEvidence = Readonly<{
  tenantId: string;
  inquiryId: string;
  outcome: 'accepted' | 'deferred' | 'rejected';
  revision: number;
  callbackOpen: boolean;
  clientCreatedInferred: false;
  clinicalAcceptanceInferred: false;
  functionalAcceptanceInferred: false;
  careAcceptanceInferred: false;
  designAcceptanceInferred: false;
  legalAcceptanceInferred: false;
}>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const CODE = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/;
const INSTANT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d{1,6})(Z|([+-])(\d{2}):(\d{2}))$/;

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    throw Error(`${label} ist kein unveraenderter Originaldatensatz.`);
  }
  return value as Record<string, unknown>;
}
function exact(value: Record<string, unknown>, keys: readonly string[], label: string) {
  const actual = Object.keys(value);
  const extra = actual.filter((key) => !keys.includes(key));
  const missing = keys.filter((key) => !actual.includes(key));
  if (extra.length) throw Error(`${label} enthaelt nicht erlaubte Felder: ${extra.join(', ')}.`);
  if (missing.length) throw Error(`${label} ist unvollstaendig: ${missing.join(', ')}.`);
}
function own(value: Record<string, unknown>, key: string, label: string) {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (!descriptor || !Object.hasOwn(descriptor, 'value')) throw Error(`${label} ${key} fehlt als Originalwert.`);
  return descriptor.value;
}
function id(value: unknown, label: string) {
  if (typeof value !== 'string' || !UUID.test(value)) throw Error(`${label} ist keine native UUID.`);
  return value;
}
function code(value: unknown, label: string) {
  if (typeof value !== 'string' || !CODE.test(value)) throw Error(`${label} ist kein stabiler Code.`);
  return value;
}
function text(value: unknown, label: string, max = 4000) {
  if (typeof value !== 'string' || !value.trim() || value !== value.trim() || value.length > max) throw Error(`${label} ist kein begrenzter Originaltext.`);
  return value;
}
function integer(value: unknown, label: string, min = 0) {
  if (!Number.isSafeInteger(value) || Number(value) < min) throw Error(`${label} ist ungueltig.`);
  return Number(value);
}
function instant(value: unknown, label: string) {
  if (typeof value !== 'string') throw Error(`${label} ist kein Mikrosekundenzeitpunkt.`);
  const match = INSTANT.exec(value);
  if (!match) throw Error(`${label} ist kein Mikrosekundenzeitpunkt.`);
  const [, year, month, day, hour, minute, second, fraction, zone, sign, zoneHour, zoneMinute] = match;
  const y = +year, mo = +month, d = +day, h = +hour, mi = +minute, s = +second, zh = +(zoneHour ?? 0), zm = +(zoneMinute ?? 0);
  const days = mo >= 1 && mo <= 12 ? new Date(Date.UTC(y, mo, 0)).getUTCDate() : 0;
  if (y < 1 || d < 1 || d > days || h > 23 || mi > 59 || s > 59 || zh > 23 || zm > 59) throw Error(`${label} enthaelt kein Kalenderdatum.`);
  const offset = zone === 'Z' ? 0 : (sign === '-' ? -1 : 1) * (zh * 60 + zm);
  return BigInt(Date.UTC(y, mo - 1, d, h, mi, s) - offset * 60000) * 1000n + BigInt(fraction.padEnd(6, '0'));
}

/** Validates one original inquiry and the explicit first-contact disposition without inferring admission. */
export function projectInquiryFirstContactEvidence(input: unknown): InquiryFirstContactEvidence {
  const root = record(input, 'Erstkontaktbeleg');
  exact(root, ['context', 'inquiry', 'decision', 'evaluatedAt'], 'Erstkontaktbeleg');
  const evaluatedAt = instant(own(root, 'evaluatedAt', 'Erstkontaktbeleg'), 'Auswertungszeit');

  const context = record(own(root, 'context', 'Erstkontaktbeleg'), 'Kontext');
  exact(context, ['tenantId', 'locationId', 'profileId', 'permissionKey'], 'Kontext');
  const tenantId = id(own(context, 'tenantId', 'Kontext'), 'Mandant');
  const locationId = id(own(context, 'locationId', 'Kontext'), 'Standort');
  const profileId = id(own(context, 'profileId', 'Kontext'), 'Profil');
  if (own(context, 'permissionKey', 'Kontext') !== 'office.inquiries.manage') throw Error('Aktuelles Erstkontaktrecht fehlt.');

  const inquiry = record(own(root, 'inquiry', 'Erstkontaktbeleg'), 'Anfrage');
  exact(inquiry, ['inquiryId', 'tenantId', 'locationId', 'sourceCode', 'concern', 'callback', 'urgencyCode', 'revision', 'receivedAt'], 'Anfrage');
  const inquiryId = id(own(inquiry, 'inquiryId', 'Anfrage'), 'Anfragekennung');
  if (id(own(inquiry, 'tenantId', 'Anfrage'), 'Anfragemandant') !== tenantId || id(own(inquiry, 'locationId', 'Anfrage'), 'Anfragestandort') !== locationId) {
    throw Error('Anfrage gehoert nicht zum aktuellen Mandanten und Standort.');
  }
  code(own(inquiry, 'sourceCode', 'Anfrage'), 'Kontaktquelle');
  text(own(inquiry, 'concern', 'Anfrage'), 'Anliegen');
  code(own(inquiry, 'urgencyCode', 'Anfrage'), 'Dringlichkeit');
  const originalRevision = integer(own(inquiry, 'revision', 'Anfrage'), 'Anfragerevision', 1);
  const receivedAt = instant(own(inquiry, 'receivedAt', 'Anfrage'), 'Eingangszeit');

  const callback = record(own(inquiry, 'callback', 'Anfrage'), 'Rueckruf');
  exact(callback, ['requested', 'channelCode', 'contactValue', 'dueAt'], 'Rueckruf');
  const requested = own(callback, 'requested', 'Rueckruf');
  if (typeof requested !== 'boolean') throw Error('Rueckrufwunsch ist kein Originalwert.');
  const channel = own(callback, 'channelCode', 'Rueckruf');
  const contactValue = own(callback, 'contactValue', 'Rueckruf');
  const dueValue = own(callback, 'dueAt', 'Rueckruf');
  let callbackDue: bigint | null = null;
  if (requested) {
    code(channel, 'Rueckrufkanal');
    text(contactValue, 'Rueckrufkontakt', 500);
    callbackDue = instant(dueValue, 'Rueckruffrist');
    if (callbackDue < receivedAt) throw Error('Rueckruffrist liegt vor dem Anfrageeingang.');
  } else if (channel !== null || contactValue !== null || dueValue !== null) {
    throw Error('Rueckrufdaten liegen ohne Rueckrufwunsch vor.');
  }

  const decision = record(own(root, 'decision', 'Erstkontaktbeleg'), 'Entscheidung');
  exact(decision, ['eventId', 'inquiryId', 'tenantId', 'locationId', 'profileId', 'outcome', 'reasonCode', 'reasonText', 'expectedRevision', 'newRevision', 'decidedAt'], 'Entscheidung');
  id(own(decision, 'eventId', 'Entscheidung'), 'Ereigniskennung');
  if (id(own(decision, 'inquiryId', 'Entscheidung'), 'Entscheidungsanfrage') !== inquiryId
      || id(own(decision, 'tenantId', 'Entscheidung'), 'Entscheidungsmandant') !== tenantId
      || id(own(decision, 'locationId', 'Entscheidung'), 'Entscheidungsstandort') !== locationId
      || id(own(decision, 'profileId', 'Entscheidung'), 'Entscheidungsprofil') !== profileId) {
    throw Error('Entscheidung bindet Anfrage und aktuellen Kontext nicht exakt.');
  }
  const outcome = own(decision, 'outcome', 'Entscheidung');
  if (outcome !== 'accepted' && outcome !== 'deferred' && outcome !== 'rejected') throw Error('Entscheidung ist weder angenommen, zurueckgestellt noch abgelehnt.');
  const reasonCode = own(decision, 'reasonCode', 'Entscheidung');
  const reasonText = own(decision, 'reasonText', 'Entscheidung');
  if (outcome === 'accepted') {
    if (reasonCode !== null || reasonText !== null) throw Error('Annahme darf keinen erfundenen Ablehnungsgrund tragen.');
  } else {
    code(reasonCode, 'Entscheidungsgrund');
    text(reasonText, 'Entscheidungsbegruendung', 2000);
  }
  if (outcome === 'deferred' && (!requested || callbackDue === null)) throw Error('Zurueckstellung benoetigt einen konkreten Rueckrufbeleg.');
  const expectedRevision = integer(own(decision, 'expectedRevision', 'Entscheidung'), 'Erwartete Revision', 1);
  const revision = integer(own(decision, 'newRevision', 'Entscheidung'), 'Neue Revision', 2);
  if (expectedRevision !== originalRevision || revision !== originalRevision + 1) throw Error('Entscheidung schreibt nicht exakt auf den gelesenen Revisionsstand fort.');
  const decidedAt = instant(own(decision, 'decidedAt', 'Entscheidung'), 'Entscheidungszeit');
  if (receivedAt > decidedAt || decidedAt > evaluatedAt || (outcome === 'deferred' && callbackDue! < decidedAt)) throw Error('Erstkontakt verletzt die Mikrosekundenfolge.');

  return Object.freeze({
    tenantId, inquiryId, outcome, revision, callbackOpen: outcome === 'deferred', clientCreatedInferred: false,
    clinicalAcceptanceInferred: false, functionalAcceptanceInferred: false, careAcceptanceInferred: false,
    designAcceptanceInferred: false, legalAcceptanceInferred: false,
  });
}
