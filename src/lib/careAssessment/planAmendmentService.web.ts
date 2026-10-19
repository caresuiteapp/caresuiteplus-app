import type {RoleKey} from '@/types';
import {enforcePermission} from '@/lib/permissions';
import {guardServiceTenant} from '@/lib/services/liveServiceGuard';
import {getServiceMode} from '@/lib/services/mode';
import {getSupabaseClient} from '@/lib/supabase/client';
import {withServiceQueryTimeout} from '@/lib/services/queryTimeout';
import {toGermanSupabaseError} from '@/lib/supabase/errors';
import type {ControlRpc} from '../pflege/clinicalControlRuntime';
import type {PlanAmendmentRequest} from './planAmendmentDomain';
import {writePlanAmendment} from './planAmendmentRuntime';
export async function savePlanAmendment(tenant:string,id:string,payload:PlanAmendmentRequest,role:RoleKey|null,replay=false){
 const denied=enforcePermission<{id:string}>(role,'pflege.plans.view')??guardServiceTenant(tenant)??(!replay?enforcePermission<{id:string}>(role,'pflege.assessments.manage'):null);if(denied)return {...denied,...(replay?{uncertain:true}:{})};
 const db=getServiceMode()==='supabase'?getSupabaseClient():null;if(!db)return {ok:false as const,error:'Planänderungsdatenbank nicht verbunden.',...(replay?{uncertain:true}:{})};
 const client=db as unknown as {rpc:ControlRpc};
 const rpc:ControlRpc=async(name,args)=>{const r=await withServiceQueryTimeout(client.rpc(name,args),'Begründete Maßnahmenänderung',20_000);return {...r,error:r.error?{...r.error,message:toGermanSupabaseError(r.error)}:null};};
 return writePlanAmendment(rpc,tenant,id,payload,replay);
}
