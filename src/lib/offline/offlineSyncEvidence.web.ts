export type OfflineSyncEvidence = Readonly<{
  tenantId: string;
  workspaceId: string;
  evaluatedAt: string;
  entries: readonly Readonly<{
    operationId: string;
    entityId: string;
    actorProfileId: string;
    deviceId: string;
    kind: 'create' | 'update' | 'delete';
    requestId: string;
    payloadSha256: string;
    capturedAt: string;
    draftEvidenceId: string;
    localProtectionEvidenceId: string;
    localProtectionEvidenceSha256: string;
    permissionKey: string;
    permissionEvidenceId: string;
    attempts: readonly Readonly<{
      attemptId: string;
      sequence: number;
      startedAt: string;
      completedAt: string;
      outcome: 'accepted' | 'rejected' | 'uncertain' | 'conflict';
      responseSha256: string | null;
      serverReceiptId: string | null;
      serverVersion: number | null;
      serverPayloadSha256: string | null;
      conflictEvidenceId: string | null;
      conflictEvidenceSha256: string | null;
    }>[];
    disposition: 'local_unconfirmed' | 'retry_pending' | 'conflict_review' | 'server_accepted';
    serverAcceptanceConfirmed: boolean;
    serverAcceptanceInferred: false;
    deletionInferred: false;
    clinicalCompletionInferred: false;
  }>[];
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

function nullableId(value: unknown, label: string): string | null {
  return value === null ? null : id(value, label);
}

function nullableHash(value: unknown, label: string): string | null {
  return value === null ? null : hash(value, label);
}

function code(value: unknown, label: string): string {
  if (typeof value !== 'string' || !CODE.test(value)) throw new Error(`${label} ist kein zulassiger technischer Code.`);
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
  return {
    text: value,
    micros: BigInt(Date.UTC(year, month - 1, day, hour, minute, second) - offset * 60_000) * 1000n
      + BigInt(fraction.padEnd(6, '0')),
  };
}

function array(value: unknown, label: string, allowEmpty = false): unknown[] {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) {
    throw new Error(`${label} fehlt als ${allowEmpty ? '' : 'nichtleere '}Originalhistorie.`);
  }
  return value;
}

