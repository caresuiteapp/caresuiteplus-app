import type {RoleKey,ServiceResult} from '@/types';
import {enforcePermission} from '@/lib/permissions';
import {guardServiceTenant} from '@/lib/services/liveServiceGuard';
import {getServiceMode} from '@/lib/services/mode';
import {withServiceQueryTimeout} from '@/lib/services/queryTimeout';
import {getSupabaseClient} from '@/lib/supabase/client';
import {fromUnknownTable} from '@/lib/supabase/untypedTable';
import {toGermanSupabaseError} from '@/lib/supabase/errors';
import {getVitalDefinition} from './vitalCatalog';
import {loadCompleteMedicationHistory,medicationHistoryFilter} from './medicationHistoryPagination';
import {validateVitalFollowUp,validateVitalMeasurement,type VitalFollowUpPayload,type VitalMeasurementPayload} from './vitalMeasurementDomain';
import {validateVitalInvalidation,vitalInvalidationIndex,orderVitalHistory,type VitalInvalidation,type VitalInvalidationPayload} from './vitalHistoryDomain';
import {isDefiniteMedicationRejection} from './medicationRequestState';
import type {MedicationWriteResult} from './medicationAdministrationService';

type Row=Record<string,unknown>;
export type VitalClient={id:string;name:string};
export type VitalChoice={key:string;catalogVersion:string;configurationVersion:string;enabled:boolean;limits:unknown};
export type VitalFollowUp={id:string;observedAt:string;observation:string;action:string;responsiblePerson:string;outcome:'ongoing'|'resolved';nextReviewAt:string|null;recordedAt:string;recordedByName:string};
export type VitalDocumentation={id:string;tenantId:string;clientId:string;clientName:string;type:string;value:string;unit:string;occurredAt:string|null;recordedAt:string;recordedByName:string;flagStatus:string;values:Row;context:Row;note:string;catalogSnapshot:Row|null;configurationSnapshot:Row|null;followUps:VitalFollowUp[];invalidation:VitalInvalidation|null};
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const object=(v:unknown):Row|null=>v!==null&&typeof v==='object'&&!Array.isArray(v)?v as Row:null;
const unavailable={ok:false as const,error:'Die Vitalwertdatenbank ist nicht verbunden.'};
type Query=ReturnType<ReturnType<typeof fromUnknownTable>['select']>;
async function allRows(client:NonNullable<ReturnType<typeof getSupabaseClient>>,table:string,tenantId:string,scope:(q:Query)=>Query,belongs:(r:Row)=>boolean){
  try{return await loadCompleteMedicationHistory<Row>(async cursor=>{
    let q=scope(fromUnknownTable(client,table).select('*').eq('tenant_id',tenantId)).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(250);
    if(cursor)q=q.or(medicationHistoryFilter(cursor));
    const r=await withServiceQueryTimeout(Promise.resolve(q),'Vitaldokumentation',20_000);if(r.error)throw Error(toGermanSupabaseError(r.error));return r.data;
  },tenantId,belongs);}catch(e){throw Error(e instanceof Error?e.message.replaceAll('Medikationsverlauf','Vitaldokumentation'):'Vitaldokumentation nicht vollständig geladen.');}
}
function permission<T>(tenantId:string,role:RoleKey|null,manage=false){return enforcePermission<T>(role,manage?'pflege.vitals.manage':'pflege.vitals.view')??guardServiceTenant(tenantId);}
function map(row:Row,tenantId:string):VitalDocumentation{
  if(!uuid(row.id)||row.tenant_id!==tenantId||!uuid(row.client_id)||!object(row.values)||!object(row.context)||typeof row.vital_key!=='string'||typeof row.display_value!=='string'||typeof row.created_at!=='string'||!Number.isFinite(Date.parse(row.created_at))||!['unrated','within_configured_range','outside_configured_range'].includes(String(row.flag_status)))throw Error('Vitalwert ist unvollständig oder einer anderen Akte zugeordnet.');
  if(row.occurred_at!=null&&(typeof row.occurred_at!=='string'||!Number.isFinite(Date.parse(row.occurred_at))))throw Error('Tatsächlicher Messzeitpunkt ist ungültig.');
  return {id:row.id,tenantId,clientId:row.client_id,clientName:'Name nicht geladen',type:row.vital_key,value:row.display_value,unit:typeof row.unit==='string'?row.unit:'',occurredAt:typeof row.occurred_at==='string'?row.occurred_at:null,recordedAt:row.created_at,recordedByName:typeof row.recorded_by_name==='string'?row.recorded_by_name:'Person nicht bestätigt',flagStatus:String(row.flag_status),values:object(row.values)!,context:object(row.context)!,note:typeof row.note==='string'?row.note:'',catalogSnapshot:object(row.catalog_snapshot),configurationSnapshot:object(row.configuration_snapshot),followUps:[],invalidation:null};
}
export async function fetchVitalClients(tenantId:string,role:RoleKey|null):Promise<ServiceResult<VitalClient[]>>{
  const denied=permission<VitalClient[]>(tenantId,role);if(denied)return denied;const client=getSupabaseClient();if(!client||getServiceMode()!=='supabase')return unavailable;
  try{
    const [clients,assignments]=await Promise.all([
      allRows(client,'clients',tenantId,q=>q.eq('status','active').is('deleted_at',null),r=>r.status==='active'&&r.deleted_at==null),
      allRows(client,'client_module_assignments',tenantId,q=>q.eq('module_key','pflege').eq('is_active',true),r=>r.module_key==='pflege'&&r.is_active===true),
    ]);
    const active=new Set(assignments.filter(r=>typeof r.status==='string'&&!['inactive','deactivated','archiviert'].includes(r.status)).map(r=>r.client_id));
    return {ok:true,data:clients.filter(r=>active.has(r.id)).map(r=>({id:String(r.id),name:[r.first_name,r.last_name].filter(v=>typeof v==='string').join(' ').trim()||'Name fehlt'})).sort((a,b)=>a.name.localeCompare(b.name,'de'))};
  }catch(e){return {ok:false,error:e instanceof Error?e.message:'Pflegeklient:innen konnten nicht geladen werden.'};}
}
export async function fetchVitalChoices(tenantId:string,clientId:string,role:RoleKey|null):Promise<ServiceResult<VitalChoice[]>>{
  const denied=permission<VitalChoice[]>(tenantId,role);if(denied)return denied;if(!uuid(clientId))return {ok:false,error:'Klient:in auswählen.'};const client=getSupabaseClient();if(!client||getServiceMode()!=='supabase')return unavailable;
  try{
    const [catalog,settings]=await Promise.all([
      withServiceQueryTimeout(Promise.resolve(fromUnknownTable(client,'vital_sign_catalog').select('*').eq('is_active',true).order('sort_order')),'Messkatalog',20_000),
      allRows(client,'client_vital_sign_settings',tenantId,q=>q.eq('client_id',clientId),r=>r.client_id===clientId),
    ]);
    if(catalog.error||!Array.isArray(catalog.data))throw Error('Messkatalog nicht zugänglich.');
    const byKey=new Map(settings.map(s=>[s.vital_key,s]));if(byKey.size!==settings.length)throw Error('Messkonfiguration ist nicht eindeutig.');
    return {ok:true,data:(catalog.data as Row[]).map(c=>{
      const definition=getVitalDefinition(String(c.key)),setting=byKey.get(c.key);
      if(!definition||typeof c.updated_at!=='string'||!Number.isFinite(Date.parse(c.updated_at))||typeof c.default_enabled!=='boolean'||!Array.isArray(c.components)||JSON.stringify(c.components)!==JSON.stringify(definition.components.map(x=>x.key))||(setting&&(typeof setting.enabled!=='boolean'||typeof setting.updated_at!=='string'||!Number.isFinite(Date.parse(setting.updated_at)))))throw Error('Messkatalog oder Konfiguration ist geändert oder unvollständig.');
      return {key:String(c.key),catalogVersion:c.updated_at,configurationVersion:setting?String(setting.updated_at):'none',enabled:setting?setting.enabled as boolean:c.default_enabled,limits:setting?.limits??{}};
    })};
  }catch(e){return {ok:false,error:e instanceof Error?e.message:'Messkonfiguration nicht zugänglich.'};}
}
export async function recordVitalDocumentation(tenantId:string,requestId:string,payload:VitalMeasurementPayload,role:RoleKey|null,replay=false):Promise<MedicationWriteResult>{
  const denied=permission<{id:string}>(tenantId,role,true)??enforcePermission<{id:string}>(role,'pflege.vitals.view');if(denied)return denied;
  if(!uuid(requestId))return {ok:false,error:'Ungültige Speicheranfrage.'};
  if(!replay){const definition=getVitalDefinition(payload.type);if(!definition)return {ok:false,error:'Messart unbekannt.'};const error=validateVitalMeasurement(payload,definition);if(error)return {ok:false,error};}
  const client=getSupabaseClient();if(!client||getServiceMode()!=='supabase')return unavailable;
  try{
    const rpc=client as unknown as {rpc(name:string,args:Row):Promise<{data:unknown;error:{code?:string}|null;status?:number}>};
    const result=await withServiceQueryTimeout(rpc.rpc('record_ambulatory_vital_measurement',{request_id:requestId,payload}),'Vitalwert speichern',20_000);
    if(result.error)return {ok:false,error:toGermanSupabaseError(result.error),uncertain:!isDefiniteMedicationRejection(result.error.code,result.status)};
    if(!uuid(result.data))return {ok:false,error:'Die Speicherbestätigung fehlt. Dieselbe Anfrage erneut prüfen.',uncertain:true};
    return {ok:true,data:{id:result.data}};
  }catch{return {ok:false,error:'Die Speicherbestätigung fehlt. Dieselbe Anfrage erneut prüfen.',uncertain:true};}
}
export async function fetchVitalDocumentation(tenantId:string,id:string,role:RoleKey|null):Promise<ServiceResult<VitalDocumentation>>{
  const denied=permission<VitalDocumentation>(tenantId,role);if(denied)return denied;if(!uuid(id))return {ok:false,error:'Ungültige Messungs-ID.'};const client=getSupabaseClient();if(!client||getServiceMode()!=='supabase')return unavailable;
  try{const result=await withServiceQueryTimeout(Promise.resolve(fromUnknownTable(client,'vital_sign_measurements').select('*').eq('tenant_id',tenantId).eq('id',id).maybeSingle()),'Vitalwert',20_000);if(result.error)throw Error(toGermanSupabaseError(result.error));if(!result.data)return {ok:false,error:'Messung nicht mehr zugänglich.'};const reading=map(result.data as Row,tenantId);const subject=await withServiceQueryTimeout(Promise.resolve(fromUnknownTable(client,'clients').select('id,tenant_id,first_name,last_name').eq('tenant_id',tenantId).eq('id',reading.clientId).maybeSingle()),'Klientenbezug',20_000);if(subject.error||!subject.data||(subject.data as Row).id!==reading.clientId||(subject.data as Row).tenant_id!==tenantId)throw Error('Klientenbezug ist nicht bestätigt.');const person=subject.data as Row;reading.clientName=[person.first_name,person.last_name].filter(v=>typeof v==='string').join(' ').trim()||'Name fehlt';const followUps=await allRows(client,'vital_measurement_follow_ups',tenantId,q=>q.eq('measurement_id',id).eq('client_id',reading.clientId),r=>r.measurement_id===id&&r.client_id===reading.clientId);
      const invalidations=await allRows(client,'vital_measurement_invalidations',tenantId,q=>q.eq('measurement_id',id).eq('client_id',reading.clientId),r=>r.measurement_id===id&&r.client_id===reading.clientId);
      reading.invalidation=vitalInvalidationIndex(invalidations,tenantId,reading.clientId).get(id)??null;
      reading.followUps=followUps.map(f=>{
        if(!uuid(f.id)||typeof f.observed_at!=='string'||!Number.isFinite(Date.parse(f.observed_at))||!['ongoing','resolved'].includes(String(f.outcome))||['observation','action','responsible_person','recorded_by_name'].some(key=>typeof f[key]!=='string'||!String(f[key]).trim())||(f.outcome==='ongoing'&&(typeof f.next_review_at!=='string'||!Number.isFinite(Date.parse(f.next_review_at))||Date.parse(f.next_review_at)<=Date.parse(f.observed_at)))||(f.outcome==='resolved'&&f.next_review_at!==null))throw Error('Folgedokumentation ist unvollständig.');
        return {id:String(f.id),observedAt:f.observed_at,observation:String(f.observation),action:String(f.action),responsiblePerson:String(f.responsible_person),outcome:f.outcome as 'ongoing'|'resolved',nextReviewAt:typeof f.next_review_at==='string'?f.next_review_at:null,recordedAt:String(f.created_at),recordedByName:String(f.recorded_by_name)};
      });return {ok:true,data:reading};}catch(e){return {ok:false,error:e instanceof Error?e.message:'Messung nicht zugänglich.'};}
}

