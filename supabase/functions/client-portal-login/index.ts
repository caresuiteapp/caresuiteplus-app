import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { maskCodeHint, normalizePortalCode, verifyPortalCode } from '../_shared/crypto.ts';
import { corsHeaders, getServiceClient, jsonResponse, readClientMeta, tryInsert } from '../_shared/http.ts';
import { ensurePortalSupabaseAuth } from '../_shared/portalAuth.ts';

type LoginBody = {
  username: string;
  code: string;
};

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX_FAILURES = 10;

async function isRateLimited(
  supabase: ReturnType<typeof getServiceClient>,
  ipAddress: string | null,
): Promise<boolean> {
  if (!ipAddress) return false;

  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
  const { count, error } = await supabase
    .from('login_audit_events')
    .select('*', { count: 'exact', head: true })
    .eq('login_type', 'client_portal')
    .eq('success', false)
    .eq('ip_address', ipAddress)
    .gte('created_at', since);

  if (error) return false;
  return (count ?? 0) >= RATE_LIMIT_MAX_FAILURES;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'Methode nicht erlaubt.' }, 405);
  }

  try {
    const body = (await req.json()) as LoginBody;
    const username = body.username?.trim().toLowerCase();
    const normalized = normalizePortalCode(body.code ?? '');

    if (!username) {
      return jsonResponse({ ok: false, error: 'Benutzername ist erforderlich.' }, 400);
    }
    if (normalized.length !== 6) {
      return jsonResponse({ ok: false, error: 'Bitte geben Sie einen 6-stelligen Zugangscode ein.' }, 400);
    }

    const supabase = getServiceClient();
    const meta = readClientMeta(req);
    const hint = `${username} / ${maskCodeHint(normalized)}`;

    if (await isRateLimited(supabase, meta.ipAddress)) {
      return jsonResponse({
        ok: false,
        error: 'Zu viele Anmeldeversuche. Bitte warten Sie einige Minuten.',
      }, 429);
    }

    const { data: matches, error } = await supabase
      .from('client_portal_access')
      .select('*')
      .eq('portal_enabled', true)
      .ilike('portal_username', username);

    if (error) {
      return jsonResponse({ ok: false, error: error.message }, 500);
    }

    const candidates = (matches ?? []).filter((row) => row.status !== 'gesperrt' && row.status !== 'deaktiviert');

    let matched: Record<string, unknown> | null = null;
    for (const row of candidates) {
      const hash = row.portal_access_code_hash as string | null;
      if (!hash) continue;
      if (!(await verifyPortalCode(normalized, hash))) continue;
      matched = row as Record<string, unknown>;
      break;
    }

    if (!matched) {
      const blocked = (matches ?? []).find((row) => row.status === 'gesperrt');
      await tryInsert(supabase, 'login_audit_events', {
        tenant_id: blocked?.tenant_id ?? null,
        login_type: 'client_portal',
        account_id: blocked?.id ?? null,
        username_or_code_hint: hint,
        success: false,
        failure_reason: blocked ? 'Zugang gesperrt.' : 'Benutzername oder Zugangscode ist falsch.',
        ip_address: meta.ipAddress,
        user_agent: meta.userAgent,
      });

      return jsonResponse({
        ok: false,
        error: blocked
          ? 'Zugang gesperrt. Bitte wenden Sie sich an die Verwaltung.'
          : 'Benutzername oder Zugangscode ist falsch.',
      }, 401);
    }

    const now = new Date().toISOString();
    const sessionToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();

    const { error: updateError } = await supabase
      .from('client_portal_access')
      .update({ last_login_at: now, updated_at: now })
      .eq('id', matched.id);

    if (updateError) {
      return jsonResponse({ ok: false, error: updateError.message }, 500);
    }

    const { error: sessionError } = await supabase.from('portal_sessions').insert({
      tenant_id: matched.tenant_id,
      portal_type: 'client',
      client_id: matched.client_id,
      relative_contact_id: null,
      status: 'active',
      session_token: sessionToken,
      started_at: now,
      last_seen_at: now,
      expires_at: expiresAt,
      ip_address: meta.ipAddress,
      user_agent: meta.userAgent,
      metadata: { portal_access_id: matched.id },
    });

    if (sessionError) {
      return jsonResponse({ ok: false, error: sessionError.message }, 500);
    }

    await tryInsert(supabase, 'login_audit_events', {
      tenant_id: matched.tenant_id as string,
      login_type: 'client_portal',
      account_id: matched.id as string,
      username_or_code_hint: hint,
      success: true,
      failure_reason: null,
      ip_address: meta.ipAddress,
      user_agent: meta.userAgent,
    });

    const portalUsername = (matched.portal_username as string | null) ?? username;
    const clientId = matched.client_id as string | null;
    let clientDisplayName: string | null = null;

    if (clientId) {
      const { data: clientRow } = await supabase
        .from('clients')
        .select('first_name, last_name, salutation')
        .eq('id', clientId)
        .maybeSingle();

      if (clientRow) {
        const first = clientRow.first_name?.trim()
          ? clientRow.first_name.trim().charAt(0).toUpperCase() + clientRow.first_name.trim().slice(1)
          : '';
        const last = clientRow.last_name?.trim()
          ? clientRow.last_name.trim().charAt(0).toUpperCase() + clientRow.last_name.trim().slice(1)
          : '';
        const fullName = [first, last].filter(Boolean).join(' ').trim();
        if (fullName) {
          const salutationKey = clientRow.salutation?.trim().toLowerCase();
          clientDisplayName =
            salutationKey === 'frau' || salutationKey === 'herr'
              ? `${salutationKey === 'frau' ? 'Frau' : 'Herr'} ${fullName}`
              : fullName;
        }
      }
    }

    const displayName = clientDisplayName ?? portalUsername;
    const { data: tenantRow } = await supabase
      .from('tenants')
      .select('name')
      .eq('id', matched.tenant_id as string)
      .maybeSingle();
    const tenantName = (tenantRow?.name as string | null)?.trim() || null;

    const authResult = await ensurePortalSupabaseAuth(supabase, {
      portalType: 'client',
      accountId: matched.id as string,
      tenantId: matched.tenant_id as string,
      roleKey: 'client_portal',
      displayName,
      linkTable: 'client_portal_access',
      linkRowId: matched.id as string,
    });

    if (!authResult.ok) {
      return jsonResponse({ ok: false, error: authResult.error }, 500);
    }

    return jsonResponse({
      ok: true,
      portalAccountId: matched.id,
      tenantId: matched.tenant_id,
      clientId: matched.client_id,
      portalType: 'client',
      displayName,
      tenantName,
      sessionToken,
      expiresAt,
      supabaseAccessToken: authResult.accessToken,
      supabaseRefreshToken: authResult.refreshToken,
    });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) }, 500);
  }
});
