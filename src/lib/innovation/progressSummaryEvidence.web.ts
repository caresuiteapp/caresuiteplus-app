export type ProgressSummaryEvidence = Readonly<{
  tenantId: string;
  clientId: string;
  releaseCandidateId: string;
  summaryId: string;
  status: 'awaiting_professional_review' | 'professionally_rejected' | 'professionally_confirmed';
  confirmedDataCount: number;
  missingDataCount: number;
  statementCount: number;
  reviewId: string | null;
  clinicalTrendInferred: false;
  carePerformanceInferred: false;
  taskCompletionInferred: false;
  functionalAcceptanceInferred: false;
  careAcceptanceInferred: false;
  designAcceptanceInferred: false;
  legalAcceptanceInferred: false;
}>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const VERSION = /^[0-9]+(?:\.[0-9]+){1,3}(?:[-+][a-z0-9.-]+)?$/;
const INSTANT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d{1,6})(Z|([+-])(\d{2}):(\d{2}))$/;

type Instant = Readonly<{ text: string; micros: bigint }>;
type Requirement = Readonly<{ fieldCode: string; unitCode: string }>;
type Source = Readonly<{ sourceRecordId: string; sourceSha256: string; recordedAt: Instant }>;
type Datum = Readonly<{ requirementId: string; sourceId: string; unitCode: string }>;

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    throw new Error(`${label} ist kein unveraenderter Originaldatensatz.`);
  }
  return value as Record<string, unknown>;
}
function exact(value: Record<string, unknown>, keys: readonly string[], label: string): void {
  const actual = Object.keys(value);
  const extra = actual.filter((key) => !keys.includes(key));
  const missing = keys.filter((key) => !actual.includes(key));
  if (extra.length) throw new Error(`${label} enthaelt nicht erlaubte Felder: ${extra.join(', ')}.`);
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
function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} fehlt.`);
  return value;
}
function list(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label} ist keine Originalmenge.`);
  return value;
}
function instant(value: unknown, label: string): Instant {
  if (typeof value !== 'string') throw new Error(`${label} ist kein vollstaendiger ISO-Zeitpunkt.`);
  const match = INSTANT.exec(value);
  if (!match) throw new Error(`${label} ist kein vollstaendiger ISO-Zeitpunkt.`);
  const [, year, month, day, hour, minute, second, fraction, zone, sign, zoneHour, zoneMinute] = match;
  const Y = +year, M = +month, D = +day, H = +hour, Min = +minute, S = +second;
  const ZH = +(zoneHour ?? 0), ZM = +(zoneMinute ?? 0);
  const days = M >= 1 && M <= 12 ? new Date(Date.UTC(Y, M, 0)).getUTCDate() : 0;
  if (Y < 1 || D < 1 || D > days || H > 23 || Min > 59 || S > 59 || ZH > 23 || ZM > 59) {
    throw new Error(`${label} enthaelt kein gueltiges Kalenderdatum.`);
  }
  const offset = zone === 'Z' ? 0 : (sign === '-' ? -1 : 1) * (ZH * 60 + ZM);
  return Object.freeze({
    text: value,
    micros: BigInt(Date.UTC(Y, M - 1, D, H, Min, S) - offset * 60000) * 1000n + BigInt(fraction.padEnd(6, '0')),
  });
}
function uniqueIds(value: unknown, label: string): string[] {
  const values = list(value, label).map((entry) => id(entry, `${label}kennung`));
  if (new Set(values).size !== values.length) throw new Error(`${label} enthaelt doppelte Kennungen.`);
  return values;
}

/**
 * Validates an evidence-linked progress summary. The projection stays inert and
 * explicitly distinguishes confirmed source data from required but missing data.
 */