export async function recordVitalFollowUp(tenantId:string,measurement:VitalDocumentation,requestId:string,payload:VitalFollowUpPayload,role:RoleKey|null,replay=false):Promise<MedicationWriteResult>{
  const denied=permission<{id:string}>(tenantId,role,true)??enforcePermission<{id:string}>(role,'pflege.vitals.view');if(denied)return denied;
  if(measurement.tenantId!==tenantId||payload.measurementId!==measurement.id||!uuid(requestId))return {ok:false,error:'Ungültiger Messungsbezug oder Anfrage.'};
  if(!replay){const error=validateVitalFollowUp(payload,measurement.occurredAt);if(error)return {ok:false,error};}
  const client=getSupabaseClient();if(!client||getServiceMode()!=='supabase')return unavailable;
  try{const rpc=client as unknown as {rpc(name:string,args:Row):Promise<{data:unknown;error:{code?:string}|null;status?:number}>};const result=await withServiceQueryTimeout(rpc.rpc('record_ambulatory_vital_follow_up',{request_id:requestId,payload}),'Vitalwertkontrolle speichern',20_000);if(result.error)return {ok:false,error:toGermanSupabaseError(result.error),uncertain:!isDefiniteMedicationRejection(result.error.code,result.status)};if(!uuid(result.data))return {ok:false,error:'Speicherergebnis unklar. Dieselbe Kontrolle erneut prüfen.',uncertain:true};return {ok:true,data:{id:result.data}};}catch{return {ok:false,error:'Speicherbestätigung fehlt. Dieselbe Kontrolle erneut prüfen.',uncertain:true};}
}

