import type {RoleKey,ServiceResult} from '@/types';
import {enforcePermission} from '@/lib/permissions';
import {guardServiceTenant} from '@/lib/services/liveServiceGuard';
import {getServiceMode} from '@/lib/services/mode';
import {getSupabaseClient} from '@/lib/supabase/client';
import {withServiceQueryTimeout} from '@/lib/services/queryTimeout';
import {toGermanSupabaseError} from '@/lib/supabase/errors';
import {readProtocolClients,readDailyProtocols,writeDailyProtocol,protocolWritePermission} from './dailyProtocolRuntime';
import type {ControlRpc} from './clinicalControlRuntime';
import type {ProtocolRequest,ProtocolRecord} from './dailyProtocolDomain';
import type {MedicationWriteResult} from './medicationAdministrationService';
const scope=<T,>(tenant:string,role:RoleKey|null)=>enforcePermission<T>(role,'pflege.documentation.view')??guardServiceTenant(tenant);
function rpc():ControlRpc|null{const db=getServiceMode()==='supabase'?getSupabaseClient():null;if(!db)return null;const client=db as unknown as {rpc:ControlRpc};return async(name,args)=>{const r=await withServiceQueryTimeout(client.rpc(name,args),'Pflegeprotokolle',20_000);return {...r,error:r.error?{...r.error,message:toGermanSupabaseError(r.error)}:null};};}
export async function fetchDailyProtocolClients(tenant:string,role:RoleKey|null):Promise<ServiceResult<{id:string;name:string}[]>>{const denied=scope<{id:string;name:string}[]>(tenant,role);if(denied)return denied;const run=rpc();return run?readProtocolClients(run,tenant):{ok:false,error:'Protokolldatenbank nicht verbunden.'};}
export async function fetchDailyProtocols(tenant:string,client:string,role:RoleKey|null):Promise<ServiceResult<ProtocolRecord[]>>{const denied=scope<ProtocolRecord[]>(tenant,role);if(denied)return denied;const run=rpc();return run?readDailyProtocols(run,tenant,client):{ok:false,error:'Protokolldatenbank nicht verbunden.'};}
export async function saveDailyProtocol(tenant:string,id:string,p:ProtocolRequest,role:RoleKey|null,replay=false):Promise<MedicationWriteResult>{const denied=scope<{id:string}>(tenant,role);if(denied)return denied;if(!replay){try{const d=enforcePermission<{id:string}>(role,protocolWritePermission(p.draft.action));if(d)return d;}catch(e){return {ok:false,error:e instanceof Error?e.message:'Handlung ungültig.'};}}const run=rpc();return run?writeDailyProtocol(run,tenant,id,p,replay):{ok:false,error:'Protokolldatenbank nicht verbunden.'};}
