export type CatalogVersionHistoryEvidence = Readonly<{
  tenantId: string;
  catalogId: string;
  documentId: string;
  historicalCatalogVersionId: string;
  historicalCatalogVersion: string;
  activeCatalogVersionId: string;
  activeCatalogVersion: string;
  historicalVersionRetained: true;
  catalogMigrationInferred: false;
  functionalAcceptanceInferred: false;
  careAcceptanceInferred: false;
  designAcceptanceInferred: false;
  legalAcceptanceInferred: false;
}>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SHA = /^[0-9a-f]{64}$/;
const VERSION = /^[0-9]+(?:\.[0-9]+){1,3}(?:[-+][a-z0-9.-]+)?$/;
const CODE = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/;
const INSTANT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d{1,6})(Z|([+-])(\d{2}):(\d{2}))$/;

type Instant = Readonly<{ micros: bigint }>;
type CatalogItem = Readonly<{ itemId: string; code: string; label: string; unit: string; itemSha256: string }>;
type CatalogVersion = Readonly<{
  catalogVersionId: string;
  version: string;
  validFrom: Instant;
  validUntil: Instant | null;
  items: ReadonlyMap<string, CatalogItem>;
  recordSha256: string;
  revision: number;
  createdAt: Instant;
}>;

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw Error(`${label} ist kein unveraenderter Originaldatensatz.`);
  return value as Record<string, unknown>;
}
function exact(value: Record<string, unknown>, keys: readonly string[], label: string): void {
  const actual = Object.keys(value), extra = actual.filter((key) => !keys.includes(key)), missing = keys.filter((key) => !actual.includes(key));
  if (extra.length) throw Error(`${label} enthaelt nicht erlaubte Felder: ${extra.join(', ')}.`);
  if (missing.length) throw Error(`${label} ist unvollstaendig: ${missing.join(', ')}.`);
}
function own(value: Record<string, unknown>, key: string, label: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (!descriptor || !Object.hasOwn(descriptor, 'value')) throw Error(`${label} ${key} fehlt als Originalwert.`);
  return descriptor.value;
}
function id(value: unknown, label: string): string { if (typeof value !== 'string' || !UUID.test(value)) throw Error(`${label} ist keine native UUID.`); return value; }
function hash(value: unknown, label: string): string { if (typeof value !== 'string' || !SHA.test(value)) throw Error(`${label} ist kein SHA-256-Originalwert.`); return value; }
function version(value: unknown, label: string): string { if (typeof value !== 'string' || !VERSION.test(value)) throw Error(`${label} ist nicht exakt versioniert.`); return value; }
function code(value: unknown, label: string): string { if (typeof value !== 'string' || !CODE.test(value)) throw Error(`${label} ist kein stabiler Code.`); return value; }
function text(value: unknown, label: string): string { if (typeof value !== 'string' || !value.trim()) throw Error(`${label} fehlt.`); return value; }
function integer(value: unknown, label: string, minimum = 0): number { if (!Number.isSafeInteger(value) || Number(value) < minimum) throw Error(`${label} ist ungueltig.`); return Number(value); }
function instant(value: unknown, label: string): Instant {
  if (typeof value !== 'string') throw Error(`${label} ist kein vollstaendiger ISO-Zeitpunkt.`);
  const match = INSTANT.exec(value);
  if (!match) throw Error(`${label} ist kein vollstaendiger ISO-Zeitpunkt.`);
  const [, year, month, day, hour, minute, second, fraction, zone, sign, zoneHour, zoneMinute] = match;
  const y = Number(year), m = Number(month), d = Number(day), h = Number(hour), min = Number(minute), s = Number(second), zh = Number(zoneHour ?? 0), zm = Number(zoneMinute ?? 0);
  const days = m >= 1 && m <= 12 ? new Date(Date.UTC(y, m, 0)).getUTCDate() : 0;
  if (y < 1 || d < 1 || d > days || h > 23 || min > 59 || s > 59 || zh > 23 || zm > 59) throw Error(`${label} enthaelt kein gueltiges Kalenderdatum.`);
  const offset = zone === 'Z' ? 0 : (sign === '-' ? -1 : 1) * (zh * 60 + zm);
  return Object.freeze({ micros: BigInt(Date.UTC(y, m - 1, d, h, min, s) - offset * 60_000) * 1000n + BigInt(fraction.padEnd(6, '0')) });
}

