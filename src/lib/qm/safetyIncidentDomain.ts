export type SafetyIncidentEvidence = {
  evidenceId: string;
  sourceType: 'care_record' | 'tour_stop_emergency' | 'qm_document_version' | 'incident_report' | 'other';
  sourceEntityId: string;
  sourceVersionId: string | null;
  recordLocator: string;
  sourceSha256: string;
};

export type SafetyIncidentEventInput = {
  eventId: string;
  clientRequestId: string;
  kind: 'immediate_action' | 'causal_analysis' | 'corrective_action' | 'effectiveness_review' | 'closure' | 'reopened';
  occurredAt: string;
  recordedAt: string;
  actorId: string;
  actorName: string;
  summary: string;
  evidence: readonly SafetyIncidentEvidence[];
  assignedOwnerId: string | null;
  assignedOwnerName: string | null;
  dueAt: string | null;
  reviewOutcome: 'effective' | 'partially_effective' | 'not_effective' | null;
  closureOutcome: 'risk_controlled' | 'follow_up_required' | 'closed_without_harm_inference' | null;
  resultSha256: string | null;
  referencesEventIds: readonly string[];
};

export type SafetyIncidentInput = {
  incidentId: string;
  clientRequestId: string;
  tenantId: string;
  classification: 'error' | 'near_miss';
  category: 'medication' | 'fall' | 'documentation' | 'communication' | 'hygiene' | 'care_process' | 'other';
  careSetting: 'home_visit' | 'office' | 'transport' | 'remote' | 'other';
  clientId: string | null;
  sourceEmergencyId: string | null;
  description: string;
  impactCode: 'not_reached' | 'no_observed_harm' | 'temporary_harm' | 'permanent_harm' | 'death' | 'unknown';
  impactSummary: string;
  occurredAt: string;
  observedAt: string;
  recordedAt: string;
  reporterMode: 'named' | 'anonymous';
  reporterId: string | null;
  reporterName: string | null;
  recordedBy: string;
  recordedByName: string;
  events: readonly SafetyIncidentEventInput[];
};

export type SafetyIncident = SafetyIncidentInput & {
  status: 'reported' | 'analysing' | 'action_open' | 'reviewed' | 'closed';
  cycle: number;
  careCompletion: 'not_inferred';
  faultAttribution: 'not_inferred';
  historyMode: 'append_only';
};

export type AnonymousSafetyAggregate = {
  quarter: string;
  classification: SafetyIncidentInput['classification'];
  category: SafetyIncidentInput['category'];
  incidentCount: number | null;
  suppressed: boolean;
};

const exactUtcMicros = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}(?:Z|\+00:00)$/;
const sha256 = /^[0-9a-f]{64}$/;
const classifications = ['error', 'near_miss'] as const;
const categories = ['medication', 'fall', 'documentation', 'communication', 'hygiene', 'care_process', 'other'] as const;
const settings = ['home_visit', 'office', 'transport', 'remote', 'other'] as const;
const impacts = ['not_reached', 'no_observed_harm', 'temporary_harm', 'permanent_harm', 'death', 'unknown'] as const;
const outcomes = ['effective', 'partially_effective', 'not_effective'] as const;
const closureOutcomes = ['risk_controlled', 'follow_up_required', 'closed_without_harm_inference'] as const;
function required(value: string | null | undefined, label: string) { if (typeof value !== 'string' || !value.trim()) throw Error(`${label} fehlt.`); return value.trim(); }
function micros(value: string, label: string) { const v = required(value, label); if (!exactUtcMicros.test(v) || Number.isNaN(Date.parse(v))) throw Error(`${label} benötigt exakt sechs UTC-Mikrosekundenstellen.`); return v; }
function fingerprint(value: string | null, label: string) { const v = required(value, label); if (!sha256.test(v)) throw Error(`${label} benötigt einen SHA-256-Fingerprint.`); return v; }

