import type {RoleKey,ServiceResult} from '@/types';
import {enforcePermission} from '@/lib/permissions';
import {guardServiceTenant} from '@/lib/services/liveServiceGuard';
import {getServiceMode} from '@/lib/services/mode';
import {getSupabaseClient} from '@/lib/supabase/client';
import {withServiceQueryTimeout} from '@/lib/services/queryTimeout';
import {toGermanSupabaseError} from '@/lib/supabase/errors';
import {fromUnknownTable} from '@/lib/supabase/untypedTable';
import {loadCompleteMedicationHistory,medicationHistoryFilter} from './medicationHistoryPagination';
import {isDefiniteMedicationRejection} from './medicationRequestState';
import {woundUuid} from './woundCareDomain';
import {decodeInfusionSnapshot,decodeInfusionConfirmation,validateInfusionRequest,type InfusionRequest,type InfusionRecord} from './infusionCourseGateway';
import type {MedicationWriteResult} from './medicationAdministrationService';
type Row=Record<string,unknown>;
const scope=<T,>(tenant:string,role:RoleKey|null,write=false)=>enforcePermission<T>(role,'pflege.treatment.view')??enforcePermission<T>(role,'pflege.orders.view')??(write?enforcePermission<T>(role,'pflege.treatment.manage'):null)??guardServiceTenant(tenant);
export async function fetchInfusionOrders(tenant:string,client:string,role:RoleKey|null):Promise<ServiceResult<Row[]>>{
 const denied=scope<Row[]>(tenant,role);if(denied)return denied;if(!woundUuid(client))return {ok:false,error:'Aktiven Pflegefall wählen.'};const db=getServiceMode()==='supabase'?getSupabaseClient():null;if(!db)return {ok:false,error:'Anordnungsdatenbank nicht verbunden.'};
 try{const rows=await loadCompleteMedicationHistory<Row>(async cursor=>{let q=fromUnknownTable(db,'care_medical_orders').select('*').eq('tenant_id',tenant).eq('client_id',client).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(250);if(cursor)q=q.or(medicationHistoryFilter(cursor));const r=await withServiceQueryTimeout(Promise.resolve(q),'Infusionsanordnungen vollständig laden',20_000);if(r.error)throw Error(toGermanSupabaseError(r.error));return r.data;},tenant,r=>r.client_id===client);return {ok:true,data:rows};}catch(e){return {ok:false,error:e instanceof Error?e.message:'Anordnungen nicht vollständig geladen.'};}
}
export async function fetchInfusionCheckers(tenant:string,role:RoleKey|null):Promise<ServiceResult<{id:string;name:string}[]>>{
 const denied=scope<{id:string;name:string}[]>(tenant,role);if(denied)return denied;const db=getServiceMode()==='supabase'?getSupabaseClient():null;if(!db)return {ok:false,error:'Prüfpersonen nicht verbunden.'};
 try{const rows=await loadCompleteMedicationHistory<Row>(async cursor=>{let q=fromUnknownTable(db,'profiles').select('id,tenant_id,display_name,is_active,created_at').eq('tenant_id',tenant).eq('is_active',true).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(250);if(cursor)q=q.or(medicationHistoryFilter(cursor));const r=await withServiceQueryTimeout(Promise.resolve(q),'Zugängliche aktive Prüfpersonen vollständig laden',20_000);if(r.error)throw Error(toGermanSupabaseError(r.error));return r.data;},tenant,r=>r.is_active===true);return {ok:true,data:rows.map(r=>({id:String(r.id),name:typeof r.display_name==='string'&&r.display_name.trim()?r.display_name:'Name nicht bestätigt'}))};}catch(e){return {ok:false,error:e instanceof Error?e.message:'Prüfpersonen nicht vollständig geladen.'};}
}
function database(){const db=getServiceMode()==='supabase'?getSupabaseClient():null;return db as unknown as {rpc(name:string,args:Row):Promise<{data:unknown;error:{code?:string}|null;status?:number}>}|null;}
export async function fetchInfusionCourses(tenant:string,client:string|null,role:RoleKey|null):Promise<ServiceResult<InfusionRecord[]>>{
 const denied=scope<InfusionRecord[]>(tenant,role);if(denied)return denied;
 if(!woundUuid(tenant)||(client!==null&&!woundUuid(client)))return {ok:false,error:'Infusions-Aktenkontext ungültig.'};const db=database();if(!db)return {ok:false,error:'Infusionsdatenbank nicht verbunden.'};
 try{const r=await withServiceQueryTimeout(db.rpc('read_infusion_courses',{requested_tenant:tenant,requested_client:client}),'Infusionsverläufe konsistent und vollständig laden',20_000);if(r.error)return {ok:false,error:toGermanSupabaseError(r.error)};return {ok:true,data:decodeInfusionSnapshot(r.data,tenant,client)};}catch(e){return {ok:false,error:e instanceof Error?e.message:'Infusionsverläufe nicht vollständig verfügbar.'};}
}
export async function writeInfusionEvent(tenant:string,id:string,payload:InfusionRequest,role:RoleKey|null,replay=false):Promise<MedicationWriteResult>{
 const denied=scope<{id:string}>(tenant,role,true);if(denied)return denied;if(!woundUuid(id))return {ok:false,error:'Anfrage-ID ungültig.'};
 if(!replay){try{validateInfusionRequest(tenant,payload);}catch(e){return {ok:false,error:e instanceof Error?e.message:'Infusionsangaben ungültig.'};}}
 const db=database();if(!db)return {ok:false,error:'Infusionsdatenbank nicht verbunden.'};
 try{const r=await withServiceQueryTimeout(db.rpc('write_infusion_event',{request_id:id,payload}),'Tatsächliches Infusionsereignis speichern',20_000);if(r.error)return {ok:false,error:toGermanSupabaseError(r.error),uncertain:!isDefiniteMedicationRejection(r.error.code,r.status)};
  return {ok:true,data:decodeInfusionConfirmation(r.data,tenant,id,payload)};
 }catch(e){return {ok:false,error:e instanceof Error?e.message:'Speicherbestätigung fehlt. Dieselbe unveränderte Anfrage erneut prüfen.',uncertain:true};}
}
