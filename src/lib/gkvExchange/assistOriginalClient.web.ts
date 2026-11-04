import {getSupabaseClient} from '@/lib/supabase/client';
import {loadAssistOriginalContext, type AssistOriginalRpc, type AssistOriginalScope} from './assistOriginal';
export async function personalAssistRpc(scope: AssistOriginalScope): Promise<AssistOriginalRpc> {
 const client=getSupabaseClient();
 if(!client)throw new Error('Die Verbindung zum gespeicherten Nachweis fehlt.');
 const {data,error}=await client.auth.getSession();
 if(error||!data.session||data.session.user.id!==scope.actorId)throw new Error('Die Anmeldung wurde geändert. Bitte den Einsatz neu öffnen.');
 return client.rpc.bind(client) as unknown as AssistOriginalRpc;
}
export async function loadPersonalAssistOriginal(scope: AssistOriginalScope) {
 return loadAssistOriginalContext(await personalAssistRpc(scope),scope);
}
