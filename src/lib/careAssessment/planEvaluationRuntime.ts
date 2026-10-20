import {requireMeasureReviews} from './planEvaluationMeasures.ts';
import {controlExact} from '../pflege/clinicalControlDomain.ts';
import {woundUuid} from '../pflege/woundCareDomain.ts';
import {isDefiniteMedicationRejection} from '../pflege/medicationRequestState.ts';
import {decodeEvaluationRecords,snapshotEvaluationRequest,type EvaluationRequest,type EvaluationRecord} from './planEvaluationDomain.ts';
import type {ControlRpc,ControlResult} from '../pflege/clinicalControlRuntime.ts';
export async function readPlanEvaluations(rpc:ControlRpc,tenant:string,assessment:string,client:string,now=Date.now()):Promise<ControlResult<EvaluationRecord[]>>{
 if(![tenant,assessment,client].every(woundUuid))return {ok:false,error:'Eigener Assessment-/Pflegefallbezug fehlt.'};try{const r=await rpc('read_ambulatory_plan_evaluations',{requested_tenant:tenant,requested_assessment:assessment});if(r.error)return {ok:false,error:r.error.message??'Evaluationsbestand nicht zugänglich.'};return {ok:true,data:decodeEvaluationRecords(r.data,tenant,assessment,client,now)};}catch(e){return {ok:false,error:e instanceof Error?e.message:'Evaluationsbestand nicht vollständig verfügbar.'};}
}
export async function writePlanEvaluation(rpc:ControlRpc,tenant:string,requestId:string,payload:EvaluationRequest,replay=false):Promise<ControlResult<{id:string}>>{
 let p:EvaluationRequest;try{p=snapshotEvaluationRequest(payload);if(!replay)requireMeasureReviews(p.draft.entry,p.snapshot);if(!woundUuid(tenant)||!woundUuid(requestId)||p.snapshot.tenantId!==tenant)throw Error('Eigener Mandant/Originalrequest fehlt.');}catch(e){return {ok:false,error:e instanceof Error?e.message:'Evaluationsangaben prüfen.'};}
 try{const r=await rpc('write_ambulatory_plan_evaluation',{request_id:requestId,payload:p});if(r.error)return {ok:false,error:r.error.message??'Evaluation nicht gespeichert.',uncertain:replay||!isDefiniteMedicationRejection(r.error.code,r.status)};
 if(!controlExact(r.data,['id','tenantId','assessmentId','rootId','requestId','previousId','sequence'])||!woundUuid(r.data.id)||r.data.tenantId!==tenant||r.data.assessmentId!==p.assessmentId||r.data.rootId!==p.rootId||r.data.requestId!==requestId||r.data.previousId!==p.expectedHeadId||r.data.sequence!==p.expectedSequence+1)return {ok:false,error:'Passende Evaluationsbestätigung fehlt. Dieselbe Anfrage erneut prüfen.',uncertain:true};return {ok:true,data:{id:r.data.id}};}catch(e){return {ok:false,error:e instanceof Error?e.message:'Evaluationsbestätigung fehlt.',uncertain:true};}
}
