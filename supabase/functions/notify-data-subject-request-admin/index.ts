import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import {
  buildAdminNotifyEmailContent,
  collectAdminRecipientEmails,
  isAdminNotifySendConfigured,
  resolveAdminNotifyEnvConfig,
  resolveAdminNotifyResult,
  sendViaResend,
  type AdminNotifyRequestPayload,
} from '../_shared/dsgvoAdminNotify.ts';
import { corsHeaders, getServiceClient, jsonResponse } from '../_shared/http.ts';

type NotifyBody = AdminNotifyRequestPayload;

function validateBody(body: NotifyBody): string | null {
  if (!body.tenantId?.trim()) return 'Mandant fehlt.';
  if (!body.requestId?.trim()) return 'Anfrage-ID fehlt.';
  if (!body.requestType?.trim()) return 'Anfrage-Art fehlt.';
  if (!body.requesterName?.trim()) return 'Name des Antragstellers fehlt.';
  if (!body.requesterEmail?.trim() || !body.requesterEmail.includes('@')) {
    return 'E-Mail des Antragstellers fehlt oder ungültig.';
  }
  return null;
}

async function verifyCallerTenant(req: Request, tenantId: string): Promise<boolean> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return false;

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  if (!supabaseUrl || !anonKey) return false;

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData.user) return false;

  const service = getServiceClient();
  const { data: profile } = await service
    .from('profiles')
    .select('tenant_id')
    .eq('id', authData.user.id)
    .maybeSingle();

  return profile?.tenant_id === tenantId;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'Methode nicht erlaubt.' }, 405);
  }

  try {
    const body = (await req.json()) as NotifyBody;
    const validationError = validateBody(body);
    if (validationError) {
      return jsonResponse({ ok: false, error: validationError }, 400);
    }

    const tenantId = body.tenantId.trim();
    const authorized = await verifyCallerTenant(req, tenantId);
    if (!authorized) {
      return jsonResponse({ ok: false, error: 'Nicht autorisiert für diesen Mandanten.' }, 403);
    }

    const service = getServiceClient();
    const { data: requestRow, error: requestError } = await service
      .from('data_subject_requests')
      .select('id, tenant_id')
      .eq('tenant_id', tenantId)
      .eq('id', body.requestId.trim())
      .maybeSingle();

    if (requestError) {
      return jsonResponse({ ok: false, error: requestError.message }, 500);
    }
    if (!requestRow) {
      return jsonResponse({ ok: false, error: 'Betroffenenanfrage nicht gefunden.' }, 404);
    }

    const config = resolveAdminNotifyEnvConfig({
      RESEND_API_KEY: Deno.env.get('RESEND_API_KEY') ?? undefined,
      DSGVO_NOTIFY_FROM_EMAIL: Deno.env.get('DSGVO_NOTIFY_FROM_EMAIL') ?? undefined,
      DSGVO_ADMIN_NOTIFY_EMAIL: Deno.env.get('DSGVO_ADMIN_NOTIFY_EMAIL') ?? undefined,
    });

    const { data: tenant } = await service
      .from('tenants')
      .select('email')
      .eq('id', tenantId)
      .maybeSingle();

    const { data: adminProfiles } = await service
      .from('profiles')
      .select('email')
      .eq('tenant_id', tenantId)
      .in('role_key', ['business_admin', 'owner'])
      .not('email', 'is', null);

    const recipientEmails = collectAdminRecipientEmails({
      profileEmails: (adminProfiles ?? []).map((row) => row.email as string),
      tenantEmail: tenant?.email as string | null,
      overrideEmail: config.adminOverrideEmail,
    });

    const payload: AdminNotifyRequestPayload = {
      tenantId,
      requestId: body.requestId.trim(),
      requestType: body.requestType.trim(),
      requesterName: body.requesterName.trim(),
      requesterEmail: body.requesterEmail.trim(),
      receivedAt: body.receivedAt ?? null,
    };

    if (!isAdminNotifySendConfigured(config)) {
      const result = resolveAdminNotifyResult({
        config,
        recipientEmails,
        sendAttempted: false,
        sendSucceeded: false,
      });
      return jsonResponse({
        ok: true,
        status: result.status,
        recipientCount: result.recipientCount,
        message: result.message,
      });
    }

    if (recipientEmails.length === 0) {
      const result = resolveAdminNotifyResult({
        config,
        recipientEmails,
        sendAttempted: false,
        sendSucceeded: false,
      });
      return jsonResponse({
        ok: true,
        status: result.status,
        recipientCount: result.recipientCount,
        message: result.message,
      });
    }

    const email = buildAdminNotifyEmailContent(payload);
    const sendResult = await sendViaResend({
      apiKey: config.resendApiKey!,
      from: config.fromEmail!,
      to: recipientEmails,
      subject: email.subject,
      text: email.text,
      html: email.html,
    });

    const result = resolveAdminNotifyResult({
      config,
      recipientEmails,
      sendAttempted: true,
      sendSucceeded: sendResult.ok,
    });

    if (result.status === 'send_failed') {
      console.warn(`[edge] DSGVO admin notify failed: ${sendResult.error ?? 'unknown'}`);
      return jsonResponse(
        {
          ok: false,
          status: result.status,
          recipientCount: result.recipientCount,
          message: result.message,
          error: sendResult.error ?? 'Resend-Versand fehlgeschlagen.',
        },
        502,
      );
    }

    return jsonResponse({
      ok: true,
      status: result.status,
      recipientCount: result.recipientCount,
      message: result.message,
    });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) }, 500);
  }
});