function item(value: unknown, label: string): CatalogItem {
  const record = object(value, label);
  exact(record, ['itemId', 'code', 'label', 'unit', 'itemSha256'], label);
  return Object.freeze({
    itemId: id(own(record, 'itemId', label), `${label}kennung`),
    code: code(own(record, 'code', label), `${label}code`),
    label: text(own(record, 'label', label), `${label}bezeichnung`),
    unit: code(own(record, 'unit', label), `${label}einheit`),
    itemSha256: hash(own(record, 'itemSha256', label), `${label}summe`),
  });
}

function catalogVersion(value: unknown, tenantId: string, catalogId: string): CatalogVersion {
  const record = object(value, 'Katalogfassung');
  exact(record, ['catalogVersionId', 'tenantId', 'catalogId', 'version', 'validFrom', 'validUntil', 'changeReason', 'responsibleProfileId', 'permissionKey', 'permissionEvidenceId', 'items', 'recordSha256', 'revision', 'createdAt'], 'Katalogfassung');
  const catalogVersionId = id(own(record, 'catalogVersionId', 'Katalogfassung'), 'Katalogfassungskennung');
  if (id(own(record, 'tenantId', 'Katalogfassung'), 'Katalogfassungsmandant') !== tenantId || id(own(record, 'catalogId', 'Katalogfassung'), 'Katalogkennung') !== catalogId) throw Error('Katalogfassung gehoert nicht zum belegten Mandanten und Katalog.');
  const catalogVersionValue = version(own(record, 'version', 'Katalogfassung'), 'Katalogversionsnummer');
  const validFrom = instant(own(record, 'validFrom', 'Katalogfassung'), 'Gueltigkeitsbeginn');
  const rawValidUntil = own(record, 'validUntil', 'Katalogfassung');
  const validUntil = rawValidUntil === null ? null : instant(rawValidUntil, 'Gueltigkeitsende');
  if (validUntil && validUntil.micros <= validFrom.micros) throw Error('Kataloggueltigkeitszeitraum ist ungueltig.');
  text(own(record, 'changeReason', 'Katalogfassung'), 'Aenderungsgrund');
  id(own(record, 'responsibleProfileId', 'Katalogfassung'), 'Verantwortliches Profil');
  if (own(record, 'permissionKey', 'Katalogfassung') !== 'organization.catalog-version.publish') throw Error('Katalogveroeffentlichungsberechtigung fehlt.');
  id(own(record, 'permissionEvidenceId', 'Katalogfassung'), 'Katalogberechtigungsbeleg');
  const rawItems = own(record, 'items', 'Katalogfassung');
  if (!Array.isArray(rawItems) || rawItems.length === 0) throw Error('Katalogfassung enthaelt keine Positionen.');
  const items = new Map<string, CatalogItem>();
  const codes = new Set<string>();
  let previous = '';
  for (const rawItem of rawItems) {
    const parsed = item(rawItem, 'Katalogposition');
    if (items.has(parsed.itemId) || codes.has(parsed.code)) throw Error('Katalogpositionen enthalten Dubletten.');
    if (previous && previous >= parsed.itemId) throw Error('Katalogpositionen sind nicht stabil nach nativer Kennung sortiert.');
    items.set(parsed.itemId, parsed); codes.add(parsed.code); previous = parsed.itemId;
  }
  const recordSha256 = hash(own(record, 'recordSha256', 'Katalogfassung'), 'Katalogfassungssumme');
  const revision = integer(own(record, 'revision', 'Katalogfassung'), 'Katalogfassungsrevision', 1);
  const createdAt = instant(own(record, 'createdAt', 'Katalogfassung'), 'Katalogerstellungszeit');
  if (createdAt.micros > validFrom.micros) throw Error('Katalogfassung wurde erst nach ihrem Gueltigkeitsbeginn erstellt.');
  return Object.freeze({ catalogVersionId, version: catalogVersionValue, validFrom, validUntil, items, recordSha256, revision, createdAt });
}

