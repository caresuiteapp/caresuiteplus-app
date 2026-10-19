import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import {
  buildAdminNotifyEmailContent,
  collectAdminRecipientEmails,
  isAdminNotifySendConfigured,
  resolveAdminNotifyEnvConfig,
  sendViaResend,
} from '../_shared/dsgvoAdminNotify.ts';
import {
  handleDataSubjectRequestAdminNotify,
  collectScopedAdminProfileEmails,
  type DataRequestNotifyCaller,
  type StoredDataRequestForNotify,
} from '../_shared/dataSubjectRequestAdminNotifyHandler.ts';
import { corsHeaders, getServiceClient, jsonResponse } from '../_shared/http.ts';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

async function resolveCaller(
  req: Request,
  tenantId: string,
  service: ReturnType<typeof getServiceClient>,
): Promise<DataRequestNotifyCaller | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  if (!supabaseUrl || !anonKey) return null;

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: auth, error: authError } = await userClient.auth.getUser();
  if (authError || !auth.user || auth.user.is_anonymous) return null;
  const authUserId = auth.user.id;

  const [profileIdentity, tenantIdentity] = await Promise.all([
    userClient.rpc('resolve_current_profile_id'),
    userClient.rpc('current_tenant_id'),
  ]);
  if (profileIdentity.error || tenantIdentity.error ||
      typeof profileIdentity.data !== 'string' || tenantIdentity.data !== tenantId) return null;

  const { data: profile, error: profileError } = await service
    .from('profiles')
    .select('id, tenant_id, auth_user_id, is_active')
    .eq('id', profileIdentity.data)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (profileError || !profile || profile.is_active !== true ||
      (profile.id !== authUserId && profile.auth_user_id !== authUserId)) return null;

  // The authenticated RPC confirms the active profile, tenant and portal scope.
  // Never grant administrative access from user-editable metadata or role names.
  const { data: capabilities, error: capabilityError } = await userClient.rpc(
    'data_request_workspace_v1',
    {
      p_action: 'capabilities',
      p_payload: {
        expected_auth_user_id: authUserId,
        expected_tenant_id: tenantId,
        expected_profile_id: profile.id,
      },
    },
  );
  if (capabilityError || !isRecord(capabilities) || capabilities.version !== 1 ||
      !isRecord(capabilities.capabilities) || capabilities.capabilities.self_service !== true) return null;

  return {
    authUserId,
    profileId: profile.id,
    profileAuthUserId: profile.auth_user_id,
    tenantId: profile.tenant_id,
    active: true,
    selfService: true,
    adminManage: capabilities.capabilities.admin_manage === true,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  try {
    const service = getServiceClient();
    const config = resolveAdminNotifyEnvConfig({
      RESEND_API_KEY: Deno.env.get('RESEND_API_KEY') ?? undefined,
      DSGVO_NOTIFY_FROM_EMAIL: Deno.env.get('DSGVO_NOTIFY_FROM_EMAIL') ?? undefined,
      DSGVO_ADMIN_NOTIFY_EMAIL: Deno.env.get('DSGVO_ADMIN_NOTIFY_EMAIL') ?? undefined,
    });

    const result = await handleDataSubjectRequestAdminNotify(req, {
      resolveCaller: (request, tenantId) => resolveCaller(request, tenantId, service),
      loadRequest: async (tenantId, requestId) => {
        const { data, error } = await service
          .from('data_subject_requests')
          .select('id, tenant_id, profile_id, request_type, requester_name, requester_email, received_at, created_at')
          .eq('tenant_id', tenantId)
          .eq('id', requestId)
          .maybeSingle();
        if (error) throw new Error('Request lookup failed');
        return data as StoredDataRequestForNotify | null;
      },
      isConfigured: () => isAdminNotifySendConfigured(config),
      loadRecipients: async (tenantId) => {
        const [tenantResult, profileResult] = await Promise.all([
          service.from('tenants').select('email').eq('id', tenantId).maybeSingle(),
          service.from('profiles').select('email, roles!inner(*)').eq('tenant_id', tenantId)
            .eq('is_active', true).eq('status', 'active').eq('roles.is_admin_role', true).not('email', 'is', null),
        ]);
        if (tenantResult.error || profileResult.error) throw new Error('Recipient lookup failed');
        return collectAdminRecipientEmails({
          profileEmails: collectScopedAdminProfileEmails(profileResult.data ?? [], tenantId),
          tenantEmail: tenantResult.data?.email as string | null,
          overrideEmail: config.adminOverrideEmail,
        });
      },
      claimDelivery: async (requestId) => {
        const { data, error } = await service.rpc('data_request_admin_notification_v1', {
          p_action: 'claim',
          p_request_id: requestId,
        });
        if (error || !isRecord(data) || typeof data.claimed !== 'boolean') {
          throw new Error('Notification claim unavailable');
        }
        if (!data.claimed) return { claimed: false };
        if (typeof data.claim_token !== 'string') throw new Error('Notification claim invalid');
        return { claimed: true, claimToken: data.claim_token };
      },
      finishDelivery: async (requestId, claimToken, sent) => {
        const { data, error } = await service.rpc('data_request_admin_notification_v1', {
          p_action: sent ? 'finish_sent' : 'finish_failed',
          p_request_id: requestId,
          p_claim_token: claimToken,
        });
        if (error || !isRecord(data) || data.recorded !== true) {
          throw new Error('Notification outcome unavailable');
        }
      },
      send: async (payload, recipients) => {
        const email = buildAdminNotifyEmailContent(payload);
        return sendViaResend({
          apiKey: config.resendApiKey!,
          from: config.fromEmail!,
          to: recipients,
          subject: email.subject,
          text: email.text,
          html: email.html,
        });
      },
    });
    return jsonResponse(result.body, result.statusCode);
  } catch {
    return jsonResponse({ ok: false, error: 'Die zusätzliche Benachrichtigung ist derzeit nicht verfügbar.' }, 503);
  }
});
