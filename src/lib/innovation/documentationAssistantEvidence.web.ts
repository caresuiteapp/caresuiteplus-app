export type DocumentationAssistantEvidence = Readonly<{
  tenantId: string;
  clientId: string;
  releaseCandidateId: string;
  draftId: string;
  status: 'awaiting_professional_review' | 'professionally_rejected' | 'confirmed_not_persisted' | 'persisted_after_confirmation';
  sourceCount: number;
  claimCount: number;
  editCount: number;
  responsibleProfileId: string | null;
  reviewedAt: string | null;
  persistedAt: string | null;
  clinicalPerformanceInferred: false;
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

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw new Error(`${label} ist kein unveraenderter Originaldatensatz.`);
  return value as Record<string, unknown>;
}
function exact(value: Record<string, unknown>, keys: readonly string[], label: string): void {
  const actual = Object.keys(value), extra = actual.filter((key) => !keys.includes(key)), missing = keys.filter((key) => !actual.includes(key));
  if (extra.length) throw new Error(`${label} enthaelt nicht erlaubte Felder: ${extra.join(', ')}.`);
  if (missing.length) throw new Error(`${label} ist unvollstaendig: ${missing.join(', ')}.`);
}
function own(value: Record<string, unknown>, key: string, label: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (!descriptor || !Object.hasOwn(descriptor, 'value')) throw new Error(`${label} ${key} fehlt als Originalwert.`);
  return descriptor.value;
}
function id(value: unknown, label: string): string { if (typeof value !== 'string' || !UUID.test(value)) throw new Error(`${label} ist keine native UUID.`); return value; }
function hash(value: unknown, label: string): string { if (typeof value !== 'string' || !SHA256.test(value)) throw new Error(`${label} ist kein SHA-256-Originalwert.`); return value; }
function text(value: unknown, label: string): string { if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} fehlt.`); return value; }
function array(value: unknown, label: string): unknown[] { if (!Array.isArray(value)) throw new Error(`${label} ist keine Originalmenge.`); return value; }
function instant(value: unknown, label: string): { text: string; micros: bigint } {
  if (typeof value !== 'string') throw new Error(`${label} ist kein vollstaendiger ISO-Zeitpunkt.`);
  const match = INSTANT.exec(value); if (!match) throw new Error(`${label} ist kein vollstaendiger ISO-Zeitpunkt.`);
  const [, y, m, d, h, min, s, fraction, zone, sign, zh, zm] = match;
  const year = Number(y), month = Number(m), day = Number(d), hour = Number(h), minute = Number(min), second = Number(s), zoneHour = Number(zh ?? 0), zoneMinute = Number(zm ?? 0);
  const monthDays = month >= 1 && month <= 12 ? new Date(Date.UTC(year, month, 0)).getUTCDate() : 0;
  if (year < 1 || day < 1 || day > monthDays || hour > 23 || minute > 59 || second > 59 || zoneHour > 23 || zoneMinute > 59) throw new Error(`${label} enthaelt kein gueltiges Kalenderdatum.`);
  const offset = zone === 'Z' ? 0 : (sign === '-' ? -1 : 1) * (zoneHour * 60 + zoneMinute);
  return { text: value, micros: BigInt(Date.UTC(year, month - 1, day, hour, minute, second) - offset * 60_000) * 1000n + BigInt(fraction.padEnd(6, '0')) };
}

/** Keeps assistive text source-bound and provisional until a responsible professional explicitly confirms it. */
export function projectDocumentationAssistantEvidence(input: unknown): DocumentationAssistantEvidence {
  const root = object(input, 'Assistenznachweis');
  exact(root, ['tenantId', 'clientId', 'releaseCandidateId', 'buildSha256', 'run', 'sources', 'proposal', 'edits', 'finalDraftSha256', 'review', 'persistence', 'evaluatedAt'], 'Assistenznachweis');
  const tenantId = id(own(root, 'tenantId', 'Assistenznachweis'), 'Mandantenkennung'), clientId = id(own(root, 'clientId', 'Assistenznachweis'), 'Pflegefallkennung');
  const releaseCandidateId = id(own(root, 'releaseCandidateId', 'Assistenznachweis'), 'Kandidatenkennung'), buildSha256 = hash(own(root, 'buildSha256', 'Assistenznachweis'), 'Buildsumme');
  const evaluatedAt = instant(own(root, 'evaluatedAt', 'Assistenznachweis'), 'Auswertungszeit');

  const run = object(own(root, 'run', 'Assistenznachweis'), 'Assistenzlauf');
  exact(run, ['runId', 'tenantId', 'clientId', 'releaseCandidateId', 'buildSha256', 'model', 'modelVersion', 'promptTemplateId', 'promptTemplateVersion', 'requestedByProfileId', 'permissionKey', 'permissionEvidenceId', 'startedAt'], 'Assistenzlauf');
  const runId = id(own(run, 'runId', 'Assistenzlauf'), 'Laufkennung');
  if (id(own(run, 'tenantId', 'Assistenzlauf'), 'Laufmandant') !== tenantId || id(own(run, 'clientId', 'Assistenzlauf'), 'Laufpflegefall') !== clientId
    || id(own(run, 'releaseCandidateId', 'Assistenzlauf'), 'Laufkandidat') !== releaseCandidateId || hash(own(run, 'buildSha256', 'Assistenzlauf'), 'Laufbuildsumme') !== buildSha256
    || own(run, 'permissionKey', 'Assistenzlauf') !== 'pflege.documentation_assistant.propose') throw new Error('Assistenzlauf ist nicht exakt an Fall, Kandidat, Build und Vorschlagsberechtigung gebunden.');
  text(own(run, 'model', 'Assistenzlauf'), 'Assistenzmodell');
  if (typeof own(run, 'modelVersion', 'Assistenzlauf') !== 'string' || !VERSION.test(own(run, 'modelVersion', 'Assistenzlauf') as string)
    || typeof own(run, 'promptTemplateVersion', 'Assistenzlauf') !== 'string' || !VERSION.test(own(run, 'promptTemplateVersion', 'Assistenzlauf') as string)) throw new Error('Assistenzlauf besitzt keine konkrete Modell- und Vorlagenversion.');
  id(own(run, 'promptTemplateId', 'Assistenzlauf'), 'Vorlagenkennung'); id(own(run, 'requestedByProfileId', 'Assistenzlauf'), 'Anforderungsprofil'); id(own(run, 'permissionEvidenceId', 'Assistenzlauf'), 'Vorschlagsberechtigungsbeleg');
  const startedAt = instant(own(run, 'startedAt', 'Assistenzlauf'), 'Laufstart'); if (startedAt.micros > evaluatedAt.micros) throw new Error('Assistenzlauf liegt nach der Auswertung.');

  const sourceIds = new Set<string>(); let latestSource = startedAt.micros;
  for (const value of array(own(root, 'sources', 'Assistenznachweis'), 'Quellen')) {
    const source = object(value, 'Quelle'); exact(source, ['sourceId', 'tenantId', 'clientId', 'sourceType', 'sourceSha256', 'occurredAt', 'retrievedAt'], 'Quelle');
    const sourceId = id(own(source, 'sourceId', 'Quelle'), 'Quellenkennung'); if (sourceIds.has(sourceId)) throw new Error('Quellenkennung ist doppelt.'); sourceIds.add(sourceId);
    if (id(own(source, 'tenantId', 'Quelle'), 'Quellenmandant') !== tenantId || id(own(source, 'clientId', 'Quelle'), 'Quellenpflegefall') !== clientId) throw new Error('Quelle gehoert nicht exakt zu Mandant und Pflegefall.');
    const sourceType = own(source, 'sourceType', 'Quelle'); if (!['care_plan', 'visit_note', 'vital_measurement', 'prescription', 'person_statement'].includes(sourceType as string)) throw new Error('Quelle besitzt keinen erlaubten konkreten Typ.');
    hash(own(source, 'sourceSha256', 'Quelle'), 'Quellensumme'); const occurred = instant(own(source, 'occurredAt', 'Quelle'), 'Quellenereignis'), retrieved = instant(own(source, 'retrievedAt', 'Quelle'), 'Quellenabruf');
    if (occurred.micros > retrieved.micros || retrieved.micros > startedAt.micros) throw new Error('Quelle verletzt Ereignis-, Abruf- und Laufreihenfolge.'); latestSource = latestSource > retrieved.micros ? latestSource : retrieved.micros;
  }
  if (!sourceIds.size) throw new Error('Assistenzvorschlag besitzt keine konkrete Quelle.');

  const proposal = object(own(root, 'proposal', 'Assistenznachweis'), 'Vorschlag');
  exact(proposal, ['proposalId', 'runId', 'draftId', 'proposalSha256', 'generatedAt', 'sourceIds', 'claims'], 'Vorschlag');
  id(own(proposal, 'proposalId', 'Vorschlag'), 'Vorschlagskennung'); const draftId = id(own(proposal, 'draftId', 'Vorschlag'), 'Entwurfskennung');
  if (id(own(proposal, 'runId', 'Vorschlag'), 'Vorschlagslauf') !== runId) throw new Error('Vorschlag ist nicht an den Assistenzlauf gebunden.');
  const proposalSha256 = hash(own(proposal, 'proposalSha256', 'Vorschlag'), 'Vorschlagssumme');
  const proposalSources = array(own(proposal, 'sourceIds', 'Vorschlag'), 'Vorschlagsquellen').map((value) => id(value, 'Vorschlagsquelle'));
  if (proposalSources.length !== sourceIds.size || new Set(proposalSources).size !== sourceIds.size || proposalSources.some((value) => !sourceIds.has(value))) throw new Error('Vorschlag bindet nicht die vollstaendige konkrete Quellenmenge.');
  const generatedAt = instant(own(proposal, 'generatedAt', 'Vorschlag'), 'Vorschlagszeit'); if (generatedAt.micros < latestSource || generatedAt.micros > evaluatedAt.micros) throw new Error('Vorschlagszeit verletzt die Ereignisfolge.');
  const claims = array(own(proposal, 'claims', 'Vorschlag'), 'Aussagen'); if (!claims.length) throw new Error('Assistenzvorschlag enthaelt keine einzeln pruefbaren Aussagen.');
  const claimIds = new Set<string>();
  for (const value of claims) {
    const claim = object(value, 'Aussage'); exact(claim, ['claimId', 'kind', 'sourceIds', 'clinicalPerformanceAsserted', 'taskCompletionAsserted'], 'Aussage');
    const claimId = id(own(claim, 'claimId', 'Aussage'), 'Aussagenkennung'); if (claimIds.has(claimId)) throw new Error('Aussagenkennung ist doppelt.'); claimIds.add(claimId);
    if (!['rewrite', 'summary', 'follow_up_question'].includes(own(claim, 'kind', 'Aussage') as string)) throw new Error('Aussage besitzt keinen erlaubten Assistenztyp.');
    const refs = array(own(claim, 'sourceIds', 'Aussage'), 'Aussagenquellen').map((item) => id(item, 'Aussagenquelle'));
    if (!refs.length || new Set(refs).size !== refs.length || refs.some((item) => !sourceIds.has(item))) throw new Error('Aussage besitzt keinen eindeutigen konkreten Quellenbezug.');
    if (own(claim, 'clinicalPerformanceAsserted', 'Aussage') !== false || own(claim, 'taskCompletionAsserted', 'Aussage') !== false) throw new Error('Assistenz darf keine Pflegehandlung oder Aufgabenerledigung behaupten.');
  }

  let previousHash = proposalSha256, previousTime = generatedAt.micros, editCount = 0;
  for (const value of array(own(root, 'edits', 'Assistenznachweis'), 'Aenderungen')) {
    const edit = object(value, 'Aenderung'); exact(edit, ['editId', 'draftId', 'fromSha256', 'toSha256', 'editorProfileId', 'permissionKey', 'permissionEvidenceId', 'editedAt'], 'Aenderung');
    id(own(edit, 'editId', 'Aenderung'), 'Aenderungskennung'); if (id(own(edit, 'draftId', 'Aenderung'), 'Aenderungsentwurf') !== draftId || hash(own(edit, 'fromSha256', 'Aenderung'), 'Ausgangssumme') !== previousHash
      || own(edit, 'permissionKey', 'Aenderung') !== 'pflege.documentation_assistant.edit') throw new Error('Aenderung ist nicht lueckenlos an Entwurf, vorherige Fassung und Berechtigung gebunden.');
    previousHash = hash(own(edit, 'toSha256', 'Aenderung'), 'Zielsumme'); id(own(edit, 'editorProfileId', 'Aenderung'), 'Bearbeitungsprofil'); id(own(edit, 'permissionEvidenceId', 'Aenderung'), 'Bearbeitungsberechtigungsbeleg');
    const editedAt = instant(own(edit, 'editedAt', 'Aenderung'), 'Aenderungszeit'); if (editedAt.micros < previousTime || editedAt.micros > evaluatedAt.micros) throw new Error('Aenderung verletzt die Mikrosekundenfolge.'); previousTime = editedAt.micros; editCount++;
  }
  const finalDraftSha256 = hash(own(root, 'finalDraftSha256', 'Assistenznachweis'), 'Endfassungssumme'); if (finalDraftSha256 !== previousHash) throw new Error('Endfassung stimmt nicht mit der lueckenlosen Aenderungskette ueberein.');

  const reviewValue = own(root, 'review', 'Assistenznachweis'), persistenceValue = own(root, 'persistence', 'Assistenznachweis');
  let status: DocumentationAssistantEvidence['status'] = 'awaiting_professional_review', responsibleProfileId: string | null = null, reviewedAt: string | null = null, persistedAt: string | null = null, reviewId: string | null = null;
  if (reviewValue !== null) {
    const review = object(reviewValue, 'Fachpruefung'); exact(review, ['reviewId', 'draftId', 'finalDraftSha256', 'reviewerProfileId', 'permissionKey', 'permissionEvidenceId', 'responsibilityAccepted', 'decision', 'reviewedAt'], 'Fachpruefung');
    reviewId = id(own(review, 'reviewId', 'Fachpruefung'), 'Pruefkennung'); responsibleProfileId = id(own(review, 'reviewerProfileId', 'Fachpruefung'), 'Verantwortungsprofil');
    if (id(own(review, 'draftId', 'Fachpruefung'), 'Pruefentwurf') !== draftId || hash(own(review, 'finalDraftSha256', 'Fachpruefung'), 'Pruefsumme') !== finalDraftSha256
      || own(review, 'permissionKey', 'Fachpruefung') !== 'pflege.documentation_assistant.review') throw new Error('Fachpruefung ist nicht exakt an Endfassung und Berechtigung gebunden.');
    id(own(review, 'permissionEvidenceId', 'Fachpruefung'), 'Pruefberechtigungsbeleg'); const reviewTime = instant(own(review, 'reviewedAt', 'Fachpruefung'), 'Pruefzeit');
    if (reviewTime.micros < previousTime || reviewTime.micros > evaluatedAt.micros) throw new Error('Fachpruefung verletzt die Mikrosekundenfolge.'); reviewedAt = reviewTime.text;
    const decision = own(review, 'decision', 'Fachpruefung'); if (decision !== 'approved' && decision !== 'rejected') throw new Error('Fachpruefung enthaelt keine erlaubte Entscheidung.');
    if ((decision === 'approved') !== (own(review, 'responsibilityAccepted', 'Fachpruefung') === true)) throw new Error('Genehmigung und ausdrueckliche Verantwortungsuebernahme stimmen nicht ueberein.');
    status = decision === 'approved' ? 'confirmed_not_persisted' : 'professionally_rejected';
  }
  if (persistenceValue !== null) {
    if (status !== 'confirmed_not_persisted' || !reviewId || !responsibleProfileId || !reviewedAt) throw new Error('Assistenzentwurf darf nicht vor fachlicher Bestaetigung gespeichert werden.');
    const persistence = object(persistenceValue, 'Speicherbeleg'); exact(persistence, ['persistenceId', 'draftId', 'finalDraftSha256', 'reviewId', 'responsibleProfileId', 'storedDocumentId', 'receiptSha256', 'persistedAt'], 'Speicherbeleg');
    id(own(persistence, 'persistenceId', 'Speicherbeleg'), 'Speicherkennung');
    if (id(own(persistence, 'draftId', 'Speicherbeleg'), 'Speicherentwurf') !== draftId || hash(own(persistence, 'finalDraftSha256', 'Speicherbeleg'), 'Speichersumme') !== finalDraftSha256
      || id(own(persistence, 'reviewId', 'Speicherbeleg'), 'Speicherpruefung') !== reviewId || id(own(persistence, 'responsibleProfileId', 'Speicherbeleg'), 'Speicherverantwortung') !== responsibleProfileId) throw new Error('Speicherbeleg ist nicht exakt an Endfassung, Pruefung und Verantwortung gebunden.');
    id(own(persistence, 'storedDocumentId', 'Speicherbeleg'), 'Dokumentkennung'); hash(own(persistence, 'receiptSha256', 'Speicherbeleg'), 'Speicherbelegsumme'); const persistenceTime = instant(own(persistence, 'persistedAt', 'Speicherbeleg'), 'Speicherzeit');
    if (persistenceTime.micros < instant(reviewedAt, 'Pruefzeit').micros || persistenceTime.micros > evaluatedAt.micros) throw new Error('Speicherung verletzt die Ereignisfolge.'); persistedAt = persistenceTime.text; status = 'persisted_after_confirmation';
  }
  return Object.freeze({ tenantId, clientId, releaseCandidateId, draftId, status, sourceCount: sourceIds.size, claimCount: claimIds.size, editCount, responsibleProfileId, reviewedAt, persistedAt,
    clinicalPerformanceInferred: false, taskCompletionInferred: false, functionalAcceptanceInferred: false, careAcceptanceInferred: false, designAcceptanceInferred: false, legalAcceptanceInferred: false });
}