function sameItem(left: CatalogItem, right: CatalogItem): boolean {
  return left.itemId === right.itemId && left.code === right.code && left.label === right.label && left.unit === right.unit && left.itemSha256 === right.itemSha256;
}

/** Validates that a historical document resolves its original catalog snapshot despite a newer active version. */
export function projectCatalogVersionHistoryEvidence(input: unknown): CatalogVersionHistoryEvidence {
  const root = object(input, 'Kataloghistorie');
  exact(root, ['tenantId', 'catalogId', 'catalogVersions', 'historicalDocument', 'historicalResolution', 'evaluatedAt'], 'Kataloghistorie');
  const tenantId = id(own(root, 'tenantId', 'Kataloghistorie'), 'Mandantenkennung');
  const catalogId = id(own(root, 'catalogId', 'Kataloghistorie'), 'Katalogkennung');
  const evaluatedAt = instant(own(root, 'evaluatedAt', 'Kataloghistorie'), 'Auswertungszeit');
  const rawVersions = own(root, 'catalogVersions', 'Kataloghistorie');
  if (!Array.isArray(rawVersions) || rawVersions.length !== 2) throw Error('Kataloghistorie benoetigt genau zwei aufeinanderfolgende Fassungen.');
  const historical = catalogVersion(rawVersions[0], tenantId, catalogId), active = catalogVersion(rawVersions[1], tenantId, catalogId);
  if (historical.catalogVersionId === active.catalogVersionId || historical.version === active.version || historical.revision >= active.revision || historical.validUntil === null || historical.validUntil.micros !== active.validFrom.micros || active.validUntil !== null || active.validFrom.micros > evaluatedAt.micros) throw Error('Katalogfassungen bilden keine eindeutige geschlossene Historie mit aktueller Fassung.');

  const document = object(own(root, 'historicalDocument', 'Kataloghistorie'), 'Historische Dokumentation');
  exact(document, ['documentId', 'tenantId', 'subjectId', 'catalogId', 'catalogVersionId', 'catalogVersion', 'catalogRecordSha256', 'itemSnapshot', 'documentSha256', 'occurredAt', 'recordedAt', 'authorProfileId'], 'Historische Dokumentation');
  const documentId = id(own(document, 'documentId', 'Historische Dokumentation'), 'Dokumentkennung');
  if (id(own(document, 'tenantId', 'Historische Dokumentation'), 'Dokumentmandant') !== tenantId || id(own(document, 'catalogId', 'Historische Dokumentation'), 'Dokumentkatalog') !== catalogId || id(own(document, 'catalogVersionId', 'Historische Dokumentation'), 'Dokumentkatalogfassung') !== historical.catalogVersionId || version(own(document, 'catalogVersion', 'Historische Dokumentation'), 'Dokumentkatalogversion') !== historical.version || hash(own(document, 'catalogRecordSha256', 'Historische Dokumentation'), 'Dokumentkatalogsumme') !== historical.recordSha256) throw Error('Historische Dokumentation ist nicht exakt an ihre damalige Katalogfassung gebunden.');
  id(own(document, 'subjectId', 'Historische Dokumentation'), 'Dokumentsubjekt');
  const documentItem = item(own(document, 'itemSnapshot', 'Historische Dokumentation'), 'Dokumentposition');
  const historicalItem = historical.items.get(documentItem.itemId);
  if (!historicalItem || !sameItem(documentItem, historicalItem)) throw Error('Historische Dokumentation bewahrt nicht die damalige Katalogposition.');
  hash(own(document, 'documentSha256', 'Historische Dokumentation'), 'Dokumentsumme');
  const occurredAt = instant(own(document, 'occurredAt', 'Historische Dokumentation'), 'Tatsaechliche Ereigniszeit');
  const recordedAt = instant(own(document, 'recordedAt', 'Historische Dokumentation'), 'Dokumentationszeit');
  id(own(document, 'authorProfileId', 'Historische Dokumentation'), 'Dokumentationsprofil');
  if (occurredAt.micros < historical.validFrom.micros || occurredAt.micros >= historical.validUntil.micros || recordedAt.micros < occurredAt.micros) throw Error('Historische Dokumentation verletzt den damaligen Gueltigkeitszeitraum oder die Ereignisfolge.');

  const resolution = object(own(root, 'historicalResolution', 'Kataloghistorie'), 'Historische Aufloesung');
  exact(resolution, ['queryEvidenceId', 'tenantId', 'documentId', 'activeCatalogVersionId', 'activeCatalogVersion', 'resolvedCatalogVersionId', 'resolvedCatalogVersion', 'resolvedCatalogSha256', 'resolvedItemSnapshot', 'queriedAt'], 'Historische Aufloesung');
  id(own(resolution, 'queryEvidenceId', 'Historische Aufloesung'), 'Abfragebeleg');
  if (id(own(resolution, 'tenantId', 'Historische Aufloesung'), 'Aufloesungsmandant') !== tenantId || id(own(resolution, 'documentId', 'Historische Aufloesung'), 'Aufloesungsdokument') !== documentId) throw Error('Historische Aufloesung gehoert nicht zu Mandant und Dokument.');
  if (id(own(resolution, 'activeCatalogVersionId', 'Historische Aufloesung'), 'Aktive Katalogfassung') !== active.catalogVersionId || version(own(resolution, 'activeCatalogVersion', 'Historische Aufloesung'), 'Aktive Katalogversion') !== active.version) throw Error('Historische Aufloesung belegt nicht die aktuelle Katalogfassung.');
  if (id(own(resolution, 'resolvedCatalogVersionId', 'Historische Aufloesung'), 'Aufgeloeste Katalogfassung') !== historical.catalogVersionId || version(own(resolution, 'resolvedCatalogVersion', 'Historische Aufloesung'), 'Aufgeloeste Katalogversion') !== historical.version || hash(own(resolution, 'resolvedCatalogSha256', 'Historische Aufloesung'), 'Aufgeloeste Katalogsumme') !== historical.recordSha256) throw Error('Historische Aufloesung ersetzt die damalige Katalogfassung.');
  const resolvedItem = item(own(resolution, 'resolvedItemSnapshot', 'Historische Aufloesung'), 'Aufgeloeste Katalogposition');
  if (!sameItem(resolvedItem, documentItem) || !sameItem(resolvedItem, historicalItem)) throw Error('Historische Aufloesung ersetzt die damalige Katalogposition.');
  const queriedAt = instant(own(resolution, 'queriedAt', 'Historische Aufloesung'), 'Abfragezeit');
  if (recordedAt.micros > queriedAt.micros || active.validFrom.micros > queriedAt.micros || queriedAt.micros > evaluatedAt.micros) throw Error('Historische Katalogaufloesung verletzt die Mikrosekundenfolge.');

  return Object.freeze({ tenantId, catalogId, documentId, historicalCatalogVersionId: historical.catalogVersionId, historicalCatalogVersion: historical.version, activeCatalogVersionId: active.catalogVersionId, activeCatalogVersion: active.version, historicalVersionRetained: true, catalogMigrationInferred: false, functionalAcceptanceInferred: false, careAcceptanceInferred: false, designAcceptanceInferred: false, legalAcceptanceInferred: false });
}
