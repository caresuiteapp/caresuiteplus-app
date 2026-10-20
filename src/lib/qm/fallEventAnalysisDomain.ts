export type FallEventEvidence = {
  evidenceId: string;
  sourceType: 'safety_incident' | 'care_record' | 'care_plan_version' | 'tour_stop_emergency' | 'assessment' | 'other';
  sourceEntityId: string;
  sourceVersionId: string | null;
  recordLocator: string;
  sourceSha256: string;
};

export type FallEventAnalysisEventInput = {
  eventId: string;
  clientRequestId: string;
  kind: 'causal_analysis' | 'care_adjustment' | 'repeat_check' | 'analysis_closure' | 'reopened';
  occurredAt: string;
  recordedAt: string;
  actorId: string;
  actorName: string;
  summary: string;
  evidence: readonly FallEventEvidence[];
  referencesEventIds: readonly string[];
  factorCodes: readonly ('intrinsic' | 'medication' | 'environment' | 'assistive_device' | 'care_process' | 'unknown')[];
  causeCertainty: 'confirmed' | 'contributing' | 'unclear' | null;
  uncertaintyNote: string | null;
  responsibleId: string | null;
  responsibleName: string | null;
  carePlanId: string | null;
  carePlanVersionId: string | null;
  effectiveAt: string | null;
  plannedReviewDueAt: string | null;
  observedFrom: string | null;
  observedUntil: string | null;
  reviewOutcome: 'effective' | 'partially_effective' | 'not_effective' | 'insufficient_observation' | null;
  recurrenceObserved: boolean | null;
  resultSha256: string | null;
};

export type FallEventAnalysisInput = {
  analysisId: string;
  clientRequestId: string;
  tenantId: string;
  clientId: string;
  sourceSafetyIncidentId: string;
  sourceCareRecordId: string;
  eventType: 'fall' | 'other_care_event';
  eventSummary: string;
  documentedConsequences: string;
  occurredAt: string;
  observedAt: string;
  recordedAt: string;
  recordedBy: string;
  recordedByName: string;
  events: readonly FallEventAnalysisEventInput[];
};

export type FallEventAnalysis = FallEventAnalysisInput & {
  status: 'reported' | 'analysing' | 'adjustment_active' | 'repeat_checked' | 'analysis_closed';
  cycle: number;
  careCompletion: 'not_inferred';
  incidentResolution: 'not_inferred';
  clinicalCauseCertainty: 'not_inferred';
  historyMode: 'append_only';
};

const exactUtcMicros = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}(?:Z|\+00:00)$/;
const sha256 = /^[0-9a-f]{64}$/;
const factors = ['intrinsic', 'medication', 'environment', 'assistive_device', 'care_process', 'unknown'] as const;
const outcomes = ['effective', 'partially_effective', 'not_effective', 'insufficient_observation'] as const;
const evidenceTypes = ['safety_incident', 'care_record', 'care_plan_version', 'tour_stop_emergency', 'assessment', 'other'] as const;
function required(value: string | null | undefined, label: string) { if (typeof value !== 'string' || !value.trim()) throw Error(`${label} fehlt.`); return value.trim(); }
function micros(value: string | null | undefined, label: string) { const v = required(value, label); if (!exactUtcMicros.test(v) || Number.isNaN(Date.parse(v))) throw Error(`${label} benötigt exakt sechs UTC-Mikrosekundenstellen.`); return v; }
function fingerprint(value: string | null, label: string) { const v = required(value, label); if (!sha256.test(v)) throw Error(`${label} benötigt einen SHA-256-Fingerprint.`); return v; }
function none(value: unknown) { return value === null || value === undefined || (Array.isArray(value) && value.length === 0); }

