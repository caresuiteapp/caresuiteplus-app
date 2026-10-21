export type TenantSetupIsolationEvidence = Readonly<{
  serviceIds: readonly [string, string];
  tenantIds: readonly [string, string];
  bidirectionalIsolationEvidenced: true;
  returnedRowCount: 0;
  setupCompletedInferred: false;
  dataCreatedInferred: false;
  functionalAcceptanceInferred: false;
  careAcceptanceInferred: false;
  designAcceptanceInferred: false;
  legalAcceptanceInferred: false;
}>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SHA = /^[0-9a-f]{64}$/;
const VERSION = /^[0-9]+(?:\.[0-9]+){1,3}(?:[-+][a-z0-9.-]+)?$/;
const IK = /^[0-9]{9}$/;
const INSTANT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d{1,6})(Z|([+-])(\d{2}):(\d{2}))$/;

type Instant = Readonly<{ micros: bigint }>;

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    throw Error(`${label} ist kein unveraenderter Originaldatensatz.`);
  }
  return value as Record<string, unknown>;
}

function exact(value: Record<string, unknown>, keys: readonly string[], label: string): void {
  const actual = Object.keys(value);
  const extra = actual.filter((key) => !keys.includes(key));
  const missing = keys.filter((key) => !actual.includes(key));
  if (extra.length) throw Error(`${label} enthaelt nicht erlaubte Felder: ${extra.join(', ')}.`);
  if (missing.length) throw Error(`${label} ist unvollstaendig: ${missing.join(', ')}.`);
}

function own(value: Record<string, unknown>, key: string, label: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (!descriptor || !Object.hasOwn(descriptor, 'value')) throw Error(`${label} ${key} fehlt als Originalwert.`);
  return descriptor.value;
}

function id(value: unknown, label: string): string {
  if (typeof value !== 'string' || !UUID.test(value)) throw Error(`${label} ist keine native UUID.`);
  return value;
}

function hash(value: unknown, label: string): string {
  if (typeof value !== 'string' || !SHA.test(value)) throw Error(`${label} ist kein SHA-256-Originalwert.`);
  return value;
}

function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw Error(`${label} fehlt.`);
  return value;
}

function instant(value: unknown, label: string): Instant {
  if (typeof value !== 'string') throw Error(`${label} ist kein vollstaendiger ISO-Zeitpunkt.`);
  const match = INSTANT.exec(value);
  if (!match) throw Error(`${label} ist kein vollstaendiger ISO-Zeitpunkt.`);
  const [, year, month, day, hour, minute, second, fraction, zone, sign, zoneHour, zoneMinute] = match;
  const y = Number(year), m = Number(month), d = Number(day), h = Number(hour), min = Number(minute), s = Number(second);
  const zh = Number(zoneHour ?? 0), zm = Number(zoneMinute ?? 0);
  const days = m >= 1 && m <= 12 ? new Date(Date.UTC(y, m, 0)).getUTCDate() : 0;
  if (y < 1 || d < 1 || d > days || h > 23 || min > 59 || s > 59 || zh > 23 || zm > 59) {
    throw Error(`${label} enthaelt kein gueltiges Kalenderdatum.`);
  }
  const offset = zone === 'Z' ? 0 : (sign === '-' ? -1 : 1) * (zh * 60 + zm);
  return Object.freeze({ micros: BigInt(Date.UTC(y, m - 1, d, h, min, s) - offset * 60_000) * 1_000n + BigInt(fraction.padEnd(6, '0')) });
}

type Service = Readonly<{ tenantId: string; serviceId: string; committedAt: Instant }>;

