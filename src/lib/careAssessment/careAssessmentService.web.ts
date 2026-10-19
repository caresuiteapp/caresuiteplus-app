import {runAssessmentLifecycleRequest,type AssessmentLifecycleRequest} from './assessmentLifecycleDomain';
import {runAssessmentDraftRequest,type AssessmentDraftRequest} from './assessmentDraftRequestDomain';
import {isDefiniteMedicationRejection} from '@/lib/pflege/medicationRequestState';
import {getSupabaseClient} from '@/lib/supabase/client';
import {withServiceQueryTimeout} from '@/lib/services/queryTimeout';
import {toGermanSupabaseError} from '@/lib/supabase/errors';
import {calculateCareAssessmentCompleteness} from './catalog';
import type { RoleKey, ServiceResult } from '@/types';
import type {
  CareAssessment,
  CareAssessmentListItem,
  CareAssessmentStatus,
  CareAssessmentSubjectOption,
  CareAssessmentSubjectType,
  CareAssessmentEvaluation,
} from '@/types/modules/careAssessment';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { careAssessmentRepository } from './careAssessmentRepository.supabase';

const viewPermission = (type: CareAssessmentSubjectType) =>
  type === 'resident' ? 'stationaer.residents.view' : 'pflege.plans.view';
const managePermission = (type: CareAssessmentSubjectType) =>
  type === 'resident' ? 'stationaer.assessments.manage' : 'pflege.assessments.manage';

export async function fetchEligibleCareClients(
  tenantId: string,
  role?: RoleKey | null,
): Promise<ServiceResult<CareAssessmentSubjectOption[]>> {
  const denied = enforcePermission<CareAssessmentSubjectOption[]>(role, viewPermission('client'));
  if (denied) return denied;
  const tenant = guardServiceTenant(tenantId);
  return tenant ?? careAssessmentRepository.listEligibleCareClients(tenantId);
}

export async function fetchCareAssessments(
  tenantId: string,
  subjectType: CareAssessmentSubjectType,
  role?: RoleKey | null,
): Promise<ServiceResult<CareAssessmentListItem[]>> {
  const denied = enforcePermission<CareAssessmentListItem[]>(role, viewPermission(subjectType));
  if (denied) return denied;
  const tenant = guardServiceTenant(tenantId);
  return tenant ?? careAssessmentRepository.list(tenantId, subjectType);
}

export async function fetchCareAssessment(
  tenantId: string,
  id: string,
  subjectType: CareAssessmentSubjectType,
  role?: RoleKey | null,
): Promise<ServiceResult<CareAssessment>> {
  const denied = enforcePermission<CareAssessment>(role, viewPermission(subjectType));
  if (denied) return denied;
  const tenant = guardServiceTenant(tenantId);
  if (tenant) return tenant;
  const result = await careAssessmentRepository.get(tenantId, id);
  if (result.ok && result.data.subjectType !== subjectType) {
    return { ok: false, error: 'Dieser Datensatz gehört nicht zum gewählten Fachbereich.' };
  }
  return result;
}

export async function createCareAssessment(
  tenantId: string,
  input: Pick<CareAssessment, 'subjectType' | 'subjectId' | 'subjectName' | 'variant' | 'reason' | 'assessorName'>,
  role?: RoleKey | null,
) {
  const denied = enforcePermission<CareAssessment>(role, managePermission(input.subjectType));
  if (denied) return denied;
  const tenant = guardServiceTenant(tenantId);
  return tenant ?? careAssessmentRepository.create(tenantId, input);
}

export async function saveCareAssessment(tenantId: string, value: CareAssessment, role?: RoleKey | null) {
  const denied = enforcePermission<CareAssessment>(role, managePermission(value.subjectType));
  if (denied) return denied;
  const tenant = guardServiceTenant(tenantId);
  return tenant ?? careAssessmentRepository.save(tenantId, value);
}

