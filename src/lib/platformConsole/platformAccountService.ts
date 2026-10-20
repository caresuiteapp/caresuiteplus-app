import { getSupabaseClient } from '@/lib/supabase/client';
import { getServiceMode } from '@/lib/services/mode';
import type { ServiceResult } from '@/types/core/base';
import { platformRpc } from './platformSupabaseClient';

export type PlatformAccount = {
  id:string;display_name:string|null;username:string|null;email:string|null;role_key:string;status:string;
  last_login_at:string|null;has_login:boolean;updated_at?:string;
  access_state?:'active'|'inactive'|'deleted';
  open_operation?:{state:string;action:string;created_at:string}|null;
  welcome:{state:string;recipient_email:string;attempts:number;sent_at:string|null;updated_at:string;last_error_code:string|null}|null;
};
export async function listPlatformAccounts(tenantId:string,includeDeleted=false):Promise<ServiceResult<PlatformAccount[]>> {
  if(getServiceMode()==='demo') return {ok:true,data:[{id:'demo-owner',display_name:'Geschäftsführung',username:'verwaltung',email:'verwaltung@example.test',role_key:'owner',status:'active',last_login_at:null,has_login:true,welcome:null}]};
  const {data,error}=await platformRpc<{items:PlatformAccount[]}>('platform_list_tenant_account_access',{p_tenant_id:tenantId,p_include_deleted:includeDeleted});
  return error?{ok:false,error:error.message}:{ok:true,data:data?.items??[]};
}
export type PlatformAccountAction = {nonce:string;tenantId:string;tenantUserId:string;action:'email_change'|'password_recovery'|'welcome_resend';newEmail?:string;reason:string;authorizationConfirmed:boolean};
export async function managePlatformAccount(input:PlatformAccountAction):Promise<ServiceResult<{message:string}>> {
  if(getServiceMode()==='demo') return {ok:false,error:'In der Vorschau werden keine Konten geändert und keine E-Mails versendet.'};
  const client=getSupabaseClient();
  if(!client) return {ok:false,error:'Die Verbindung zur Anmeldung ist nicht verfügbar.'};
  try {
    const {data,error}=await client.functions.invoke('platform-tenant-account',{body:input});
    if(error) {
      try {const details=await error.context?.json();if(details?.error)return {ok:false,error:details.error};}catch {}
      return {ok:false,error:'Der Vorgang konnte nicht bestätigt werden. Bitte die Akte neu laden.'};
    }
    if(!data?.ok||typeof data.message!=='string') return {ok:false,error:data?.error||'Der Vorgang konnte nicht bestätigt werden.'};
    return {ok:true,data:{message:data.message}};
  } catch {return {ok:false,error:'Die Verbindung wurde unterbrochen. Bitte vor einer erneuten Aktion den Kontostand prüfen.'};}
}
