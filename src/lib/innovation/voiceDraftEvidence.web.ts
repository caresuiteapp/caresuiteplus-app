export type VoiceDraftEvidence = Readonly<{
  tenantId: string;
  clientId: string;
  releaseCandidateId: string;
  draftId: string;
  status: 'awaiting_professional_review' | 'professionally_rejected' | 'confirmed_not_persisted' | 'persisted_after_confirmation';
  reviewedAt: string | null;
  persistedAt: string | null;
  recordingConsentValidForCapture: true;
  everySpeakerManuallyAssigned: true;
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
function id(value: unknown, label: string): string {
  if (typeof value !== 'string' || !UUID.test(value)) throw new Error(`${label} ist keine native UUID.`);
  return value;
}
function hash(value: unknown, label: string): string {
  if (typeof value !== 'string' || !SHA256.test(value)) throw new Error(`${label} ist kein SHA-256-Originalwert.`);
  return value;
}
function instant(value: unknown, label: string): { text: string; micros: bigint } {
  if (typeof value !== 'string') throw new Error(`${label} ist kein vollstaendiger ISO-Zeitpunkt.`);
  const match = INSTANT.exec(value);
  if (!match) throw new Error(`${label} ist kein vollstaendiger ISO-Zeitpunkt.`);
  const [, y, m, d, h, min, s, fraction, zone, sign, zh, zm] = match;
  const year = Number(y), month = Number(m), day = Number(d), hour = Number(h), minute = Number(min), second = Number(s), zoneHour = Number(zh ?? 0), zoneMinute = Number(zm ?? 0);
  const monthDays = month >= 1 && month <= 12 ? new Date(Date.UTC(year, month, 0)).getUTCDate() : 0;
  if (year < 1 || day < 1 || day > monthDays || hour > 23 || minute > 59 || second > 59 || zoneHour > 23 || zoneMinute > 59) throw new Error(`${label} enthaelt kein gueltiges Kalenderdatum.`);
  const offset = zone === 'Z' ? 0 : (sign === '-' ? -1 : 1) * (zoneHour * 60 + zoneMinute);
  return { text: value, micros: BigInt(Date.UTC(year, month - 1, day, hour, minute, second) - offset * 60_000) * 1000n + BigInt(fraction.padEnd(6, '0')) };
}
function array(value: unknown, label: string): unknown[] { if (!Array.isArray(value)) throw new Error(`${label} ist keine Originalmenge.`); return value; }

/** Requires explicit recording consent, manual person attribution, professional review, then optional persistence. */
export function projectVoiceDraftEvidence(input: unknown): VoiceDraftEvidence {
  const root = object(input, 'Sprachentwurfsnachweis');
  exact(root, ['tenantId', 'clientId', 'releaseCandidateId', 'buildSha256', 'draftId', 'draftSha256', 'consent', 'capture', 'transcript', 'speakerAssignments', 'review', 'persistence', 'evaluatedAt'], 'Sprachentwurfsnachweis');
  const tenantId = id(own(root, 'tenantId', 'Sprachentwurfsnachweis'), 'Mandantenkennung'), clientId = id(own(root, 'clientId', 'Sprachentwurfsnachweis'), 'Pflegefallkennung');
  const releaseCandidateId = id(own(root, 'releaseCandidateId', 'Sprachentwurfsnachweis'), 'Kandidatenkennung'), draftId = id(own(root, 'draftId', 'Sprachentwurfsnachweis'), 'Entwurfskennung');
  const buildSha256 = hash(own(root, 'buildSha256', 'Sprachentwurfsnachweis'), 'Buildsumme'), draftSha256 = hash(own(root, 'draftSha256', 'Sprachentwurfsnachweis'), 'Entwurfssumme');
  const evaluatedAt = instant(own(root, 'evaluatedAt', 'Sprachentwurfsnachweis'), 'Auswertungszeit');

  const consent = object(own(root, 'consent', 'Sprachentwurfsnachweis'), 'Aufnahmefreigabe');
  exact(consent, ['consentId', 'tenantId', 'clientId', 'purpose', 'decision', 'decidedAt', 'revokedAt'], 'Aufnahmefreigabe');
  const consentId = id(own(consent, 'consentId', 'Aufnahmefreigabe'), 'Freigabekennung');
  if (id(own(consent, 'tenantId', 'Aufnahmefreigabe'), 'Freigabemandant') !== tenantId || id(own(consent, 'clientId', 'Aufnahmefreigabe'), 'Freigabepflegefall') !== clientId
    || own(consent, 'purpose', 'Aufnahmefreigabe') !== 'care_documentation_voice_draft' || own(consent, 'decision', 'Aufnahmefreigabe') !== 'granted') throw new Error('Aufnahmefreigabe ist nicht explizit fuer diesen Sprachentwurf erteilt.');
  const decidedAt = instant(own(consent, 'decidedAt', 'Aufnahmefreigabe'), 'Freigabezeit');
  const revokedValue = own(consent, 'revokedAt', 'Aufnahmefreigabe'), revokedAt = revokedValue === null ? null : instant(revokedValue, 'Widerrufszeit');

  const capture = object(own(root, 'capture', 'Sprachentwurfsnachweis'), 'Aufnahme');
  exact(capture, ['captureId', 'tenantId', 'clientId', 'releaseCandidateId', 'buildSha256', 'consentId', 'capturedByProfileId', 'permissionKey', 'permissionEvidenceId', 'startedAt', 'endedAt', 'recordingSha256'], 'Aufnahme');
  const captureId = id(own(capture, 'captureId', 'Aufnahme'), 'Aufnahmekennung');
  if (id(own(capture, 'tenantId', 'Aufnahme'), 'Aufnahmemandant') !== tenantId || id(own(capture, 'clientId', 'Aufnahme'), 'Aufnahmepflegefall') !== clientId
    || id(own(capture, 'releaseCandidateId', 'Aufnahme'), 'Aufnahmekandidat') !== releaseCandidateId || hash(own(capture, 'buildSha256', 'Aufnahme'), 'Aufnahmebuildsumme') !== buildSha256
    || id(own(capture, 'consentId', 'Aufnahme'), 'Aufnahmefreigabebindung') !== consentId || own(capture, 'permissionKey', 'Aufnahme') !== 'pflege.voice_drafts.capture') throw new Error('Aufnahme ist nicht exakt an Fall, Kandidat, Build, Freigabe und Berechtigung gebunden.');
  id(own(capture, 'capturedByProfileId', 'Aufnahme'), 'Aufnahmeprofil'); id(own(capture, 'permissionEvidenceId', 'Aufnahme'), 'Aufnahmeberechtigungsbeleg'); hash(own(capture, 'recordingSha256', 'Aufnahme'), 'Aufnahmesumme');
  const startedAt = instant(own(capture, 'startedAt', 'Aufnahme'), 'Aufnahmestart'), endedAt = instant(own(capture, 'endedAt', 'Aufnahme'), 'Aufnahmeende');
  if (decidedAt.micros > startedAt.micros || startedAt.micros > endedAt.micros || endedAt.micros > evaluatedAt.micros || (revokedAt && revokedAt.micros <= endedAt.micros)) throw new Error('Aufnahme liegt ausserhalb der wirksamen Freigabe oder Ereignisfolge.');

  const transcript = object(own(root, 'transcript', 'Sprachentwurfsnachweis'), 'Transkript');
  exact(transcript, ['transcriptId', 'captureId', 'engine', 'engineVersion', 'transcriptSha256', 'segmentIds', 'generatedAt'], 'Transkript');
  const transcriptId = id(own(transcript, 'transcriptId', 'Transkript'), 'Transkriptkennung');
  if (id(own(transcript, 'captureId', 'Transkript'), 'Transkriptaufnahme') !== captureId) throw new Error('Transkript ist nicht an die Aufnahme gebunden.');
  const engine = own(transcript, 'engine', 'Transkript'), engineVersion = own(transcript, 'engineVersion', 'Transkript');
  if (typeof engine !== 'string' || !engine.trim() || typeof engineVersion !== 'string' || !VERSION.test(engineVersion)) throw new Error('Transkript besitzt keine konkrete Engine und Version.');
  const transcriptSha256 = hash(own(transcript, 'transcriptSha256', 'Transkript'), 'Transkriptsumme');
  const segmentIds = array(own(transcript, 'segmentIds', 'Transkript'), 'Segmentkennungen').map((value) => id(value, 'Segmentkennung'));
  if (!segmentIds.length || new Set(segmentIds).size !== segmentIds.length) throw new Error('Transkriptsegmente fehlen oder sind doppelt.');
  const generatedAt = instant(own(transcript, 'generatedAt', 'Transkript'), 'Transkriptzeit');
  if (generatedAt.micros < endedAt.micros || generatedAt.micros > evaluatedAt.micros) throw new Error('Transkriptzeit verletzt die Ereignisfolge.');

  const assigned = new Set<string>(), assignmentTimes: bigint[] = [];
  for (const value of array(own(root, 'speakerAssignments', 'Sprachentwurfsnachweis'), 'Personenzuordnungen')) {
    const assignment = object(value, 'Personenzuordnung'); exact(assignment, ['assignmentId', 'transcriptId', 'segmentId', 'personId', 'assignedByProfileId', 'assignedAt', 'manualConfirmation'], 'Personenzuordnung');
    id(own(assignment, 'assignmentId', 'Personenzuordnung'), 'Zuordnungskennung');
    if (id(own(assignment, 'transcriptId', 'Personenzuordnung'), 'Zuordnungstranskript') !== transcriptId) throw new Error('Personenzuordnung ist nicht an das Transkript gebunden.');
    const segmentId = id(own(assignment, 'segmentId', 'Personenzuordnung'), 'Zuordnungssegment');
    if (!segmentIds.includes(segmentId) || assigned.has(segmentId)) throw new Error('Personenzuordnung fehlt, ist fremd oder doppelt.');
    assigned.add(segmentId); id(own(assignment, 'personId', 'Personenzuordnung'), 'Personenkennung'); id(own(assignment, 'assignedByProfileId', 'Personenzuordnung'), 'Zuordnungsprofil');
    if (own(assignment, 'manualConfirmation', 'Personenzuordnung') !== true) throw new Error('Personenzuordnung wurde nicht manuell bestaetigt.');
    const assignedAt = instant(own(assignment, 'assignedAt', 'Personenzuordnung'), 'Zuordnungszeit'); if (assignedAt.micros < generatedAt.micros || assignedAt.micros > evaluatedAt.micros) throw new Error('Personenzuordnung verletzt die Ereignisfolge.');
    assignmentTimes.push(assignedAt.micros);
  }
  if (assigned.size !== segmentIds.length) throw new Error('Nicht alle Transkriptsegmente sind einer bestaetigten Person zugeordnet.');

  const reviewValue = own(root, 'review', 'Sprachentwurfsnachweis'), persistenceValue = own(root, 'persistence', 'Sprachentwurfsnachweis');
  let status: VoiceDraftEvidence['status'] = 'awaiting_professional_review', reviewedAt: string | null = null, persistedAt: string | null = null, reviewId: string | null = null;
  if (reviewValue !== null) {
    const review = object(reviewValue, 'Fachpruefung'); exact(review, ['reviewId', 'draftId', 'draftSha256', 'transcriptId', 'transcriptSha256', 'reviewerProfileId', 'permissionKey', 'permissionEvidenceId', 'reviewedAt', 'decision', 'segmentCount'], 'Fachpruefung');
    reviewId = id(own(review, 'reviewId', 'Fachpruefung'), 'Pruefkennung');
    if (id(own(review, 'draftId', 'Fachpruefung'), 'Pruefentwurf') !== draftId || hash(own(review, 'draftSha256', 'Fachpruefung'), 'Pruefentwurfssumme') !== draftSha256
      || id(own(review, 'transcriptId', 'Fachpruefung'), 'Prueftranskript') !== transcriptId || hash(own(review, 'transcriptSha256', 'Fachpruefung'), 'Prueftranskriptsumme') !== transcriptSha256
      || own(review, 'permissionKey', 'Fachpruefung') !== 'pflege.voice_drafts.review' || own(review, 'segmentCount', 'Fachpruefung') !== segmentIds.length) throw new Error('Fachpruefung ist nicht exakt an Entwurf, Transkript, Segmente und Berechtigung gebunden.');
    id(own(review, 'reviewerProfileId', 'Fachpruefung'), 'Prueferprofil'); id(own(review, 'permissionEvidenceId', 'Fachpruefung'), 'Pruefberechtigungsbeleg');
    const reviewTime = instant(own(review, 'reviewedAt', 'Fachpruefung'), 'Pruefzeit');
    if (assignmentTimes.some((value) => value > reviewTime.micros) || reviewTime.micros > evaluatedAt.micros) throw new Error('Fachpruefung liegt ausserhalb der kausalen Ereignisfolge.');
    reviewedAt = reviewTime.text; const decision = own(review, 'decision', 'Fachpruefung');
    if (decision !== 'approved' && decision !== 'rejected') throw new Error('Fachpruefung enthaelt keine erlaubte Entscheidung.');
    status = decision === 'approved' ? 'confirmed_not_persisted' : 'professionally_rejected';
  }
  if (persistenceValue !== null) {
    if (status !== 'confirmed_not_persisted' || !reviewId || !reviewedAt) throw new Error('Sprachentwurf darf nicht vor fachlicher Bestaetigung gespeichert werden.');
    const persistence = object(persistenceValue, 'Speicherbeleg'); exact(persistence, ['persistenceId', 'draftId', 'draftSha256', 'reviewId', 'storedDocumentId', 'receiptSha256', 'persistedAt'], 'Speicherbeleg');
    id(own(persistence, 'persistenceId', 'Speicherbeleg'), 'Speicherkennung');
    if (id(own(persistence, 'draftId', 'Speicherbeleg'), 'Speicherentwurf') !== draftId || hash(own(persistence, 'draftSha256', 'Speicherbeleg'), 'Speicherentwurfssumme') !== draftSha256
      || id(own(persistence, 'reviewId', 'Speicherbeleg'), 'Speicherpruefung') !== reviewId) throw new Error('Speicherbeleg ist nicht exakt an bestaetigten Entwurf und Pruefung gebunden.');
    id(own(persistence, 'storedDocumentId', 'Speicherbeleg'), 'Dokumentkennung'); hash(own(persistence, 'receiptSha256', 'Speicherbeleg'), 'Speicherbelegsumme');
    const persistenceTime = instant(own(persistence, 'persistedAt', 'Speicherbeleg'), 'Speicherzeit');
    if (persistenceTime.micros < instant(reviewedAt, 'Pruefzeit').micros || persistenceTime.micros > evaluatedAt.micros) throw new Error('Speicherung verletzt die Ereignisfolge.');
    persistedAt = persistenceTime.text; status = 'persisted_after_confirmation';
  }
  return Object.freeze({ tenantId, clientId, releaseCandidateId, draftId, status, reviewedAt, persistedAt, recordingConsentValidForCapture: true,
    everySpeakerManuallyAssigned: true, clinicalPerformanceInferred: false, taskCompletionInferred: false, functionalAcceptanceInferred: false,
    careAcceptanceInferred: false, designAcceptanceInferred: false, legalAcceptanceInferred: false });
}