export function buildSafetyIncident(input: SafetyIncidentInput): SafetyIncident {
  for (const [value, label] of [[input.incidentId, 'Ereignis'], [input.clientRequestId, 'Anforderungs-ID'], [input.tenantId, 'Mandant'], [input.description, 'Beschreibung'], [input.impactSummary, 'Auswirkung'], [input.recordedBy, 'Erfassungsidentität'], [input.recordedByName, 'Erfassungsname']] as const) required(value, label);
  if (!classifications.includes(input.classification)) throw Error('Ereignisklassifikation ist ungültig.');
  if (!categories.includes(input.category)) throw Error('Ereigniskategorie ist ungültig.');
  if (!settings.includes(input.careSetting)) throw Error('Versorgungsumfeld ist ungültig.');
  if (!impacts.includes(input.impactCode)) throw Error('Auswirkungscode ist ungültig.');
  if (input.classification === 'near_miss' && input.impactCode !== 'not_reached') throw Error('Beinahefehler darf keine eingetretene Auswirkung behaupten.');
  if (input.classification === 'error' && input.impactCode === 'not_reached') throw Error('Fehler darf nicht als nicht erreichtes Ereignis bezeichnet werden.');
  if (input.reporterMode === 'anonymous' && (input.reporterId || input.reporterName)) throw Error('Anonyme Meldung darf keine meldende Identität enthalten.');
  if (input.reporterMode === 'named') { required(input.reporterId, 'Meldendenidentität'); required(input.reporterName, 'Meldendenname'); }
  if (!['named', 'anonymous'].includes(input.reporterMode)) throw Error('Meldungsart ist ungültig.');
  const occurredAt = micros(input.occurredAt, 'Ereigniszeit'); const observedAt = micros(input.observedAt, 'Beobachtungszeit'); const recordedAt = micros(input.recordedAt, 'Erfassungszeit');
  if (occurredAt > observedAt || observedAt > recordedAt) throw Error('Ereignis, Beobachtung und Erfassung sind zeitlich widersprüchlich.');
  const eventIds = new Set<string>(), requestIds = new Set<string>(), evidenceIds = new Set<string>(); let lastAt = occurredAt, lastRecordedAt = recordedAt, status: SafetyIncident['status'] = 'reported', cycle = 1; let causes = new Set<string>(), actions = new Set<string>(), reviews = new Set<string>();
  const events = input.events.map(event => {
    for (const [value, label] of [[event.eventId, 'Verlaufseintrag'], [event.clientRequestId, 'Verlaufs-Anforderungs-ID'], [event.actorId, 'Verlaufsautor'], [event.actorName, 'Verlaufsautorname'], [event.summary, 'Verlaufsinhalt']] as const) required(value, label);
    if (eventIds.has(event.eventId) || requestIds.has(event.clientRequestId)) throw Error('Verlaufseintrag oder Anforderungs-ID ist doppelt.'); eventIds.add(event.eventId); requestIds.add(event.clientRequestId);
    const eventAt = micros(event.occurredAt, 'Verlaufszeit'); const eventRecordedAt = micros(event.recordedAt, 'Verlaufserfassungszeit'); if (eventAt < lastAt || eventRecordedAt < eventAt || eventRecordedAt < lastRecordedAt) throw Error('Verlauf ist zeitlich widersprüchlich.'); lastAt = eventAt; lastRecordedAt = eventRecordedAt;
    const evidence = event.evidence.map(item => { for (const [value, label] of [[item.evidenceId, 'Beleg'], [item.sourceEntityId, 'Belegquelle'], [item.recordLocator, 'Aktenstelle']] as const) required(value, label); if (!['care_record', 'tour_stop_emergency', 'qm_document_version', 'incident_report', 'other'].includes(item.sourceType)) throw Error('Belegart ist ungültig.'); if (evidenceIds.has(item.evidenceId)) throw Error('Beleg ist doppelt.'); evidenceIds.add(item.evidenceId); fingerprint(item.sourceSha256, 'Beleg'); return Object.freeze({ ...item }); });
    if (new Set(event.referencesEventIds).size !== event.referencesEventIds.length || event.referencesEventIds.some(id => !eventIds.has(id))) throw Error('Verlaufsreferenz fehlt, ist doppelt oder zeigt in die Zukunft.');
    if (status === 'closed' && event.kind !== 'reopened') throw Error('Geschlossenes Ereignis benötigt eine ausdrückliche Wiederaufnahme.');
    if (event.kind === 'immediate_action') { if (!evidence.length) throw Error('Sofortmaßnahme benötigt einen konkreten Beleg.'); status = 'action_open'; }
    else if (event.kind === 'causal_analysis') { if (!evidence.length || event.assignedOwnerId || event.dueAt || event.reviewOutcome || event.closureOutcome || event.resultSha256) throw Error('Ursachenanalyse benötigt Beleg und darf Maßnahme, Prüfung oder Abschluss nicht vermischen.'); causes.add(event.eventId); status = 'analysing'; }
    else if (event.kind === 'corrective_action') { required(event.assignedOwnerId, 'Maßnahmenverantwortung'); required(event.assignedOwnerName, 'Maßnahmenverantwortliche Person'); const dueAt = micros(required(event.dueAt, 'Maßnahmenfrist'), 'Maßnahmenfrist'); if (dueAt <= eventAt || !evidence.length || !event.referencesEventIds.some(id => causes.has(id))) throw Error('Korrekturmaßnahme benötigt Ursache, Verantwortung, zukünftige Frist und Beleg.'); if (event.reviewOutcome || event.closureOutcome || event.resultSha256) throw Error('Korrekturmaßnahme darf Prüfung oder Abschluss nicht vorwegnehmen.'); actions.add(event.eventId); status = 'action_open'; }
    else if (event.kind === 'effectiveness_review') { if (!event.reviewOutcome || !outcomes.includes(event.reviewOutcome) || !evidence.length || !event.resultSha256) throw Error('Wirksamkeitsprüfung benötigt Ergebnis, Beleg und Fingerprint.'); fingerprint(event.resultSha256, 'Prüfergebnis'); if (!event.referencesEventIds.some(id => actions.has(id))) throw Error('Wirksamkeitsprüfung muss eine Korrekturmaßnahme des aktuellen Zyklus referenzieren.'); if (event.assignedOwnerId || event.dueAt || event.closureOutcome) throw Error('Wirksamkeitsprüfung darf Verantwortung oder Abschluss nicht vermischen.'); reviews.add(event.eventId); status = 'reviewed'; }
    else if (event.kind === 'closure') { if (!causes.size || !actions.size || !reviews.size || !event.closureOutcome || !closureOutcomes.includes(event.closureOutcome) || !event.resultSha256 || !evidence.length) throw Error('Abschluss benötigt Ursache, Maßnahme, Wirksamkeitsprüfung, Ergebnis und Beleg.'); fingerprint(event.resultSha256, 'Abschlussergebnis'); if (![causes, actions, reviews].every(set => event.referencesEventIds.some(id => set.has(id)))) throw Error('Abschluss muss Ursache, Maßnahme und Wirksamkeitsprüfung des aktuellen Zyklus referenzieren.'); if (event.assignedOwnerId || event.dueAt || event.reviewOutcome) throw Error('Abschluss darf keine neue Maßnahme oder Prüfung erfinden.'); status = 'closed'; }
    else if (event.kind === 'reopened') { if (status !== 'closed' || evidence.length || event.assignedOwnerId || event.dueAt || event.reviewOutcome || event.closureOutcome || event.resultSha256) throw Error('Wiederaufnahme ist nur nach Abschluss als begründeter eigener Eintrag zulässig.'); cycle += 1; causes = new Set(); actions = new Set(); reviews = new Set(); status = 'reported'; }
    else throw Error('Verlaufsart ist ungültig.');
    return Object.freeze({ ...event, occurredAt: eventAt, recordedAt: eventRecordedAt, evidence: Object.freeze(evidence), referencesEventIds: Object.freeze([...event.referencesEventIds]) });
  });
  return Object.freeze({ ...input, occurredAt, observedAt, recordedAt, events: Object.freeze(events), status, cycle, careCompletion: 'not_inferred', faultAttribution: 'not_inferred', historyMode: 'append_only' });
}

export function buildAnonymousSafetyAggregate(inputs: readonly SafetyIncident[], minimumCohort = 5): AnonymousSafetyAggregate[] {
  if (!Number.isInteger(minimumCohort) || minimumCohort < 5) throw Error('Anonymisierung benötigt mindestens fünf Fälle je Kohorte.');
  const groups = new Map<string, { quarter: string; classification: SafetyIncidentInput['classification']; category: SafetyIncidentInput['category']; count: number }>();
  for (const item of inputs) { const month = Number(item.occurredAt.slice(5, 7)); const quarter = `${item.occurredAt.slice(0, 4)}-Q${Math.ceil(month / 3)}`; const key = `${quarter}|${item.classification}|${item.category}`; const group = groups.get(key) ?? { quarter, classification: item.classification, category: item.category, count: 0 }; group.count += 1; groups.set(key, group); }
  return [...groups.values()].filter(group => group.count >= minimumCohort).sort((a, b) => `${a.quarter}|${a.classification}|${a.category}`.localeCompare(`${b.quarter}|${b.classification}|${b.category}`)).map(group => Object.freeze({ quarter: group.quarter, classification: group.classification, category: group.category, incidentCount: group.count, suppressed: false }));
}
