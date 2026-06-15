import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { maskCodeHint, normalizePortalCode, verifyPortalCode } from '../_shared/crypto.ts';
import { corsHeaders, getServiceClient, jsonResponse, readClientMeta, tryInsert } from '../_shared/http.ts';

type LoginBody = {
  code: string;
  portalType: 'client' | 'relative';
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'Methode nicht erlaubt.' }, 405);
  }

  try {
    const body = (await req.json()) as LoginBody;
    const normalized = normalizePortalCode(body.code ?? '');
    if (normalized.length !== 6) {
      return jsonResponse({ ok: false, error: 'Bitte geben Sie einen 6-stelligen Code ein.' }, 400);
    }

    const portalType = body.portalType === 'relative' ? 'relative' : 'client';
    const table = portalType === 'client' ? 'client_portal_codes' : 'relative_portal_codes';
    const loginType = portalType === 'client' ? 'client_portal' : 'relative_portal';

    const supabase = getServiceClient();
    const meta = readClientMeta(req);
    const hint = maskCodeHint(normalized);

    const { data: rows, error } = await supabase
      .from(table)
      .select('*')
      .in('status', ['active', 'blocked']);

    if (error) {
      return jsonResponse({ ok: false, error: error.message }, 500);
    }

    let matched: Record<string, unknown> | null = null;
    for (const row of rows ?? []) {
      const hash = row.code_hash as string;
      if (!hash) continue;
      if (!(await verifyPortalCode(normalized, hash))) continue;
      matched = row as Record<string, unknown>;
      break;
    }

    if (!matched) {
      await tryInsert(supabase, 'login_audit_events', {
        tenant_id: null,
        login_type: loginType,
        account_id: null,
        username_or_code_hint: hint,
        success: false,
        failure_reason: 'Code unbekannt.',
        ip_address: meta.ipAddress,
        user_agent: meta.userAgent,
      });
      return jsonResponse({ ok: false, error: 'Code ungültig oder abgelaufen.' }, 401);
    }

    if (matched.status === 'blocked') {
      await tryInsert(supabase, 'login_audit_events', {
        tenant_id: matched.tenant_id as string,
        login_type: loginType,
        account_id: matched.id as string,
        username_or_code_hint: hint,
        success: false,
        failure_reason: 'Code gesperrt.',
        ip_address: meta.ipAddress,
        user_agent: meta.userAgent,
      });
      return jsonResponse({
        ok: false,
        error: 'Zugang gesperrt. Bitte wenden Sie sich an die Verwaltung.',
      }, 403);
    }

    if (matched.expires_at && new Date(matched.expires_at as string).getTime() < Date.now()) {
      return jsonResponse({ ok: false, error: 'Code ungültig oder abgelaufen.' }, 401);
    }

    const now = new Date().toISOString();
    const sessionToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();

    const { error: updateError } = await supabase
      .from(table)
      .update({ last_used_at: now })
      .eq('id', matched.id);

    if (updateError) {
      return jsonResponse({ ok: false, error: updateError.message }, 500);
    }

    const { error: sessionError } = await supabase.from('portal_sessions').insert({
      tenant_id: matched.tenant_id,
      portal_type: portalType,
      client_id: matched.client_id,
      relative_contact_id: portalType === 'relative' ? matched.relative_contact_id : null,
      status: 'active',
      session_token: sessionToken,
      started_at: now,
      last_seen_at: now,
      expires_at: expiresAt,
      ip_address: meta.ipAddress,
      user_agent: meta.userAgent,
      metadata: { portal_code_id: matched.id },
    });

    if (sessionError) {
      return jsonResponse({ ok: false, error: sessionError.message }, 500);
    }

    await tryInsert(supabase, 'login_audit_events', {
      tenant_id: matched.tenant_id as string,
      login_type: loginType,
      account_id: matched.id as string,
      username_or_code_hint: hint,
      success: true,
      failure_reason: null,
      ip_address: meta.ipAddress,
      user_agent: meta.userAgent,
    });

    return jsonResponse({
      ok: true,
      portalAccountId: matched.id,
      tenantId: matched.tenant_id,
      portalType,
      sessionToken,
      expiresAt,
    });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) }, 500);
  }
});