function setup(value: unknown, evaluatedAt: Instant): Service {
  const record = object(value, 'Dienstanlage');
  exact(record, ['operationId', 'tenantId', 'serviceId', 'serviceName', 'branchId', 'branchName', 'ikNumber', 'addresses', 'responsibleProfileId', 'responsibilityRole', 'requestSha256', 'receiptSha256', 'revision', 'createdAt', 'committedAt'], 'Dienstanlage');
  id(own(record, 'operationId', 'Dienstanlage'), 'Anlagevorgang');
  const tenantId = id(own(record, 'tenantId', 'Dienstanlage'), 'Mandantenkennung');
  const serviceId = id(own(record, 'serviceId', 'Dienstanlage'), 'Dienstkennung');
  text(own(record, 'serviceName', 'Dienstanlage'), 'Dienstname');
  id(own(record, 'branchId', 'Dienstanlage'), 'Niederlassungskennung');
  text(own(record, 'branchName', 'Dienstanlage'), 'Niederlassungsname');
  const ikNumber = own(record, 'ikNumber', 'Dienstanlage');
  if (typeof ikNumber !== 'string' || !IK.test(ikNumber)) throw Error('Institutionskennzeichen muss aus neun Originalziffern bestehen.');

  const addresses = own(record, 'addresses', 'Dienstanlage');
  if (!Array.isArray(addresses) || addresses.length === 0) throw Error('Dienstanlage benoetigt mindestens eine Originaladresse.');
  const seenAddressIds = new Set<string>();
  let primaryCount = 0;
  for (const value of addresses) {
    const address = object(value, 'Dienstadresse');
    exact(address, ['addressId', 'tenantId', 'serviceId', 'kind', 'street', 'houseNumber', 'postalCode', 'city', 'countryCode', 'isPrimary'], 'Dienstadresse');
    const addressId = id(own(address, 'addressId', 'Dienstadresse'), 'Adresskennung');
    if (seenAddressIds.has(addressId)) throw Error('Dienstadressen enthalten eine doppelte native Kennung.');
    seenAddressIds.add(addressId);
    if (id(own(address, 'tenantId', 'Dienstadresse'), 'Adressmandant') !== tenantId || id(own(address, 'serviceId', 'Dienstadresse'), 'Adressdienst') !== serviceId) {
      throw Error('Dienstadresse gehoert nicht exakt zu Mandant und Dienst.');
    }
    if (!['registered', 'service'].includes(String(own(address, 'kind', 'Dienstadresse')))) throw Error('Dienstadresse besitzt keine gueltige Art.');
    text(own(address, 'street', 'Dienstadresse'), 'Strasse');
    text(own(address, 'houseNumber', 'Dienstadresse'), 'Hausnummer');
    if (!/^\d{5}$/.test(text(own(address, 'postalCode', 'Dienstadresse'), 'Postleitzahl'))) throw Error('Postleitzahl ist nicht fuenfstellig.');
    text(own(address, 'city', 'Dienstadresse'), 'Ort');
    if (!/^[A-Z]{2}$/.test(text(own(address, 'countryCode', 'Dienstadresse'), 'Laendercode'))) throw Error('Laendercode ist nicht ISO-alpha-2.');
    if (typeof own(address, 'isPrimary', 'Dienstadresse') !== 'boolean') throw Error('Primaerkennzeichen der Dienstadresse fehlt.');
    if (own(address, 'isPrimary', 'Dienstadresse') === true) primaryCount += 1;
  }
  if (primaryCount !== 1) throw Error('Dienstanlage benoetigt genau eine Primaeradresse.');

  id(own(record, 'responsibleProfileId', 'Dienstanlage'), 'Verantwortlichenprofil');
  text(own(record, 'responsibilityRole', 'Dienstanlage'), 'Verantwortungsrolle');
  hash(own(record, 'requestSha256', 'Dienstanlage'), 'Anfragepruefsumme');
  hash(own(record, 'receiptSha256', 'Dienstanlage'), 'Quittungspruefsumme');
  const revision = own(record, 'revision', 'Dienstanlage');
  if (!Number.isSafeInteger(revision) || Number(revision) < 1) throw Error('Dienstanlage besitzt keine positive sichere Revision.');
  const createdAt = instant(own(record, 'createdAt', 'Dienstanlage'), 'Anlagezeit');
  const committedAt = instant(own(record, 'committedAt', 'Dienstanlage'), 'Commitzeit');
  if (committedAt.micros < createdAt.micros || committedAt.micros > evaluatedAt.micros) throw Error('Dienstanlage verletzt die Mikrosekundenfolge.');
  return Object.freeze({ tenantId, serviceId, committedAt });
}

