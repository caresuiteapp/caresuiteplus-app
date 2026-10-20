export type CareStopRiskState = 'none' | 'documented';
export type CareStopCompletionDraft = Readonly<{
  documentation: string;
  mandatoryConfirmed: boolean;
  riskState: CareStopRiskState | '';
  riskDetail: string;
  riskAction: string;
  followUp: string;
}>;
export type CareStopCompletionInput = Readonly<CareStopCompletionDraft & {
  stopId: string;
  expectedStopUpdatedAt: string;
  requestId: string;
}>;

const microsecondInstant = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}(?:Z|[+-]\d{2}:\d{2})$/;
const trim = (value: string) => value.trim();

export function validateCareStopCompletionDraft(draft: CareStopCompletionDraft): { ok: true; data: CareStopCompletionDraft } | { ok: false; error: string } {
  const data = { ...draft, documentation: trim(draft.documentation), riskDetail: trim(draft.riskDetail), riskAction: trim(draft.riskAction), followUp: trim(draft.followUp) };
  if (data.documentation.length < 10) return { ok: false, error: 'Pflichtdokumentation mit mindestens zehn Zeichen erfassen.' };
  if (!data.mandatoryConfirmed) return { ok: false, error: 'Die Prüfung aller Pflichtangaben ausdrücklich bestätigen.' };
  if (!['none','documented'].includes(data.riskState)) return { ok: false, error: 'Offene Risiken ausdrücklich als nicht vorhanden oder dokumentiert kennzeichnen.' };
  if (data.riskState === 'documented' && (data.riskDetail.length < 5 || data.riskAction.length < 5 || data.followUp.length < 5)) return { ok: false, error: 'Risiko, getroffene Maßnahme und verbindlichen Folgeauftrag vollständig dokumentieren.' };
  if (data.riskState === 'none' && (data.riskDetail || data.riskAction || data.followUp)) return { ok: false, error: 'Risikodetails nur bei ausdrücklich dokumentiertem Risiko erfassen.' };
  return { ok: true, data };
}

export function validateCareStopCompletionInput(input: CareStopCompletionInput) {
  if (!input.stopId || !input.requestId || !microsecondInstant.test(input.expectedStopUpdatedAt)) return { ok: false as const, error: 'Einsatz, unveränderter Mikrosekundenstand und Anfragekennung sind erforderlich.' };
  return validateCareStopCompletionDraft(input);
}

