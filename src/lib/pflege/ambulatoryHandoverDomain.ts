export type HandoverPriority = 'normal' | 'important' | 'urgent' | 'critical';

export type AmbulatoryHandoverChange = {
  changeId: string;
  sourceType: string;
  sourceEntityId: string;
  sourceVersionId: string;
  occurredAt: string;
  summary: string;
  recordLocator: string;
  sourceSha256: string;
};

export type AmbulatoryHandoverConsequence = {
  consequenceId: string;
  nativeTaskId: string;
  title: string;
  responsibilityId: string;
  responsibilityName: string;
  dueAt: string;
  priority: HandoverPriority;
  consequence: string;
  sourceChangeIds: readonly string[];
};

export type AmbulatoryHandoverRecipient = {
  recipientId: string;
  profileId: string;
  name: string;
  roleSnapshot: string;
  responsibility: string;
};

export type AmbulatoryHandoverAcknowledgement = {
  acknowledgementId: string;
  clientRequestId: string;
  recipientId: string;
  actorId: string;
  actorName: string;
  acknowledgedAt: string;
  contentSha256: string;
  acknowledgedChangeIds: readonly string[];
  acknowledgedConsequenceIds: readonly string[];
  statement: string;
};

export type AmbulatoryHandoverInput = {
  handoverId: string;
  clientRequestId: string;
  tenantId: string;
  clientId: string;
  title: string;
  priority: HandoverPriority;
  contentSha256: string;
  createdAt: string;
  createdBy: string;
  createdByName: string;
  changes: readonly AmbulatoryHandoverChange[];
  openConsequences: readonly AmbulatoryHandoverConsequence[];
  recipients: readonly AmbulatoryHandoverRecipient[];
  acknowledgements: readonly AmbulatoryHandoverAcknowledgement[];
};

export type AmbulatoryHandover = AmbulatoryHandoverInput & {
  status: 'awaiting_receipt' | 'partially_acknowledged' | 'acknowledged';
  historyMode: 'append_only';
  taskCompletion: 'not_inferred';
  clinicalPerformance: 'not_inferred';
  legalApproval: 'not_inferred';
  releaseApproval: 'not_inferred';
};

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const sha256 = /^[0-9a-f]{64}$/;
const exactUtcMicros = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}(?:Z|\+00:00)$/;
const priorities = ['normal', 'important', 'urgent', 'critical'] as const;
const required = (value: unknown, label: string) => { if (typeof value !== 'string' || !value.trim()) throw Error(`${label} fehlt.`); return value.trim(); };
const identity = (value: unknown, label: string) => { const v = required(value, label); if (!uuid.test(v)) throw Error(`${label} ist keine native UUID.`); return v; };
const fingerprint = (value: unknown, label: string) => { const v = required(value, label); if (!sha256.test(v)) throw Error(`${label} benötigt einen SHA-256-Fingerprint.`); return v; };
const micros = (value: unknown, label: string) => { const v = required(value, label); if (!exactUtcMicros.test(v) || Number.isNaN(Date.parse(v))) throw Error(`${label} benötigt exakt sechs UTC-Mikrosekundenstellen.`); return v; };
const exactSet = (actual: readonly string[], expected: readonly string[]) => actual.length === expected.length && new Set(actual).size === actual.length && expected.every(id => actual.includes(id));

