export type ImportVerificationEvidence = Readonly<{
  tenantId: string;
  importRunId: string;
  sourceId: string;
  sourceVersion: string;
  sourceSha256: string;
  evaluatedAt: string;
  counts: Readonly<{ sourceTotal: number; imported: number; rejected: number; duplicate: number }>;
  rows: readonly Readonly<{
    sourceRowId: string;
    sourceOrdinal: number;
    sourceRecordType: string;
    sourceContentSha256: string;
    sourceUnitCode: string | null;
    decision: 'imported' | 'rejected' | 'duplicate';
    targetEntityId: string | null;
    targetContentSha256: string | null;
    targetUnitCode: string | null;
    unitMappingRuleVersion: string | null;
    duplicateOfSourceRowId: string | null;
    reasonCode: string | null;
  }>[];
  samples: readonly Readonly<{
    sampleId: string;
    sourceRowId: string;
    decision: 'imported' | 'rejected' | 'duplicate';
    sourceContentSha256: string;
    targetEntityId: string | null;
    targetContentSha256: string | null;
    verifierProfileId: string;
    permissionEvidenceId: string;
    checkedAt: string;
  }>[];
  status: 'counts_and_samples_verified';
  importCompletenessInferred: false;
  semanticEquivalenceInferred: false;
  clinicalValidityInferred: false;
  releaseApprovalInferred: false;
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
  const actual = Object.keys(value), unexpected = actual.filter((key) => !allowed.includes(key));
  if (unexpected.length) throw new Error(`${label} enthaelt nicht erlaubte Felder: ${unexpected.join(', ')}.`);
  const missing = allowed.filter((key) => !actual.includes(key));
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
function nullableId(value: unknown, label: string): string | null { return value === null ? null : id(value, label); }
function hash(value: unknown, label: string): string {
  if (typeof value !== 'string' || !SHA256.test(value)) throw new Error(`${label} ist kein SHA-256-Originalwert.`);
  return value;
}
function nullableHash(value: unknown, label: string): string | null { return value === null ? null : hash(value, label); }
function code(value: unknown, label: string): string {
  if (typeof value !== 'string' || !CODE.test(value)) throw new Error(`${label} ist kein zulassiger technischer Code.`);
  return value;
}
function nullableCode(value: unknown, label: string): string | null { return value === null ? null : code(value, label); }
function count(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new Error(`${label} ist keine nichtnegative ganze Zahl.`);
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
  return { text: value, micros: BigInt(Date.UTC(year, month - 1, day, hour, minute, second) - offset * 60_000) * 1000n + BigInt(fraction.padEnd(6, '0')) };
}
function array(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value) || value.length === 0) throw new Error(`${label} fehlt als nichtleere Originalmenge.`);
  return value;
}

