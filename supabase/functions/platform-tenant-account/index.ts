import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders,getServiceClient,jsonResponse } from '../_shared/http.ts';
import { resolveRegistrationWelcomeConfig } from '../_shared/registrationWelcomeEmail.ts';
import { REGISTRATION_WELCOME_ENV_KEYS } from '../registration-welcome-dispatch/worker.ts';
import { AccountActionError,manageTenantAccount,validAccountRequest,type AccountAdmin } from './core.ts';

const messages:Record<string,string> = {
  platform_forbidden:'Ihre Rolle darf keine Anmeldekonten ändern.',
  account_authorization_required:'Bitte die Beauftragung durch die berechtigte Person bestätigen.',
  account_not_active:'Dieses Verwaltungskonto ist nicht aktiv oder nicht für diesen Vorgang geeignet.',
  account_identity_mismatch:'Die Anmeldedaten und die Unternehmensakte stimmen nicht überein. Bitte zuerst den Kontostand klären.',
  account_shared_identity:'Dieses Konto gehört zu mehreren Unternehmen oder zur Plattformverwaltung. Eine Änderung muss gesondert abgestimmt werden.',
  account_email_invalid:'Bitte eine gültige neue E-Mail-Adresse eingeben.',
  account_email_in_use:'Die neue E-Mail-Adresse wird bereits für ein anderes Konto verwendet.',
  account_mail_in_progress:'Für dieses Konto läuft bereits ein Mailversand. Bitte den Versandabschluss abwarten.',
  welcome_owner_required:'Die Firmenwillkommensmail ist für das Geschäftsführungskonto vorgesehen.',
  request_payload_changed:'Dieser Vorgang wurde bereits mit anderen Angaben übermittelt. Bitte den aktuellen Stand prüfen.',
  account_operation_inactive:'Dieser Vorgang läuft bereits oder wurde beendet. Bitte die Akte neu laden.',
  account_mail_unavailable:'Der Systemmail-Versand ist derzeit nicht verfügbar. Bitte die Versandeinstellungen prüfen.',
  account_update_needs_review:'Der Vorgang muss geprüft werden. Eine Änderung oder ein Versand könnte bereits erfolgt sein. Bitte keinen zweiten Vorgang auslösen.',
};
serve(async req=>{
  if(req.method==='OPTIONS') return new Response('ok',{headers:corsHeaders});
  if(req.method!=='POST') return jsonResponse({ok:false,error:'Methode nicht erlaubt.'},405);
  const token=/^Bearer (.+)$/i.exec(req.headers.get('authorization')??'')?.[1];
  if(!token) return jsonResponse({ok:false,error:'Bitte erneut anmelden.'},401);
  try {
    const raw=await req.text();
    if(raw.length>6000) return jsonResponse({ok:false,error:'Anfrage zu groß.'},413);
    const body=JSON.parse(raw);
    if(!validAccountRequest(body)) return jsonResponse({ok:false,error:'Bitte Empfänger, Begründung und Beauftragung prüfen.'},400);
    const user=createClient(Deno.env.get('SUPABASE_URL')??'',Deno.env.get('SUPABASE_ANON_KEY')??'',{
      auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:`Bearer ${token}`}},
    });
    const verified=await user.auth.getUser(token);
    if(verified.error||!verified.data.user) return jsonResponse({ok:false,error:'Bitte erneut anmelden.'},401);
    const config=resolveRegistrationWelcomeConfig(Object.fromEntries(REGISTRATION_WELCOME_ENV_KEYS.map(key=>[key,Deno.env.get(key)])));
    return jsonResponse(await manageTenantAccount(user,getServiceClient() as unknown as AccountAdmin,config,body));
  } catch(cause) {
    const code=cause instanceof AccountActionError?cause.code:'account_request_invalid';
    return jsonResponse({ok:false,error:messages[code]??'Der Vorgang konnte nicht bestätigt werden. Bitte die Akte neu laden und den Kontostand prüfen.',
      needsReview:cause instanceof AccountActionError&&cause.needsReview},code==='platform_forbidden'?403:409);
  }
});
