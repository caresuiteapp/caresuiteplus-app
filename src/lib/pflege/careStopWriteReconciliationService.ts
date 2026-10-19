import type{RoleKey,ServiceResult}from'@/types';
import{enforcePermission}from'@/lib/permissions';
import{guardServiceTenant}from'@/lib/services/liveServiceGuard';
import{getServiceMode}from'@/lib/services/mode';
import{getSupabaseClient}from'@/lib/supabase/client';
import{toGermanSupabaseError}from'@/lib/supabase/errors';
import{decodeCareStopWriteReconciliation,type CareStopWriteReconciliation,type CareStopWriteReconciliationRequest}from'./careStopWriteReconciliationDomain';
type RpcError={code?:string;message?:string}|null;type RpcClient={rpc:(name:string,args:Record<string,unknown>)=>Promise<{data:unknown;error:RpcError}>};
function guard(tenantId:string,role?:RoleKey|null):ServiceResult<CareStopWriteReconciliation>|null{const denied=enforcePermission<CareStopWriteReconciliation>(role,'pflege.plans.manage');if(denied)return denied;const invalid=guardServiceTenant(tenantId);if(invalid)return invalid as ServiceResult<CareStopWriteReconciliation>;return getServiceMode()==='supabase'&&getSupabaseClient()?null:{ok:false,error:'Der Serverabgleich ist ausschließlich live verfügbar.'};}
export async function reconcileCareStopWrite(tenantId:string,role:RoleKey|null|undefined,request:CareStopWriteReconciliationRequest):Promise<ServiceResult<CareStopWriteReconciliation>>{
 const denied=guard(tenantId,role);if(denied)return denied;
 try{const{data,error}=await(getSupabaseClient()as unknown as RpcClient).rpc('reconcile_ambulatory_care_stop_write',{p_operation:request.operation,p_request_id:request.requestId,p_frozen_payload:request.payload});if(error||data==null){if(error?.code==='PGRST202')return{ok:false,error:'Der sichere Serverabgleich ist in der Datenbank noch nicht freigeschaltet.'};return{ok:false,error:toGermanSupabaseError(error)};}return{ok:true,data:decodeCareStopWriteReconciliation(data,request)};}catch(error){return{ok:false,error:error instanceof Error?error.message:'Verbindung unterbrochen. Die ursprüngliche Anfrage bleibt ungeklärt und darf nicht automatisch neu erzeugt werden.'};}
}
