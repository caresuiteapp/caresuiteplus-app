export type CompleteListPerformanceEvidence = Readonly<{
  tenantId: string;
  releaseCandidateId: string;
  buildSha256: string;
  snapshotId: string;
  recordCount: number;
  scenarioCount: number;
  status: 'evidence_incomplete' | 'independent_review_required' | 'evidence_complete';
  reviewedAt: string | null;
  completenessEvidence: true;
  performanceBudgetEvidence: true;
  functionalAcceptanceInferred: false;
  careAcceptanceInferred: false;
  designAcceptanceInferred: false;
  legalAcceptanceInferred: false;
}>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const VERSION = /^[0-9]+(?:\.[0-9]+){1,3}(?:[-+][a-z0-9.-]+)?$/;
const INSTANT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d{1,6})(Z|([+-])(\d{2}):(\d{2}))$/;
const PROFILES = ['wide', 'narrow'] as const;
const KINDS = ['unfiltered', 'search', 'filter'] as const;

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw new Error(`${label} ist kein unveraenderter Originaldatensatz.`);
  return value as Record<string, unknown>;
}
function exact(value: Record<string, unknown>, keys: readonly string[], label: string): void {
  const actual = Object.keys(value), unexpected = actual.filter((key) => !keys.includes(key)), missing = keys.filter((key) => !actual.includes(key));
  if (unexpected.length) throw new Error(`${label} enthaelt nicht erlaubte Felder: ${unexpected.join(', ')}.`);
  if (missing.length) throw new Error(`${label} ist unvollstaendig: ${missing.join(', ')}.`);
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
function hash(value: unknown, label: string): string {
  if (typeof value !== 'string' || !SHA256.test(value)) throw new Error(`${label} ist kein SHA-256-Originalwert.`);
  return value;
}
function positive(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) throw new Error(`${label} ist keine positive ganze Zahl.`);
  return value;
}
function instant(value: unknown, label: string): { text: string; micros: bigint } {
  if (typeof value !== 'string') throw new Error(`${label} ist kein vollstaendiger ISO-Zeitpunkt.`);
  const match = INSTANT.exec(value);
  if (!match) throw new Error(`${label} ist kein vollstaendiger ISO-Zeitpunkt.`);
  const [, y, m, d, h, min, s, fraction, zone, sign, zh, zm] = match;
  const year = Number(y), month = Number(m), day = Number(d), hour = Number(h), minute = Number(min), second = Number(s);
  const zoneHour = Number(zh ?? 0), zoneMinute = Number(zm ?? 0), monthDays = month >= 1 && month <= 12 ? new Date(Date.UTC(year, month, 0)).getUTCDate() : 0;
  if (year < 1 || day < 1 || day > monthDays || hour > 23 || minute > 59 || second > 59 || zoneHour > 23 || zoneMinute > 59) throw new Error(`${label} enthaelt kein gueltiges Kalenderdatum.`);
  const offset = zone === 'Z' ? 0 : (sign === '-' ? -1 : 1) * (zoneHour * 60 + zoneMinute);
  return { text: value, micros: BigInt(Date.UTC(year, month - 1, day, hour, minute, second) - offset * 60_000) * 1000n + BigInt(fraction.padEnd(6, '0')) };
}
function array(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label} ist keine Originalmenge.`);
  return value;
}

/** Validates complete keyset pagination and bound wide/narrow browser budgets for one immutable snapshot. */
export function projectCompleteListPerformanceEvidence(input: unknown): CompleteListPerformanceEvidence {
  const root = record(input, 'Listenleistungsnachweis');
  exact(root, ['tenantId', 'releaseCandidateId', 'buildSha256', 'snapshotId', 'datasetSha256', 'recordIds', 'budgets', 'scenarios', 'measurements', 'review', 'evaluatedAt'], 'Listenleistungsnachweis');
  const tenantId = id(own(root, 'tenantId', 'Listenleistungsnachweis'), 'Mandantenkennung');
  const releaseCandidateId = id(own(root, 'releaseCandidateId', 'Listenleistungsnachweis'), 'Kandidatenkennung');
  const buildSha256 = hash(own(root, 'buildSha256', 'Listenleistungsnachweis'), 'Buildsumme');
  const snapshotId = id(own(root, 'snapshotId', 'Listenleistungsnachweis'), 'Snapshotkennung');
  hash(own(root, 'datasetSha256', 'Listenleistungsnachweis'), 'Datensatzsumme');
  const evaluatedAt = instant(own(root, 'evaluatedAt', 'Listenleistungsnachweis'), 'Auswertungszeit');
  const recordIds = array(own(root, 'recordIds', 'Listenleistungsnachweis'), 'Datensatzkennungen').map((value) => id(value, 'Datensatzkennung'));
  if (!recordIds.length || new Set(recordIds).size !== recordIds.length || recordIds.some((value, index) => index && value <= recordIds[index - 1])) {
    throw new Error('Datensatzkennungen sind nicht eindeutig und strikt aufsteigend.');
  }
  const recordSet = new Set(recordIds);
  const budgets = record(own(root, 'budgets', 'Listenleistungsnachweis'), 'Leistungsbudgets');
  exact(budgets, ['maxPageResponseMs', 'maxInteractiveMs'], 'Leistungsbudgets');
  const maxPageResponseMs = positive(own(budgets, 'maxPageResponseMs', 'Leistungsbudgets'), 'Seitenantwortbudget');
  const maxInteractiveMs = positive(own(budgets, 'maxInteractiveMs', 'Leistungsbudgets'), 'Interaktionsbudget');
  const scenarioIds = new Set<string>(), scenarioKinds = new Set<string>(), scenarioExpected = new Map<string, readonly string[]>(), latestPageMicros: bigint[] = [];
  const scenarios = array(own(root, 'scenarios', 'Listenleistungsnachweis'), 'Szenarien').map((value) => {
    const scenario = record(value, 'Szenario');
    exact(scenario, ['scenarioId', 'tenantId', 'releaseCandidateId', 'buildSha256', 'snapshotId', 'kind', 'criteriaSha256', 'expectedRecordIds', 'pages'], 'Szenario');
    if (id(own(scenario, 'tenantId', 'Szenario'), 'Szenariomandant') !== tenantId
      || id(own(scenario, 'releaseCandidateId', 'Szenario'), 'Szenariokandidat') !== releaseCandidateId
      || hash(own(scenario, 'buildSha256', 'Szenario'), 'Szenariobuildsumme') !== buildSha256
      || id(own(scenario, 'snapshotId', 'Szenario'), 'Szenariosnapshot') !== snapshotId) throw new Error('Szenario ist nicht exakt an Mandant, Kandidat, Build und Snapshot gebunden.');
    const scenarioId = id(own(scenario, 'scenarioId', 'Szenario'), 'Szenariokennung');
    if (scenarioIds.has(scenarioId)) throw new Error('Szenarien enthalten doppelte Kennungen.');
    scenarioIds.add(scenarioId);
    const kind = own(scenario, 'kind', 'Szenario');
    if (typeof kind !== 'string' || !KINDS.includes(kind as typeof KINDS[number]) || scenarioKinds.has(kind)) throw new Error('Szenarioart fehlt oder ist doppelt.');
    scenarioKinds.add(kind);
    hash(own(scenario, 'criteriaSha256', 'Szenario'), 'Kriteriensumme');
    const expected = array(own(scenario, 'expectedRecordIds', 'Szenario'), 'Erwartete Kennungen').map((item) => id(item, 'Erwartete Kennung'));
    if (new Set(expected).size !== expected.length || expected.some((item, index) => !recordSet.has(item) || (index > 0 && item <= expected[index - 1]))) throw new Error('Szenarioerwartung ist nicht eindeutig, sortiert und snapshotgebunden.');
    if (kind === 'unfiltered' && (expected.length !== recordIds.length || expected.some((item, index) => item !== recordIds[index]))) throw new Error('Ungefiltertes Szenario deckt den Snapshot nicht vollstaendig ab.');
    const pages = array(own(scenario, 'pages', 'Szenario'), 'Szenarioseiten');
    if (!pages.length) throw new Error('Szenario besitzt keine Seitenbelege.');
    const collected: string[] = []; let previousCursor: string | null = null;
    pages.forEach((pageValue, pageIndex) => {
      const page = record(pageValue, 'Seitenbeleg');
      exact(page, ['pageId', 'scenarioId', 'index', 'cursorIn', 'cursorOut', 'rowIds', 'responseSha256', 'startedAt', 'completedAt', 'responseMs'], 'Seitenbeleg');
      id(own(page, 'pageId', 'Seitenbeleg'), 'Seitenkennung');
      if (id(own(page, 'scenarioId', 'Seitenbeleg'), 'Seitenszenario') !== scenarioId || own(page, 'index', 'Seitenbeleg') !== pageIndex
        || own(page, 'cursorIn', 'Seitenbeleg') !== previousCursor) throw new Error('Seitenbeleg verletzt Szenario-, Index- oder Cursorfolge.');
      const rows = array(own(page, 'rowIds', 'Seitenbeleg'), 'Seitenzeilen').map((item) => id(item, 'Seitenzeilenkennung'));
      if (!rows.length) throw new Error('Leere Abschlussseite darf keine Vollstaendigkeit vortaeuschen.');
      const expectedSlice = expected.slice(collected.length, collected.length + rows.length);
      if (rows.length !== expectedSlice.length || rows.some((item, index) => item !== expectedSlice[index])) throw new Error('Seitenbeleg enthaelt Luecken, Dubletten oder eine falsche Reihenfolge.');
      collected.push(...rows);
      const cursorOut = own(page, 'cursorOut', 'Seitenbeleg');
      const final = pageIndex === pages.length - 1;
      if ((!final && cursorOut !== rows.at(-1)) || (final && cursorOut !== null)) throw new Error('Seitenbeleg besitzt keinen eindeutigen Fortsetzungs- oder Abschlusscursor.');
      previousCursor = final ? null : String(cursorOut);
      hash(own(page, 'responseSha256', 'Seitenbeleg'), 'Antwortsumme');
      const startedAt = instant(own(page, 'startedAt', 'Seitenbeleg'), 'Seitenstart'), completedAt = instant(own(page, 'completedAt', 'Seitenbeleg'), 'Seitenende');
      const responseMs = positive(own(page, 'responseMs', 'Seitenbeleg'), 'Seitenantwortzeit');
      if (completedAt.micros < startedAt.micros || completedAt.micros > evaluatedAt.micros || responseMs > maxPageResponseMs) throw new Error('Seitenbeleg verletzt Ereignisfolge oder Antwortbudget.');
      latestPageMicros.push(completedAt.micros);
    });
    if (collected.length !== expected.length) throw new Error('Szenarioseiten sind nicht vollstaendig.');
    scenarioExpected.set(scenarioId, Object.freeze(expected));
    return Object.freeze({ scenarioId, kind, expectedRecordIds: Object.freeze(expected) });
  });
  if (scenarioKinds.size !== KINDS.length || KINDS.some((kind) => !scenarioKinds.has(kind))) throw new Error('Ungefiltertes, Such- und Filterszenario muessen gemeinsam vorliegen.');

  const measurementKeys = new Set<string>();
  const measurements = array(own(root, 'measurements', 'Listenleistungsnachweis'), 'Browsermessungen').map((value) => {
    const measurement = record(value, 'Browsermessung');
    exact(measurement, ['measurementId', 'scenarioId', 'tenantId', 'releaseCandidateId', 'buildSha256', 'snapshotId', 'profile', 'browserEngine', 'browserVersion', 'interactiveMs', 'traceSha256', 'screenshotSha256', 'measuredAt', 'recordCount', 'listComplete', 'controlsUsable'], 'Browsermessung');
    const scenarioId = id(own(measurement, 'scenarioId', 'Browsermessung'), 'Messszenario');
    if (!scenarioExpected.has(scenarioId) || id(own(measurement, 'tenantId', 'Browsermessung'), 'Messmandant') !== tenantId
      || id(own(measurement, 'releaseCandidateId', 'Browsermessung'), 'Messkandidat') !== releaseCandidateId
      || hash(own(measurement, 'buildSha256', 'Browsermessung'), 'Messbuildsumme') !== buildSha256
      || id(own(measurement, 'snapshotId', 'Browsermessung'), 'Messsnapshot') !== snapshotId) throw new Error('Browsermessung ist nicht exakt an Szenario, Mandant, Kandidat, Build und Snapshot gebunden.');
    id(own(measurement, 'measurementId', 'Browsermessung'), 'Messkennung');
    const profile = own(measurement, 'profile', 'Browsermessung');
    if (typeof profile !== 'string' || !PROFILES.includes(profile as typeof PROFILES[number])) throw new Error('Browsermessung enthaelt kein erlaubtes Profil.');
    const key = `${scenarioId}:${profile}`;
    if (measurementKeys.has(key)) throw new Error('Browsermessungen enthalten ein doppeltes Szenarioprofil.');
    measurementKeys.add(key);
    const engine = own(measurement, 'browserEngine', 'Browsermessung'), version = own(measurement, 'browserVersion', 'Browsermessung');
    if (!['chromium', 'firefox', 'webkit'].includes(String(engine)) || typeof version !== 'string' || !VERSION.test(version)) throw new Error('Browsermessung enthaelt keine konkrete erlaubte Browserversion.');
    if (positive(own(measurement, 'interactiveMs', 'Browsermessung'), 'Interaktionszeit') > maxInteractiveMs
      || own(measurement, 'recordCount', 'Browsermessung') !== scenarioExpected.get(scenarioId)?.length
      || own(measurement, 'listComplete', 'Browsermessung') !== true || own(measurement, 'controlsUsable', 'Browsermessung') !== true) throw new Error('Browsermessung verletzt Budget, Vollstaendigkeit oder Bedienbarkeit.');
    hash(own(measurement, 'traceSha256', 'Browsermessung'), 'Leistungsspursumme'); hash(own(measurement, 'screenshotSha256', 'Browsermessung'), 'Bildsumme');
    const measuredAt = instant(own(measurement, 'measuredAt', 'Browsermessung'), 'Messzeit');
    if (measuredAt.micros > evaluatedAt.micros) throw new Error('Browsermessung liegt nach der Auswertung.');
    return Object.freeze({ scenarioId, profile });
  });
  const coverage = scenarios.every((scenario) => PROFILES.every((profile) => measurementKeys.has(`${scenario.scenarioId}:${profile}`)));
  const reviewValue = own(root, 'review', 'Listenleistungsnachweis'); let reviewedAt: string | null = null;
  let status: CompleteListPerformanceEvidence['status'] = coverage ? 'independent_review_required' : 'evidence_incomplete';
  if (reviewValue !== null) {
    const review = record(reviewValue, 'Leistungspruefung');
    exact(review, ['reviewId', 'tenantId', 'releaseCandidateId', 'buildSha256', 'snapshotId', 'reviewerProfileId', 'permissionKey', 'permissionEvidenceId', 'reviewedAt', 'decision', 'measurementCount'], 'Leistungspruefung');
    if (id(own(review, 'tenantId', 'Leistungspruefung'), 'Pruefmandant') !== tenantId || id(own(review, 'releaseCandidateId', 'Leistungspruefung'), 'Pruefkandidat') !== releaseCandidateId
      || hash(own(review, 'buildSha256', 'Leistungspruefung'), 'Pruefbuildsumme') !== buildSha256 || id(own(review, 'snapshotId', 'Leistungspruefung'), 'Pruefsnapshot') !== snapshotId
      || own(review, 'permissionKey', 'Leistungspruefung') !== 'performance.browser.review' || own(review, 'measurementCount', 'Leistungspruefung') !== measurements.length) throw new Error('Leistungspruefung ist nicht exakt an Nachweise und Berechtigung gebunden.');
    id(own(review, 'reviewId', 'Leistungspruefung'), 'Pruefkennung'); id(own(review, 'reviewerProfileId', 'Leistungspruefung'), 'Prueferprofil'); id(own(review, 'permissionEvidenceId', 'Leistungspruefung'), 'Pruefberechtigungsbeleg');
    const reviewAt = instant(own(review, 'reviewedAt', 'Leistungspruefung'), 'Pruefzeit');
    if (reviewAt.micros > evaluatedAt.micros || latestPageMicros.some((value) => value > reviewAt.micros)) throw new Error('Leistungspruefung liegt ausserhalb der kausalen Ereignisfolge.');
    reviewedAt = reviewAt.text; const decision = own(review, 'decision', 'Leistungspruefung');
    if (decision !== 'approved' && decision !== 'rejected') throw new Error('Leistungspruefung enthaelt keine erlaubte Entscheidung.');
    if (decision === 'approved' && !coverage) throw new Error('Unvollstaendige Browsermessungen koennen nicht freigegeben werden.');
    status = decision === 'approved' ? 'evidence_complete' : 'independent_review_required';
  }
  return Object.freeze({ tenantId, releaseCandidateId, buildSha256, snapshotId, recordCount: recordIds.length, scenarioCount: scenarios.length,
    status, reviewedAt, completenessEvidence: true, performanceBudgetEvidence: true, functionalAcceptanceInferred: false,
    careAcceptanceInferred: false, designAcceptanceInferred: false, legalAcceptanceInferred: false });
}
