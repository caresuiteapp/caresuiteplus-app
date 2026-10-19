export type CaseConferenceOutcome = 'open' | 'not_achieved' | 'verified_achieved';

export type CaseConferenceEvidence = Readonly<{
  tenantId: string;
  clientId: string;
  conferenceId: string;
  reasonSourceId: string;
  reason: string;
  participantIds: readonly string[];
  decisions: readonly Readonly<{
    decisionId: string;
    followUpTaskId: string;
    responsibleParticipantId: string;
    taskState: 'open' | 'in_progress' | 'completed' | 'cancelled';
    latestResultId: string | null;
    outcome: CaseConferenceOutcome;
  }>[];
  state: 'open' | 'all_decisions_verified';
  allDecisionsVerified: boolean;
  clinicalCompletionInferred: false;
}>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const INSTANT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d{1,6})(Z|([+-])(\d{2}):(\d{2}))$/;

function ownRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    throw new Error(`${label} ist kein unveraenderter Originaldatensatz.`);
  }
  return value as Record<string, unknown>;
}

function ownValue(record: Record<string, unknown>, key: string, label: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(record, key);
  if (!descriptor || !Object.hasOwn(descriptor, 'value')) throw new Error(`${label} ${key} fehlt als Originalwert.`);
  return descriptor.value;
}

function array(value: unknown, label: string, allowEmpty = false): unknown[] {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) throw new Error(`${label} fehlt als nichtleeres Originalarray.`);
  return value;
}

function uuid(value: unknown, label: string): string {
  if (typeof value !== 'string' || !UUID.test(value)) throw new Error(`${label} ist keine native UUID.`);
  return value;
}

function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`${label} fehlt als Originaltext.`);
  return value;
}

function hash(value: unknown, label: string): string {
  if (typeof value !== 'string' || !SHA256.test(value)) throw new Error(`${label} ist kein SHA-256-Originalwert.`);
  return value;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], label: string): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) throw new Error(`${label} ist kein erlaubter Originalstatus.`);
  return value as T;
}

function instant(value: unknown, label: string): bigint {
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
  return BigInt(Date.UTC(year, month - 1, day, hour, minute, second) - offset * 60_000) * 1000n
    + BigInt(fraction.padEnd(6, '0'));
}

function unique(values: readonly string[], label: string): void {
  if (new Set(values).size !== values.length) throw new Error(`${label} enthaelt doppelte native Kennungen.`);
}

/**
 * Builds a fail-closed case-conference projection. Attendance and a recorded
 * decision never imply implementation. A decision is verified only through its
 * own responsible task and a later, permission-bound evidence result.
 */