export function projectProgressSummaryEvidence(input: unknown): ProgressSummaryEvidence {
  const root = object(input, 'Verlaufsuebersicht');
  exact(root, ['tenantId', 'clientId', 'releaseCandidateId', 'buildSha256', 'snapshot', 'requirements', 'sources', 'confirmedData', 'summary', 'review', 'evaluatedAt'], 'Verlaufsuebersicht');
  const tenantId = id(own(root, 'tenantId', 'Verlaufsuebersicht'), 'Mandantenkennung');
  const clientId = id(own(root, 'clientId', 'Verlaufsuebersicht'), 'Pflegefallkennung');
  const releaseCandidateId = id(own(root, 'releaseCandidateId', 'Verlaufsuebersicht'), 'Kandidatenkennung');
  const buildSha256 = hash(own(root, 'buildSha256', 'Verlaufsuebersicht'), 'Buildsumme');
  const evaluatedAt = instant(own(root, 'evaluatedAt', 'Verlaufsuebersicht'), 'Auswertungszeit');

  const snapshot = object(own(root, 'snapshot', 'Verlaufsuebersicht'), 'Verlaufssnapshot');
  exact(snapshot, ['snapshotId', 'tenantId', 'clientId', 'releaseCandidateId', 'buildSha256', 'snapshotSha256', 'requirementCount', 'capturedAt'], 'Verlaufssnapshot');
  const snapshotId = id(own(snapshot, 'snapshotId', 'Verlaufssnapshot'), 'Snapshotkennung');
  if (id(own(snapshot, 'tenantId', 'Verlaufssnapshot'), 'Snapshotmandant') !== tenantId
    || id(own(snapshot, 'clientId', 'Verlaufssnapshot'), 'Snapshotpflegefall') !== clientId
    || id(own(snapshot, 'releaseCandidateId', 'Verlaufssnapshot'), 'Snapshotkandidat') !== releaseCandidateId
    || hash(own(snapshot, 'buildSha256', 'Verlaufssnapshot'), 'Snapshotbuild') !== buildSha256) {
    throw new Error('Verlaufssnapshot ist nicht exakt an Mandant, Pflegefall, Kandidat und Build gebunden.');
  }
  const snapshotSha256 = hash(own(snapshot, 'snapshotSha256', 'Verlaufssnapshot'), 'Snapshotsumme');
  const capturedAt = instant(own(snapshot, 'capturedAt', 'Verlaufssnapshot'), 'Snapshotzeit');
  if (capturedAt.micros > evaluatedAt.micros) throw new Error('Verlaufssnapshot liegt nach der Auswertung.');

  const requirements = new Map<string, Requirement>();
  for (const value of list(own(root, 'requirements', 'Verlaufsuebersicht'), 'Datenanforderungen')) {
    const requirement = object(value, 'Datenanforderung');
    exact(requirement, ['requirementId', 'fieldCode', 'unitCode'], 'Datenanforderung');
    const requirementId = id(own(requirement, 'requirementId', 'Datenanforderung'), 'Anforderungskennung');
    if (requirements.has(requirementId)) throw new Error('Datenanforderung ist doppelt.');
    requirements.set(requirementId, Object.freeze({
      fieldCode: text(own(requirement, 'fieldCode', 'Datenanforderung'), 'Feldcode'),
      unitCode: text(own(requirement, 'unitCode', 'Datenanforderung'), 'Einheitencode'),
    }));
  }
  if (!requirements.size || own(snapshot, 'requirementCount', 'Verlaufssnapshot') !== requirements.size) {
    throw new Error('Snapshot-Anforderungssumme stimmt nicht mit dem vollstaendigen Bestand ueberein.');
  }

  const sources = new Map<string, Source>();
  for (const value of list(own(root, 'sources', 'Verlaufsuebersicht'), 'Quellen')) {
    const source = object(value, 'Quelle');
    exact(source, ['sourceId', 'tenantId', 'clientId', 'sourceRecordId', 'sourceType', 'sourceVersion', 'sourceSha256', 'recordedAt'], 'Quelle');
    const sourceId = id(own(source, 'sourceId', 'Quelle'), 'Quellenkennung');
    if (sources.has(sourceId)) throw new Error('Quelle ist doppelt.');
    if (id(own(source, 'tenantId', 'Quelle'), 'Quellenmandant') !== tenantId || id(own(source, 'clientId', 'Quelle'), 'Quellenpflegefall') !== clientId) {
      throw new Error('Quelle gehoert nicht zu Mandant und Pflegefall.');
    }
    const recordedAt = instant(own(source, 'recordedAt', 'Quelle'), 'Quellzeit');
    if (recordedAt.micros > capturedAt.micros) throw new Error('Quelle verletzt den Snapshot-Zeitbezug.');
    sources.set(sourceId, Object.freeze({
      sourceRecordId: id(own(source, 'sourceRecordId', 'Quelle'), 'Quellensatzkennung'),
      sourceSha256: hash(own(source, 'sourceSha256', 'Quelle'), 'Quellensumme'),
      recordedAt,
    }));
    text(own(source, 'sourceType', 'Quelle'), 'Quellentyp');
    if (typeof own(source, 'sourceVersion', 'Quelle') !== 'string' || !VERSION.test(own(source, 'sourceVersion', 'Quelle') as string)) {
      throw new Error('Quellenfassung ist nicht exakt versioniert.');
    }
  }

  const data = new Map<string, Datum>();
  const coveredRequirements = new Set<string>();
  for (const value of list(own(root, 'confirmedData', 'Verlaufsuebersicht'), 'Bestaetigte Daten')) {
    const datum = object(value, 'Bestaetigter Datenpunkt');
    exact(datum, ['dataPointId', 'requirementId', 'sourceId', 'sourceRecordId', 'sourceSha256', 'fieldCode', 'value', 'unitCode', 'observedAt', 'confirmedAt', 'confirmedByProfileId', 'permissionKey', 'permissionEvidenceId'], 'Bestaetigter Datenpunkt');
    const dataPointId = id(own(datum, 'dataPointId', 'Bestaetigter Datenpunkt'), 'Datenpunktkennung');
    if (data.has(dataPointId)) throw new Error('Bestaetigter Datenpunkt ist doppelt.');
    const requirementId = id(own(datum, 'requirementId', 'Bestaetigter Datenpunkt'), 'Anforderungsbezug');
    const requirement = requirements.get(requirementId);
    if (!requirement || coveredRequirements.has(requirementId)) throw new Error('Bestaetigter Datenpunkt besitzt eine fremde oder doppelt belegte Anforderung.');
    const sourceId = id(own(datum, 'sourceId', 'Bestaetigter Datenpunkt'), 'Quellenbezug');
    const source = sources.get(sourceId);
    if (!source || id(own(datum, 'sourceRecordId', 'Bestaetigter Datenpunkt'), 'Quellensatzbezug') !== source.sourceRecordId
      || hash(own(datum, 'sourceSha256', 'Bestaetigter Datenpunkt'), 'Datenpunktquellensumme') !== source.sourceSha256) {
      throw new Error('Bestaetigter Datenpunkt ist nicht exakt an seine Quelle gebunden.');
    }
    const valueField = own(datum, 'value', 'Bestaetigter Datenpunkt');
    if ((typeof valueField !== 'number' || !Number.isFinite(valueField)) && (typeof valueField !== 'string' || !valueField.trim())) {
      throw new Error('Bestaetigter Datenpunkt besitzt keinen unveraenderten Wert.');
    }
    const fieldCode = text(own(datum, 'fieldCode', 'Bestaetigter Datenpunkt'), 'Datenfeldcode');
    const unitCode = text(own(datum, 'unitCode', 'Bestaetigter Datenpunkt'), 'Datenpunkteinheit');
    if (fieldCode !== requirement.fieldCode || unitCode !== requirement.unitCode) throw new Error('Datenfeld oder Einheit weicht von der Anforderung ab.');
    const observedAt = instant(own(datum, 'observedAt', 'Bestaetigter Datenpunkt'), 'Beobachtungszeit');
    const confirmedAt = instant(own(datum, 'confirmedAt', 'Bestaetigter Datenpunkt'), 'Bestaetigungszeit');
    if (observedAt.text !== source.recordedAt.text || observedAt.micros > confirmedAt.micros || confirmedAt.micros > capturedAt.micros) {
      throw new Error('Bestaetigter Datenpunkt verletzt den originalen Zeitbezug oder die Mikrosekundenfolge.');
    }
    id(own(datum, 'confirmedByProfileId', 'Bestaetigter Datenpunkt'), 'Bestaetigerprofil');
    if (own(datum, 'permissionKey', 'Bestaetigter Datenpunkt') !== 'pflege.progress.confirm') throw new Error('Bestaetigungsberechtigung fehlt.');
    id(own(datum, 'permissionEvidenceId', 'Bestaetigter Datenpunkt'), 'Bestaetigungsberechtigungsbeleg');
    data.set(dataPointId, Object.freeze({ requirementId, sourceId, unitCode }));
    coveredRequirements.add(requirementId);
  }

  const summary = object(own(root, 'summary', 'Verlaufsuebersicht'), 'Zusammenfassung');
  exact(summary, ['summaryId', 'snapshotId', 'snapshotSha256', 'modelId', 'modelVersion', 'statements', 'missingData', 'summarySha256', 'createdAt', 'clinicalTrendAsserted', 'carePerformanceAsserted', 'taskCompletionAsserted'], 'Zusammenfassung');
  const summaryId = id(own(summary, 'summaryId', 'Zusammenfassung'), 'Zusammenfassungskennung');
  if (id(own(summary, 'snapshotId', 'Zusammenfassung'), 'Zusammenfassungssnapshot') !== snapshotId
    || hash(own(summary, 'snapshotSha256', 'Zusammenfassung'), 'Zusammenfassungssnapshotsumme') !== snapshotSha256) {
    throw new Error('Zusammenfassung ist nicht exakt an den Verlaufssnapshot gebunden.');
  }
  text(own(summary, 'modelId', 'Zusammenfassung'), 'Zusammenfassungsmodell');
  if (typeof own(summary, 'modelVersion', 'Zusammenfassung') !== 'string' || !VERSION.test(own(summary, 'modelVersion', 'Zusammenfassung') as string)) {
    throw new Error('Modellfassung ist nicht exakt versioniert.');
  }
  if (own(summary, 'clinicalTrendAsserted', 'Zusammenfassung') !== false
    || own(summary, 'carePerformanceAsserted', 'Zusammenfassung') !== false
    || own(summary, 'taskCompletionAsserted', 'Zusammenfassung') !== false) {
    throw new Error('Zusammenfassung darf keinen klinischen Trend, keine Pflegehandlung und keine Erledigung behaupten.');
  }
  const createdAt = instant(own(summary, 'createdAt', 'Zusammenfassung'), 'Zusammenfassungszeit');
  if (createdAt.micros < capturedAt.micros || createdAt.micros > evaluatedAt.micros) throw new Error('Zusammenfassung verletzt die Mikrosekundenfolge.');
  const summarySha256 = hash(own(summary, 'summarySha256', 'Zusammenfassung'), 'Zusammenfassungssumme');

  const linkedData = new Set<string>();
  const statements = list(own(summary, 'statements', 'Zusammenfassung'), 'Aussagen');
  for (const value of statements) {
    const statement = object(value, 'Aussage');
    exact(statement, ['statementId', 'text', 'dataPointIds', 'sourceIds', 'unitCodes'], 'Aussage');
    id(own(statement, 'statementId', 'Aussage'), 'Aussagenkennung');
    text(own(statement, 'text', 'Aussage'), 'Aussagentext');
    const dataPointIds = uniqueIds(own(statement, 'dataPointIds', 'Aussage'), 'Datenpunktbezuege');
    if (!dataPointIds.length) throw new Error('Aussage besitzt keinen konkreten Datenbeleg.');
    const expectedSources = new Set<string>();
    const expectedUnits = new Set<string>();
    for (const dataPointId of dataPointIds) {
      const datum = data.get(dataPointId);
      if (!datum) throw new Error('Aussage verweist auf einen fremden Datenpunkt.');
      linkedData.add(dataPointId);
      expectedSources.add(datum.sourceId);
      expectedUnits.add(datum.unitCode);
    }
    const sourceIds = uniqueIds(own(statement, 'sourceIds', 'Aussage'), 'Quellenbezuege');
    const unitCodes = list(own(statement, 'unitCodes', 'Aussage'), 'Einheitenbezuege').map((entry) => text(entry, 'Einheitenbezug'));
    if (new Set(unitCodes).size !== unitCodes.length
      || sourceIds.length !== expectedSources.size || sourceIds.some((entry) => !expectedSources.has(entry))
      || unitCodes.length !== expectedUnits.size || unitCodes.some((entry) => !expectedUnits.has(entry))) {
      throw new Error('Aussage verlinkt Quellen oder Einheiten nicht vollstaendig und exakt.');
    }
  }
  if (linkedData.size !== data.size) throw new Error('Zusammenfassung verschluckt bestaetigte Datenpunkte.');

  const missingRequirements = new Set<string>();
  for (const value of list(own(summary, 'missingData', 'Zusammenfassung'), 'Fehlende Daten')) {
    const missing = object(value, 'Fehlender Datenpunkt');
    exact(missing, ['requirementId', 'fieldCode', 'unitCode', 'reason', 'detectedAt'], 'Fehlender Datenpunkt');
    const requirementId = id(own(missing, 'requirementId', 'Fehlender Datenpunkt'), 'Fehlende Anforderungskennung');
    const requirement = requirements.get(requirementId);
    if (!requirement || coveredRequirements.has(requirementId) || missingRequirements.has(requirementId)) {
      throw new Error('Fehlender Datenpunkt ist fremd, bereits bestaetigt oder doppelt markiert.');
    }
    if (text(own(missing, 'fieldCode', 'Fehlender Datenpunkt'), 'Fehlender Feldcode') !== requirement.fieldCode
      || text(own(missing, 'unitCode', 'Fehlender Datenpunkt'), 'Fehlende Einheit') !== requirement.unitCode) {
      throw new Error('Fehlender Datenpunkt bewahrt Feld und Einheit nicht exakt.');
    }
    text(own(missing, 'reason', 'Fehlender Datenpunkt'), 'Fehlgrund');
    const detectedAt = instant(own(missing, 'detectedAt', 'Fehlender Datenpunkt'), 'Fehlfeststellungszeit');
    if (detectedAt.micros < capturedAt.micros || detectedAt.micros > createdAt.micros) throw new Error('Fehlmarkierung verletzt die Mikrosekundenfolge.');
    missingRequirements.add(requirementId);
  }
  if (coveredRequirements.size + missingRequirements.size !== requirements.size) {
    throw new Error('Zusammenfassung markiert nicht jede unbelegte Datenanforderung als fehlend.');
  }

  let status: ProgressSummaryEvidence['status'] = 'awaiting_professional_review';
  let reviewId: string | null = null;
  const reviewValue = own(root, 'review', 'Verlaufsuebersicht');
  if (reviewValue !== null) {
    const review = object(reviewValue, 'Fachpruefung');
    exact(review, ['reviewId', 'summaryId', 'summarySha256', 'reviewerProfileId', 'permissionKey', 'permissionEvidenceId', 'decision', 'rationale', 'reviewedAt'], 'Fachpruefung');
    reviewId = id(own(review, 'reviewId', 'Fachpruefung'), 'Pruefkennung');
    if (id(own(review, 'summaryId', 'Fachpruefung'), 'Pruefzusammenfassung') !== summaryId
      || hash(own(review, 'summarySha256', 'Fachpruefung'), 'Pruefsumme') !== summarySha256
      || own(review, 'permissionKey', 'Fachpruefung') !== 'pflege.progress.review') {
      throw new Error('Fachpruefung ist nicht exakt an Zusammenfassung und Berechtigung gebunden.');
    }
    id(own(review, 'reviewerProfileId', 'Fachpruefung'), 'Prueferprofil');
    id(own(review, 'permissionEvidenceId', 'Fachpruefung'), 'Pruefberechtigungsbeleg');
    text(own(review, 'rationale', 'Fachpruefung'), 'Pruefbegruendung');
    const decision = own(review, 'decision', 'Fachpruefung');
    if (decision !== 'confirmed' && decision !== 'rejected') throw new Error('Fachpruefung besitzt keine erlaubte Entscheidung.');
    const reviewedAt = instant(own(review, 'reviewedAt', 'Fachpruefung'), 'Pruefzeit');
    if (reviewedAt.micros < createdAt.micros || reviewedAt.micros > evaluatedAt.micros) throw new Error('Fachpruefung verletzt die Mikrosekundenfolge.');
    status = decision === 'confirmed' ? 'professionally_confirmed' : 'professionally_rejected';
  }

  return Object.freeze({
    tenantId,
    clientId,
    releaseCandidateId,
    summaryId,
    status,
    confirmedDataCount: data.size,
    missingDataCount: missingRequirements.size,
    statementCount: statements.length,
    reviewId,
    clinicalTrendInferred: false,
    carePerformanceInferred: false,
    taskCompletionInferred: false,
    functionalAcceptanceInferred: false,
    careAcceptanceInferred: false,
    designAcceptanceInferred: false,
    legalAcceptanceInferred: false,
  });
}
