import {woundUuid} from '../pflege/woundCareDomain.ts';
import type {ControlRpc,ControlResult} from '../pflege/clinicalControlRuntime.ts';
import {decodePlanAmendmentHistory,type PlanAmendmentHistoryRecord} from './planAmendmentHistoryDomain.ts';
export async function readPlanAmendmentHistory(rpc:ControlRpc,tenant:string,assessment:string,client:string,now=Date.now()):Promise<ControlResult<PlanAmendmentHistoryRecord[]>>{
 if(![tenant,assessment,client].every(woundUuid))return {ok:false,error:'Eigener Pflegefall und Assessmentbezug fehlen.'};
 try{const r=await rpc('read_ambulatory_plan_amendments',{requested_tenant:tenant,requested_assessment:assessment});if(r.error)return {ok:false,error:r.error.message??'Änderungshistorie nicht zugänglich.'};return {ok:true,data:decodePlanAmendmentHistory(r.data,tenant,assessment,client,now)};}catch(e){return {ok:false,error:e instanceof Error?e.message:'Änderungshistorie nicht vollständig verfügbar.'};}
}
