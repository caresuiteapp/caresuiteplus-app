import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders, getServiceClient, jsonResponse } from '../_shared/http.ts';
import { provisionBusinessRegistration, validateRegistrationBody } from './provision.ts';
import { dispatchRegistrationWelcomeEmails, REGISTRATION_WELCOME_ENV_KEYS, type RegistrationWelcomeClient } from '../registration-welcome-dispatch/worker.ts';

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };

serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ ok: false, error: 'Methode nicht erlaubt.' }, 405);
  let body: Record<string, unknown>;
  try {
    const raw = await req.text();
    if (raw.length > 12000) return jsonResponse({ ok: false, error: 'Die Anfrage ist zu groß.' }, 413);
    body = JSON.parse(raw);
  } catch {
    return jsonResponse({ ok: false, error: 'Ungültige Registrierungsdaten.' }, 400);
  }
  const validation = validateRegistrationBody(body);
  if (validation) return jsonResponse({ ok: false, error: validation }, 400);
  try {
    const service = getServiceClient();
    const result = await provisionBusinessRegistration(service, body);
    if (result.status === 201 && result.body.ok === true && typeof result.body.tenantId === 'string') {
      const env = Object.fromEntries(REGISTRATION_WELCOME_ENV_KEYS.map(key => [key, Deno.env.get(key)]));
      const delivery = dispatchRegistrationWelcomeEmails(service as unknown as RegistrationWelcomeClient, env, result.body.tenantId)
        .then(report => { if (!report.configured) console.error('registration_mail_not_configured'); })
        .catch(() => console.error('registration_mail_dispatch_unconfirmed'));
      if (typeof EdgeRuntime !== 'undefined') EdgeRuntime.waitUntil(delivery);
      else await delivery;
    }
    return jsonResponse(result.body, result.status);
  } catch {
    return jsonResponse({ ok: false, error: 'Die Registrierung konnte nicht bestätigt werden. Bitte prüfen Sie zuerst die Anmeldung mit Ihrer E-Mail-Adresse.' }, 503);
  }
});
