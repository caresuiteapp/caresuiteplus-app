import {getSupabaseClient} from '@/lib/supabase/client';
import {withServiceQueryTimeout} from '@/lib/services/queryTimeout';
import {enforcePermission} from '@/lib/permissions';
import {guardServiceTenant} from '@/lib/services/liveServiceGuard';
import {sameClientNativeOriginal,freezeClientNativeOriginal} from '../clients/clientRecordNativeOriginal.web.ts';
import {createAssessmentWorkspaceTransport,captureAssessmentWorkspaceJson} from './assessmentWorkspaceTransport.web.ts';
import {validatePlanLifecycleSnapshot,type PlanLifecycleSnapshot} from './planLifecyclePacket.web';
import type {RoleKey,ServiceResult} from '@/types';
import type {HandoverSdk} from '../pflege/caseHandoverRepository.web';
export async function readPlanLifecycleSnapshot(input:{tenantId:string;assessmentId:string;subjectId:string;actorId:string;role?:RoleKey|null;isCurrent?():boolean}):Promise<ServiceResult<PlanLifecycleSnapshot>>{
 try{
  const fields=['tenantId','assessmentId','subjectId','actorId','role','isCurrent'] as const,values=fields.map(key=>{const d=Object.getOwnPropertyDescriptor(input,key);if(d&&(!('value'in d)||!d.enumerable))throw Error('Der eigene native Lesekontext ist ungeklärt.');return d?.value;});
  const [tenantId,assessmentId,subjectId,actorId,role,callback]=values as [string,string,string,string,RoleKey|null|undefined,(()=>boolean)|undefined];
  if(typeof subjectId!=='string'||subjectId.length!==36||! /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(subjectId)||callback!==undefined&&typeof callback!=='function')throw Error('Eigener nativer Personenbezug oder aktuelle Lesewache fehlt.');
  const denied=enforcePermission<PlanLifecycleSnapshot>(role,'pflege.plans.view');if(denied)return denied;const tenant=guardServiceTenant(tenantId);if(tenant)return tenant;
  const current=()=>{try{return fields.every((key,index)=>{const d=Object.getOwnPropertyDescriptor(input,key);return (!d||'value'in d&&d.enumerable)&&d?.value===values[index];})&&(!callback||callback()===true);}catch{return false;}};
  const guard=await createAssessmentWorkspaceTransport({tenantId,assessmentId,actorId,isCurrent:current},{getSdk:()=>getSupabaseClient() as unknown as HandoverSdk|null,query:(request,operation)=>withServiceQueryTimeout(Promise.resolve(request),operation,20_000)});
  const read=async()=>{await guard.check();const response=await guard.read('web_read_plan_lifecycle_v2_packet',{p_tenant_id:tenantId,p_assessment_id:assessmentId,p_subject_id:subjectId,p_actor_profile_id:actorId},'Planlebenszyklus vollständig lesen');await guard.check();if(response.error!==null)throw Error('Der vollständige native Bestand konnte nicht bestätigt werden.');const issue=validatePlanLifecycleSnapshot(response.data,{tenantId,assessmentId,subjectId,actorId});if(issue)throw Error(issue);return freezeClientNativeOriginal(captureAssessmentWorkspaceJson(response.data as PlanLifecycleSnapshot));};
  const first=await read(),last=await read();
  if(!sameClientNativeOriginal(first,last))throw Error('Der vollständige native Bestand wurde während des Ladens geändert. Neu laden.');guard.current();return{ok:true,data:last};
 }catch(error){return{ok:false,error:error instanceof Error?error.message:'Der vollständige native Bestand ist nicht bestätigt.'};}
}
