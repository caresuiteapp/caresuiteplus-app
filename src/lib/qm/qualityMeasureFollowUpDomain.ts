export type QualityMeasureEvidence = {
  evidenceId: string;
  sourceType: 'deviation_original' | 'action_record' | 'effectiveness_record' | 'correspondence' | 'audit_record' | 'other';
  sourceEntityId: string;
  sourceVersionId: string | null;
  recordLocator: string;
  sourceSha256: string;
};

export type QualityMeasureFollowUpEventInput = {
  eventId: string;
  clientRequestId: string;
  kind: 'assignment' | 'progress' | 'effectiveness_review' | 'completion' | 'reopened';
  occurredAt: string;
  recordedAt: string;
  actorId: string;
  actorName: string;
  summary: string;
  referencesEventIds: readonly string[];
  evidence: readonly QualityMeasureEvidence[];
  actionDescription: string | null;
  responsibleId: string | null;
  responsibleName: string | null;
  dueAt: string | null;
  progressNote: string | null;
  observedFrom: string | null;
  observedUntil: string | null;
  effectivenessOutcome: 'effective' | 'partially_effective' | 'not_effective' | 'insufficient_evidence' | null;
  effectivenessResult: string | null;
  resultSha256: string | null;
};

export type QualityMeasureFollowUpInput = {
  followUpId: string;
  clientRequestId: string;
  tenantId: string;
  sourceDeviationId: string;
  sourceDeviationSha256: string;
  deviationCategory: string;
  deviationSummary: string;
  deviationRecordedAt: string;
  recordedAt: string;
  recordedBy: string;
  recordedByName: string;
  events: readonly QualityMeasureFollowUpEventInput[];
};

export type QualityMeasureFollowUp = QualityMeasureFollowUpInput & {
  status: 'open' | 'assigned' | 'in_progress' | 'effectiveness_reviewed' | 'completed';
  cycle: number;
  effectivenessRequired: true;
  deviationResolution: 'not_inferred';
  careCompletion: 'not_inferred';
  historyMode: 'append_only';
};

const exactUtcMicros = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}(?:Z|\+00:00)$/;
const sha256 = /^[0-9a-f]{64}$/;
const evidenceTypes = ['deviation_original', 'action_record', 'effectiveness_record', 'correspondence', 'audit_record', 'other'] as const;
const outcomes = ['effective', 'partially_effective', 'not_effective', 'insufficient_evidence'] as const;
function required(value: string | null | undefined, label: string) { if (typeof value !== 'string' || !value.trim()) throw Error(`${label} fehlt.`); return value.trim(); }
function micros(value: string | null | undefined, label: string) { const v = required(value, label); if (!exactUtcMicros.test(v) || Number.isNaN(Date.parse(v))) throw Error(`${label} benötigt exakt sechs UTC-Mikrosekundenstellen.`); return v; }
function fingerprint(value: string | null | undefined, label: string) { const v = required(value, label); if (!sha256.test(v)) throw Error(`${label} benötigt einen SHA-256-Fingerprint.`); return v; }
function none(value: unknown) { return value === null || value === undefined || (Array.isArray(value) && value.length === 0); }

