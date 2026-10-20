import type {RoleKey,ServiceResult} from '@/types';
import {enforcePermission} from '@/lib/permissions';
import {guardServiceTenant} from '@/lib/services/liveServiceGuard';
import {getServiceMode} from '@/lib/services/mode';
import {getSupabaseClient} from '@/lib/supabase/client';
import {fromUnknownTable} from '@/lib/supabase/untypedTable';
import {withServiceQueryTimeout} from '@/lib/services/queryTimeout';
import {toGermanSupabaseError} from '@/lib/supabase/errors';
import {loadCompleteMedicationHistory,medicationHistoryFilter} from './medicationHistoryPagination';
import {isDefiniteMedicationRejection} from './medicationRequestState';
import {sameWoundJson,woundUuid} from './woundCareDomain';
import {fetchWoundCareContext,type WoundCareContext} from './woundCareService';
import {validateTreatmentSource,validateTreatmentCorrection,validateTreatmentCorrectionHistory,validateDressingCorrectionLinks,type TreatmentCorrectionRequest,type TreatmentRow as Row} from './treatmentCorrectionDomain';
import type {MedicationWriteResult} from './medicationAdministrationService';
const database=()=>getServiceMode()==='supabase'?getSupabaseClient():null;
const scope=<T,>(tenant:string,role:RoleKey|null,write=false)=>enforcePermission<T>(role,'pflege.treatment.view')??(write?enforcePermission<T>(role,'pflege.treatment.manage'):null)??guardServiceTenant(tenant);
async function read(db:NonNullable<ReturnType<typeof database>>,table:string,tenant:string,field?:string,value?:string,projection='*'){
 return loadCompleteMedicationHistory<Row>(async cursor=>{
  let q=fromUnknownTable(db,table).select(projection).eq('tenant_id',tenant).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(250);if(field)q=q.eq(field,value);if(cursor)q=q.or(medicationHistoryFilter(cursor));
  const result=await withServiceQueryTimeout(Promise.resolve(q),'Nachweis und Berichtigungen vollständig laden',20_000);if(result.error)throw Error(toGermanSupabaseError(result.error));return result.data;
 },tenant,r=>!field||r[field]===value);
}
export type TreatmentCorrectionContext={execution:Row;dressing:Row|null;corrections:Row[];clientName:string};
export async function fetchTreatmentCorrectionContext(tenant:string,id:string,role:RoleKey|null):Promise<ServiceResult<TreatmentCorrectionContext>>{
 const denied=scope<TreatmentCorrectionContext>(tenant,role);if(denied)return denied;if(!woundUuid(id))return {ok:false,error:'Ungültiger Nachweisbezug.'};const db=database();if(!db)return {ok:false,error:'Behandlungspflegedatenbank nicht verbunden.'};
 try{
  const e=await withServiceQueryTimeout(Promise.resolve(fromUnknownTable(db,'clinical_treatment_executions').select('*').eq('tenant_id',tenant).eq('id',id).maybeSingle()),'Originalnachweis',20_000);if(e.error)throw Error(toGermanSupabaseError(e.error));const execution=e.data as Row|null;if(!execution||execution.id!==id||execution.tenant_id!==tenant)throw Error('Originalnachweis nicht zugänglich.');validateTreatmentSource(execution);
  const people=await read(db,'clients',tenant,'id',String(execution.client_id),'id,tenant_id,first_name,last_name,status,deleted_at,created_at');const person=people[0];if(!person||person.status!=='active'||person.deleted_at!=null)throw Error('Kein aktiver zugänglicher Klient.');
  const relation=await withServiceQueryTimeout(Promise.resolve(db.rpc('read_treatment_wound_relation' as never,{execution_id:id} as never)),'Wundnachweiszuordnung',20_000);if(relation.error)throw Error(toGermanSupabaseError(relation.error));
  const rel=relation.data as unknown as {woundId:unknown;dressingId:unknown}|null;if(!rel||typeof rel!=='object'||Array.isArray(rel)||!Object.hasOwn(rel,'woundId')||!Object.hasOwn(rel,'dressingId')||Object.keys(rel).length!==2||(rel.woundId==null)!==(rel.dressingId==null)||(rel.dressingId!=null&&(!woundUuid(rel.dressingId)||!woundUuid(rel.woundId))))throw Error('Originalzuordnung nicht bestätigt.');
  let dressing:Row|null=null;
  if(rel.dressingId!=null){const permissions=enforcePermission(role,'pflege.wounds.view')??enforcePermission(role,'pflege.orders.view');if(permissions)throw Error('Für die gemeinsame Berichtigung dieses Verbandwechsels sind zusätzlich Wund- und Anordnungsleserechte erforderlich.');
   const d=await read(db,'ambulatory_wound_dressings',tenant,'id',String(rel.dressingId));dressing=d[0]??null;if(!dressing||dressing.execution_id!==id||dressing.client_id!==execution.client_id||dressing.wound_case_id!==rel.woundId)throw Error('Zugehöriger Original-Verbandwechsel nicht vollständig zugänglich.');
  }
  const corrections=await read(db,'clinical_treatment_corrections',tenant,'execution_id',id);validateTreatmentCorrectionHistory(corrections,tenant,[execution]);
  const again=await withServiceQueryTimeout(Promise.resolve(fromUnknownTable(db,'clinical_treatment_executions').select('*').eq('tenant_id',tenant).eq('id',id).maybeSingle()),'Originalstand prüfen',20_000);if(again.error)throw Error(toGermanSupabaseError(again.error));if(!sameWoundJson(execution,again.data))throw Error('Originalnachweis während des Ladens geändert. Neu laden.');
  return {ok:true,data:{execution,dressing,corrections,clientName:[person.first_name,person.last_name].filter(v=>typeof v==='string').join(' ').trim()||'Name fehlt'}};
 }catch(e){return {ok:false,error:e instanceof Error?e.message:'Nachweisstand nicht vollständig geladen.'};}
}
export type TreatmentRecordList={executions:Row[];corrections:Row[];clientNames:Map<string,string>};
export async function fetchTreatmentRecords(tenant:string,role:RoleKey|null):Promise<ServiceResult<TreatmentRecordList>>{
 const denied=scope<TreatmentRecordList>(tenant,role);if(denied)return denied;const db=database();if(!db)return {ok:false,error:'Behandlungspflegedatenbank nicht verbunden.'};
 try{
  const [people,assignments,allExecutions,allCorrections]=await Promise.all([read(db,'clients',tenant,undefined,undefined,'id,tenant_id,first_name,last_name,status,deleted_at,created_at'),read(db,'client_module_assignments',tenant,'module_key','pflege'),read(db,'clinical_treatment_executions',tenant),read(db,'clinical_treatment_corrections',tenant)]);
  const active=new Set(assignments.filter(a=>a.is_active===true&&typeof a.status==='string'&&!['inactive','deactivated','archiviert'].includes(a.status)).map(a=>a.client_id));
  const clientNames=new Map(people.filter(p=>p.status==='active'&&p.deleted_at==null&&active.has(p.id)).map(p=>[String(p.id),[p.first_name,p.last_name].filter(v=>typeof v==='string').join(' ').trim()||'Name fehlt']));
  const executions=allExecutions.filter(e=>clientNames.has(String(e.client_id))),corrections=allCorrections.filter(c=>clientNames.has(String(c.client_id)));validateTreatmentCorrectionHistory(corrections,tenant,executions);
  return {ok:true,data:{executions,corrections,clientNames}};
 }catch(e){return {ok:false,error:e instanceof Error?e.message:'Nachweise und Berichtigungen nicht vollständig geladen.'};}
}
export async function fetchWoundCareWithTreatmentCorrections(tenant:string,id:string,role:RoleKey|null,dressing=false):Promise<ServiceResult<WoundCareContext&{corrections:Row[];correctionLinks:Row[]}>>{
 const ctx=await fetchWoundCareContext(tenant,id,role,dressing);if(!ctx.ok)return ctx;if(!dressing)return {ok:true,data:{...ctx.data,corrections:[],correctionLinks:[]}};
 const db=database();if(!db)return {ok:false,error:'Wunddatenbank nicht verbunden.'};
 try{
  const client=String(ctx.data.wound.row.client_id),[corrections,correctionLinks,executions]=await Promise.all([read(db,'clinical_treatment_corrections',tenant,'wound_case_id',id),read(db,'wound_dressing_correction_links',tenant,'wound_case_id',id),read(db,'clinical_treatment_executions',tenant,'client_id',client)]);
  validateTreatmentCorrectionHistory(corrections,tenant,executions);validateDressingCorrectionLinks(corrections,correctionLinks,tenant,client,id,ctx.data.dressings);
  const after=await withServiceQueryTimeout(Promise.resolve(fromUnknownTable(db,'clinical_wound_cases').select('updated_at,status').eq('tenant_id',tenant).eq('id',id).maybeSingle()),'Wund-Berichtigungsstand prüfen',20_000);if(after.error)throw Error(toGermanSupabaseError(after.error));const w=after.data as Row|null;if(!w||w.updated_at!==ctx.data.wound.row.updated_at||w.status!==ctx.data.wound.row.status)throw Error('Wundverlauf während des Ladens geändert. Neu laden.');
  return {ok:true,data:{...ctx.data,corrections,correctionLinks}};
 }catch(e){return {ok:false,error:e instanceof Error?e.message:'Gemeinsamer Berichtigungsverlauf nicht vollständig.'};}
}
export async function writeTreatmentCorrection(tenant:string,requestId:string,payload:TreatmentCorrectionRequest,role:RoleKey|null,replay=false):Promise<MedicationWriteResult>{
 const denied=scope<{id:string}>(tenant,role,true)??(payload.expectedDressingJson?(enforcePermission<{id:string}>(role,'pflege.wounds.view')??enforcePermission<{id:string}>(role,'pflege.wounds.manage')??enforcePermission<{id:string}>(role,'pflege.orders.view')):null);if(denied)return denied;if(!woundUuid(requestId))return {ok:false,error:'Ungültige Anfrage-ID.'};if(!replay){const error=validateTreatmentCorrection(payload);if(error)return {ok:false,error};}
 const db=database();if(!db)return {ok:false,error:'Behandlungspflegedatenbank nicht verbunden.'};
 try{const rpc=db as unknown as {rpc(name:string,args:Row):Promise<{data:unknown;error:{code?:string}|null;status?:number}>};const r=await withServiceQueryTimeout(rpc.rpc('write_clinical_treatment_correction',{request_id:requestId,payload}),'Berichtigung speichern',20_000);if(r.error)return {ok:false,error:toGermanSupabaseError(r.error),uncertain:!isDefiniteMedicationRejection(r.error.code,r.status)};if(!woundUuid(r.data))return {ok:false,error:'Speicherbestätigung fehlt. Dieselbe unveränderte Anfrage erneut prüfen.',uncertain:true};return {ok:true,data:{id:r.data}};}catch{return {ok:false,error:'Speicherbestätigung fehlt. Dieselbe unveränderte Anfrage erneut prüfen.',uncertain:true};}
}
