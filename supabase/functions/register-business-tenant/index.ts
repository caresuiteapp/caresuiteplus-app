import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders, getServiceClient, jsonResponse } from '../_shared/http.ts';
import { provisionBusinessRegistration, validateRegistrationBody } from './provision.ts';

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
    const result = await provisionBusinessRegistration(getServiceClient(), body);
    return jsonResponse(result.body, result.status);
  } catch {
    return jsonResponse({ ok: false, error: 'Die Registrierung konnte nicht bestätigt werden. Bitte prüfen Sie zuerst die Anmeldung mit Ihrer E-Mail-Adresse.' }, 503);
  }
});
