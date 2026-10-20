export type ClinicalConfigurationActivationEvidence = Readonly<{
  tenantId: string;
  configurationId: string;
  configurationVersion: string;
  validationIssueCodes: readonly string[];
  bindingRevision: number;
  invalidActivationPrevented: true;
  bindingActivationInferred: false;
  functionalAcceptanceInferred: false;
  careAcceptanceInferred: false;
  designAcceptanceInferred: false;
  legalAcceptanceInferred: false;
}>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SHA = /^[0-9a-f]{64}$/;
const VERSION = /^[0-9]+(?:\.[0-9]+){1,3}(?:[-+][a-z0-9.-]+)?$/;
const CODE = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/;
const PATH = /^\$\.[A-Za-z][A-Za-z0-9]*(?:\[[0-9]+\]|\.[A-Za-z][A-Za-z0-9]*)*$/;
const INSTANT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d{1,6})(Z|([+-])(\d{2}):(\d{2}))$/;

type Instant = Readonly<{ micros: bigint }>;
type Binding = Readonly<{
  bindingId: string;
  activeConfigurationId: string | null;
  activeConfigurationVersion: string | null;
  revision: number;
  recordSha256: string;
  capturedAt: Instant;
}>;

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

function version(value: unknown, label: string): string {
  if (typeof value !== 'string' || !VERSION.test(value)) throw Error(`${label} ist nicht exakt versioniert.`);
  return value;
}

function code(value: unknown, label: string): string {
  if (typeof value !== 'string' || !CODE.test(value)) throw Error(`${label} ist kein stabiler Code.`);
  return value;
}

function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw Error(`${label} fehlt.`);
  return value;
}

function integer(value: unknown, label: string, minimum = 0): number {
  if (!Number.isSafeInteger(value) || Number(value) < minimum) throw Error(`${label} ist ungueltig.`);
  return Number(value);
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
  return Object.freeze({ micros: BigInt(Date.UTC(y, m - 1, d, h, min, s) - offset * 60_000) * 1000n + BigInt(fraction.padEnd(6, '0')) });
}

function model(value: unknown, label: string): void {
  const record = object(value, label);
  exact(record, ['modelId', 'code', 'version', 'modelSha256'], label);
  id(own(record, 'modelId', label), `${label}kennung`);
  code(own(record, 'code', label), `${label}code`);
  version(own(record, 'version', label), `${label}version`);
  hash(own(record, 'modelSha256', label), `${label}summe`);
}

function serviceTypes(value: unknown): void {
  if (!Array.isArray(value) || value.length === 0) throw Error('Leistungsarten fehlen.');
  const ids = new Set<string>();
  const codes = new Set<string>();
  let previous = '';
  for (const item of value) {
    const record = object(item, 'Leistungsart');
    exact(record, ['serviceTypeId', 'code', 'catalogVersion', 'catalogSha256'], 'Leistungsart');
    const serviceTypeId = id(own(record, 'serviceTypeId', 'Leistungsart'), 'Leistungsartkennung');
    const serviceCode = code(own(record, 'code', 'Leistungsart'), 'Leistungsartcode');
    version(own(record, 'catalogVersion', 'Leistungsart'), 'Leistungskatalogversion');
    hash(own(record, 'catalogSha256', 'Leistungsart'), 'Leistungskatalogsumme');
    if (ids.has(serviceTypeId) || codes.has(serviceCode)) throw Error('Leistungsarten enthalten Dubletten.');
    if (previous && previous >= serviceTypeId) throw Error('Leistungsarten sind nicht stabil nach nativer Kennung sortiert.');
    ids.add(serviceTypeId);
    codes.add(serviceCode);
    previous = serviceTypeId;
  }
}