function denial(value: unknown, source: Service, target: Service, evaluatedAt: Instant): void {
  const record = object(value, 'Zugriffsverweigerung');
  exact(record, ['requestId', 'requesterTenantId', 'requesterServiceId', 'targetTenantId', 'targetServiceId', 'targetResourceId', 'permissionKey', 'policyVersion', 'policySha256', 'decision', 'denialCode', 'returnedRowCount', 'decisionEvidenceId', 'requestedAt', 'decidedAt'], 'Zugriffsverweigerung');
  id(own(record, 'requestId', 'Zugriffsverweigerung'), 'Zugriffsanfrage');
  if (id(own(record, 'requesterTenantId', 'Zugriffsverweigerung'), 'Anfragemandant') !== source.tenantId || id(own(record, 'requesterServiceId', 'Zugriffsverweigerung'), 'Anfragedienst') !== source.serviceId) {
    throw Error('Zugriffsverweigerung ist nicht an den anfragenden Dienst gebunden.');
  }
  if (id(own(record, 'targetTenantId', 'Zugriffsverweigerung'), 'Zielmandant') !== target.tenantId || id(own(record, 'targetServiceId', 'Zugriffsverweigerung'), 'Zieldienst') !== target.serviceId) {
    throw Error('Zugriffsverweigerung ist nicht an den fremden Zieldienst gebunden.');
  }
  id(own(record, 'targetResourceId', 'Zugriffsverweigerung'), 'Zielressource');
  text(own(record, 'permissionKey', 'Zugriffsverweigerung'), 'Berechtigungsschluessel');
  const policyVersion = own(record, 'policyVersion', 'Zugriffsverweigerung');
  if (typeof policyVersion !== 'string' || !VERSION.test(policyVersion)) throw Error('Zugriffsrichtlinie ist nicht exakt versioniert.');
  hash(own(record, 'policySha256', 'Zugriffsverweigerung'), 'Richtlinienpruefsumme');
  if (own(record, 'decision', 'Zugriffsverweigerung') !== 'denied') throw Error('Fremdzugriff wurde nicht verweigert.');
  text(own(record, 'denialCode', 'Zugriffsverweigerung'), 'Verweigerungscode');
  if (own(record, 'returnedRowCount', 'Zugriffsverweigerung') !== 0) throw Error('Verweigerter Fremdzugriff darf keine Datenzeile liefern.');
  id(own(record, 'decisionEvidenceId', 'Zugriffsverweigerung'), 'Entscheidungsbeleg');
  const requestedAt = instant(own(record, 'requestedAt', 'Zugriffsverweigerung'), 'Anfragezeit');
  const decidedAt = instant(own(record, 'decidedAt', 'Zugriffsverweigerung'), 'Entscheidungszeit');
  if (requestedAt.micros < source.committedAt.micros || requestedAt.micros < target.committedAt.micros || decidedAt.micros < requestedAt.micros || decidedAt.micros > evaluatedAt.micros) {
    throw Error('Zugriffsverweigerung verletzt die Mikrosekundenfolge nach beiden Dienstanlagen.');
  }
}

/** Validates two complete service setup receipts and denial evidence in both cross-tenant directions. */
export function projectTenantSetupIsolationEvidence(input: unknown): TenantSetupIsolationEvidence {
  const root = object(input, 'Mandanteneinrichtung');
  exact(root, ['setups', 'crossAccessDenials', 'evaluatedAt'], 'Mandanteneinrichtung');
  const evaluatedAt = instant(own(root, 'evaluatedAt', 'Mandanteneinrichtung'), 'Auswertungszeit');
  const rawSetups = own(root, 'setups', 'Mandanteneinrichtung');
  if (!Array.isArray(rawSetups) || rawSetups.length !== 2) throw Error('Mandanteneinrichtung benoetigt genau zwei Dienstanlagen.');
  const services = rawSetups.map((value) => setup(value, evaluatedAt)) as [Service, Service];
  if (services[0].tenantId === services[1].tenantId || services[0].serviceId === services[1].serviceId) throw Error('Die beiden Dienste muessen native getrennte Mandanten und Dienstkennungen besitzen.');

  const rawDenials = own(root, 'crossAccessDenials', 'Mandanteneinrichtung');
  if (!Array.isArray(rawDenials) || rawDenials.length !== 2) throw Error('Mandanteneinrichtung benoetigt zwei gerichtete Zugriffsverweigerungen.');
  denial(rawDenials[0], services[0], services[1], evaluatedAt);
  denial(rawDenials[1], services[1], services[0], evaluatedAt);

  return Object.freeze({
    serviceIds: Object.freeze([services[0].serviceId, services[1].serviceId]) as readonly [string, string],
    tenantIds: Object.freeze([services[0].tenantId, services[1].tenantId]) as readonly [string, string],
    bidirectionalIsolationEvidenced: true,
    returnedRowCount: 0,
    setupCompletedInferred: false,
    dataCreatedInferred: false,
    functionalAcceptanceInferred: false,
    careAcceptanceInferred: false,
    designAcceptanceInferred: false,
    legalAcceptanceInferred: false,
  });
}
