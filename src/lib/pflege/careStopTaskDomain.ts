import type { CareStopTaskOutcome } from './careStopTaskService';

export type CareStopTaskDraft = Readonly<{ outcome: CareStopTaskOutcome | ''; resultDetail: string; hasDeviation: boolean; deviationReason: string; observation: string }>;
export type ValidCareStopTaskDraft = Readonly<{ outcome: CareStopTaskOutcome; resultDetail: string; hasDeviation: boolean; deviationReason: string; observation: string }>;

export function validateCareStopTaskDraft(input: CareStopTaskDraft): { ok: true; data: ValidCareStopTaskDraft } | { ok: false; error: string } {
  const resultDetail = input.resultDetail.trim(); const deviationReason = input.deviationReason.trim(); const observation = input.observation.trim();
  if (!input.outcome) return { ok: false, error: 'Ergebnisstatus ist erforderlich.' };
  if (resultDetail.length < 5 || resultDetail.length > 4000) return { ok: false, error: 'Ergebnis und fachliches Detail müssen zwischen 5 und 4000 Zeichen enthalten.' };
  const needsDeviation = input.hasDeviation || input.outcome !== 'performed';
  if (needsDeviation && (deviationReason.length < 5 || deviationReason.length > 2000)) return { ok: false, error: 'Die Abweichung beziehungsweise Nichtdurchführung benötigt einen konkreten Grund.' };
  if (!needsDeviation && deviationReason) return { ok: false, error: 'Ein Abweichungsgrund darf nicht ohne dokumentierte Abweichung gespeichert werden.' };
  if (observation.length > 4000) return { ok: false, error: 'Die Beobachtung ist zu lang.' };
  return { ok: true, data: { outcome: input.outcome, resultDetail, hasDeviation: input.hasDeviation, deviationReason: needsDeviation ? deviationReason : '', observation } };
}