export function buildQualityMeasureFollowUp(input: QualityMeasureFollowUpInput): QualityMeasureFollowUp {
  for (const [value, label] of [[input.followUpId, 'Nachhaltung'], [input.clientRequestId, 'Anforderungs-ID'], [input.tenantId, 'Mandant'], [input.sourceDeviationId, 'Abweichung'], [input.deviationCategory, 'Abweichungskategorie'], [input.deviationSummary, 'Abweichungsbeschreibung'], [input.recordedBy, 'Erfassungsidentität'], [input.recordedByName, 'Erfassungsname']] as const) required(value, label);
  fingerprint(input.sourceDeviationSha256, 'Abweichungsoriginal');
  const deviationRecordedAt = micros(input.deviationRecordedAt, 'Abweichungserfassung');
  const recordedAt = micros(input.recordedAt, 'Nachhaltungserfassung');
  if (deviationRecordedAt > recordedAt) throw Error('Abweichung und Nachhaltung sind zeitlich widersprüchlich.');

  const ids = new Set<string>(), requests = new Set<string>(), evidenceIds = new Set<string>();
  let lastOccurredAt = deviationRecordedAt, lastRecordedAt = recordedAt;
  let status: QualityMeasureFollowUp['status'] = 'open', cycle = 1;
  let assignments = new Set<string>(), reviews = new Set<string>(), completionId: string | null = null;
  const events = input.events.map(event => {
    for (const [value, label] of [[event.eventId, 'Verlaufseintrag'], [event.clientRequestId, 'Verlaufs-Anforderungs-ID'], [event.actorId, 'Verlaufsautor'], [event.actorName, 'Verlaufsautorname'], [event.summary, 'Verlaufsinhalt']] as const) required(value, label);
    if (ids.has(event.eventId) || requests.has(event.clientRequestId)) throw Error('Verlaufseintrag oder Anforderungs-ID ist doppelt.');
    ids.add(event.eventId); requests.add(event.clientRequestId);
    const occurredAt = micros(event.occurredAt, 'Verlaufszeit'); const eventRecordedAt = micros(event.recordedAt, 'Verlaufserfassungszeit');
    if (occurredAt < lastOccurredAt || eventRecordedAt < occurredAt || eventRecordedAt < lastRecordedAt) throw Error('Verlauf ist zeitlich widersprüchlich.');
    lastOccurredAt = occurredAt; lastRecordedAt = eventRecordedAt;
    const evidence = event.evidence.map(item => {
      for (const [value, label] of [[item.evidenceId, 'Beleg'], [item.sourceEntityId, 'Belegquelle'], [item.recordLocator, 'Aktenstelle']] as const) required(value, label);
      if (!evidenceTypes.includes(item.sourceType)) throw Error('Belegart ist ungültig.');
      if (evidenceIds.has(item.evidenceId)) throw Error('Beleg ist doppelt.'); evidenceIds.add(item.evidenceId); fingerprint(item.sourceSha256, 'Beleg');
      return Object.freeze({ ...item });
    });
    if (new Set(event.referencesEventIds).size !== event.referencesEventIds.length || event.referencesEventIds.some(id => !ids.has(id))) throw Error('Verlaufsreferenz fehlt, ist doppelt oder zeigt in die Zukunft.');
    if (status === 'completed' && event.kind !== 'reopened') throw Error('Erledigte Maßnahme benötigt eine ausdrückliche Wiederaufnahme.');

    if (event.kind === 'assignment') {
      const dueAt = micros(event.dueAt, 'Maßnahmenfrist');
      for (const [value, label] of [[event.actionDescription, 'Konkrete Maßnahme'], [event.responsibleId, 'Verantwortungsidentität'], [event.responsibleName, 'Verantwortliche Person']] as const) required(value, label);
      if (dueAt <= occurredAt || !evidence.some(item => item.sourceType === 'action_record')) throw Error('Maßnahmenzuweisung benötigt eine spätere Frist und einen Originalbeleg.');
      if (![event.progressNote, event.observedFrom, event.observedUntil, event.effectivenessOutcome, event.effectivenessResult, event.resultSha256].every(none)) throw Error('Maßnahmenzuweisung darf Fortschritt oder Wirksamkeit nicht vorwegnehmen.');
      assignments.add(event.eventId); status = 'assigned';
    } else if (event.kind === 'progress') {
      required(event.progressNote, 'Fortschrittsangabe');
      if (!event.referencesEventIds.some(id => assignments.has(id)) || !evidence.length) throw Error('Fortschritt benötigt die aktuelle Maßnahmenzuweisung und einen Originalbeleg.');
      if (![event.actionDescription, event.responsibleId, event.responsibleName, event.dueAt, event.observedFrom, event.observedUntil, event.effectivenessOutcome, event.effectivenessResult, event.resultSha256].every(none)) throw Error('Fortschritt darf Verantwortung, Frist oder Wirksamkeit nicht überschreiben.');
      status = 'in_progress';
    } else if (event.kind === 'effectiveness_review') {
      const from = micros(event.observedFrom, 'Beobachtungsbeginn'); const until = micros(event.observedUntil, 'Beobachtungsende');
      if (!event.effectivenessOutcome || !outcomes.includes(event.effectivenessOutcome)) throw Error('Wirksamkeitsprüfung benötigt ein gültiges Ergebnis.');
      required(event.effectivenessResult, 'Wirksamkeitsbegründung'); fingerprint(event.resultSha256, 'Wirksamkeitsergebnis');
      if (!event.referencesEventIds.some(id => assignments.has(id)) || !evidence.some(item => item.sourceType === 'effectiveness_record')) throw Error('Wirksamkeitsprüfung benötigt die aktuelle Maßnahme und einen Originalbeleg.');
      const assignment = input.events.find(item => event.referencesEventIds.includes(item.eventId) && item.kind === 'assignment');
      if (!assignment || from < assignment.occurredAt || from > until || until > occurredAt) throw Error('Beobachtungszeitraum muss nach der Maßnahmenzuweisung und vor der tatsächlichen Prüfung liegen.');
      if (![event.actionDescription, event.responsibleId, event.responsibleName, event.dueAt, event.progressNote].every(none)) throw Error('Wirksamkeitsprüfung darf Maßnahme, Verantwortung oder Frist nicht überschreiben.');
      reviews.add(event.eventId); status = 'effectiveness_reviewed';
    } else if (event.kind === 'completion') {
      fingerprint(event.resultSha256, 'Abschlussnachweis');
      const referencedAssignment = event.referencesEventIds.some(id => assignments.has(id));
      const referencedReview = input.events.find(item => event.referencesEventIds.includes(item.eventId) && item.kind === 'effectiveness_review');
      if (!referencedAssignment || !referencedReview || !reviews.has(referencedReview.eventId) || referencedReview.effectivenessOutcome !== 'effective' || !evidence.length) throw Error('Erledigung benötigt die aktuelle Maßnahme, einen wirksamen Wirksamkeitsnachweis und einen Abschlussbeleg.');
      if (![event.actionDescription, event.responsibleId, event.responsibleName, event.dueAt, event.progressNote, event.observedFrom, event.observedUntil, event.effectivenessOutcome, event.effectivenessResult].every(none)) throw Error('Erledigung darf Maßnahme oder Wirksamkeitsprüfung nicht nachträglich vermischen.');
      completionId = event.eventId; status = 'completed';
    } else if (event.kind === 'reopened') {
      if (status !== 'completed' || evidence.length || event.referencesEventIds.length !== 1 || event.referencesEventIds[0] !== completionId || ![event.actionDescription, event.responsibleId, event.responsibleName, event.dueAt, event.progressNote, event.observedFrom, event.observedUntil, event.effectivenessOutcome, event.effectivenessResult, event.resultSha256].every(none)) throw Error('Wiederaufnahme ist nur nach Erledigung als begründeter eigener Eintrag zulässig.');
      cycle += 1; assignments = new Set(); reviews = new Set(); completionId = null; status = 'open';
    } else throw Error('Verlaufsart ist ungültig.');
    return Object.freeze({ ...event, occurredAt, recordedAt: eventRecordedAt, referencesEventIds: Object.freeze([...event.referencesEventIds]), evidence: Object.freeze(evidence) });
  });
  return Object.freeze({ ...input, deviationRecordedAt, recordedAt, events: Object.freeze(events), status, cycle, effectivenessRequired: true, deviationResolution: 'not_inferred', careCompletion: 'not_inferred', historyMode: 'append_only' });
}
