import {assessmentMeasureIdentityIssue} from './assessmentMeasureIdentityDomain.ts';
import {continenceProfileIssue,continenceProfileKey} from './continenceProfileDomain.ts';
import {validateAssessmentInstrumentPacket,type AssessmentInstrumentPacket} from './assessmentInstrumentPacket.web.ts';
import {validatePlanLifecyclePacket,type PlanLifecyclePacket} from './planLifecyclePacket.web.ts';
import type {CareAssessment} from '@/types/modules/careAssessment';
export type AssessmentDraftRequest={assessmentId:string;expectedRevision:string;payloadJson:string;intent:'save'|'review'};
const uuid=(v:unknown)=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
/** Serialize before entering the shared request controller: no mutable nested clinical object remains. */
export function makeAssessmentDraftRequest(value:CareAssessment,intent:'save'|'review',instrumentPacket?:AssessmentInstrumentPacket|null,planLifecyclePacket?:PlanLifecyclePacket|null):AssessmentDraftRequest{
 if(!Number.isSafeInteger(value.draftRevision)||Number(value.draftRevision)<0)throw Error('Der Änderungsstand fehlt. Den gespeicherten Datensatz neu laden.');
 for(const risk of value.risks){if(risk.focusedAssessmentKey===continenceProfileKey&&risk.riskKey!=='continence')throw Error('Kontinenzprofil benötigt den Kontinenzbezug.');const issue=continenceProfileIssue(risk.focusedAssessmentKey,risk.focusedAssessmentResult);if(issue)throw Error(issue);}
 const assessment={reason:value.reason,reason_detail:value.reasonDetail,next_review_at:value.nextReviewAt,person_statement:value.personStatement,statement_source:value.statementSource,statement_source_name:value.statementSourceName,conversation_participants:value.conversationParticipants,communication_support:value.communicationSupport,information_source_summary:value.informationSourceSummary,professional_summary:value.professionalSummary,change_summary:value.changeSummary,destabilization_summary:value.destabilizationSummary};
 const request={assessmentId:value.id,expectedRevision:String(value.draftRevision),payloadJson:JSON.stringify({assessment,topics:value.topics,risks:value.risks,measures:value.measures,instrumentPacket:instrumentPacket?structuredClone(instrumentPacket):null,planLifecyclePacket:planLifecyclePacket?structuredClone(planLifecyclePacket):null}),intent};
 const error=validateAssessmentDraftRequest(request);if(error)throw Error(error);return request;
}
export function validateAssessmentDraftRequest(value:AssessmentDraftRequest):string|null{
 if(!uuid(value.assessmentId)||!/^(?:0|[1-9]\d{0,9})$/.test(value.expectedRevision)||Number(value.expectedRevision)>2147483647)return 'Assessmentbezug oder Änderungsstand ist ungültig.';
 if(!['save','review'].includes(value.intent))return 'Speicheraktion ausdrücklich auswählen.';
 if(typeof value.payloadJson!=='string'||new TextEncoder().encode(value.payloadJson).length>262144)return 'Assessment ist zu umfangreich.';
 try{const p=JSON.parse(value.payloadJson);if(!p||typeof p!=='object'||Array.isArray(p)||!p.assessment||typeof p.assessment!=='object'||Array.isArray(p.assessment)||!['topics','risks','measures'].every(k=>Array.isArray(p[k])&&p[k].length<=200))return 'Assessmentstruktur ist unvollständig.';if(p.instrumentPacket!=null){const packetIssue=validateAssessmentInstrumentPacket(p.instrumentPacket);if(packetIssue)return packetIssue;if(p.instrumentPacket.assessmentId!==value.assessmentId)return 'Instrumentenpaket gehört nicht zu diesem Assessment.';}else if(value.intent==='review')return 'Prüfübergabe benötigt den vollständig gelesenen Instrumenten- und Modellstand.';if(p.planLifecyclePacket!=null){const planIssue=validatePlanLifecyclePacket(p.planLifecyclePacket);if(planIssue)return planIssue;if(p.planLifecyclePacket.assessmentId!==value.assessmentId||JSON.stringify(p.planLifecyclePacket.plannedMeasures)!==JSON.stringify(p.measures))return 'Planlebenszyklus gehört nicht zum aktuellen Maßnahmenstand.';}else if(value.intent==='review')return 'Prüfübergabe benötigt Tagesstruktur, Unterstützungsgrenzen und Pflegevisitenstand.';const measureIssue=assessmentMeasureIdentityIssue(p.measures);if(measureIssue)return measureIssue;for(const risk of p.risks){if(risk?.focusedAssessmentKey===continenceProfileKey){if(risk.riskKey!=='continence')return 'Kontinenzprofil benötigt Kontinenzbezug.';const issue=continenceProfileIssue(risk.focusedAssessmentKey,risk.focusedAssessmentResult);if(issue)return issue;}}}catch{return 'Assessmentstruktur ist ungültig.';}return null;
}
export function assertAssessmentDraftReceipt(request:AssessmentDraftRequest,result:unknown){
 const r=result as {assessmentId?:unknown;draftRevision?:unknown;status?:unknown;instrumentSelectionRevision?:unknown;instrumentCatalogRevision?:unknown;planPacketRevision?:unknown;planVersion?:unknown};
 if(!r||typeof r!=='object'||r.assessmentId!==request.assessmentId||!Number.isSafeInteger(r.draftRevision)||Number(r.draftRevision)<=Number(request.expectedRevision)||(request.intent==='review'?r.status!=='professional_review':!['draft','in_progress'].includes(String(r.status))))throw Error('Speicherbestätigung stimmt nicht mit der Anfrage überein.');
 const packet=JSON.parse(request.payloadJson).instrumentPacket as AssessmentInstrumentPacket|null;
 if(packet&&(r.instrumentSelectionRevision!==packet.selectionRevision+1||r.instrumentCatalogRevision!==packet.catalogRevision))throw Error('Instrumenten- und Modellauswahl ist nicht vollständig bestätigt.');
 const plan=JSON.parse(request.payloadJson).planLifecyclePacket as PlanLifecyclePacket|null;
 if(plan&&(r.planPacketRevision!==plan.packetRevision+1||r.planVersion!==(request.intent==='review'?plan.planVersion+1:plan.planVersion)))throw Error('Planlebenszyklus ist nicht vollständig bestätigt.');
 return {assessmentId:request.assessmentId,draftRevision:Number(r.draftRevision),status:String(r.status)};
}
/** The write receipt was already validated at the gateway. A subsequent native read proves only the stored assessment revision/status, not sidecar receipt fields. */
export function assertAssessmentDraftStoredRead(request:AssessmentDraftRequest,result:unknown){
 const r=result as {assessmentId?:unknown;draftRevision?:unknown;status?:unknown};
 if(!r||typeof r!=='object'||r.assessmentId!==request.assessmentId||!Number.isSafeInteger(r.draftRevision)||Number(r.draftRevision)<=Number(request.expectedRevision)||(request.intent==='review'?r.status!=='professional_review':!['draft','in_progress'].includes(String(r.status))))throw Error('Gespeicherter Assessmentstand stimmt nicht mit der bestätigten Anfrage überein.');
 return {assessmentId:request.assessmentId,draftRevision:Number(r.draftRevision),status:String(r.status)};
}
export type AssessmentDraftWriteResult={ok:true;id:string}|{ok:false;error:string;uncertain?:boolean};
export async function runAssessmentDraftRequest(request:AssessmentDraftRequest,invoke:()=>Promise<{data:unknown;error:unknown}>,rejection:(error:unknown)=>{message:string;definite:boolean}):Promise<AssessmentDraftWriteResult>{
 const error=validateAssessmentDraftRequest(request);if(error)return {ok:false,error};
 try{
  const result=await invoke();
  if(result.error){const failure=rejection(result.error);return {ok:false,error:failure.message,uncertain:!failure.definite};}
  const receipt=assertAssessmentDraftReceipt(request,result.data);return {ok:true,id:receipt.assessmentId};
 }catch{return {ok:false,uncertain:true,error:'Die Speicherbestätigung fehlt oder ist unvollständig. Dieselbe Anfrage erneut prüfen.'};}
}
