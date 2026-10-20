export type BackupRecoveryEvidence = Readonly<{
  tenantId: string;
  backupId: string;
  sourceSystemId: string;
  backupFormatVersion: string;
  snapshotAt: string;
  createdAt: string;
  archiveSha256: string;
  manifestSha256: string;
  storage: Readonly<{
    objectId: string;
    locationCode: string;
    encryptionKeyVersion: string;
    accessEvidenceId: string;
    accessProfileId: string;
    verifiedAt: string;
  }>;
  contents: readonly Readonly<{
    contentId: string;
    entityType: string;
    sourceVersion: string;
    recordCount: number;
    contentSha256: string;
  }>[];
  restoreDrill: Readonly<{
    drillId: string;
    targetEnvironmentId: string;
    startedAt: string;
    completedAt: string;
    outcome: 'succeeded' | 'failed';
    verifierProfileId: string;
    permissionEvidenceId: string;
    reportSha256: string;
    restoredContents: readonly Readonly<{
      contentId: string;
      recordCount: number;
      contentSha256: string;
    }>[];
  }> | null;
  evaluatedAt: string;
  status: 'backup_exists_unverified' | 'restoration_failed' | 'restoration_verified';
  backupVerified: boolean;
  productionRecoveryReadinessInferred: false;
  legalRetentionComplianceInferred: false;
  clinicalCompletenessInferred: false;
  sourceDeletionInferred: false;
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
function hash(value: unknown, label: string): string {
  if (typeof value !== 'string' || !SHA256.test(value)) throw new Error(`${label} ist kein SHA-256-Originalwert.`);
  return value;
}
function code(value: unknown, label: string): string {
  if (typeof value !== 'string' || !CODE.test(value)) throw new Error(`${label} ist kein zulaessiger technischer Code.`);
  return value;
}
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
function nonEmptyArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value) || value.length === 0) throw new Error(`${label} fehlt als nichtleere Originalmenge.`);
  return value;
}
function array(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label} ist keine Originalmenge.`);
  return value;
}

/** Binds one backup to a real isolated restore drill without inferring production, legal, or clinical approval. */
export function projectBackupRecoveryEvidence(input: unknown): BackupRecoveryEvidence {
  const root = record(input, 'Sicherungsnachweis');
  exactKeys(root, [
    'tenantId', 'backupId', 'sourceSystemId', 'backupFormatVersion', 'snapshotAt', 'createdAt',
    'archiveSha256', 'manifestSha256', 'creatorProfileId', 'creatorPermissionKey',
    'creatorPermissionEvidenceId', 'storage', 'contents', 'restoreDrill', 'evaluatedAt',
  ], 'Sicherungsnachweis');
  const tenantId = id(own(root, 'tenantId', 'Sicherungsnachweis'), 'Mandantenkennung');
  const backupId = id(own(root, 'backupId', 'Sicherungsnachweis'), 'Sicherungskennung');
  const sourceSystemId = id(own(root, 'sourceSystemId', 'Sicherungsnachweis'), 'Quellsystemkennung');
  const backupFormatVersion = code(own(root, 'backupFormatVersion', 'Sicherungsnachweis'), 'Sicherungsformatfassung');
  const snapshotAt = instant(own(root, 'snapshotAt', 'Sicherungsnachweis'), 'Sicherungsstand');
  const createdAt = instant(own(root, 'createdAt', 'Sicherungsnachweis'), 'Sicherungserstellung');
  const evaluatedAt = instant(own(root, 'evaluatedAt', 'Sicherungsnachweis'), 'Auswertungszeit');
  if (createdAt.micros < snapshotAt.micros || evaluatedAt.micros < createdAt.micros) {
    throw new Error('Sicherungsstand, Erstellung und Auswertung sind nicht kausal geordnet.');
  }
  const archiveSha256 = hash(own(root, 'archiveSha256', 'Sicherungsnachweis'), 'Archivsumme');
  const manifestSha256 = hash(own(root, 'manifestSha256', 'Sicherungsnachweis'), 'Manifestsumme');
  id(own(root, 'creatorProfileId', 'Sicherungsnachweis'), 'Erstellerprofil');
  if (own(root, 'creatorPermissionKey', 'Sicherungsnachweis') !== 'backup.create') {
    throw new Error('Sicherung enthaelt keine gebundene Erstellberechtigung.');
  }
  id(own(root, 'creatorPermissionEvidenceId', 'Sicherungsnachweis'), 'Erstellberechtigungsbeleg');

  const storageInput = record(own(root, 'storage', 'Sicherungsnachweis'), 'Speicherbeleg');
  exactKeys(storageInput, [
    'tenantId', 'backupId', 'objectId', 'locationCode', 'encryptionKeyVersion', 'archiveSha256',
    'manifestSha256', 'accessEvidenceId', 'accessProfileId', 'permissionKey', 'verifiedAt',
  ], 'Speicherbeleg');
  if (id(own(storageInput, 'tenantId', 'Speicherbeleg'), 'Speichermandant') !== tenantId
    || id(own(storageInput, 'backupId', 'Speicherbeleg'), 'Speichersicherung') !== backupId
    || hash(own(storageInput, 'archiveSha256', 'Speicherbeleg'), 'Speicherarchivsumme') !== archiveSha256
    || hash(own(storageInput, 'manifestSha256', 'Speicherbeleg'), 'Speichermanifestsumme') !== manifestSha256) {
    throw new Error('Speicherbeleg ist nicht exakt an Sicherung und Summen gebunden.');
  }
  if (own(storageInput, 'permissionKey', 'Speicherbeleg') !== 'backup.storage.read') {
    throw new Error('Speicherbeleg enthaelt keine gebundene Leseberechtigung.');
  }
  const storageVerifiedAt = instant(own(storageInput, 'verifiedAt', 'Speicherbeleg'), 'Speicherpruefzeit');
  if (storageVerifiedAt.micros < createdAt.micros || storageVerifiedAt.micros > evaluatedAt.micros) {
    throw new Error('Speicherpruefung liegt ausserhalb der Sicherungsfolge.');
  }
  const storage = Object.freeze({
    objectId: id(own(storageInput, 'objectId', 'Speicherbeleg'), 'Speicherobjektkennung'),
    locationCode: code(own(storageInput, 'locationCode', 'Speicherbeleg'), 'Speicherort'),
    encryptionKeyVersion: code(own(storageInput, 'encryptionKeyVersion', 'Speicherbeleg'), 'Verschluesselungsschluesselfassung'),
    accessEvidenceId: id(own(storageInput, 'accessEvidenceId', 'Speicherbeleg'), 'Zugriffsbelegkennung'),
    accessProfileId: id(own(storageInput, 'accessProfileId', 'Speicherbeleg'), 'Zugriffsprofil'),
    verifiedAt: storageVerifiedAt.text,
  });

  const contentIds = new Set<string>();
  const contents = nonEmptyArray(own(root, 'contents', 'Sicherungsnachweis'), 'Sicherungsumfang').map((value) => {
    const item = record(value, 'Sicherungsinhalt');
    exactKeys(item, ['contentId', 'tenantId', 'backupId', 'entityType', 'sourceVersion', 'recordCount', 'contentSha256'], 'Sicherungsinhalt');
    if (id(own(item, 'tenantId', 'Sicherungsinhalt'), 'Inhaltsmandant') !== tenantId
      || id(own(item, 'backupId', 'Sicherungsinhalt'), 'Inhaltssicherung') !== backupId) {
      throw new Error('Sicherungsinhalt gehoert zu einem anderen Sicherungsumfang.');
    }
    const contentId = id(own(item, 'contentId', 'Sicherungsinhalt'), 'Inhaltskennung');
    if (contentIds.has(contentId)) throw new Error('Sicherungsmanifest enthaelt doppelte Inhaltskennungen.');
    contentIds.add(contentId);
    return Object.freeze({
      contentId,
      entityType: code(own(item, 'entityType', 'Sicherungsinhalt'), 'Entitaetsart'),
      sourceVersion: code(own(item, 'sourceVersion', 'Sicherungsinhalt'), 'Quellfassung'),
      recordCount: count(own(item, 'recordCount', 'Sicherungsinhalt'), 'Datensatzmenge'),
      contentSha256: hash(own(item, 'contentSha256', 'Sicherungsinhalt'), 'Inhaltssumme'),
    });
  });
  const contentsById = new Map(contents.map((item) => [item.contentId, item]));

  const drillValue = own(root, 'restoreDrill', 'Sicherungsnachweis');
  let restoreDrill: BackupRecoveryEvidence['restoreDrill'] = null;
  let status: BackupRecoveryEvidence['status'] = 'backup_exists_unverified';
  if (drillValue !== null) {
    const drill = record(drillValue, 'Wiederherstellungsprobe');
    exactKeys(drill, [
      'drillId', 'tenantId', 'backupId', 'sourceSystemId', 'targetEnvironmentId', 'targetEnvironmentKind',
      'recoveryPointAt', 'startedAt', 'completedAt', 'outcome', 'archiveSha256', 'manifestSha256',
      'restoredContents', 'verifierProfileId', 'permissionKey', 'permissionEvidenceId', 'reportSha256',
    ], 'Wiederherstellungsprobe');
    const targetEnvironmentId = id(own(drill, 'targetEnvironmentId', 'Wiederherstellungsprobe'), 'Wiederherstellungsziel');
    if (id(own(drill, 'tenantId', 'Wiederherstellungsprobe'), 'Probenmandant') !== tenantId
      || id(own(drill, 'backupId', 'Wiederherstellungsprobe'), 'Probensicherung') !== backupId
      || id(own(drill, 'sourceSystemId', 'Wiederherstellungsprobe'), 'Probenquellsystem') !== sourceSystemId
      || targetEnvironmentId === sourceSystemId
      || own(drill, 'targetEnvironmentKind', 'Wiederherstellungsprobe') !== 'isolated_validation'
      || own(drill, 'recoveryPointAt', 'Wiederherstellungsprobe') !== snapshotAt.text
      || hash(own(drill, 'archiveSha256', 'Wiederherstellungsprobe'), 'Probenarchivsumme') !== archiveSha256
      || hash(own(drill, 'manifestSha256', 'Wiederherstellungsprobe'), 'Probenmanifestsumme') !== manifestSha256) {
      throw new Error('Wiederherstellungsprobe ist nicht exakt und isoliert an die Sicherung gebunden.');
    }
    if (own(drill, 'permissionKey', 'Wiederherstellungsprobe') !== 'backup.restore.verify') {
      throw new Error('Wiederherstellungsprobe enthaelt keine gebundene Pruefberechtigung.');
    }
    const startedAt = instant(own(drill, 'startedAt', 'Wiederherstellungsprobe'), 'Probenbeginn');
    const completedAt = instant(own(drill, 'completedAt', 'Wiederherstellungsprobe'), 'Probenende');
    if (startedAt.micros < storageVerifiedAt.micros || completedAt.micros < startedAt.micros
      || completedAt.micros > evaluatedAt.micros) throw new Error('Wiederherstellungsprobe liegt ausserhalb der kausalen Ereignisfolge.');
    const outcome = own(drill, 'outcome', 'Wiederherstellungsprobe');
    if (outcome !== 'succeeded' && outcome !== 'failed') throw new Error('Wiederherstellungsprobe enthaelt kein erlaubtes Ergebnis.');
    const restoredIds = new Set<string>();
    const restoredContents = array(own(drill, 'restoredContents', 'Wiederherstellungsprobe'), 'Wiederhergestellte Inhalte').map((value) => {
      const restored = record(value, 'Wiederhergestellter Inhalt');
      exactKeys(restored, ['contentId', 'recordCount', 'contentSha256'], 'Wiederhergestellter Inhalt');
      const contentId = id(own(restored, 'contentId', 'Wiederhergestellter Inhalt'), 'Wiederhergestellte Inhaltskennung');
      if (restoredIds.has(contentId)) throw new Error('Wiederherstellungsprobe enthaelt doppelte Inhaltskennungen.');
      restoredIds.add(contentId);
      const original = contentsById.get(contentId);
      const recordCount = count(own(restored, 'recordCount', 'Wiederhergestellter Inhalt'), 'Wiederhergestellte Datensatzmenge');
      const contentSha256 = hash(own(restored, 'contentSha256', 'Wiederhergestellter Inhalt'), 'Wiederhergestellte Inhaltssumme');
      if (!original || original.recordCount !== recordCount || original.contentSha256 !== contentSha256) {
        throw new Error('Wiederhergestellter Inhalt stimmt nicht exakt mit dem Sicherungsmanifest ueberein.');
      }
      return Object.freeze({ contentId, recordCount, contentSha256 });
    });
    if (outcome === 'succeeded' && (restoredContents.length !== contents.length
      || contents.some((item) => !restoredIds.has(item.contentId)))) {
      throw new Error('Erfolgreiche Wiederherstellungsprobe deckt den Sicherungsumfang nicht lueckenlos ab.');
    }
    status = outcome === 'succeeded' ? 'restoration_verified' : 'restoration_failed';
    restoreDrill = Object.freeze({
      drillId: id(own(drill, 'drillId', 'Wiederherstellungsprobe'), 'Probenkennung'),
      targetEnvironmentId,
      startedAt: startedAt.text,
      completedAt: completedAt.text,
      outcome,
      verifierProfileId: id(own(drill, 'verifierProfileId', 'Wiederherstellungsprobe'), 'Prueferprofil'),
      permissionEvidenceId: id(own(drill, 'permissionEvidenceId', 'Wiederherstellungsprobe'), 'Pruefberechtigungsbeleg'),
      reportSha256: hash(own(drill, 'reportSha256', 'Wiederherstellungsprobe'), 'Probenberichtssumme'),
      restoredContents: Object.freeze(restoredContents),
    });
  }

  return Object.freeze({
    tenantId, backupId, sourceSystemId, backupFormatVersion, snapshotAt: snapshotAt.text, createdAt: createdAt.text,
    archiveSha256, manifestSha256, storage, contents: Object.freeze(contents), restoreDrill, evaluatedAt: evaluatedAt.text,
    status, backupVerified: status === 'restoration_verified', productionRecoveryReadinessInferred: false,
    legalRetentionComplianceInferred: false, clinicalCompletenessInferred: false, sourceDeletionInferred: false,
  });
}