/** Verifies declared import counts and representative content without promoting them to a release or clinical approval. */
export function projectImportVerificationEvidence(input: unknown): ImportVerificationEvidence {
  const root = record(input, 'Importpruefung');
  exactKeys(root, ['tenantId', 'importRunId', 'sourceId', 'sourceVersion', 'sourceSha256', 'evaluatedAt', 'declaredCounts', 'rows', 'samples'], 'Importpruefung');
  const tenantId = id(own(root, 'tenantId', 'Importpruefung'), 'Mandantenkennung');
  const importRunId = id(own(root, 'importRunId', 'Importpruefung'), 'Importlaufkennung');
  const sourceId = id(own(root, 'sourceId', 'Importpruefung'), 'Quellenkennung');
  const sourceVersion = code(own(root, 'sourceVersion', 'Importpruefung'), 'Quellenfassung');
  const sourceSha256 = hash(own(root, 'sourceSha256', 'Importpruefung'), 'Quellensumme');
  const evaluatedAt = instant(own(root, 'evaluatedAt', 'Importpruefung'), 'Auswertungszeit');
  const declared = record(own(root, 'declaredCounts', 'Importpruefung'), 'Deklarierte Mengen');
  exactKeys(declared, ['sourceTotal', 'imported', 'rejected', 'duplicate'], 'Deklarierte Mengen');
  const declaredCounts = Object.freeze({
    sourceTotal: count(own(declared, 'sourceTotal', 'Deklarierte Mengen'), 'Quellgesamtmenge'),
    imported: count(own(declared, 'imported', 'Deklarierte Mengen'), 'Importmenge'),
    rejected: count(own(declared, 'rejected', 'Deklarierte Mengen'), 'Ablehnungsmenge'),
    duplicate: count(own(declared, 'duplicate', 'Deklarierte Mengen'), 'Dublettmenge'),
  });
  const rowIds = new Set<string>(), targetIds = new Set<string>();
  const rows = array(own(root, 'rows', 'Importpruefung'), 'Quellzeilen').map((value, index) => {
    const row = record(value, 'Quellzeile');
    exactKeys(row, ['sourceRowId', 'tenantId', 'importRunId', 'sourceId', 'sourceOrdinal', 'sourceRecordType', 'sourceContentSha256', 'sourceUnitCode', 'decision', 'targetEntityId', 'targetContentSha256', 'targetUnitCode', 'unitMappingRuleVersion', 'duplicateOfSourceRowId', 'reasonCode'], 'Quellzeile');
    if (id(own(row, 'tenantId', 'Quellzeile'), 'Zeilenmandant') !== tenantId
      || id(own(row, 'importRunId', 'Quellzeile'), 'Zeilenimportlauf') !== importRunId
      || id(own(row, 'sourceId', 'Quellzeile'), 'Zeilenquelle') !== sourceId) throw new Error('Quellzeile gehoert zu einem anderen Importumfang.');
    const sourceRowId = id(own(row, 'sourceRowId', 'Quellzeile'), 'Quellzeilenkennung');
    if (rowIds.has(sourceRowId)) throw new Error('Import enthaelt doppelte Quellzeilenkennungen.');
    rowIds.add(sourceRowId);
    const sourceOrdinal = count(own(row, 'sourceOrdinal', 'Quellzeile'), 'Quellreihenfolge');
    if (sourceOrdinal !== index + 1) throw new Error('Quellzeilen sind nicht lueckenlos in Originalreihenfolge.');
    const decision = own(row, 'decision', 'Quellzeile');
    if (!['imported', 'rejected', 'duplicate'].includes(String(decision))) throw new Error('Quellzeile enthaelt keine erlaubte Zuordnungsentscheidung.');
    const targetEntityId = nullableId(own(row, 'targetEntityId', 'Quellzeile'), 'Zielkennung');
    const targetContentSha256 = nullableHash(own(row, 'targetContentSha256', 'Quellzeile'), 'Zielinhaltssumme');
    const sourceUnitCode = nullableCode(own(row, 'sourceUnitCode', 'Quellzeile'), 'Quelleinheit');
    const targetUnitCode = nullableCode(own(row, 'targetUnitCode', 'Quellzeile'), 'Zieleinheit');
    const unitMappingRuleVersion = nullableCode(own(row, 'unitMappingRuleVersion', 'Quellzeile'), 'Einheitenregel');
    const duplicateOfSourceRowId = nullableId(own(row, 'duplicateOfSourceRowId', 'Quellzeile'), 'Dublettenvorgaenger');
    const reasonCode = nullableCode(own(row, 'reasonCode', 'Quellzeile'), 'Entscheidungsgrund');
    if (decision === 'imported') {
      if (!targetEntityId || !targetContentSha256 || duplicateOfSourceRowId || reasonCode
        || ((sourceUnitCode === null) !== (targetUnitCode === null))
        || ((sourceUnitCode === null) !== (unitMappingRuleVersion === null))) throw new Error('Importierte Quellzeile ist nicht vollstaendig zugeordnet.');
      if (targetIds.has(targetEntityId)) throw new Error('Mehrere Quellzeilen verwenden dieselbe Zielkennung.');
      targetIds.add(targetEntityId);
    } else if (decision === 'rejected') {
      if (!reasonCode || targetEntityId || targetContentSha256 || targetUnitCode || unitMappingRuleVersion || duplicateOfSourceRowId) throw new Error('Abgelehnte Quellzeile enthaelt widerspruechliche Ziel- oder Dublettenwerte.');
    } else {
      if (!duplicateOfSourceRowId || !reasonCode || targetEntityId || targetContentSha256 || targetUnitCode || unitMappingRuleVersion) throw new Error('Dublette ist nicht vollstaendig und getrennt belegt.');
      if (!rowIds.has(duplicateOfSourceRowId) || duplicateOfSourceRowId === sourceRowId
        || index === 0) throw new Error('Dublette verweist nicht auf eine fruehere Quellzeile.');
    }
    return Object.freeze({ sourceRowId, sourceOrdinal, sourceRecordType: code(own(row, 'sourceRecordType', 'Quellzeile'), 'Quelldatensatzart'), sourceContentSha256: hash(own(row, 'sourceContentSha256', 'Quellzeile'), 'Quellinhaltssumme'), sourceUnitCode, decision: decision as 'imported' | 'rejected' | 'duplicate', targetEntityId, targetContentSha256, targetUnitCode, unitMappingRuleVersion, duplicateOfSourceRowId, reasonCode });
  });
  const actual = { sourceTotal: rows.length, imported: rows.filter((row) => row.decision === 'imported').length, rejected: rows.filter((row) => row.decision === 'rejected').length, duplicate: rows.filter((row) => row.decision === 'duplicate').length };
  if (Object.keys(actual).some((key) => actual[key as keyof typeof actual] !== declaredCounts[key as keyof typeof declaredCounts])) throw new Error('Deklarierte Importmengen stimmen nicht mit den einzelnen Quellzeilen ueberein.');
  const rowsById = new Map(rows.map((row) => [row.sourceRowId, row]));
  const sampleIds = new Set<string>();
  const samples = array(own(root, 'samples', 'Importpruefung'), 'Repraesentative Stichproben').map((value) => {
    const sample = record(value, 'Stichprobe');
    exactKeys(sample, ['sampleId', 'tenantId', 'importRunId', 'sourceRowId', 'decision', 'sourceContentSha256', 'targetEntityId', 'targetContentSha256', 'verifierProfileId', 'permissionKey', 'permissionEvidenceId', 'checkedAt'], 'Stichprobe');
    if (id(own(sample, 'tenantId', 'Stichprobe'), 'Stichprobenmandant') !== tenantId
      || id(own(sample, 'importRunId', 'Stichprobe'), 'Stichprobenimportlauf') !== importRunId) throw new Error('Stichprobe gehoert zu einem anderen Importumfang.');
    const sampleId = id(own(sample, 'sampleId', 'Stichprobe'), 'Stichprobenkennung');
    if (sampleIds.has(sampleId)) throw new Error('Importpruefung enthaelt doppelte Stichprobenkennungen.');
    sampleIds.add(sampleId);
    const sourceRowId = id(own(sample, 'sourceRowId', 'Stichprobe'), 'Stichprobenquellzeile');
    const row = rowsById.get(sourceRowId);
    const decision = own(sample, 'decision', 'Stichprobe');
    const sourceContentSha256 = hash(own(sample, 'sourceContentSha256', 'Stichprobe'), 'Stichprobenquellsumme');
    const targetEntityId = nullableId(own(sample, 'targetEntityId', 'Stichprobe'), 'Stichprobenziel');
    const targetContentSha256 = nullableHash(own(sample, 'targetContentSha256', 'Stichprobe'), 'Stichprobenzielsumme');
    if (!row || decision !== row.decision || sourceContentSha256 !== row.sourceContentSha256
      || targetEntityId !== row.targetEntityId || targetContentSha256 !== row.targetContentSha256) throw new Error('Stichprobe stimmt nicht exakt mit Quellzeile und Zielzuordnung ueberein.');
    if (own(sample, 'permissionKey', 'Stichprobe') !== 'import.verify') throw new Error('Stichprobe enthaelt keine gebundene Pruefberechtigung.');
    const checkedAt = instant(own(sample, 'checkedAt', 'Stichprobe'), 'Stichprobenpruefzeit');
    if (checkedAt.micros > evaluatedAt.micros) throw new Error('Stichprobe liegt nach der Auswertungszeit.');
    return Object.freeze({ sampleId, sourceRowId, decision: decision as 'imported' | 'rejected' | 'duplicate', sourceContentSha256, targetEntityId, targetContentSha256, verifierProfileId: id(own(sample, 'verifierProfileId', 'Stichprobe'), 'Prueferprofil'), permissionEvidenceId: id(own(sample, 'permissionEvidenceId', 'Stichprobe'), 'Pruefberechtigungsbeleg'), checkedAt: checkedAt.text });
  });
  const represented = new Set(samples.map((sample) => sample.decision));
  if ((['imported', 'rejected', 'duplicate'] as const).some((decision) => actual[decision] > 0 && !represented.has(decision))) throw new Error('Stichproben decken nicht jede vorhandene Zuordnungsentscheidung ab.');
  return Object.freeze({ tenantId, importRunId, sourceId, sourceVersion, sourceSha256, evaluatedAt: evaluatedAt.text, counts: declaredCounts, rows: Object.freeze(rows), samples: Object.freeze(samples), status: 'counts_and_samples_verified', importCompletenessInferred: false, semanticEquivalenceInferred: false, clinicalValidityInferred: false, releaseApprovalInferred: false });
}
