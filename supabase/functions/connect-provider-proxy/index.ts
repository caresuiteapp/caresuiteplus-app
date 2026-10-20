// CareSuite+ — Connect Provider Proxy (Edge Function, Vorbereitung)
// Keine externen API-Aufrufe. Secrets nur serverseitig. Keine Wildcard-Actions.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  assertConnectProxyFeatureAllowed,
  buildBlockedProxyResponse,
  isConnectProxyActionAllowed,
  type ConnectProxyRequest,
  type ConnectProxyResponse,
} from '../_shared/connectGateway.ts';
import { corsHeaders, getServiceClient, jsonResponse } from '../_shared/http.ts';

async function resolveTenantId(authHeader: string): Promise<{ tenantId: string | null; userId: string | null; role: string | null }> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  if (!supabaseUrl || !anonKey) return { tenantId: null, userId: null, role: null };

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authData } = await userClient.auth.getUser();
  if (!authData.user) return { tenantId: null, userId: null, role: null };

  const service = getServiceClient();
  const { data: profile } = await service
    .from('profiles')
    .select('tenant_id, role_key, auth_user_id, id')
    .or(`auth_user_id.eq.${authData.user.id},id.eq.${authData.user.id}`)
    .maybeSingle();

  return {
    tenantId: profile?.tenant_id ?? null,
    userId: profile?.auth_user_id ?? profile?.id ?? authData.user.id,
    role: profile?.role_key ?? null,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse(buildBlockedProxyResponse('unknown', 'Methode nicht erlaubt.'), 405);
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse(buildBlockedProxyResponse('unknown', 'Nicht autorisiert.'), 401);
    }

    const body = (await req.json()) as ConnectProxyRequest;
    const action = body.action?.trim();
    const providerKey = body.providerKey?.trim();

    if (!providerKey || !action) {
      return jsonResponse(buildBlockedProxyResponse(action ?? 'unknown', 'providerKey und action erforderlich.'), 400);
    }

    if (!isConnectProxyActionAllowed(providerKey, action)) {
      return jsonResponse(
        buildBlockedProxyResponse(action, `Aktion „${action}" ist für ${providerKey} nicht erlaubt.`),
        403,
      );
    }

    const { tenantId, userId, role } = await resolveTenantId(authHeader);
    if (!tenantId || !userId || !role) {
      return jsonResponse(buildBlockedProxyResponse(action, 'Mandant oder Rolle fehlt.'), 403);
    }

    const service = getServiceClient();

    let integrationStatus = 'not_configured';
    let hasCredential = false;

    if (body.integrationId) {
      const { data: integration } = await service
        .from('tenant_connect_integrations')
        .select('id, integration_status, tenant_id')
        .eq('id', body.integrationId)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (!integration) {
        return jsonResponse(buildBlockedProxyResponse(action, 'Integration nicht gefunden.'), 404);
      }

      integrationStatus = integration.integration_status ?? 'not_configured';

      const { count } = await service
        .from('tenant_connect_credentials')
        .select('id', { count: 'exact', head: true })
        .eq('integration_id', body.integrationId)
        .eq('tenant_id', tenantId);

      hasCredential = (count ?? 0) > 0;
    }

    if (!body.integrationId) {
      return jsonResponse(buildBlockedProxyResponse(action, 'Keine Integration konfiguriert.'), 403);
    }

    const featureGate = assertConnectProxyFeatureAllowed(
      {
        userId,
        tenantId,
        role,
        hasModuleAccess: true,
        integrationStatus,
        hasCredential,
        environment: integrationStatus === 'production' ? 'production' : 'sandbox',
        isMockProvider: true,
        demoMode: false,
        hasProductionApproval: integrationStatus === 'production',
        hasExternalTransferConsent: false,
      },
      action,
    );
    if (!featureGate.allowed) {
      return jsonResponse(buildBlockedProxyResponse(action, featureGate.message), 403);
    }

    if (integrationStatus === 'disabled') {
      return jsonResponse(buildBlockedProxyResponse(action, 'Integration deaktiviert.'), 403);
    }

    const result: ConnectProxyResponse = {
      ok: false,
      blocked: true,
      message: `Connect-Proxy vorbereitet — kein externer Aufruf für ${providerKey}/${action}.`,
      auditAction: action,
    };

    await service.from('connect_audit_events').insert({
      tenant_id: tenantId,
      integration_id: body.integrationId,
      provider_id: null,
      actor_user_id: userId,
      action: `proxy:${action}`,
      entity_type: 'connect_proxy',
      entity_id: body.integrationId,
      old_value_hash: null,
      new_value_hash: null,
    });

    return jsonResponse(result, 200);
  } catch (err) {
    return jsonResponse(
      buildBlockedProxyResponse('unknown', err instanceof Error ? err.message : 'Interner Fehler.'),
      500,
    );
  }
});
