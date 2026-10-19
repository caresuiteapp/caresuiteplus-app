import type {RoleKey,ServiceResult} from '@/types';
import {enforcePermission} from '@/lib/permissions';
import {guardServiceTenant} from '@/lib/services/liveServiceGuard';
import {getServiceMode} from '@/lib/services/mode';
import {getSupabaseClient} from '@/lib/supabase/client';
import {fromUnknownTable} from '@/lib/supabase/untypedTable';
import {withServiceQueryTimeout} from '@/lib/services/queryTimeout';
import {toGermanSupabaseError} from '@/lib/supabase/errors';
import {loadCompleteMedicationHistory,medicationHistoryFilter,medicationHistoryCursor} from './medicationHistoryPagination';
import {isDefiniteMedicationRejection} from './medicationRequestState';
import {validateWoundRequest,type WoundRequest} from './woundDocumentationDomain';
import {validateWoundLifecycle,type WoundLifecycleRequest} from './woundLifecycleDomain';
import type {MedicationWriteResult} from './medicationAdministrationService';
type Row=Record<string,unknown>;
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const database=()=>getServiceMode()==='supabase'?getSupabaseClient():null;
const scope=<T,>(tenant:string,role:RoleKey|null,write=false)=>enforcePermission<T>(role,write?'pflege.wounds.manage':'pflege.wounds.view')??guardServiceTenant(tenant);
async function all(client:NonNullable<ReturnType<typeof database>>,table:string,tenant:string,field?:string,id?:string){
 return loadCompleteMedicationHistory<Row>(async cursor=>{
  let q=fromUnknownTable(client,table).select('*').eq('tenant_id',tenant).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(250);
  if(field)q=q.eq(field,id);if(cursor)q=q.or(medicationHistoryFilter(cursor));const r=await withServiceQueryTimeout(Promise.resolve(q),'Wundverlauf',20_000);if(r.error)throw Error(toGermanSupabaseError(r.error));return r.data;
 },tenant,r=>!field||r[field]===id);
}
export async function fetchWoundClients(tenant:string,role:RoleKey|null):Promise<ServiceResult<{id:string;name:string}[]>>{
 const blocked=scope<{id:string;name:string}[]>(tenant,role);if(blocked)return blocked;const db=database();if(!db)return {ok:false,error:'Wunddatenbank ist nicht verbunden.'};
 try{const [people,assignments]=await Promise.all([all(db,'clients',tenant),all(db,'client_module_assignments',tenant,'module_key','pflege')]);const active=new Set(assignments.filter(a=>a.is_active===true&&typeof a.status==='string'&&!['inactive','deactivated','archiviert'].includes(a.status)).map(a=>a.client_id));return {ok:true,data:people.filter(p=>p.status==='active'&&p.deleted_at==null&&active.has(p.id)).map(p=>({id:String(p.id),name:[p.first_name,p.last_name].filter(v=>typeof v==='string').join(' ').trim()||'Name fehlt'}))};}catch(e){return {ok:false,error:e instanceof Error?e.message:'Pflegeklient:innen nicht vollständig geladen.'};}
}
export type AmbulatoryWound={row:Row;assessments:Row[];lifecycle:Row[];clientName:string};
export async function fetchAmbulatoryWound(tenant:string,id:string,role:RoleKey|null):Promise<ServiceResult<AmbulatoryWound>>{
 const blocked=scope<AmbulatoryWound>(tenant,role);if(blocked)return blocked;if(!uuid(id))return {ok:false,error:'Ungültige Wund-ID.'};const db=database();if(!db)return {ok:false,error:'Wunddatenbank ist nicht verbunden.'};
 try{const r=await withServiceQueryTimeout(Promise.resolve(fromUnknownTable(db,'clinical_wound_cases').select('*').eq('tenant_id',tenant).eq('id',id).maybeSingle()),'Wundfall',20_000);if(r.error)throw Error(toGermanSupabaseError(r.error));const w=r.data as Row|null;if(!w||w.id!==id||w.tenant_id!==tenant||!uuid(w.client_id))throw Error('Wundfall nicht zugänglich.');const people=await fetchWoundClients(tenant,role);if(!people.ok)throw Error(people.error);const person=people.data.find(p=>p.id===w.client_id);if(!person)throw Error('Kein aktiver zugänglicher Pflegefall.');const assessments=await all(db,'clinical_wound_assessments',tenant,'wound_case_id',id);if(assessments.some(a=>a.client_id!==w.client_id))throw Error('Assessment einer fremden Akte zugeordnet.');for(const a of assessments){if(a.observed_at!=null)medicationHistoryCursor({id:a.id,created_at:a.observed_at});if(a.documentation_details!=null&&(typeof a.documentation_details!=='object'||Array.isArray(a.documentation_details)))throw Error('Assessmentdetails sind ungültig.');}medicationHistoryCursor(w);if(w.documentation_details!=null&&(typeof w.documentation_details!=='object'||Array.isArray(w.documentation_details)))throw Error('Wundfalldetails sind ungültig.');const lifecycle=await all(db,'ambulatory_wound_lifecycle_events',tenant,'wound_case_id',id);if(lifecycle.some(e=>e.client_id!==w.client_id))throw Error('Fallstatusereignis einer fremden Akte zugeordnet.');for(const e of lifecycle){medicationHistoryCursor({id:e.id,created_at:e.occurred_at});if(!['close','reopen'].includes(String(e.action))||typeof e.reason!=='string'||typeof e.decision_basis!=='string'||typeof e.handover!=='string')throw Error('Fallstatusverlauf ungültig.');}const check=await withServiceQueryTimeout(Promise.resolve(fromUnknownTable(db,'clinical_wound_cases').select('updated_at,status').eq('tenant_id',tenant).eq('id',id).maybeSingle()),'Wundfallstand prüfen',20_000);if(check.error)throw Error(toGermanSupabaseError(check.error));const after=check.data as Row|null;if(!after||after.updated_at!==w.updated_at||after.status!==w.status)throw Error('Fallstatus während des Ladens geändert. Verlauf erneut laden.');return {ok:true,data:{row:w,assessments,lifecycle,clientName:person.name}};}catch(e){return {ok:false,error:e instanceof Error?e.message:'Wundfall konnte nicht vollständig geladen werden.'};}
}
export async function writeAmbulatoryWound(tenant:string,requestId:string,payload:WoundRequest,role:RoleKey|null,replay=false):Promise<MedicationWriteResult>{
 const blocked=scope<{id:string}>(tenant,role,true)??enforcePermission<{id:string}>(role,'pflege.wounds.view');if(blocked)return blocked;if(!uuid(requestId))return {ok:false,error:'Ungültige Anfrage-ID.'};if(!replay){const error=validateWoundRequest(payload);if(error)return {ok:false,error};}const db=database();if(!db)return {ok:false,error:'Wunddatenbank ist nicht verbunden.'};
 try{const rpc=db as unknown as {rpc(name:string,args:Row):Promise<{data:unknown;error:{code?:string}|null;status?:number}>};const r=await withServiceQueryTimeout(rpc.rpc('write_ambulatory_wound_documentation',{request_id:requestId,payload}),'Wunddokumentation speichern',20_000);if(r.error)return {ok:false,error:toGermanSupabaseError(r.error),uncertain:!isDefiniteMedicationRejection(r.error.code,r.status)};if(!uuid(r.data))return {ok:false,error:'Speicherbestätigung fehlt. Dieselbe Anfrage erneut prüfen.',uncertain:true};return {ok:true,data:{id:r.data}};}catch{return {ok:false,error:'Speicherbestätigung fehlt. Dieselbe Anfrage erneut prüfen.',uncertain:true};}
}
export async function fetchAmbulatoryWoundList(tenant:string,role:RoleKey|null):Promise<ServiceResult<{row:Row;clientName:string}[]>>{
 const blocked=scope<{row:Row;clientName:string}[]>(tenant,role);if(blocked)return blocked;const db=database();if(!db)return {ok:false,error:'Wunddatenbank ist nicht verbunden.'};
 try{const people=await fetchWoundClients(tenant,role);if(!people.ok)throw Error(people.error);const names=new Map(people.data.map(p=>[p.id,p.name]));const wounds=await all(db,'clinical_wound_cases',tenant);return {ok:true,data:wounds.filter(w=>names.has(String(w.client_id))).map(w=>({row:w,clientName:names.get(String(w.client_id))!}))};}catch(e){return {ok:false,error:e instanceof Error?e.message:'Wundfälle konnten nicht vollständig geladen werden.'};}
}

