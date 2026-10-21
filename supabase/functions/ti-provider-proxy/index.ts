// CareSuite+ — TI Provider Proxy (Edge Function Stub)
// Caller-scoped stub: no provider secrets or external TI requests.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type TIProxyRequest = {
  action: 'check_connection' | 'sync_kim' | 'fetch_messages';
  providerId: string;
  mailboxId?: string;
};

const permissions: Record<TIProxyRequest['action'], string> = {
  check_connection: 'ti.provider.manage',
  sync_kim: 'ti.kim.manage',
  fetch_messages: 'ti.kim.view',
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') return response({ error: 'Methode nicht erlaubt' }, 405);

  const authHeader = req.headers.get('Authorization') ?? '';
  const bearer = /^Bearer\s+(\S+)$/i.exec(authHeader);
  if (!bearer) return response({ error: 'Nicht autorisiert' }, 401);

  try {
    const url = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (!url || !anonKey) return response({ error: 'TI-Dienst nicht verfügbar' }, 503);
    // Keep RLS in effect for every query; never use the service-role key here.
    const supabase = createClient(
      url,
      anonKey,
      { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false, autoRefreshToken: false } },
    );
    const verified = await supabase.auth.getUser(bearer[1]);
    const user = verified.data.user;
    if (verified.error || !user) return response({ error: 'Nicht autorisiert' }, 401);
    if (user.app_metadata?.portal_type === 'academy_family') {
      return response({ error: 'Keine Berechtigung für TI' }, 403);
    }

    let body: TIProxyRequest;
    try {
      const value = await req.json();
      if (!value || typeof value !== 'object' || Array.isArray(value)
        || !Object.prototype.hasOwnProperty.call(permissions, value.action)
        || typeof value.providerId !== 'string' || !uuid.test(value.providerId)
        || (value.mailboxId !== undefined && (typeof value.mailboxId !== 'string' || !uuid.test(value.mailboxId)))) {
        return response({ error: 'Ungültige TI-Anfrage' }, 400);
      }
      body = value;
    } catch {
      return response({ error: 'Ungültige TI-Anfrage' }, 400);
    }

    // Tenant and permissions come only from the verified caller's database context.
    const { data: tenantId, error: tenantError } = await supabase.rpc('current_tenant_id');
    if (tenantError || typeof tenantId !== 'string' || !uuid.test(tenantId)) {
      return response({ error: 'Mandant nicht zugeordnet' }, 403);
    }
    for (const permission of ['ti.view', permissions[body.action]]) {
      const { data: allowed, error } = await supabase.rpc('has_permission', { p_permission_key: permission });
      if (error || allowed !== true) return response({ error: 'Keine Berechtigung für diese TI-Aktion' }, 403);
    }
    const { data: profile, error: profileError } = await supabase.from('profiles')
      .select('id,tenant_id,auth_user_id,status,is_active')
      .or(`id.eq.${user.id},auth_user_id.eq.${user.id}`)
      .eq('tenant_id', tenantId).single();
    if (profileError || !profile || profile.tenant_id !== tenantId
      || profile.status !== 'active' || profile.is_active !== true
      || !(profile.auth_user_id === user.id || (profile.auth_user_id === null && profile.id === user.id))) {
      return response({ error: 'Benutzerprofil nicht eindeutig aktiv zugeordnet' }, 403);
    }

    // The stub needs no secret reference, endpoint or privileged provider access.
    const { data: provider, error } = await supabase
      .from('ti_providers')
      .select('id, tenant_id, kind, is_active')
      .eq('tenant_id', tenantId)
      .eq('id', body.providerId)
      .maybeSingle();

    if (error || !provider || provider.tenant_id !== tenantId || provider.is_active !== true) {
      return response({ error: 'Provider nicht gefunden' }, 404);
    }
    if (body.mailboxId) {
      const { data: mailbox, error: mailboxError } = await supabase.from('kim_mailboxes')
        .select('id,tenant_id,provider_id').eq('tenant_id', tenantId)
        .eq('provider_id', provider.id).eq('id', body.mailboxId).maybeSingle();
      if (mailboxError || !mailbox || mailbox.tenant_id !== tenantId || mailbox.provider_id !== provider.id) {
        return response({ error: 'Postfach nicht gefunden' }, 404);
      }
    }

    // Stub — produktiv: Vault-Lookup + gematik-konformer Connector
    const result = {
      ok: true,
      action: body.action,
      providerId: body.providerId,
      message: `Stub: ${body.action} für Provider ${provider.kind}`,
      checkedAt: new Date().toISOString(),
    };

    const { error: auditError } = await supabase.from('ti_audit_events').insert({
      tenant_id: tenantId,
      action: 'provider_check',
      actor_id: profile.id,
      actor_name: 'ti-provider-proxy',
      resource_type: 'ti_provider',
      resource_id: provider.id,
      details: result.message,
    });
    if (auditError) return response({ error: 'TI-Prüfung konnte nicht protokolliert werden' }, 500);

    return response(result);
  } catch {
    return response({ error: 'TI-Dienst nicht verfügbar' }, 500);
  }
});
