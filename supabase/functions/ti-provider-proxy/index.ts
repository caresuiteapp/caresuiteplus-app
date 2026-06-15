// CareSuite+ — TI Provider Proxy (Edge Function Stub)
// Server-side only — Secrets aus Vault, niemals an Client zurückgeben

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type TIProxyRequest = {
  action: 'check_connection' | 'sync_kim' | 'fetch_messages';
  providerId: string;
  mailboxId?: string;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Nicht autorisiert' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = (await req.json()) as TIProxyRequest;

    // Secret-Referenz aus DB laden — niemals Secret-Wert an Client
    const { data: provider, error } = await supabase
      .from('ti_providers')
      .select('id, secret_reference, endpoint_url, kind')
      .eq('id', body.providerId)
      .single();

    if (error || !provider) {
      return new Response(JSON.stringify({ error: 'Provider nicht gefunden' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Stub — produktiv: Vault-Lookup + gematik-konformer Connector
    const result = {
      ok: true,
      action: body.action,
      providerId: body.providerId,
      message: `Stub: ${body.action} für Provider ${provider.kind}`,
      checkedAt: new Date().toISOString(),
    };

    await supabase.from('ti_audit_events').insert({
      action: 'provider_check',
      actor_name: 'ti-provider-proxy',
      resource_type: 'ti_provider',
      resource_id: body.providerId,
      details: result.message,
    });

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
