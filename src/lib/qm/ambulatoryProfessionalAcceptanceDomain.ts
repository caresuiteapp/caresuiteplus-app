export type ProfessionalAcceptanceEvidence = {
  evidenceId: string;
  sourceType: 'qualification_record' | 'scenario_protocol' | 'decision_record' | 'restriction_record' | 'software_test' | 'other';
  sourceEntityId: string;
  sourceVersionId: string | null;
  recordLocator: string;
  sourceSha256: string;
};

export type ProfessionalAcceptanceEventInput = {
  eventId: string;
  clientRequestId: string;
  kind: 'review_requested' | 'scenario_performed' | 'restriction_recorded' | 'review_decision' | 'reopened';
  occurredAt: string;
  recordedAt: string;
  actorId: string;
  actorName: string;
  summary: string;
  referencesEventIds: readonly string[];
  evidence: readonly ProfessionalAcceptanceEvidence[];
  scenarioId: string | null;
  scenarioTitle: string | null;
  scenarioResult: 'passed' | 'failed' | 'blocked' | null;
  reviewerId: string | null;
  reviewerName: string | null;
  reviewerQualification: string | null;
  restrictionId: string | null;
  restrictionText: string | null;
  restrictionOwnerId: string | null;
  restrictionOwnerName: string | null;
  restrictionReviewDueAt: string | null;
  decision: 'accepted' | 'accepted_with_restrictions' | 'not_accepted' | null;
  decisionReason: string | null;
  decisionSha256: string | null;
};

export type AmbulatoryProfessionalAcceptanceInput = {
  acceptanceId: string;
  clientRequestId: string;
  tenantId: string;
  reviewScope: string;
  scopeVersionId: string;
  scopeSha256: string;
  requiredScenarioIds: readonly string[];
  preparedAt: string;
  preparedBy: string;
  preparedByName: string;
  events: readonly ProfessionalAcceptanceEventInput[];
};

export type AmbulatoryProfessionalAcceptance = AmbulatoryProfessionalAcceptanceInput & {
  status: 'prepared' | 'in_review' | 'accepted' | 'accepted_with_restrictions' | 'not_accepted';
  cycle: number;
  softwareTestsAreSupplementaryOnly: true;
  releaseApproval: 'not_inferred';
  legalApproval: 'not_inferred';
  designApproval: 'not_inferred';
  clinicalPerformance: 'not_inferred';
  historyMode: 'append_only';
};

const exactUtcMicros = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}(?:Z|\+00:00)$/;
const sha256 = /^[0-9a-f]{64}$/;
const evidenceTypes = ['qualification_record', 'scenario_protocol', 'decision_record', 'restriction_record', 'software_test', 'other'] as const;
const results = ['passed', 'failed', 'blocked'] as const;
const decisions = ['accepted', 'accepted_with_restrictions', 'not_accepted'] as const;
function required(value: string | null | undefined, label: string) { if (typeof value !== 'string' || !value.trim()) throw Error(`${label} fehlt.`); return value.trim(); }
function micros(value: string | null | undefined, label: string) { const v = required(value, label); if (!exactUtcMicros.test(v) || Number.isNaN(Date.parse(v))) throw Error(`${label} benötigt exakt sechs UTC-Mikrosekundenstellen.`); return v; }
function fingerprint(value: string | null | undefined, label: string) { const v = required(value, label); if (!sha256.test(v)) throw Error(`${label} benötigt einen SHA-256-Fingerprint.`); return v; }
function none(value: unknown) { return value === null || value === undefined || (Array.isArray(value) && value.length === 0); }

