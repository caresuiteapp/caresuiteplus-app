import type { ContactAttemptInput, ContactAttemptOutcome, ContactAttemptChannel, FollowUpPriority, UnreachableFeedbackState, UnreachableReportInput, UnreachableRiskLevel } from './careStopUnreachableService';

export type ContactAttemptDraft = Readonly<{ channel: ContactAttemptChannel | ''; targetLabel: string; outcome: ContactAttemptOutcome | ''; detail: string; responseDetail: string }>;
export type UnreachableReportDraft = Readonly<{ circumstances: string; riskLevel: UnreachableRiskLevel | ''; riskDetail: string; feedbackState: UnreachableFeedbackState; feedbackDetail: string; followUpAction: string; followUpAssignee: string; followUpPriority: FollowUpPriority | ''; followUpDueAt: string }>;

export function validateContactAttemptDraft(stopId: string, input: ContactAttemptDraft): { ok: true; data: Omit<ContactAttemptInput,'requestId'> } | { ok: false; error: string } {
  const targetLabel=input.targetLabel.trim(), detail=input.detail.trim(), responseDetail=input.responseDetail.trim();
  if (!input.channel || !input.outcome) return { ok:false,error:'Kontaktweg und Ergebnis sind erforderlich.' };
  if (targetLabel.length<2 || targetLabel.length>200) return { ok:false,error:'Das tatsächliche Kontaktziel muss zwischen 2 und 200 Zeichen enthalten.' };
  if (detail.length<5 || detail.length>2000) return { ok:false,error:'Der tatsächliche Kontaktversuch muss zwischen 5 und 2000 Zeichen beschrieben werden.' };
  if (input.outcome==='reached' && (responseDetail.length<2 || responseDetail.length>2000)) return { ok:false,error:'Bei erreichtem Kontakt ist die tatsächliche Rückmeldung erforderlich.' };
  if (input.outcome!=='reached' && responseDetail) return { ok:false,error:'Eine Rückmeldung darf nur bei tatsächlich erreichtem Kontakt eingetragen werden.' };
  return { ok:true,data:{ stopId,channel:input.channel,targetLabel,outcome:input.outcome,detail,responseDetail } };
}

export function validateUnreachableReportDraft(stopId: string, expectedStopUpdatedAt: string, input: UnreachableReportDraft): { ok: true; data: Omit<UnreachableReportInput,'requestId'> } | { ok: false; error: string } {
  const circumstances=input.circumstances.trim(), riskDetail=input.riskDetail.trim(), feedbackDetail=input.feedbackDetail.trim(), followUpAction=input.followUpAction.trim(), followUpAssignee=input.followUpAssignee.trim();
  if (!input.riskLevel || !input.followUpPriority) return { ok:false,error:'Risikobewertung und Priorität des Folgeauftrags sind erforderlich.' };
  if (circumstances.length<5 || circumstances.length>4000) return { ok:false,error:'Die tatsächlichen Umstände müssen zwischen 5 und 4000 Zeichen beschrieben werden.' };
  if (riskDetail.length<5 || riskDetail.length>2000) return { ok:false,error:'Die konkrete Risiko- und Notfallbewertung ist erforderlich.' };
  if (input.feedbackState!=='none' && (feedbackDetail.length<2 || feedbackDetail.length>2000)) return { ok:false,error:'Die tatsächlich erreichte Rückmeldung muss beschrieben werden.' };
  if (input.feedbackState==='none' && feedbackDetail) return { ok:false,error:'Ohne erreichte Rückmeldung darf kein Rückmeldungsinhalt eingetragen werden.' };
  if (followUpAction.length<5 || followUpAction.length>2000 || followUpAssignee.length<2 || followUpAssignee.length>200) return { ok:false,error:'Folgehandlung und zuständige Stelle müssen konkret angegeben werden.' };
  if (input.riskLevel==='urgent' && input.followUpPriority!=='urgent') return { ok:false,error:'Eine dringende Risikobewertung benötigt einen dringenden Folgeauftrag.' };
  const due=new Date(input.followUpDueAt); if (!input.followUpDueAt || Number.isNaN(due.getTime())) return { ok:false,error:'Eine gültige Frist des Folgeauftrags ist erforderlich.' };
  return { ok:true,data:{ stopId,expectedStopUpdatedAt,circumstances,riskLevel:input.riskLevel,riskDetail,feedbackState:input.feedbackState,feedbackDetail,followUpAction,followUpAssignee,followUpPriority:input.followUpPriority,followUpDueAt:due.toISOString() } };
}