export async function writeWoundLifecycle(tenant:string,requestId:string,payload:WoundLifecycleRequest,role:RoleKey|null,replay=false):Promise<MedicationWriteResult>{
 const blocked=scope<{id:string}>(tenant,role,true)??enforcePermission<{id:string}>(role,'pflege.wounds.view');if(blocked)return blocked;if(!uuid(requestId))return {ok:false,error:'Ungültige Anfrage-ID.'};if(!replay){const error=validateWoundLifecycle(payload);if(error)return {ok:false,error};}const db=database();if(!db)return {ok:false,error:'Wunddatenbank ist nicht verbunden.'};
 try{const rpc=db as unknown as {rpc(name:string,args:Row):Promise<{data:unknown;error:{code?:string}|null;status?:number}>};const r=await withServiceQueryTimeout(rpc.rpc('write_ambulatory_wound_lifecycle',{request_id:requestId,payload}),'Fallstatus speichern',20_000);if(r.error)return {ok:false,error:toGermanSupabaseError(r.error),uncertain:!isDefiniteMedicationRejection(r.error.code,r.status)};if(!uuid(r.data))return {ok:false,error:'Speicherbestätigung fehlt. Dieselbe Anfrage erneut prüfen.',uncertain:true};return {ok:true,data:{id:r.data}};}catch{return {ok:false,error:'Speicherbestätigung fehlt. Dieselbe Anfrage erneut prüfen.',uncertain:true};}
}
