import {serve} from 'https://deno.land/std@0.168.0/http/server.ts';
import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
import {corsHeaders,getServiceClient,jsonResponse,readClientMeta} from '../_shared/http.ts';
import {consumePublicAccessLimit} from '../_shared/publicAccess.ts';
import {resolveRegistrationWelcomeConfig} from '../_shared/registrationWelcomeEmail.ts';
import {REGISTRATION_WELCOME_ENV_KEYS} from '../registration-welcome-dispatch/worker.ts';
import {BUSINESS_RECOVERY_MESSAGE,completeBusinessRecovery,deliverBusinessRecovery,isValidRecoveryEmail,type BusinessRecoveryAdmin,type BusinessRecoveryVerifier} from './core.ts';
declare const EdgeRuntime:{waitUntil(promise:Promise<unknown>):void};

serve(async req=>{
  if(req.method==='OPTIONS') return new Response('ok',{headers:corsHeaders});
  if(req.method!=='POST') return jsonResponse({ok:false,error:'Methode nicht erlaubt.'},405);
  let body:Record<string,unknown>;
  try { const raw=await req.text(); if(raw.length>10000) return jsonResponse({ok:false,error:'Anfrage zu groß.'},413);body=JSON.parse(raw);if(!body || Array.isArray(body)) throw new Error(); }
  catch {return jsonResponse({ok:false,error:'Bitte die Eingaben prüfen.'},400);}
  try {
    const service=getServiceClient() as unknown as BusinessRecoveryAdmin;
    const ip=readClientMeta(req).ipAddress || 'unknown';
    if(body.action==='complete') {
      const verifier=createClient(Deno.env.get('SUPABASE_URL')??'',Deno.env.get('SUPABASE_ANON_KEY')??'',{auth:{persistSession:false,autoRefreshToken:false}});
      const result=await completeBusinessRecovery(service,verifier as unknown as BusinessRecoveryVerifier,body,ip);
      return jsonResponse(result.body,result.status);
    }
    if(body.action!=='request' || !isValidRecoveryEmail(body.email)) return jsonResponse({ok:false,error:'Bitte eine gültige Verwaltungs-E-Mail eingeben.'},400);
    const config=resolveRegistrationWelcomeConfig(Object.fromEntries(REGISTRATION_WELCOME_ENV_KEYS.map(key=>[key,Deno.env.get(key)])));
    if(!config.provider) return jsonResponse({ok:false,error:'Der Systemmail-Versand ist momentan nicht verfügbar. Bitte nutzen Sie den öffentlichen Support.'},503);
    const email=body.email.trim().toLowerCase();
    if(!await consumePublicAccessLimit(service,'reset_request',ip,email)) return jsonResponse({ok:false,error:'Zu viele Anfragen. Bitte warten Sie 15 Minuten.'},429);
    const task=deliverBusinessRecovery(service,config,email,fetch,body.delivery==='native'?'native':'web').catch(()=>console.error('business_recovery_delivery_unconfirmed'));
    if(typeof EdgeRuntime!=='undefined') EdgeRuntime.waitUntil(task); else await task;
    return jsonResponse({ok:true,message:BUSINESS_RECOVERY_MESSAGE},202);
  } catch { return jsonResponse({ok:false,error:'Die Wiederherstellung konnte nicht bestätigt werden. Bitte fordern Sie erneut einen Link an oder nutzen Sie den öffentlichen Support.'},503); }
});
