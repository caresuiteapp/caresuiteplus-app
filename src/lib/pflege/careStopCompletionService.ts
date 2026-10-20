import type { RoleKey, ServiceResult } from '@/types';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { validateCareStopCompletionInput, type CareStopCompletionInput } from './careStopCompletionDomain';

export type CareStopCompletionContext = Readonly<{
  stopId: string; stopUpdatedAt: string; actualStartedAt: string; stopStatus: string;
  plannedTaskCount: number; documentedTaskCount: number; openTaskCount: number;
  deviationCount: number; releaseState: 'pending' | 'not_applicable';
}>;
type RpcError={code?:string;message?:string}|null;
type RpcClient={rpc:(name:string,args:Record<string,unknown>)=>Promise<{data:unknown;error:RpcError}>};
const requestId=()=>globalThis.crypto?.randomUUID?.()??`${Date.now()}-${Math.random()}`;
export const newCareStopCompletionRequestId=requestId;
function message(error:RpcError){if(error?.code==='PGRST202')return 'Der sichere Einsatzabschluss ist in der Datenbank noch nicht freigeschaltet.';if(['23514','40001','P0001'].includes(error?.code??'')&&error?.message)return error.message;return toGermanSupabaseError(error);}
function guard<T>(tenantId:string,role?:RoleKey|null):ServiceResult<T>|null{const denied=enforcePermission<T>(role,'pflege.plans.manage');if(denied)return denied;const invalid=guardServiceTenant(tenantId);if(invalid)return invalid as ServiceResult<T>;return getServiceMode()==='supabase'&&getSupabaseClient()?null:{ok:false,error:'Der Einsatzabschluss ist ausschließlich live verfügbar.'};}
async function rpc<T>(name:string,args:Record<string,unknown>):Promise<ServiceResult<T>>{try{const client=getSupabaseClient() as unknown as RpcClient;const {data,error}=await client.rpc(name,args);return error||data==null?{ok:false,error:message(error)}:{ok:true,data:data as T};}catch{return{ok:false,error:'Verbindung unterbrochen. Einsatz neu laden und gespeicherten Zustand prüfen.'};}}
export function fetchCareStopCompletionContext(tenantId:string,role:RoleKey|null|undefined,stopId:string){return Promise.resolve(guard<CareStopCompletionContext>(tenantId,role)??rpc<CareStopCompletionContext>('get_ambulatory_care_stop_completion_context',{p_stop_id:stopId}));}
export function completeCareStop(tenantId:string,role:RoleKey|null|undefined,input:CareStopCompletionInput){const denied=guard<{completionId:string;stopId:string;actualStartedAt:string;actualEndedAt:string;releaseState:'pending';duplicate:boolean}>(tenantId,role);if(denied)return Promise.resolve(denied);const checked=validateCareStopCompletionInput(input);if(!checked.ok)return Promise.resolve({ok:false as const,error:checked.error});return rpc<{completionId:string;stopId:string;actualStartedAt:string;actualEndedAt:string;releaseState:'pending';duplicate:boolean}>('complete_ambulatory_care_stop',{p_stop_id:input.stopId,p_expected_stop_updated_at:input.expectedStopUpdatedAt,p_documentation:checked.data.documentation,p_mandatory_confirmed:checked.data.mandatoryConfirmed,p_risk_state:checked.data.riskState,p_risk_detail:checked.data.riskDetail,p_risk_action:checked.data.riskAction,p_follow_up:checked.data.followUp,p_request_id:input.requestId});}

