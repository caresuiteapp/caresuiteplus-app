import {v4 as uuid} from 'uuid';
import {invokeEdgeFunction} from '@/lib/supabase/edgeFunctions';
export const newPublicSupportNonce=uuid;
export type PublicSupportInput={name:string;email:string;organization:string;subject:string;category:'technical'|'account'|'general';message:string;privacyAccepted:boolean;website:string;nonce:string};
export async function submitPublicSupportTicket(input:PublicSupportInput) {
  const result=await invokeEdgeFunction<{reference:string}>('public-support-ticket',input);
  if(!result.ok) return result;
  if(!/^PUB-\d{6,}$/.test(result.data.reference??'')) return {ok:false as const,error:'Der Eingang konnte nicht bestätigt werden. Bitte versuchen Sie es erneut.'};
  return {ok:true as const,data:{reference:result.data.reference}};
}