export function buildAmbulatoryProfessionalAcceptance(input: AmbulatoryProfessionalAcceptanceInput): AmbulatoryProfessionalAcceptance {
  for (const [value, label] of [[input.acceptanceId, 'Abnahmeakte'], [input.clientRequestId, 'Anforderungs-ID'], [input.tenantId, 'Mandant'], [input.reviewScope, 'Prüfumfang'], [input.scopeVersionId, 'Prüffassung'], [input.preparedBy, 'Vorbereitungsidentität'], [input.preparedByName, 'Vorbereitungsname']] as const) required(value, label);
  fingerprint(input.scopeSha256, 'Prüffassung');
  const preparedAt = micros(input.preparedAt, 'Vorbereitungszeit');
  if (!input.requiredScenarioIds.length || new Set(input.requiredScenarioIds).size !== input.requiredScenarioIds.length || input.requiredScenarioIds.some(id => !id.trim())) throw Error('Erforderliche Prüfszenarien fehlen oder sind doppelt.');

  const eventIds = new Set<string>(), requests = new Set<string>(), evidenceIds = new Set<string>();
  let lastOccurredAt = preparedAt, lastRecordedAt = preparedAt, status: AmbulatoryProfessionalAcceptance['status'] = 'prepared', cycle = 1;
  let requestId: string | null = null, decisionId: string | null = null;
  let currentScenarios = new Map<string, ProfessionalAcceptanceEventInput>(), currentRestrictions = new Map<string, ProfessionalAcceptanceEventInput>();
  const events = input.events.map(event => {
    for (const [value, label] of [[event.eventId, 'Verlaufseintrag'], [event.clientRequestId, 'Verlaufs-Anforderungs-ID'], [event.actorId, 'Verlaufsautor'], [event.actorName, 'Verlaufsautorname'], [event.summary, 'Verlaufsinhalt']] as const) required(value, label);
    if (eventIds.has(event.eventId) || requests.has(event.clientRequestId)) throw Error('Verlaufseintrag oder Anforderungs-ID ist doppelt.');
    eventIds.add(event.eventId); requests.add(event.clientRequestId);
    const occurredAt = micros(event.occurredAt, 'Verlaufszeit'); const recordedAt = micros(event.recordedAt, 'Verlaufserfassungszeit');
    if (occurredAt < lastOccurredAt || recordedAt < occurredAt || recordedAt < lastRecordedAt) throw Error('Verlauf ist zeitlich widersprüchlich.');
    lastOccurredAt = occurredAt; lastRecordedAt = recordedAt;
    const evidence = event.evidence.map(item => {
      for (const [value, label] of [[item.evidenceId, 'Beleg'], [item.sourceEntityId, 'Belegquelle'], [item.recordLocator, 'Aktenstelle']] as const) required(value, label);
      if (!evidenceTypes.includes(item.sourceType)) throw Error('Belegart ist ungültig.');
      if (evidenceIds.has(item.evidenceId)) throw Error('Beleg ist doppelt.'); evidenceIds.add(item.evidenceId); fingerprint(item.sourceSha256, 'Beleg');
      return Object.freeze({ ...item });
    });
    if (new Set(event.referencesEventIds).size !== event.referencesEventIds.length || event.referencesEventIds.some(id => !eventIds.has(id))) throw Error('Verlaufsreferenz fehlt, ist doppelt oder zeigt in die Zukunft.');
    if (['accepted', 'accepted_with_restrictions', 'not_accepted'].includes(status) && event.kind !== 'reopened') throw Error('Entschiedene Abnahme benötigt eine ausdrückliche Wiederaufnahme.');

    const reviewFields = [event.scenarioId, event.scenarioTitle, event.scenarioResult, event.reviewerId, event.reviewerName, event.reviewerQualification];
    const restrictionFields = [event.restrictionId, event.restrictionText, event.restrictionOwnerId, event.restrictionOwnerName, event.restrictionReviewDueAt];
    const decisionFields = [event.decision, event.decisionReason, event.decisionSha256];
    if (event.kind === 'review_requested') {
      if (requestId || evidence.length || ![...reviewFields, ...restrictionFields, ...decisionFields].every(none)) throw Error('Prüfauftrag darf keine Durchführung oder Entscheidung vorwegnehmen.');
      requestId = event.eventId; status = 'in_review';
    } else if (event.kind === 'scenario_performed') {
      const scenarioId = required(event.scenarioId, 'Szenario'); required(event.scenarioTitle, 'Szenariotitel');
      if (!requestId || !event.referencesEventIds.includes(requestId) || !input.requiredScenarioIds.includes(scenarioId)) throw Error('Tatsächliches Szenario benötigt den Prüfauftrag und muss im Prüfumfang liegen.');
      if (!event.scenarioResult || !results.includes(event.scenarioResult)) throw Error('Szenario benötigt ein gültiges tatsächliches Ergebnis.');
      for (const [value, label] of [[event.reviewerId, 'Pflegefachliche Prüferidentität'], [event.reviewerName, 'Pflegefachliche Prüferperson'], [event.reviewerQualification, 'Prüferqualifikation']] as const) required(value, label);
      if (event.reviewerId !== event.actorId || event.reviewerName?.trim() !== event.actorName.trim()) throw Error('Pflegefachliche Prüferidentität muss der tatsächlichen Verlaufsidentität entsprechen.');
      if (!evidence.some(item => item.sourceType === 'qualification_record') || !evidence.some(item => item.sourceType === 'scenario_protocol')) throw Error('Szenario benötigt Qualifikationsnachweis und tatsächliches Szenarioprotokoll.');
      if (![...restrictionFields, ...decisionFields].every(none)) throw Error('Szenariodurchführung darf Einschränkung oder Entscheidung nicht vermischen.');
      currentScenarios.set(scenarioId, event); status = 'in_review';
    } else if (event.kind === 'restriction_recorded') {
      const restrictionId = required(event.restrictionId, 'Einschränkung'); required(event.restrictionText, 'Einschränkungstext'); required(event.restrictionOwnerId, 'Einschränkungsverantwortung'); required(event.restrictionOwnerName, 'Einschränkungsverantwortliche Person');
      const dueAt = micros(event.restrictionReviewDueAt, 'Einschränkungsprüffrist');
      if (!requestId || !event.referencesEventIds.includes(requestId) || dueAt <= occurredAt || !evidence.some(item => item.sourceType === 'restriction_record')) throw Error('Einschränkung benötigt Prüfauftrag, spätere Prüffrist und Originalbeleg.');
      if (![...reviewFields, ...decisionFields].every(none)) throw Error('Einschränkung darf Szenario oder Entscheidung nicht vermischen.');
      currentRestrictions.set(restrictionId, event); status = 'in_review';
    } else if (event.kind === 'review_decision') {
      if (!requestId || !event.referencesEventIds.includes(requestId)) throw Error('Abnahmeentscheidung benötigt den Prüfauftrag.');
      if (!event.decision || !decisions.includes(event.decision)) throw Error('Abnahmeentscheidung ist ungültig.');
      required(event.decisionReason, 'Entscheidungsbegründung'); fingerprint(event.decisionSha256, 'Entscheidung');
      for (const [value, label] of [[event.reviewerId, 'Entscheideridentität'], [event.reviewerName, 'Entscheiderperson'], [event.reviewerQualification, 'Entscheiderqualifikation']] as const) required(value, label);
      if (event.reviewerId !== event.actorId || event.reviewerName?.trim() !== event.actorName.trim()) throw Error('Entscheideridentität muss der tatsächlichen Verlaufsidentität entsprechen.');
      if (!evidence.some(item => item.sourceType === 'qualification_record') || !evidence.some(item => item.sourceType === 'decision_record')) throw Error('Abnahmeentscheidung benötigt Qualifikations- und Entscheidungsoriginal.');
      if (event.decision !== 'not_accepted') {
        const missing = input.requiredScenarioIds.filter(id => !currentScenarios.has(id));
        const failed = input.requiredScenarioIds.filter(id => currentScenarios.get(id)?.scenarioResult !== 'passed');
        if (missing.length || failed.length) throw Error('Pflegefachliche Abnahme benötigt jedes erforderliche tatsächlich bestandene Szenario.');
        if ([...currentScenarios.values()].some(item => !event.referencesEventIds.includes(item.eventId))) throw Error('Pflegefachliche Abnahmeentscheidung muss jedes maßgebliche Szenarioprotokoll referenzieren.');
        if (event.decision === 'accepted' && currentRestrictions.size) throw Error('Uneingeschränkte Abnahme ist bei dokumentierten Einschränkungen unzulässig.');
        if (event.decision === 'accepted_with_restrictions' && !currentRestrictions.size) throw Error('Abnahme mit Einschränkungen benötigt mindestens eine dokumentierte Einschränkung.');
      }
      if ([...restrictionFields, event.scenarioId, event.scenarioTitle, event.scenarioResult].some(value => !none(value))) throw Error('Abnahmeentscheidung darf Szenario oder Einschränkung nicht nachtragen.');
      decisionId = event.eventId; status = event.decision;
    } else if (event.kind === 'reopened') {
      if (!decisionId || event.referencesEventIds.length !== 1 || event.referencesEventIds[0] !== decisionId || evidence.length || ![...reviewFields, ...restrictionFields, ...decisionFields].every(none)) throw Error('Wiederaufnahme ist nur nach einer Entscheidung als eigener begründeter Eintrag zulässig.');
      cycle += 1; requestId = null; decisionId = null; currentScenarios = new Map(); currentRestrictions = new Map(); status = 'prepared';
    } else throw Error('Verlaufsart ist ungültig.');
    return Object.freeze({ ...event, occurredAt, recordedAt, referencesEventIds: Object.freeze([...event.referencesEventIds]), evidence: Object.freeze(evidence) });
  });
  return Object.freeze({ ...input, preparedAt, requiredScenarioIds: Object.freeze([...input.requiredScenarioIds]), events: Object.freeze(events), status, cycle, softwareTestsAreSupplementaryOnly: true, releaseApproval: 'not_inferred', legalApproval: 'not_inferred', designApproval: 'not_inferred', clinicalPerformance: 'not_inferred', historyMode: 'append_only' });
}