function binding(value: unknown, tenantId: string, label: string): Binding {
  const record = object(value, label);
  exact(record, ['bindingId', 'tenantId', 'activeConfigurationId', 'activeConfigurationVersion', 'revision', 'recordSha256', 'capturedAt'], label);
  const bindingId = id(own(record, 'bindingId', label), `${label}kennung`);
  if (id(own(record, 'tenantId', label), `${label}mandant`) !== tenantId) throw Error(`${label} gehoert nicht zum Mandanten.`);
  const rawConfigurationId = own(record, 'activeConfigurationId', label);
  const rawVersion = own(record, 'activeConfigurationVersion', label);
  if ((rawConfigurationId === null) !== (rawVersion === null)) throw Error(`${label} hat eine unvollstaendige aktive Konfiguration.`);
  const activeConfigurationId = rawConfigurationId === null ? null : id(rawConfigurationId, `${label}konfiguration`);
  const activeConfigurationVersion = rawVersion === null ? null : version(rawVersion, `${label}version`);
  return Object.freeze({
    bindingId,
    activeConfigurationId,
    activeConfigurationVersion,
    revision: integer(own(record, 'revision', label), `${label}revision`),
    recordSha256: hash(own(record, 'recordSha256', label), `${label}summe`),
    capturedAt: instant(own(record, 'capturedAt', label), `${label}zeit`),
  });
}