export function buildFallEventAnalysis(input: FallEventAnalysisInput): FallEventAnalysis {
  for (const [value, label] of [[input.analysisId, 'Analyse'], [input.clientRequestId, 'Anforderungs-ID'], [input.tenantId, 'Mandant'], [input.clientId, 'Pflegefall'], [input.sourceSafetyIncidentId, 'Ausgangsereignis'], [input.sourceCareRecordId, 'Pflegeverlaufsquelle'], [input.eventSummary, 'Ereignisbeschreibung'], [input.documentedConsequences, 'Dokumentierte Folgen'], [input.recordedBy, 'Erfassungsidentität'], [input.recordedByName, 'Erfassungsname']] as const) required(value, label);
  if (!['fall', 'other_care_event'].includes(input.eventType)) throw Error('Ereignisart ist ungültig.');
  const occurredAt = micros(input.occurredAt, 'Ereigniszeit'); const observedAt = micros(input.observedAt, 'Beobachtungszeit'); const recordedAt = micros(input.recordedAt, 'Erfassungszeit');
  if (occurredAt > observedAt || observedAt > recordedAt) throw Error('Ereignis, Beobachtung und Erfassung sind zeitlich widersprüchlich.');
  const ids = new Set<string>(), requests = new Set<string>(), evidenceIds = new Set<string>(); let lastAt = occurredAt, lastRecordedAt = recordedAt, status: FallEventAnalysis['status'] = 'reported', cycle = 1; let causes = new Set<string>(), adjustments = new Set<string>(), checks = new Set<string>();
  const events = input.events.map(event => {
    for (const [value, label] of [[event.eventId, 'Verlaufseintrag'], [event.clientRequestId, 'Verlaufs-Anforderungs-ID'], [event.actorId, 'Verlaufsautor'], [event.actorName, 'Verlaufsautorname'], [event.summary, 'Verlaufsinhalt']] as const) required(value, label);
    if (ids.has(event.eventId) || requests.has(event.clientRequestId)) throw Error('Verlaufseintrag oder Anforderungs-ID ist doppelt.'); ids.add(event.eventId); requests.add(event.clientRequestId);
    const eventAt = micros(event.occurredAt, 'Verlaufszeit'); const eventRecordedAt = micros(event.recordedAt, 'Verlaufserfassungszeit'); if (eventAt < lastAt || eventRecordedAt < eventAt || eventRecordedAt < lastRecordedAt) throw Error('Verlauf ist zeitlich widersprüchlich.'); lastAt = eventAt; lastRecordedAt = eventRecordedAt;
    const evidence = event.evidence.map(item => { for (const [value, label] of [[item.evidenceId, 'Beleg'], [item.sourceEntityId, 'Belegquelle'], [item.recordLocator, 'Aktenstelle']] as const) required(value, label); if (!evidenceTypes.includes(item.sourceType)) throw Error('Belegart ist ungültig.'); if (evidenceIds.has(item.evidenceId)) throw Error('Beleg ist doppelt.'); evidenceIds.add(item.evidenceId); fingerprint(item.sourceSha256, 'Beleg'); return Object.freeze({ ...item }); });
    if (new Set(event.referencesEventIds).size !== event.referencesEventIds.length || event.referencesEventIds.some(id => !ids.has(id))) throw Error('Verlaufsreferenz fehlt, ist doppelt oder zeigt in die Zukunft.');
    if (status === 'analysis_closed' && event.kind !== 'reopened') throw Error('Geschlossene Analyse benötigt eine ausdrückliche Wiederaufnahme.');
    if (event.kind === 'causal_analysis') {
      if (!evidence.length || !event.factorCodes.length || new Set(event.factorCodes).size !== event.factorCodes.length || event.factorCodes.some(code => !factors.includes(code))) throw Error('Ursachenanalyse benötigt gültige Faktoren und Originalbelege.');
      if (!event.causeCertainty || !['confirmed', 'contributing', 'unclear'].includes(event.causeCertainty)) throw Error('Ursachenanalyse benötigt eine dokumentierte Sicherheit.');
      if (event.causeCertainty === 'unclear') required(event.uncertaintyNote, 'Unsicherheitsbegründung');
      if (![event.responsibleId, event.responsibleName, event.carePlanId, event.carePlanVersionId, event.effectiveAt, event.plannedReviewDueAt, event.observedFrom, event.observedUntil, event.reviewOutcome, event.recurrenceObserved, event.resultSha256].every(none)) throw Error('Ursachenanalyse darf Anpassung oder Wiederholungsprüfung nicht vorwegnehmen.');
      causes.add(event.eventId); status = 'analysing';
    } else if (event.kind === 'care_adjustment') {
      const effectiveAt = micros(event.effectiveAt, 'Wirksamkeitsbeginn'); const dueAt = micros(event.plannedReviewDueAt, 'Geplanter Prüftermin');
      for (const [value, label] of [[event.responsibleId, 'Maßnahmenverantwortung'], [event.responsibleName, 'Maßnahmenverantwortliche Person'], [event.carePlanId, 'Pflegeplan'], [event.carePlanVersionId, 'Pflegeplanfassung']] as const) required(value, label);
      if (!evidence.some(item => item.sourceType === 'care_plan_version') || !event.referencesEventIds.some(id => causes.has(id)) || effectiveAt < eventAt || dueAt <= effectiveAt) throw Error('Versorgungsanpassung benötigt Ursache, verantwortete Pflegeplanfassung, Wirksamkeitsbeginn, späteren Prüftermin und Originalbeleg.');
      if (!none(event.factorCodes) || event.causeCertainty || event.uncertaintyNote || event.observedFrom || event.observedUntil || event.reviewOutcome || event.recurrenceObserved !== null || event.resultSha256) throw Error('Versorgungsanpassung darf Ursache oder Wiederholungsprüfung nicht vermischen.');
      adjustments.add(event.eventId); status = 'adjustment_active';
    } else if (event.kind === 'repeat_check') {
      const from = micros(event.observedFrom, 'Beobachtungsbeginn'); const until = micros(event.observedUntil, 'Beobachtungsende');
      if (!event.reviewOutcome || !outcomes.includes(event.reviewOutcome) || event.recurrenceObserved === null || !event.resultSha256 || !evidence.some(item => item.sourceType === 'care_record')) throw Error('Wiederholungsprüfung benötigt Zeitraum, Ergebnis, Wiederholungsangabe, Pflegeverlaufsbeleg und Fingerprint.');
      fingerprint(event.resultSha256, 'Prüfergebnis'); if (!event.referencesEventIds.some(id => adjustments.has(id))) throw Error('Wiederholungsprüfung muss die Versorgungsanpassung des aktuellen Zyklus referenzieren.');
      const adjustment = input.events.find(item => event.referencesEventIds.includes(item.eventId) && item.kind === 'care_adjustment'); const effective = adjustment ? micros(adjustment.effectiveAt, 'Wirksamkeitsbeginn') : '';
      if (from < effective || from > until || until > eventAt) throw Error('Beobachtungszeitraum muss nach Wirksamkeitsbeginn und vor der tatsächlichen Wiederholungsprüfung liegen.');
      if (![event.factorCodes, event.causeCertainty, event.uncertaintyNote, event.responsibleId, event.responsibleName, event.carePlanId, event.carePlanVersionId, event.effectiveAt, event.plannedReviewDueAt].every(none)) throw Error('Wiederholungsprüfung darf Ursache oder neue Anpassung nicht vermischen.');
      checks.add(event.eventId); status = 'repeat_checked';
    } else if (event.kind === 'analysis_closure') {
      if (!causes.size || !adjustments.size || !checks.size || !event.resultSha256 || !evidence.length || ![causes, adjustments, checks].every(set => event.referencesEventIds.some(id => set.has(id)))) throw Error('Analyseabschluss benötigt Ursache, Versorgungsanpassung, Wiederholungsprüfung, Beleg und vollständige Referenzen.');
      fingerprint(event.resultSha256, 'Abschlussergebnis'); if (![event.factorCodes, event.causeCertainty, event.uncertaintyNote, event.responsibleId, event.responsibleName, event.carePlanId, event.carePlanVersionId, event.effectiveAt, event.plannedReviewDueAt, event.observedFrom, event.observedUntil, event.reviewOutcome, event.recurrenceObserved].every(none)) throw Error('Analyseabschluss darf keine klinische Durchführung oder neue Maßnahme behaupten.'); status = 'analysis_closed';
    } else if (event.kind === 'reopened') {
      if (status !== 'analysis_closed' || evidence.length || event.referencesEventIds.length !== 1 || !event.referencesEventIds.some(id => input.events.find(item => item.eventId === id)?.kind === 'analysis_closure') || ![event.factorCodes, event.causeCertainty, event.uncertaintyNote, event.responsibleId, event.responsibleName, event.carePlanId, event.carePlanVersionId, event.effectiveAt, event.plannedReviewDueAt, event.observedFrom, event.observedUntil, event.reviewOutcome, event.recurrenceObserved, event.resultSha256].every(none)) throw Error('Wiederaufnahme ist nur nach Analyseabschluss als begründeter eigener Eintrag zulässig.');
      cycle += 1; causes = new Set(); adjustments = new Set(); checks = new Set(); status = 'reported';
    } else throw Error('Verlaufsart ist ungültig.');
    return Object.freeze({ ...event, occurredAt: eventAt, recordedAt: eventRecordedAt, evidence: Object.freeze(evidence), factorCodes: Object.freeze([...event.factorCodes]), referencesEventIds: Object.freeze([...event.referencesEventIds]) });
  });
  return Object.freeze({ ...input, occurredAt, observedAt, recordedAt, events: Object.freeze(events), status, cycle, careCompletion: 'not_inferred', incidentResolution: 'not_inferred', clinicalCauseCertainty: 'not_inferred', historyMode: 'append_only' });
}