export async function transitionCareAssessment(
  tenantId: string,
  value: CareAssessment,
  status: CareAssessmentStatus,
  actorName: string,
  role?: RoleKey | null,
) {
  const denied = enforcePermission<CareAssessment>(role, managePermission(value.subjectType));
  if (denied) return denied;
  const tenant = guardServiceTenant(tenantId);
  if (tenant) return tenant;
  if (value.subjectType !== 'client') return careAssessmentRepository.transition(tenantId, value.id, status, actorName);
  if (status !== 'professional_review') return {ok:false as const,error:'Fachliche Freigabe und weitere Statuswechsel bleiben bis zu den notwendigen fachlichen und serverseitigen Nachweisen gesperrt.'};
  if (!calculateCareAssessmentCompleteness(value).canSubmitForReview) return {ok:false as const,error:'Die offenen Angaben vor der Übergabe beheben.'};
  const client=getSupabaseClient();if(!client)return {ok:false as const,error:'Pflegeassessment-Datenbank nicht verbunden.'};
  try {
    const rpc=client as unknown as {rpc(name:string,args:Record<string,unknown>):Promise<{data:unknown;error:unknown}>};
    const result=await withServiceQueryTimeout(rpc.rpc('submit_ambulatory_assessment_review',{assessment_id:value.id,expected_version:value.version}),'Assessment zur Prüfung übergeben',20_000);
    if(result.error)return {ok:false as const,error:toGermanSupabaseError(result.error as Parameters<typeof toGermanSupabaseError>[0])};
    if(result.data!==value.id)return {ok:false as const,error:'Die Übergabe ist noch nicht bestätigt. Den gespeicherten Verlauf neu laden.'};
    return careAssessmentRepository.get(tenantId,value.id);
  }catch{return {ok:false as const,error:'Die Übergabebestätigung fehlt. Den gespeicherten Verlauf neu laden; keine fachliche Freigabe ableiten.'};}
}

export async function addCareAssessmentEvaluation(
  tenantId: string,
  value: CareAssessment,
  evaluation: Omit<CareAssessmentEvaluation, 'id'>,
  role?: RoleKey | null,
) {
  if(value.subjectType==='client')return {ok:false as const,error:'Ambulante Evaluation benötigt den historischen Maßnahmenstand im neuen Evaluationsverlauf.'};
  const denied = enforcePermission<CareAssessment>(role, managePermission(value.subjectType));
  if (denied) return denied;
  const tenant = guardServiceTenant(tenantId);
  return tenant ?? careAssessmentRepository.addEvaluation(tenantId, value.id, evaluation);
}

/** Web request identity is provided by the mounted form and retained on an uncertain result. */
export async function writeAmbulatoryAssessmentRequest(tenantId:string,requestId:string,payload:AssessmentDraftRequest,role?:RoleKey|null){
 const denied=enforcePermission<never>(role,'pflege.assessments.manage')??enforcePermission<never>(role,'pflege.plans.view')??guardServiceTenant(tenantId);
 if(denied)return denied;
 const client=getSupabaseClient();if(!client)return {ok:false as const,error:'Pflegeassessment-Datenbank nicht verbunden.'};
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId))return {ok:false as const,error:'Ungültige Anfrage-ID.'};
 const rpc=client as unknown as {rpc(name:string,args:Record<string,unknown>):Promise<{data:unknown;error:unknown}>};
 return runAssessmentDraftRequest(payload,()=>withServiceQueryTimeout(rpc.rpc('write_ambulatory_assessment_draft',{request_id:requestId,payload}),'Assessment speichern',20_000),error=>{
  const value=error as {code?:string;status?:number};return {message:toGermanSupabaseError(error as Parameters<typeof toGermanSupabaseError>[0]),definite:isDefiniteMedicationRejection(value?.code,value?.status)};
 });
}

export async function applyAmbulatoryAssessmentLifecycle(tenantId:string,requestId:string,payload:AssessmentLifecycleRequest,role?:RoleKey|null){
 const denied=enforcePermission<never>(role,'pflege.assessments.manage')??enforcePermission<never>(role,'pflege.plans.view')??guardServiceTenant(tenantId);
 if(denied)return denied;
 const client=getSupabaseClient();if(!client)return {ok:false as const,error:'Pflegeassessment-Datenbank nicht verbunden.'};
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId))return {ok:false as const,error:'Ungültige Anfrage-ID.'};
 const rpc=client as unknown as {rpc(name:string,args:Record<string,unknown>):Promise<{data:unknown;error:unknown}>};
 return runAssessmentLifecycleRequest(payload,()=>withServiceQueryTimeout(rpc.rpc('apply_ambulatory_assessment_lifecycle',{request_id:requestId,payload}),'Assessmentaktion',20_000),error=>{
  const value=error as {code?:string;status?:number};return {message:toGermanSupabaseError(error as Parameters<typeof toGermanSupabaseError>[0]),definite:isDefiniteMedicationRejection(value?.code,value?.status)};
 });
}
