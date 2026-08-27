import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders, jsonResponse } from '../_shared/http.ts';

/**
 * R14-C: retired code-only authentication.
 * A six-character code without a username required scanning every credential hash
 * and cannot be rate-limited per account. The portal-only app supports the explicit
 * employee username/password and client username/code flows instead.
 */
serve((req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'Methode nicht erlaubt.' }, 405);
  }
  return jsonResponse(
    {
      ok: false,
      error: 'Dieser alte Code-Zugang ist deaktiviert. Bitte den Klient:innen-Zugang mit Benutzername verwenden.',
      code: 'LEGACY_CODE_LOGIN_RETIRED',
    },
    410,
  );
});
