import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { hashOpaqueToken } from '../_shared/crypto.ts';
import { corsHeaders, getServiceClient, jsonResponse } from '../_shared/http.ts';

type LogoutBody = { sessionToken?: string };

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'Methode nicht erlaubt.' }, 405);
  }

  try {
    const body = (await req.json()) as LogoutBody;
    const sessionToken = body.sessionToken?.trim() ?? '';
    if (sessionToken.length < 16) {
      return jsonResponse({ ok: false, error: 'Sitzung ungültig.' }, 400);
    }

    const tokenHash = await hashOpaqueToken(sessionToken);
    const supabase = getServiceClient();
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('portal_sessions')
      .update({ status: 'logged_out', logged_out_at: now, updated_at: now })
      .in('session_token', [tokenHash, sessionToken])
      .eq('status', 'active');

    if (error) {
      console.error(`[portal-session-logout] update failed: ${error.message}`);
      return jsonResponse({ ok: false, error: 'Abmeldung konnte nicht bestätigt werden.' }, 500);
    }

    return jsonResponse({ ok: true });
  } catch (error) {
    console.error('[portal-session-logout] unexpected error', error);
    return jsonResponse({ ok: false, error: 'Abmeldung ist vorübergehend nicht verfügbar.' }, 500);
  }
});
