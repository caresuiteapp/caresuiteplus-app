import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.0';
import { corsHeaders, getServiceClient, jsonResponse } from '../_shared/http.ts';
import { authorizeDownload, validDownloadInput } from './core.ts';

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: { ...corsHeaders, 'Access-Control-Allow-Methods': 'POST, OPTIONS' } });
  if (req.method !== 'POST') return jsonResponse({ error: 'Methode nicht erlaubt.' }, 405);
  const token = /^Bearer (.+)$/i.exec(req.headers.get('authorization') ?? '')?.[1];
  if (!token) return jsonResponse({ error: 'Bitte anmelden.' }, 401);
  try {
    const raw = await req.text();
    if (raw.length > 2048) return jsonResponse({ error: 'Anfrage zu groß.' }, 413);
    const body: unknown = JSON.parse(raw);
    if (!validDownloadInput(body)) return jsonResponse({ error: 'Ungültige Anfrage.' }, 400);
    const user = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const verified = await user.auth.getUser(token);
    if (verified.error || !verified.data.user) return jsonResponse({ error: 'Bitte erneut anmelden.' }, 401);
    const url = await authorizeDownload(body,
      async args => await user.rpc('tenant_data_transfer', args),
      async (path, seconds, name) => await getServiceClient().storage.from('tenant-data-transfers').createSignedUrl(path, seconds, { download: name }),
    );
    return jsonResponse({ url, expiresIn: 60 });
  } catch {
    return jsonResponse({ error: 'Der Download ist nicht freigegeben oder derzeit nicht verfügbar.' }, 403);
  }
});
