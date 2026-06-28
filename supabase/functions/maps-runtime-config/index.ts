// CareSuite+ — Serve browser-restricted Google Maps API key to authenticated clients.
// Server secret: GOOGLE_MAPS_API_KEY (Supabase Edge Function secrets).

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { corsHeaders, jsonResponse } from '../_shared/http.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    return jsonResponse({ ok: false, error: 'Methode nicht erlaubt.' }, 405);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonResponse({ ok: false, error: 'Nicht authentifiziert.' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim();
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')?.trim();
  if (!supabaseUrl || !supabaseAnonKey) {
    return jsonResponse({ ok: false, error: 'Server-Konfiguration unvollständig.' }, 500);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return jsonResponse({ ok: false, error: 'Sitzung ungültig.' }, 401);
  }

  const browserKey = Deno.env.get('GOOGLE_MAPS_API_KEY')?.trim() ?? null;

  return jsonResponse({
    ok: true,
    browserKey,
    configured: Boolean(browserKey),
    provider: 'google',
  });
});
