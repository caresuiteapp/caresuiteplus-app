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
import {validateWoundCare,validateWoundOrder,parseWoundMaterials,sameWoundJson,woundUuid,woundInstant,type WoundCareRequest} from './woundCareDomain';
import type {MedicationWriteResult} from './medicationAdministrationService';
type Row=Record<string,unknown>;
export type WoundCareContext={wound:AmbulatoryWound;plans:Row[];orders:Row[];dressings:Row[]};
function block<T>(tenant:string,role:RoleKey|null,dressing=false,write=false){
 return enforcePermission<T>(role,'pflege.wounds.view')??enforcePermission<T>(role,'pflege.orders.view')??(write?enforcePermission<T>(role,'pflege.wounds.manage'):null)??(dressing?enforcePermission<T>(role,'pflege.treatment.view'):null)??(dressing&&write?enforcePermission<T>(role,'pflege.treatment.manage'):null)??guardServiceTenant(tenant);
}
export async function fetchWoundCareContext(tenant:string,id:string,role:RoleKey|null,dressing=false):Promise<ServiceResult<WoundCareContext>>{
 const blocked=block<WoundCareContext>(tenant,role,dressing);if(blocked)return blocked;if(!woundUuid(id))return {ok:false,error:'Ungültige Wund-ID.'};
 const db=getServiceMode()==='supabase'?getSupabaseClient():null;if(!db)return {ok:false,error:'Wunddatenbank nicht verbunden.'};
 try{
  const wound=await fetchAmbulatoryWound(tenant,id,role);if(!wound.ok)return wound;
  const client=String(wound.data.row.client_id);
  async function read(table:string,field:string,value:string){return loadCompleteMedicationHistory<Row>(async cursor=>{
   let q=fromUnknownTable(db!,table).select('*').eq('tenant_id',tenant).eq(field,value).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(250);if(cursor)q=q.or(medicationHistoryFilter(cursor));
   const result=await withServiceQueryTimeout(Promise.resolve(q),'Wundversorgung vollständig laden',20_000);if(result.error)throw Error(toGermanSupabaseError(result.error));return result.data;
  },tenant,r=>r[field]===value&&r.client_id===client);}
  const [plans,orders,dressings]=await Promise.all([read('ambulatory_wound_plan_versions','wound_case_id',id),read('care_medical_orders','client_id',client),dressing?read('ambulatory_wound_dressings','wound_case_id',id):Promise.resolve([] as Row[])]);
  plans.sort((a,b)=>Number(b.version)-Number(a.version));
  for(let i=0;i<plans.length;i++){const p=plans[i],previous=plans[i+1];if(p.version!==plans.length-i||(p.previous_id??null)!==(previous?.id??null)||woundInstant(p.effective_from)===null||(p.effective_until!=null&&woundInstant(p.effective_until)===null)||(previous&&woundInstant(p.effective_from)!<=woundInstant(previous.effective_from)!))throw Error('Planverlauf unvollständig oder widersprüchlich.');if(!p.details||typeof p.details!=='object'||Array.isArray(p.details))throw Error('Planangaben ungültig.');if(p.basis_state==='linked'){const snapshot=p.order_snapshot;if(!snapshot||typeof snapshot!=='object'||Array.isArray(snapshot)||validateWoundOrder(snapshot as Row,tenant,client,String(p.medical_order_id),String(p.effective_from),p.effective_until==null?'':String(p.effective_until)))throw Error('Gespeicherte Anordnungsfassung ungültig oder fremd.');}else if(!['pending','not_required'].includes(String(p.basis_state))||p.medical_order_id!=null||p.order_snapshot!=null)throw Error('Planbasis widersprüchlich.');}
  for(const d of dressings){if(woundInstant(d.occurred_at)===null||!d.details||typeof d.details!=='object'||Array.isArray(d.details)||!['performed','partial','omitted','refused','failed'].includes(String(d.outcome)))throw Error('Versorgungsnachweis ungültig.');if(d.plan_id!=null&&!plans.some(p=>p.id===d.plan_id&&sameWoundJson(p,d.plan_snapshot)))throw Error('Zugeordnete unveränderte Planfassung fehlt im vollständigen Verlauf.');const details=d.details as Row;if(typeof details.materialsJson!=='string')throw Error('Materialnachweis fehlt.');parseWoundMaterials(details.materialsJson);for(const moment of ['painBefore','painAfter']){if(details[moment+'State']==='NRS'){if(typeof details[moment+'Score']!=='string'||!/^\d{1,2}$/.test(String(details[moment+'Score']))||Number(details[moment+'Score'])>10)throw Error('Schmerzscore ungültig.');}else if(details[moment+'State']!=='not_assessable'||typeof details[moment+'Reason']!=='string'||!String(details[moment+'Reason']).trim())throw Error('Schmerznachweis unvollständig.');}}
  if(dressing){const executions=await read('clinical_treatment_executions','client_id',client),byId=new Map(executions.map(e=>[e.id,e]));for(const d of dressings){const e=byId.get(d.execution_id);if(!e||e.outcome!==d.outcome||e.treatment_type!=='wound_dressing'||woundInstant(e.performed_at)!==woundInstant(d.occurred_at))throw Error('Zugehöriger Behandlungspflegenachweis fehlt oder widerspricht der Wundversorgung.');}}
  return {ok:true,data:{wound:wound.data,plans,orders,dressings}};
 }catch(e){return {ok:false,error:e instanceof Error?e.message:'Versorgungsverlauf konnte nicht vollständig geladen werden.'};}
}
export async function writeWoundCare(tenant:string,requestId:string,payload:WoundCareRequest,role:RoleKey|null,replay=false):Promise<MedicationWriteResult>{
 const denied=block<{id:string}>(tenant,role,payload.action==='dressing',true);if(denied)return denied;if(!woundUuid(requestId))return {ok:false,error:'Ungültige Anfrage-ID.'};if(!replay){const error=validateWoundCare(payload);if(error)return {ok:false,error};}
 const db=getServiceMode()==='supabase'?getSupabaseClient():null;if(!db)return {ok:false,error:'Wunddatenbank nicht verbunden.'};
 try{const rpc=db as unknown as {rpc(name:string,args:Row):Promise<{data:unknown;error:{code?:string}|null;status?:number}>};const r=await withServiceQueryTimeout(rpc.rpc('write_ambulatory_wound_care',{request_id:requestId,payload}),'Wundversorgung speichern',20_000);if(r.error)return {ok:false,error:toGermanSupabaseError(r.error),uncertain:!isDefiniteMedicationRejection(r.error.code,r.status)};if(!woundUuid(r.data))return {ok:false,error:'Speicherbestätigung fehlt. Dieselbe unveränderte Anfrage erneut prüfen.',uncertain:true};return {ok:true,data:{id:r.data}};}catch{return {ok:false,error:'Speicherbestätigung fehlt. Dieselbe unveränderte Anfrage erneut prüfen.',uncertain:true};}
}