export async function fetchVitalHistory(tenantId:string,clientId:string,role:RoleKey|null):Promise<ServiceResult<VitalDocumentation[]>>{
  const denied=permission<VitalDocumentation[]>(tenantId,role);if(denied)return denied;if(!uuid(clientId))return {ok:false,error:'Klient:in ausdrücklich auswählen.'};
  const client=getSupabaseClient();if(!client||getServiceMode()!=='supabase')return unavailable;
  try{
    const subjects=await fetchVitalClients(tenantId,role);if(!subjects.ok)throw Error(subjects.error);const person=subjects.data.find(c=>c.id===clientId);if(!person)throw Error('Kein aktiver zugänglicher Pflegefall.');
    // Read measurements first: every returned parent can be covered by the later correction read.
    // This is a completed paginated read, not a transaction-wide point-in-time snapshot.
    const rows=await allRows(client,'vital_sign_measurements',tenantId,q=>q.eq('client_id',clientId),r=>r.client_id===clientId);
    const invalidations=await allRows(client,'vital_measurement_invalidations',tenantId,q=>q.eq('client_id',clientId),r=>r.client_id===clientId);
    const index=vitalInvalidationIndex(invalidations,tenantId,clientId);
    return {ok:true,data:orderVitalHistory(rows.map(row=>({...map(row,tenantId),clientName:person.name,invalidation:index.get(String(row.id))??null})))};
  }catch(e){return {ok:false,error:e instanceof Error?e.message:'Vitalwertverlauf konnte nicht vollständig geladen werden.'};}
}
export async function invalidateVitalDocumentation(tenantId:string,measurement:VitalDocumentation,requestId:string,payload:VitalInvalidationPayload,role:RoleKey|null,replay=false):Promise<MedicationWriteResult>{
  const denied=permission<{id:string}>(tenantId,role,true)??enforcePermission<{id:string}>(role,'pflege.vitals.view');if(denied)return denied;
  const error=validateVitalInvalidation(payload);if(error)return {ok:false,error};
  if(measurement.tenantId!==tenantId||payload.measurementId!==measurement.id||!uuid(requestId))return {ok:false,error:'Ungültiger Messungsbezug oder Anfrage.'};
  if(!replay&&measurement.invalidation)return {ok:false,error:'Messung ist bereits als ungültig gekennzeichnet.'};
  const client=getSupabaseClient();if(!client||getServiceMode()!=='supabase')return unavailable;
  try{
    const rpc=client as unknown as {rpc(name:string,args:Row):Promise<{data:unknown;error:{code?:string}|null;status?:number}>};
    const result=await withServiceQueryTimeout(rpc.rpc('invalidate_ambulatory_vital_measurement',{request_id:requestId,payload}),'Korrekturvermerk speichern',20_000);
    if(result.error)return {ok:false,error:toGermanSupabaseError(result.error),uncertain:!isDefiniteMedicationRejection(result.error.code,result.status)};
    if(!uuid(result.data))return {ok:false,error:'Speicherbestätigung fehlt. Dieselbe Anfrage erneut prüfen.',uncertain:true};return {ok:true,data:{id:result.data}};
  }catch{return {ok:false,error:'Speicherbestätigung fehlt. Dieselbe Anfrage erneut prüfen.',uncertain:true};}
}