/** Validates fail-closed evidence that an invalid clinical configuration did not change its active binding. */
export function projectClinicalConfigurationActivationEvidence(input: unknown): ClinicalConfigurationActivationEvidence {
  const root = object(input, 'Fachkonfigurationsaktivierung');
  exact(root, ['tenantId', 'configuration', 'validationReport', 'activeBindingBefore', 'activationAttempt', 'activeBindingAfter', 'evaluatedAt'], 'Fachkonfigurationsaktivierung');
  const tenantId = id(own(root, 'tenantId', 'Fachkonfigurationsaktivierung'), 'Mandantenkennung');
  const evaluatedAt = instant(own(root, 'evaluatedAt', 'Fachkonfigurationsaktivierung'), 'Auswertungszeit');

  const configuration = object(own(root, 'configuration', 'Fachkonfigurationsaktivierung'), 'Fachkonfiguration');
  exact(configuration, ['configurationId', 'tenantId', 'serviceModel', 'serviceTypes', 'documentationModel', 'version', 'recordSha256', 'revision', 'createdAt'], 'Fachkonfiguration');
  const configurationId = id(own(configuration, 'configurationId', 'Fachkonfiguration'), 'Konfigurationskennung');
  if (id(own(configuration, 'tenantId', 'Fachkonfiguration'), 'Konfigurationsmandant') !== tenantId) throw Error('Fachkonfiguration gehoert nicht zum Mandanten.');
  model(own(configuration, 'serviceModel', 'Fachkonfiguration'), 'Dienstmodell');
  serviceTypes(own(configuration, 'serviceTypes', 'Fachkonfiguration'));
  model(own(configuration, 'documentationModel', 'Fachkonfiguration'), 'Dokumentationsmodell');
  const configurationVersion = version(own(configuration, 'version', 'Fachkonfiguration'), 'Konfigurationsversion');
  const configurationSha256 = hash(own(configuration, 'recordSha256', 'Fachkonfiguration'), 'Konfigurationssumme');
  integer(own(configuration, 'revision', 'Fachkonfiguration'), 'Konfigurationsrevision', 1);
  const createdAt = instant(own(configuration, 'createdAt', 'Fachkonfiguration'), 'Konfigurationszeit');

  const report = object(own(root, 'validationReport', 'Fachkonfigurationsaktivierung'), 'Validierungsbericht');
  exact(report, ['reportId', 'tenantId', 'configurationId', 'configurationVersion', 'configurationSha256', 'rulesetVersion', 'rulesetSha256', 'issues', 'evaluatedAt'], 'Validierungsbericht');
  id(own(report, 'reportId', 'Validierungsbericht'), 'Berichtskennung');
  if (id(own(report, 'tenantId', 'Validierungsbericht'), 'Berichtsmandant') !== tenantId ||
      id(own(report, 'configurationId', 'Validierungsbericht'), 'Berichtskonfiguration') !== configurationId ||
      version(own(report, 'configurationVersion', 'Validierungsbericht'), 'Berichtsversion') !== configurationVersion ||
      hash(own(report, 'configurationSha256', 'Validierungsbericht'), 'Berichtskonfigurationssumme') !== configurationSha256) {
    throw Error('Validierungsbericht ist nicht exakt an die Fachkonfiguration gebunden.');
  }
  version(own(report, 'rulesetVersion', 'Validierungsbericht'), 'Regelwerksversion');
  hash(own(report, 'rulesetSha256', 'Validierungsbericht'), 'Regelwerkssumme');
  const reportAt = instant(own(report, 'evaluatedAt', 'Validierungsbericht'), 'Validierungszeit');
  const rawIssues = own(report, 'issues', 'Validierungsbericht');
  if (!Array.isArray(rawIssues) || rawIssues.length === 0) throw Error('Ungueltige Fachkonfiguration benoetigt mindestens einen Fehler.');
  const validationIssueCodes: string[] = [];
  let previousIssueKey = '';
  for (const item of rawIssues) {
    const issue = object(item, 'Validierungsfehler');
    exact(issue, ['code', 'path', 'severity', 'message', 'ruleVersion'], 'Validierungsfehler');
    const issueCode = code(own(issue, 'code', 'Validierungsfehler'), 'Fehlercode');
    const path = own(issue, 'path', 'Validierungsfehler');
    if (typeof path !== 'string' || !PATH.test(path)) throw Error('Fehlerpfad ist ungueltig.');
    if (own(issue, 'severity', 'Validierungsfehler') !== 'error') throw Error('Validierungsbericht darf nur blockierende Fehler belegen.');
    text(own(issue, 'message', 'Validierungsfehler'), 'Fehlermeldung');
    version(own(issue, 'ruleVersion', 'Validierungsfehler'), 'Fehlerregelversion');
    const issueKey = `${issueCode}\u0000${path}`;
    if (previousIssueKey && previousIssueKey >= issueKey) throw Error('Validierungsfehler sind nicht eindeutig und stabil sortiert.');
    previousIssueKey = issueKey;
    validationIssueCodes.push(issueCode);
  }
  if (new Set(validationIssueCodes).size !== validationIssueCodes.length) throw Error('Validierungsfehlercodes enthalten Dubletten.');

  const before = binding(own(root, 'activeBindingBefore', 'Fachkonfigurationsaktivierung'), tenantId, 'Bindung vorher');
  const attempt = object(own(root, 'activationAttempt', 'Fachkonfigurationsaktivierung'), 'Aktivierungsversuch');
  exact(attempt, ['requestId', 'tenantId', 'configurationId', 'configurationVersion', 'configurationSha256', 'validationReportId', 'actorProfileId', 'permissionKey', 'expectedBindingRevision', 'bindingRevision', 'status', 'reasonCodes', 'activatedConfigurationId', 'activatedConfigurationVersion', 'activationCommittedAt', 'policyVersion', 'policySha256', 'requestedAt', 'decidedAt'], 'Aktivierungsversuch');
  id(own(attempt, 'requestId', 'Aktivierungsversuch'), 'Aktivierungsanfrage');
  if (id(own(attempt, 'tenantId', 'Aktivierungsversuch'), 'Aktivierungsmandant') !== tenantId ||
      id(own(attempt, 'configurationId', 'Aktivierungsversuch'), 'Aktivierungskonfiguration') !== configurationId ||
      version(own(attempt, 'configurationVersion', 'Aktivierungsversuch'), 'Aktivierungsversion') !== configurationVersion ||
      hash(own(attempt, 'configurationSha256', 'Aktivierungsversuch'), 'Aktivierungskonfigurationssumme') !== configurationSha256 ||
      id(own(attempt, 'validationReportId', 'Aktivierungsversuch'), 'Aktivierungsbericht') !== id(own(report, 'reportId', 'Validierungsbericht'), 'Berichtskennung')) {
    throw Error('Aktivierungsversuch ist nicht exakt an Konfiguration und Validierungsbericht gebunden.');
  }
  id(own(attempt, 'actorProfileId', 'Aktivierungsversuch'), 'Aktivierungsprofil');
  if (own(attempt, 'permissionKey', 'Aktivierungsversuch') !== 'organization.clinical-configuration.activate') throw Error('Fachkonfigurations-Aktivierungsberechtigung fehlt.');
  const expectedRevision = integer(own(attempt, 'expectedBindingRevision', 'Aktivierungsversuch'), 'Erwartete Bindungsrevision');
  const resultingRevision = integer(own(attempt, 'bindingRevision', 'Aktivierungsversuch'), 'Bindungsrevision');
  if (expectedRevision !== before.revision || resultingRevision !== expectedRevision) throw Error('Abgelehnter Aktivierungsversuch hat die Bindungsrevision veraendert.');
  if (own(attempt, 'status', 'Aktivierungsversuch') !== 'rejected' || own(attempt, 'activatedConfigurationId', 'Aktivierungsversuch') !== null || own(attempt, 'activatedConfigurationVersion', 'Aktivierungsversuch') !== null || own(attempt, 'activationCommittedAt', 'Aktivierungsversuch') !== null) {
    throw Error('Ungueltige Fachkonfiguration wurde nicht fail-closed abgelehnt.');
  }
  const rawReasons = own(attempt, 'reasonCodes', 'Aktivierungsversuch');
  if (!Array.isArray(rawReasons) || rawReasons.some((reason) => typeof reason !== 'string')) throw Error('Ablehnungsgruende fehlen.');
  if (JSON.stringify(rawReasons) !== JSON.stringify(validationIssueCodes)) throw Error('Ablehnungsgruende entsprechen nicht exakt den Validierungsfehlern.');
  version(own(attempt, 'policyVersion', 'Aktivierungsversuch'), 'Aktivierungsrichtlinienversion');
  hash(own(attempt, 'policySha256', 'Aktivierungsversuch'), 'Aktivierungsrichtliniensumme');
  const requestedAt = instant(own(attempt, 'requestedAt', 'Aktivierungsversuch'), 'Aktivierungsanfragezeit');
  const decidedAt = instant(own(attempt, 'decidedAt', 'Aktivierungsversuch'), 'Aktivierungsentscheidungszeit');

  const after = binding(own(root, 'activeBindingAfter', 'Fachkonfigurationsaktivierung'), tenantId, 'Bindung nachher');
  if (before.bindingId !== after.bindingId || before.activeConfigurationId !== after.activeConfigurationId || before.activeConfigurationVersion !== after.activeConfigurationVersion || before.revision !== after.revision || before.recordSha256 !== after.recordSha256) {
    throw Error('Abgelehnte Aktivierung hat die verbindliche Fachkonfigurationsbindung veraendert.');
  }
  if (createdAt.micros > reportAt.micros || reportAt.micros > before.capturedAt.micros || before.capturedAt.micros > requestedAt.micros || requestedAt.micros > decidedAt.micros || decidedAt.micros > after.capturedAt.micros || after.capturedAt.micros > evaluatedAt.micros) {
    throw Error('Fachkonfigurationsaktivierung verletzt die Mikrosekundenfolge.');
  }

  return Object.freeze({
    tenantId,
    configurationId,
    configurationVersion,
    validationIssueCodes: Object.freeze([...validationIssueCodes]),
    bindingRevision: after.revision,
    invalidActivationPrevented: true,
    bindingActivationInferred: false,
    functionalAcceptanceInferred: false,
    careAcceptanceInferred: false,
    designAcceptanceInferred: false,
    legalAcceptanceInferred: false,
  });
}