export function buildAmbulatoryHandover(input: AmbulatoryHandoverInput): AmbulatoryHandover {
  for (const [value, label] of [[input.handoverId, 'Übergabe'], [input.clientRequestId, 'Anfrage'], [input.tenantId, 'Mandant'], [input.clientId, 'Pflegefall'], [input.createdBy, 'Ersteller']] as const) identity(value, label);
  required(input.createdByName, 'Erstellername'); required(input.title, 'Titel'); fingerprint(input.contentSha256, 'Übergabeinhalt');
  const createdAt = micros(input.createdAt, 'Erstellungszeit');
  if (!priorities.includes(input.priority)) throw Error('Priorität ist ungültig.');
  if (!input.changes.length) throw Error('Mindestens eine relevante tatsächliche Änderung ist erforderlich.');
  if (!input.openConsequences.length) throw Error('Mindestens ein offener Auftrag oder eine offene Folge ist erforderlich.');
  if (!input.recipients.length) throw Error('Mindestens eine empfangende Person ist erforderlich.');

  const ids = new Set<string>();
  const changes = input.changes.map(change => {
    for (const [value, label] of [[change.changeId, 'Änderung'], [change.sourceEntityId, 'Quellobjekt'], [change.sourceVersionId, 'Quellfassung']] as const) identity(value, label);
    if (ids.has(change.changeId)) throw Error('Änderungsidentität ist doppelt.'); ids.add(change.changeId);
    required(change.sourceType, 'Quellart'); required(change.summary, 'Änderungsinhalt'); required(change.recordLocator, 'Originalaktenstelle');
    micros(change.occurredAt, 'Änderungszeit'); fingerprint(change.sourceSha256, 'Quellbeleg');
    return Object.freeze({ ...change });
  });
  const changeIds = changes.map(change => change.changeId);
  const openConsequences = input.openConsequences.map(item => {
    for (const [value, label] of [[item.consequenceId, 'Folge'], [item.nativeTaskId, 'Originalauftrag'], [item.responsibilityId, 'Zuständigkeit']] as const) identity(value, label);
    if (ids.has(item.consequenceId)) throw Error('Folgeidentität ist doppelt.'); ids.add(item.consequenceId);
    required(item.title, 'Auftragstitel'); required(item.responsibilityName, 'Zuständigkeitsname'); required(item.consequence, 'Offene Folge');
    const dueAt = micros(item.dueAt, 'Aufgabenfrist'); if (dueAt <= createdAt) throw Error('Aufgabenfrist muss nach der Übergabe liegen.');
    if (!priorities.includes(item.priority)) throw Error('Folgepriorität ist ungültig.');
    if (!item.sourceChangeIds.length || new Set(item.sourceChangeIds).size !== item.sourceChangeIds.length || item.sourceChangeIds.some(id => !changeIds.includes(id))) throw Error('Offene Folge muss mindestens eine vorhandene Änderung eindeutig referenzieren.');
    return Object.freeze({ ...item, sourceChangeIds: Object.freeze([...item.sourceChangeIds]) });
  });
  const consequenceIds = openConsequences.map(item => item.consequenceId);
  const recipients = input.recipients.map(recipient => {
    identity(recipient.recipientId, 'Empfänger'); identity(recipient.profileId, 'Empfängerprofil');
    if (ids.has(recipient.recipientId)) throw Error('Empfängeridentität ist doppelt.'); ids.add(recipient.recipientId);
    required(recipient.name, 'Empfängername'); required(recipient.roleSnapshot, 'Empfängerrolle'); required(recipient.responsibility, 'Empfängerzuständigkeit');
    return Object.freeze({ ...recipient });
  });
  const recipientIds = recipients.map(item => item.recipientId);
  const acknowledged = new Set<string>();
  const acknowledgements = input.acknowledgements.map(item => {
    identity(item.acknowledgementId, 'Empfangsbeleg'); identity(item.clientRequestId, 'Empfangsanfrage'); identity(item.recipientId, 'Empfänger'); identity(item.actorId, 'Empfangsperson');
    if (ids.has(item.acknowledgementId) || acknowledged.has(item.recipientId)) throw Error('Empfangsbeleg oder Empfängerquittierung ist doppelt.'); ids.add(item.acknowledgementId); acknowledged.add(item.recipientId);
    const recipient = recipients.find(candidate => candidate.recipientId === item.recipientId);
    if (!recipient || recipient.profileId !== item.actorId || recipient.name.trim() !== required(item.actorName, 'Empfangspersonname')) throw Error('Nur die zugewiesene native Empfängeridentität darf quittieren.');
    if (micros(item.acknowledgedAt, 'Empfangszeit') < createdAt) throw Error('Empfangszeit liegt vor der Übergabe.');
    if (fingerprint(item.contentSha256, 'Quittierter Inhalt') !== input.contentSha256) throw Error('Quittierung gehört nicht zur exakten Übergabefassung.');
    if (!exactSet(item.acknowledgedChangeIds, changeIds) || !exactSet(item.acknowledgedConsequenceIds, consequenceIds)) throw Error('Quittierung muss alle Änderungen und offenen Folgen der Fassung ausdrücklich umfassen.');
    required(item.statement, 'Empfangsbestätigung');
    return Object.freeze({ ...item, acknowledgedChangeIds: Object.freeze([...item.acknowledgedChangeIds]), acknowledgedConsequenceIds: Object.freeze([...item.acknowledgedConsequenceIds]) });
  });
  const status = acknowledgements.length === 0 ? 'awaiting_receipt' : acknowledgements.length === recipients.length ? 'acknowledged' : 'partially_acknowledged';
  return Object.freeze({ ...input, createdAt, changes: Object.freeze(changes), openConsequences: Object.freeze(openConsequences), recipients: Object.freeze(recipients), acknowledgements: Object.freeze(acknowledgements), status, historyMode: 'append_only', taskCompletion: 'not_inferred', clinicalPerformance: 'not_inferred', legalApproval: 'not_inferred', releaseApproval: 'not_inferred' });
}