function nullableVersion(value: unknown, label: string): number | null {
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${label} ist keine positive native Serverversion.`);
  }
  return value;
}

function allNull(values: readonly unknown[]): boolean {
  return values.every((value) => value === null);
}

/**
 * Builds a fail-closed Web/Desktop projection for locally protected writes.
 * A local entry remains explicitly unconfirmed until a matching, complete
 * server receipt exists. Conflicts preserve the local draft and server proof;
 * even an accepted delete request is not treated as proof of physical deletion.
 */
export function projectOfflineSyncEvidence(input: unknown): OfflineSyncEvidence {
  const root = record(input, 'Offline-Synchronnachweis');
  exactKeys(root, ['tenantId', 'workspaceId', 'evaluatedAt', 'entries'], 'Offline-Synchronnachweis');
  const tenantId = id(own(root, 'tenantId', 'Offline-Synchronnachweis'), 'Mandantenkennung');
  const workspaceId = id(own(root, 'workspaceId', 'Offline-Synchronnachweis'), 'Workspacekennung');
  const evaluatedAt = instant(own(root, 'evaluatedAt', 'Offline-Synchronnachweis'), 'Auswertungszeit');

  const operationIds = new Set<string>();
  const requestIds = new Set<string>();
  const entries = array(own(root, 'entries', 'Offline-Synchronnachweis'), 'Offline-Eintraege', true).map((value) => {
    const row = record(value, 'Offline-Eintrag');
    exactKeys(row, [
      'operationId', 'tenantId', 'workspaceId', 'entityId', 'actorProfileId', 'deviceId', 'kind',
      'requestId', 'payloadSha256', 'capturedAt', 'draftEvidenceId', 'localProtectionEvidenceId',
      'localProtectionEvidenceSha256', 'permissionKey', 'permissionEvidenceId', 'attempts',
    ], 'Offline-Eintrag');
    if (id(own(row, 'tenantId', 'Offline-Eintrag'), 'Eintragsmandant') !== tenantId
      || id(own(row, 'workspaceId', 'Offline-Eintrag'), 'Eintragsworkspace') !== workspaceId) {
      throw new Error('Offline-Eintrag gehoert zu einem anderen Mandanten oder Workspace.');
    }
    const operationId = id(own(row, 'operationId', 'Offline-Eintrag'), 'Operationskennung');
    const requestId = id(own(row, 'requestId', 'Offline-Eintrag'), 'Anfragekennung');
    if (operationIds.has(operationId) || requestIds.has(requestId)) {
      throw new Error('Offline-Eintraege enthalten doppelte Operations- oder Anfragekennungen.');
    }
    operationIds.add(operationId);
    requestIds.add(requestId);
    const payloadSha256 = hash(own(row, 'payloadSha256', 'Offline-Eintrag'), 'Nutzlastsumme');
    const capturedAt = instant(own(row, 'capturedAt', 'Offline-Eintrag'), 'Lokale Erfassungszeit');
    if (capturedAt.micros > evaluatedAt.micros) throw new Error('Offline-Eintrag liegt nach der Auswertungszeit.');
    const kind = own(row, 'kind', 'Offline-Eintrag');
    if (!['create', 'update', 'delete'].includes(String(kind))) throw new Error('Offline-Eintrag enthaelt keine erlaubte Operation.');

    let previousCompletedAt: bigint | null = null;
    let acceptedSeen = false;
    const attemptIds = new Set<string>();
    const attempts = array(own(row, 'attempts', 'Offline-Eintrag'), 'Synchronversuche', true).map((attemptValue, index) => {
      const attempt = record(attemptValue, 'Synchronversuch');
      exactKeys(attempt, [
        'attemptId', 'sequence', 'tenantId', 'workspaceId', 'operationId', 'requestId', 'payloadSha256',
        'startedAt', 'completedAt', 'outcome', 'responseSha256', 'serverReceiptId', 'serverVersion',
        'serverPayloadSha256', 'conflictEvidenceId', 'conflictEvidenceSha256',
      ], 'Synchronversuch');
      if (id(own(attempt, 'tenantId', 'Synchronversuch'), 'Versuchsmandant') !== tenantId
        || id(own(attempt, 'workspaceId', 'Synchronversuch'), 'Versuchsworkspace') !== workspaceId
        || id(own(attempt, 'operationId', 'Synchronversuch'), 'Versuchsoperation') !== operationId
        || id(own(attempt, 'requestId', 'Synchronversuch'), 'Versuchsanfrage') !== requestId
        || hash(own(attempt, 'payloadSha256', 'Synchronversuch'), 'Versuchsnutzlastsumme') !== payloadSha256) {
        throw new Error('Synchronversuch ist nicht an den unveraenderten Offline-Eintrag gebunden.');
      }
      const attemptId = id(own(attempt, 'attemptId', 'Synchronversuch'), 'Versuchskennung');
      if (attemptIds.has(attemptId)) throw new Error('Synchronhistorie enthaelt doppelte Versuchskennungen.');
      attemptIds.add(attemptId);
      const sequence = own(attempt, 'sequence', 'Synchronversuch');
      if (typeof sequence !== 'number' || !Number.isSafeInteger(sequence) || sequence !== index + 1) {
        throw new Error('Synchronhistorie ist nicht lueckenlos und original geordnet.');
      }
      if (acceptedSeen) throw new Error('Nach bestaetigter Serverannahme darf kein weiterer Synchronversuch folgen.');
      const startedAt = instant(own(attempt, 'startedAt', 'Synchronversuch'), 'Versuchsbeginn');
      const completedAt = instant(own(attempt, 'completedAt', 'Synchronversuch'), 'Versuchsende');
      if (startedAt.micros < capturedAt.micros || completedAt.micros < startedAt.micros
        || completedAt.micros > evaluatedAt.micros
        || (previousCompletedAt !== null && startedAt.micros <= previousCompletedAt)) {
        throw new Error('Synchronversuch liegt ausserhalb der lueckenlosen Ereignisfolge.');
      }
      previousCompletedAt = completedAt.micros;
      const outcome = own(attempt, 'outcome', 'Synchronversuch');
      if (!['accepted', 'rejected', 'uncertain', 'conflict'].includes(String(outcome))) {
        throw new Error('Synchronversuch enthaelt kein erlaubtes Ergebnis.');
      }
      const responseSha256 = nullableHash(own(attempt, 'responseSha256', 'Synchronversuch'), 'Antwortsumme');
      const serverReceiptId = nullableId(own(attempt, 'serverReceiptId', 'Synchronversuch'), 'Serverbelegkennung');
      const serverVersion = nullableVersion(own(attempt, 'serverVersion', 'Synchronversuch'), 'Serverversion');
      const serverPayloadSha256 = nullableHash(own(attempt, 'serverPayloadSha256', 'Synchronversuch'), 'Servernutzlastsumme');
      const conflictEvidenceId = nullableId(own(attempt, 'conflictEvidenceId', 'Synchronversuch'), 'Konfliktbelegkennung');
      const conflictEvidenceSha256 = nullableHash(own(attempt, 'conflictEvidenceSha256', 'Synchronversuch'), 'Konfliktbelegsumme');
      const serverFields = [serverReceiptId, serverVersion, serverPayloadSha256];
      const conflictFields = [conflictEvidenceId, conflictEvidenceSha256];
      if (outcome === 'accepted') {
        if (!responseSha256 || !serverReceiptId || !serverVersion || serverPayloadSha256 !== payloadSha256
          || !allNull(conflictFields)) throw new Error('Serverannahme ist nicht vollstaendig und exakt belegt.');
        acceptedSeen = true;
      } else if (outcome === 'conflict') {
        if (!responseSha256 || !serverReceiptId || !serverVersion || !serverPayloadSha256
          || !conflictEvidenceId || !conflictEvidenceSha256) throw new Error('Serverkonflikt ist nicht vollstaendig belegt.');
      } else if (outcome === 'rejected') {
        if (!responseSha256 || !allNull(serverFields) || !allNull(conflictFields)) {
          throw new Error('Serverablehnung enthaelt widerspruechliche Annahme- oder Konfliktbelege.');
        }
      } else if (responseSha256 !== null || !allNull(serverFields) || !allNull(conflictFields)) {
        throw new Error('Ungewisser Versuch darf keine Serverantwort oder Annahme behaupten.');
      }
      return Object.freeze({
        attemptId, sequence, startedAt: startedAt.text, completedAt: completedAt.text,
        outcome: outcome as 'accepted' | 'rejected' | 'uncertain' | 'conflict', responseSha256,
        serverReceiptId, serverVersion, serverPayloadSha256, conflictEvidenceId, conflictEvidenceSha256,
      });
    });
    const latest = attempts.at(-1);
    const disposition = !latest || latest.outcome === 'rejected' ? 'local_unconfirmed'
      : latest.outcome === 'uncertain' ? 'retry_pending'
        : latest.outcome === 'conflict' ? 'conflict_review' : 'server_accepted';
    return Object.freeze({
      operationId,
      entityId: id(own(row, 'entityId', 'Offline-Eintrag'), 'Objektkennung'),
      actorProfileId: id(own(row, 'actorProfileId', 'Offline-Eintrag'), 'Akteurprofil'),
      deviceId: id(own(row, 'deviceId', 'Offline-Eintrag'), 'Geraetekennung'),
      kind: kind as 'create' | 'update' | 'delete',
      requestId,
      payloadSha256,
      capturedAt: capturedAt.text,
      draftEvidenceId: id(own(row, 'draftEvidenceId', 'Offline-Eintrag'), 'Entwurfsbelegkennung'),
      localProtectionEvidenceId: id(own(row, 'localProtectionEvidenceId', 'Offline-Eintrag'), 'Lokale Schutzbelegkennung'),
      localProtectionEvidenceSha256: hash(own(row, 'localProtectionEvidenceSha256', 'Offline-Eintrag'), 'Lokale Schutzbelegsumme'),
      permissionKey: code(own(row, 'permissionKey', 'Offline-Eintrag'), 'Berechtigungsschluessel'),
      permissionEvidenceId: id(own(row, 'permissionEvidenceId', 'Offline-Eintrag'), 'Berechtigungsbelegkennung'),
      attempts: Object.freeze(attempts),
      disposition,
      serverAcceptanceConfirmed: disposition === 'server_accepted',
      serverAcceptanceInferred: false,
      deletionInferred: false,
      clinicalCompletionInferred: false,
    });
  });
  return Object.freeze({ tenantId, workspaceId, evaluatedAt: evaluatedAt.text, entries: Object.freeze(entries) });
}
