import type { ServiceResult } from '@/types';
import { getServiceMode } from '@/lib/services/mode';
import { invokeEdgeFunction } from '@/lib/supabase/edgeFunctions';

const EMAIL_PATTERN = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
export async function requestBusinessPasswordReset(contact: string): Promise<ServiceResult<{message:string}>> {
  const email = contact.trim().toLowerCase();
  if(!EMAIL_PATTERN.test(email) || email.length>254) return {ok:false,error:'Bitte eine gültige Verwaltungs-E-Mail eingeben.'};
  if(getServiceMode()!=='supabase') return {ok:false,error:'Die Wiederherstellung ist momentan nicht verfügbar. Bitte nutzen Sie den öffentlichen Support.'};
  const result=await invokeEdgeFunction<{message:string}>('business-password-recovery',{action:'request',email});
  if(!result.ok) return result;
  if(typeof result.data.message!=='string') return {ok:false,error:'Die Anfrage konnte nicht bestätigt werden. Bitte versuchen Sie es erneut.'};
  return {ok:true,data:{message:result.data.message}};
}

export function readBusinessRecoveryToken(hash:string):string|null {
  const params=new URLSearchParams(hash.replace(/^#/,''));
  const token=params.get('token_hash');
  return params.get('type')==='recovery' && token && /^[a-zA-Z0-9_-]{32,128}$/.test(token)?token:null;
}
export async function completeBusinessPasswordReset(tokenHash:string,password:string,confirmPassword:string):Promise<ServiceResult<null>> {
  if(!tokenHash || password.length<10 || password.length>128 || password!==confirmPassword) return {ok:false,error:'Bitte zwei übereinstimmende Passwörter mit 10 bis 128 Zeichen eingeben.'};
  const result=await invokeEdgeFunction<{ok:boolean}>('business-password-recovery',{action:'complete',tokenHash,password,confirmPassword});
  if(!result.ok) return result;
  if(result.data.ok!==true) return {ok:false,error:'Die Passwortänderung konnte nicht bestätigt werden. Bitte fordern Sie einen neuen Link an.'};
  return {ok:true,data:null};
}