export function projectCaseConferenceEvidence(input: unknown): CaseConferenceEvidence {
  const root = ownRecord(input, 'Fallbesprechung');
  const tenantId = uuid(ownValue(root, 'tenantId', 'Fallbesprechung'), 'Mandantenkennung');
  const clientId = uuid(ownValue(root, 'clientId', 'Fallbesprechung'), 'Pflegefallkennung');
  const conferenceId = uuid(ownValue(root, 'conferenceId', 'Fallbesprechung'), 'Besprechungskennung');
  const reasonSourceId = uuid(ownValue(root, 'reasonSourceId', 'Fallbesprechung'), 'Anlassquellenkennung');
  const reason = text(ownValue(root, 'reason', 'Fallbesprechung'), 'Besprechungsanlass');
  const heldAt = instant(ownValue(root, 'heldAt', 'Fallbesprechung'), 'Besprechungszeit');

  const participants = array(ownValue(root, 'participants', 'Fallbesprechung'), 'Teilnehmer');
  const participantIds: string[] = [];
  const allowedParticipants = new Map<string, { profileId: string; checkedAt: bigint }>();
  for (const value of participants) {
    const participant = ownRecord(value, 'Teilnehmerbeleg');
    const participantId = uuid(ownValue(participant, 'participantId', 'Teilnehmerbeleg'), 'Teilnehmerkennung');
    const profileId = uuid(ownValue(participant, 'profileId', 'Teilnehmerbeleg'), 'Teilnehmerprofil');
    text(ownValue(participant, 'roleSnapshot', 'Teilnehmerbeleg'), 'Teilnehmerrollensnapshot');
    uuid(ownValue(participant, 'permissionEvidenceId', 'Teilnehmerbeleg'), 'Berechtigungsbelegkennung');
    const permission = oneOf(ownValue(participant, 'permission', 'Teilnehmerbeleg'), ['allowed', 'denied'] as const, 'Teilnehmerberechtigung');
    const checkedAt = instant(ownValue(participant, 'checkedAt', 'Teilnehmerbeleg'), 'Berechtigungspruefzeit');
    if (checkedAt > heldAt) throw new Error('Teilnehmerberechtigung wurde erst nach der Besprechung geprueft.');
    participantIds.push(participantId);
    if (permission === 'allowed') allowedParticipants.set(participantId, { profileId, checkedAt });
  }
  unique(participantIds, 'Teilnehmerliste');
  if (participantIds.length < 2) throw new Error('Koordinierte Fallbesprechung benoetigt mindestens zwei Teilnehmer.');

  const decisions = array(ownValue(root, 'decisions', 'Fallbesprechung'), 'Beschluesse');
  const decisionRows = decisions.map((value) => {
    const decision = ownRecord(value, 'Beschlussbeleg');
    const decisionId = uuid(ownValue(decision, 'decisionId', 'Beschlussbeleg'), 'Beschlusskennung');
    const recordedByParticipantId = uuid(ownValue(decision, 'recordedByParticipantId', 'Beschlussbeleg'), 'Beschlussakteur');
    if (!allowedParticipants.has(recordedByParticipantId)) throw new Error('Beschlussakteur ist kein berechtigter Teilnehmer.');
    text(ownValue(decision, 'decision', 'Beschlussbeleg'), 'Beschlusstext');
    const followUpTaskId = uuid(ownValue(decision, 'followUpTaskId', 'Beschlussbeleg'), 'Folgeaufgabenkennung');
    const decidedAt = instant(ownValue(decision, 'decidedAt', 'Beschlussbeleg'), 'Beschlusszeit');
    if (decidedAt < heldAt) throw new Error('Beschluss liegt vor der Besprechung.');
    return { decisionId, followUpTaskId, decidedAt };
  });
  unique(decisionRows.map((row) => row.decisionId), 'Beschlussliste');
  unique(decisionRows.map((row) => row.followUpTaskId), 'Folgeaufgabenbindungen');

  const tasks = new Map<string, { decisionId: string; responsibleParticipantId: string; state: 'open' | 'in_progress' | 'completed' | 'cancelled'; dueAt: bigint; completedAt: bigint | null }>();
  for (const value of array(ownValue(root, 'tasks', 'Fallbesprechung'), 'Folgeaufgaben')) {
    const task = ownRecord(value, 'Folgeaufgabenbeleg');
    const taskId = uuid(ownValue(task, 'taskId', 'Folgeaufgabenbeleg'), 'Folgeaufgabenkennung');
    if (tasks.has(taskId)) throw new Error('Folgeaufgabenliste enthaelt doppelte native Kennungen.');
    const decisionId = uuid(ownValue(task, 'decisionId', 'Folgeaufgabenbeleg'), 'Aufgabenbeschlusskennung');
    const responsibleParticipantId = uuid(ownValue(task, 'responsibleParticipantId', 'Folgeaufgabenbeleg'), 'Aufgabenzustaendigkeit');
    if (!allowedParticipants.has(responsibleParticipantId)) throw new Error('Folgeaufgabe hat keine berechtigte Teilnehmerzustaendigkeit.');
    const state = oneOf(ownValue(task, 'state', 'Folgeaufgabenbeleg'), ['open', 'in_progress', 'completed', 'cancelled'] as const, 'Folgeaufgabenstatus');
    const dueAt = instant(ownValue(task, 'dueAt', 'Folgeaufgabenbeleg'), 'Folgeaufgabenfrist');
    const completedValue = ownValue(task, 'completedAt', 'Folgeaufgabenbeleg');
    const completedAt = completedValue === null ? null : instant(completedValue, 'Folgeaufgabenabschlusszeit');
    if ((state === 'completed') !== (completedAt !== null)) throw new Error('Folgeaufgabenstatus und Abschlusszeit widersprechen sich.');
    tasks.set(taskId, { decisionId, responsibleParticipantId, state, dueAt, completedAt });
  }

  const resultsByTask = new Map<string, { resultId: string; outcome: 'achieved' | 'partial' | 'not_achieved'; verifiedAt: bigint }[]>();
  const seenResultIds: string[] = [];
  for (const value of array(ownValue(root, 'results', 'Fallbesprechung'), 'Ergebnisbelege', true)) {
    const result = ownRecord(value, 'Ergebnisbeleg');
    const resultId = uuid(ownValue(result, 'resultId', 'Ergebnisbeleg'), 'Ergebniskennung');
    const taskId = uuid(ownValue(result, 'taskId', 'Ergebnisbeleg'), 'Ergebnisaufgabenkennung');
    const verifierParticipantId = uuid(ownValue(result, 'verifierParticipantId', 'Ergebnisbeleg'), 'Ergebnispruefer');
    const verifier = allowedParticipants.get(verifierParticipantId);
    if (!verifier) throw new Error('Ergebnispruefer ist kein berechtigter Teilnehmer.');
    const verifierProfileId = uuid(ownValue(result, 'verifierProfileId', 'Ergebnisbeleg'), 'Ergebnisprueferprofil');
    if (verifier.profileId !== verifierProfileId) throw new Error('Ergebnisprueferprofil stimmt nicht mit dem Teilnehmerbeleg ueberein.');
    const outcome = oneOf(ownValue(result, 'outcome', 'Ergebnisbeleg'), ['achieved', 'partial', 'not_achieved'] as const, 'Ergebnisstatus');
    uuid(ownValue(result, 'evidenceId', 'Ergebnisbeleg'), 'Ergebnisnachweiskennung');
    hash(ownValue(result, 'evidenceSha256', 'Ergebnisbeleg'), 'Ergebnisnachweissumme');
    const occurredAt = instant(ownValue(result, 'occurredAt', 'Ergebnisbeleg'), 'Ergebniszeit');
    const verifiedAt = instant(ownValue(result, 'verifiedAt', 'Ergebnisbeleg'), 'Ergebnispruefzeit');
    if (occurredAt > verifiedAt) throw new Error('Ergebnispruefung liegt vor dem Ergebnis.');
    seenResultIds.push(resultId);
    const rows = resultsByTask.get(taskId) ?? [];
    rows.push({ resultId, outcome, verifiedAt });
    resultsByTask.set(taskId, rows);
  }
  unique(seenResultIds, 'Ergebnisbelegliste');

  const projected = decisionRows.map((decision) => {
    const task = tasks.get(decision.followUpTaskId);
    if (!task || task.decisionId !== decision.decisionId) throw new Error('Beschluss und Folgeaufgabe sind nicht exakt gegenseitig gebunden.');
    if (task.dueAt < decision.decidedAt) throw new Error('Folgeaufgabenfrist liegt vor dem Beschluss.');
    const results = resultsByTask.get(decision.followUpTaskId) ?? [];
    for (const result of results) {
      if (task.completedAt === null || result.verifiedAt < task.completedAt) {
        throw new Error('Ergebnisbeleg liegt ohne passenden vorherigen Aufgabenabschluss vor.');
      }
    }
    const latest = [...results].sort((left, right) => left.verifiedAt < right.verifiedAt ? -1 : left.verifiedAt > right.verifiedAt ? 1 : 0).at(-1) ?? null;
    const outcome: CaseConferenceOutcome = task.state !== 'completed' || latest === null
      ? 'open'
      : latest.outcome === 'achieved' ? 'verified_achieved' : 'not_achieved';
    return Object.freeze({
      decisionId: decision.decisionId,
      followUpTaskId: decision.followUpTaskId,
      responsibleParticipantId: task.responsibleParticipantId,
      taskState: task.state,
      latestResultId: latest?.resultId ?? null,
      outcome,
    });
  });
  for (const taskId of tasks.keys()) if (!decisionRows.some((row) => row.followUpTaskId === taskId)) throw new Error('Ungebundene Folgeaufgabe im Besprechungsfall.');
  for (const taskId of resultsByTask.keys()) if (!tasks.has(taskId)) throw new Error('Ungebundener Ergebnisbeleg im Besprechungsfall.');

  const allDecisionsVerified = projected.every((decision) => decision.outcome === 'verified_achieved');
  return Object.freeze({
    tenantId,
    clientId,
    conferenceId,
    reasonSourceId,
    reason,
    participantIds: Object.freeze(participantIds),
    decisions: Object.freeze(projected),
    state: allDecisionsVerified ? 'all_decisions_verified' : 'open',
    allDecisionsVerified,
    clinicalCompletionInferred: false,
  });
}
