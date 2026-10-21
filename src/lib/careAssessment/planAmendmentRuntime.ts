import {controlExact} from '../pflege/clinicalControlShape.ts';
import {sameWoundJson,woundInstant,woundUuid} from '../pflege/woundCareDomain.ts';
import {isDefiniteMedicationRejection} from '../pflege/medicationRequestState.ts';
import {snapshotPlanAmendment,type PlanAmendmentRequest} from './planAmendmentDomain.ts';
import type {ControlRpc,ControlResult} from '../pflege/clinicalControlRuntime.ts';
export const amendmentReceiptFields=['id','tenantId','assessmentId','clientId','requestId','sourceRootId','sourceHeadId','measureId','previousRevision','draftRevision','status','planVersion','appliedMeasure'] as const;
export function assertPlanAmendmentReceipt(value:unknown,request:PlanAmendmentRequest,requestId:string){
 const p=request;
 if(!controlExact(value,[...amendmentReceiptFields])||!woundUuid(value.id)||value.tenantId!==p.target.tenantId||value.assessmentId!==p.target.assessmentId||value.clientId!==p.target.clientId||value.requestId!==requestId||value.sourceRootId!==p.source.root.id||value.sourceHeadId!==p.source.headId||value.measureId!==p.measureId||value.previousRevision!==p.target.draftRevision||!Number.isSafeInteger(value.draftRevision)||(value.draftRevision as number)<=p.target.draftRevision||(value.draftRevision as number)>2147483647||value.status!==p.target.status||value.planVersion!==p.target.version||!sameWoundJson(value.appliedMeasure,p.proposed))throw Error('Passender Änderungsbeleg mit ursprünglichem Auftrag und geänderter Maßnahme fehlt.');
 return {id:value.id as string};
}
/** Server performs atomic source/plan checks; transport preflight is not an authorization boundary. */
export async function writePlanAmendment(rpc:ControlRpc,tenant:string,requestId:string,payload:PlanAmendmentRequest,replay=false,now=Date.now()):Promise<ControlResult<{id:string}>>{
 let p:PlanAmendmentRequest;
 try{p=snapshotPlanAmendment(payload,now);if(!woundUuid(tenant)||!woundUuid(requestId)||tenant!==p.target.tenantId)throw Error('Eigener Mandant und ursprüngliche Anfrage fehlen.');if(!replay&&['planned','active'].includes(p.proposed.status!)&&woundInstant(p.proposed.nextEvaluationAt)!<=BigInt(now)*1000n)throw Error('Prüftermin inzwischen erreicht. Änderung erneut abstimmen.');}catch(e){return {ok:false,error:e instanceof Error?e.message:'Änderungsauftrag prüfen.',...(replay?{uncertain:true}:{})};}
 try{const r=await rpc('write_ambulatory_plan_amendment',{request_id:requestId,payload:p});
  if(r.error)return {ok:false,error:r.error.message??'Planänderung nicht bestätigt.',uncertain:replay||!isDefiniteMedicationRejection(r.error.code,r.status)};
  return {ok:true,data:assertPlanAmendmentReceipt(r.data,p,requestId)};
 }catch(e){return {ok:false,error:e instanceof Error?e.message:'Änderungsbestätigung fehlt.',uncertain:true};}
}
