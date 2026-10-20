import type {RoleKey,ServiceResult} from '@/types';
import {enforcePermission} from '@/lib/permissions';
import {guardServiceTenant} from '@/lib/services/liveServiceGuard';
import {getServiceMode} from '@/lib/services/mode';
import {getSupabaseClient} from '@/lib/supabase/client';
import {fromUnknownTable} from '@/lib/supabase/untypedTable';
import {withServiceQueryTimeout} from '@/lib/services/queryTimeout';
import {toGermanSupabaseError} from '@/lib/supabase/errors';
import {fetchAmbulatoryWound,type AmbulatoryWound} from './ambulatoryWoundService';
import {loadCompleteMedicationHistory,medicationHistoryFilter} from './medicationHistoryPagination';
import {isDefiniteMedicationRejection} from './medicationRequestState';
import {woundUuid} from './woundCareDomain';
import {validateWoundAssessmentCorrection,validateWoundAssessmentCorrectionHistory,type WoundAssessmentCorrectionRequest} from './woundAssessmentCorrectionDomain';
import type {MedicationWriteResult} from './medicationAdministrationService';
type Row=Record<string,unknown>;
export type WoundCorrectionContext={wound:AmbulatoryWound;corrections:Row[]};
export async function fetchWoundWithCorrections(tenant:string,id:string,role:RoleKey|null):Promise<ServiceResult<AmbulatoryWound&{corrections:Row[]}>>{
 const result=await fetchWoundCorrectionContext(tenant,id,role);
 return result.ok?{ok:true,data:{...result.data.wound,corrections:result.data.corrections}}:result;
}
const block=<T,>(tenant:string,role:RoleKey|null,write=false)=>enforcePermission<T>(role,'pflege.wounds.view')??(write?enforcePermission<T>(role,'pflege.wounds.manage'):null)??guardServiceTenant(tenant);
export async function fetchWoundCorrectionContext(tenant:string,id:string,role:RoleKey|null):Promise<ServiceResult<WoundCorrectionContext>>{
 const denied=block<WoundCorrectionContext>(tenant,role);if(denied)return denied;if(!woundUuid(id))return {ok:false,error:'Ungültiger Wundbezug.'};
 const db=getServiceMode()==='supabase'?getSupabaseClient():null;if(!db)return {ok:false,error:'Wunddatenbank nicht verbunden.'};
 try{
  const w=await fetchAmbulatoryWound(tenant,id,role);if(!w.ok)return w;
  const corrections=await loadCompleteMedicationHistory<Row>(async cursor=>{
   let q=fromUnknownTable(db,'ambulatory_wound_assessment_corrections').select('*').eq('tenant_id',tenant).eq('wound_case_id',id).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(250);
   if(cursor)q=q.or(medicationHistoryFilter(cursor));const result=await withServiceQueryTimeout(Promise.resolve(q),'Berichtigungen vollständig laden',20_000);if(result.error)throw Error(toGermanSupabaseError(result.error));return result.data;
  },tenant,r=>r.wound_case_id===id&&r.client_id===w.data.row.client_id);
  validateWoundAssessmentCorrectionHistory(corrections,tenant,String(w.data.row.client_id),id,w.data.assessments);
  const check=await withServiceQueryTimeout(Promise.resolve(fromUnknownTable(db,'clinical_wound_cases').select('updated_at,status').eq('tenant_id',tenant).eq('id',id).maybeSingle()),'Berichtigungsstand prüfen',20_000);
  if(check.error)throw Error(toGermanSupabaseError(check.error));const after=check.data as Row|null;
  if(!after||after.updated_at!==w.data.row.updated_at||after.status!==w.data.row.status)throw Error('Wundfall während des Ladens geändert. Gesamten Verlauf erneut laden.');
  return {ok:true,data:{wound:w.data,corrections}};
 }catch(e){return {ok:false,error:e instanceof Error?e.message:'Berichtigungsstand nicht vollständig verfügbar.'};}
}
export async function writeWoundAssessmentCorrection(tenant:string,requestId:string,payload:WoundAssessmentCorrectionRequest,role:RoleKey|null,replay=false):Promise<MedicationWriteResult>{
 const denied=block<{id:string}>(tenant,role,true);if(denied)return denied;if(!woundUuid(requestId))return {ok:false,error:'Ungültige Anfrage-ID.'};if(!replay){const error=validateWoundAssessmentCorrection(payload);if(error)return {ok:false,error};}
 const db=getServiceMode()==='supabase'?getSupabaseClient():null;if(!db)return {ok:false,error:'Wunddatenbank nicht verbunden.'};
 try{
  const rpc=db as unknown as {rpc(name:string,args:Row):Promise<{data:unknown;error:{code?:string}|null;status?:number}>};
  const result=await withServiceQueryTimeout(rpc.rpc('write_ambulatory_wound_assessment_correction',{request_id:requestId,payload}),'Berichtigung speichern',20_000);
  if(result.error)return {ok:false,error:toGermanSupabaseError(result.error),uncertain:!isDefiniteMedicationRejection(result.error.code,result.status)};
  if(!woundUuid(result.data))return {ok:false,error:'Speicherbestätigung fehlt. Dieselbe unveränderte Berichtigungsanfrage erneut prüfen.',uncertain:true};
  return {ok:true,data:{id:result.data}};
 }catch{return {ok:false,error:'Speicherbestätigung fehlt. Dieselbe unveränderte Berichtigungsanfrage erneut prüfen.',uncertain:true};}
}
