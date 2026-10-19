import type {RoleKey,ServiceResult} from '@/types';
import {enforcePermission} from '@/lib/permissions';
import {guardServiceTenant} from '@/lib/services/liveServiceGuard';
import {getServiceMode} from '@/lib/services/mode';
import {getSupabaseClient} from '@/lib/supabase/client';
import {withServiceQueryTimeout} from '@/lib/services/queryTimeout';
import {toGermanSupabaseError} from '@/lib/supabase/errors';
import {readControlRuntime,readControlPeopleRuntime,readControlSourcesRuntime,writeControlRuntime,controlWritePermissions,controlSourcePermissions,type ControlRpc} from './clinicalControlRuntime';
import type {ControlRequest,ControlRecord} from './clinicalControlGateway';
import type {ControlSource} from './clinicalControlDomain';
import type {MedicationWriteResult} from './medicationAdministrationService';
const scope=<T,>(tenant:string,role:RoleKey|null)=>enforcePermission<T>(role,'pflege.documentation.view')??enforcePermission<T>(role,'pflege.treatment.view')??enforcePermission<T>(role,'pflege.orders.view')??guardServiceTenant(tenant);
function rpc():ControlRpc|null{const db=getServiceMode()==='supabase'?getSupabaseClient():null;if(!db)return null;const client=db as unknown as {rpc:ControlRpc};return async(name,args)=>{const r=await withServiceQueryTimeout(client.rpc(name,args),'Kontrollaufträge und Originalbelege',20_000);return {...r,error:r.error?{...r.error,message:toGermanSupabaseError(r.error)}:null};};}
function sourceDenied<T>(source:ControlSource,role:RoleKey|null){for(const permission of controlSourcePermissions(source.kind,String(source.snapshot.treatment_type??''))){const denied=enforcePermission<T>(role,permission as Parameters<typeof enforcePermission>[1]);if(denied)return denied;}return null;}
export async function fetchClinicalControls(tenant:string,client:string|null,role:RoleKey|null):Promise<ServiceResult<ControlRecord[]>>{const denied=scope<ControlRecord[]>(tenant,role);if(denied)return denied;const run=rpc();if(!run)return {ok:false,error:'Kontrolldatenbank nicht verbunden.'};const result=await readControlRuntime(run,tenant,client);if(result.ok)for(const r of result.data)for(const e of r.events){const source='source' in e.draft?e.draft.source:'evidence' in e.draft?e.draft.evidence:null;if(source){const d=sourceDenied<ControlRecord[]>(source,role);if(d)return d;}}return result;}
export async function fetchClinicalControlSources(tenant:string,client:string,role:RoleKey|null):Promise<ServiceResult<ControlSource[]>>{const denied=scope<ControlSource[]>(tenant,role);if(denied)return denied;const run=rpc();if(!run)return {ok:false,error:'Kontrollquellen nicht verbunden.'};const result=await readControlSourcesRuntime(run,tenant,client);if(result.ok)for(const source of result.data){const d=sourceDenied<ControlSource[]>(source,role);if(d)return d;}return result;}
export async function writeClinicalControl(tenant:string,id:string,p:ControlRequest,role:RoleKey|null,replay=false):Promise<MedicationWriteResult>{
 const denied=scope<{id:string}>(tenant,role);if(denied)return denied;
 if(!replay){try{for(const permission of controlWritePermissions(p.draft.kind)){const d=enforcePermission<{id:string}>(role,permission as Parameters<typeof enforcePermission>[1]);if(d)return d;}const source='source' in p.draft?p.draft.source:'evidence' in p.draft?p.draft.evidence:null;if(source){const d=sourceDenied<{id:string}>(source,role);if(d)return d;}}catch(e){return {ok:false,error:e instanceof Error?e.message:'Kontrollhandlung ungültig.'};}}
 const run=rpc();if(!run)return {ok:false,error:'Kontrolldatenbank nicht verbunden.'};return writeControlRuntime(run,tenant,id,p,replay);
}

export async function fetchClinicalControlPeople(tenant:string,role:RoleKey|null):Promise<ServiceResult<{id:string;name:string}[]>>{const denied=scope<{id:string;name:string}[]>(tenant,role);if(denied)return denied;const run=rpc();if(!run)return {ok:false,error:'Aktives eigenes Kontrollteam nicht verbunden.'};return readControlPeopleRuntime(run,tenant);}
