import {getSupabaseClient} from '@/lib/supabase/client';
import {toGermanSupabaseError} from '@/lib/supabase/errors';
import {withServiceQueryTimeout} from '@/lib/services/queryTimeout';
import {enforcePermission} from '@/lib/permissions';
import {guardServiceTenant} from '@/lib/services/liveServiceGuard';
import {validateAssessmentInstrumentSnapshot,type AssessmentInstrumentSnapshot} from './assessmentInstrumentPacket.web';
import type {RoleKey,ServiceResult} from '@/types';

export async function readAssessmentInstrumentSnapshot(input:{tenantId:string;assessmentId:string;subjectId:string;actorId:string;role?:RoleKey|null}):Promise<ServiceResult<AssessmentInstrumentSnapshot>>{
 const denied=enforcePermission<AssessmentInstrumentSnapshot>(input.role,'pflege.plans.view');if(denied)return denied;
 const tenant=guardServiceTenant(input.tenantId);if(tenant)return tenant;
 const client=getSupabaseClient();if(!client)return {ok:false,error:'Pflegeassessment-Datenbank nicht verbunden.'};
 try{
  const rpc=client as unknown as {rpc(name:string,args:Record<string,unknown>):Promise<{data:unknown;error:unknown}>};
  const result=await withServiceQueryTimeout(rpc.rpc('web_read_ambulatory_assessment_instrument_packet',{p_tenant_id:input.tenantId,p_assessment_id:input.assessmentId,p_subject_id:input.subjectId,p_actor_profile_id:input.actorId}),'Assessmentmodell und Instrumente laden',20_000);
  if(result.error)return {ok:false,error:toGermanSupabaseError(result.error as Parameters<typeof toGermanSupabaseError>[0])};
  const issue=validateAssessmentInstrumentSnapshot(result.data,{tenantId:input.tenantId,assessmentId:input.assessmentId,subjectId:input.subjectId,actorId:input.actorId});
  if(issue)return {ok:false,error:issue};
  return {ok:true,data:structuredClone(result.data as AssessmentInstrumentSnapshot)};
 }catch(error){return {ok:false,error:error instanceof Error?error.message:'Instrumentenbestand nicht vollständig verfügbar.'};}
}
