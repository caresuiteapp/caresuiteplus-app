import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import {
  createOpaqueToken,
  hashOpaqueToken,
  hashPortalCode,
  needsSecretRehash,
  normalizePortalCode,
  verifyPortalCode,
} from '../_shared/crypto.ts';
import { corsHeaders, getServiceClient, jsonResponse, readClientMeta, tryInsert } from '../_shared/http.ts';
import { ensurePortalSupabaseAuth } from '../_shared/portalAuth.ts';
import {
  INVALID_PORTAL_CREDENTIALS_MESSAGE,
  isLoginRateLimited,
  RATE_LIMIT_MESSAGE,
} from '../_shared/loginSecurity.ts';

type LoginBody = {
  username: string;
  code: string;
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
    const hint = username;

    if (await isLoginRateLimited(supabase, {
      loginType: 'client_portal',
      ipAddress: meta.ipAddress,
      accountHint: hint,
    })) {
      return jsonResponse({
        ok: false,
        error: RATE_LIMIT_MESSAGE,
      }, 429);
    }

    const { data: matches, error } = await supabase
      .from('client_portal_access')
      .select('*')
      .eq('portal_enabled', true)
      .ilike('portal_username', username);

    if (error) {
      console.error(`[client-portal-login] account lookup failed: ${error.message}`);
      return jsonResponse({ ok: false, error: 'Anmeldung ist vorübergehend nicht verfügbar.' }, 500);
    }

    const candidates = (matches ?? []).filter((row) => row.status === 'aktiv');

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
        tenant_id: blocked?.tenant_id ?? matches?.[0]?.tenant_id ?? null,
        login_type: 'client_portal',
        account_id: blocked?.id ?? matches?.[0]?.id ?? null,
        username_or_code_hint: hint,
        success: false,
        failure_reason: blocked ? 'Zugang gesperrt.' : 'Benutzername oder Zugangscode ist falsch.',
        ip_address: meta.ipAddress,
        user_agent: meta.userAgent,
      });

      return jsonResponse({
        ok: false,
        error: INVALID_PORTAL_CREDENTIALS_MESSAGE,
      }, 401);
    }

    const now = new Date().toISOString();
    const sessionToken = createOpaqueToken();
    const sessionTokenHash = await hashOpaqueToken(sessionToken);
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
    const storedCodeHash = matched.portal_access_code_hash as string;
    const accountUpdate: Record<string, unknown> = { last_login_at: now, updated_at: now };
    if (needsSecretRehash(storedCodeHash)) {
      accountUpdate.portal_access_code_hash = await hashPortalCode(normalized);
    }

    const { error: updateError } = await supabase
      .from('client_portal_access')
      .update(accountUpdate)
      .eq('id', matched.id);

    if (updateError) {
      console.error(`[client-portal-login] account update failed: ${updateError.message}`);
      return jsonResponse({ ok: false, error: 'Anmeldung ist vorübergehend nicht verfügbar.' }, 500);
    }

    const { error: sessionError } = await supabase.from('portal_sessions').insert({
      tenant_id: matched.tenant_id,
      portal_type: 'client',
      client_id: matched.client_id,
      relative_contact_id: null,
      status: 'active',
      session_token: sessionTokenHash,
      started_at: now,
      last_seen_at: now,
      expires_at: expiresAt,
      ip_address: meta.ipAddress,
      user_agent: meta.userAgent,
      metadata: { portal_access_id: matched.id, portal_account_id: matched.id, token_format: 'sha256' },
    });

    if (sessionError) {
      console.error(`[client-portal-login] session insert failed: ${sessionError.message}`);
      return jsonResponse({ ok: false, error: 'Sitzung konnte nicht erstellt werden.' }, 500);
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
    let clientFirstName: string | null = null;
    let clientLastName: string | null = null;

    if (clientId) {
      const { data: clientRow } = await supabase
        .from('clients')
        .select('first_name, last_name, gender')
        .eq('id', clientId)
        .maybeSingle();

      if (clientRow) {
        clientFirstName = (clientRow.first_name as string | null)?.trim() || null;
        clientLastName = (clientRow.last_name as string | null)?.trim() || null;

        const first = clientFirstName
          ? clientFirstName.charAt(0).toUpperCase() + clientFirstName.slice(1)
          : '';
        const last = clientLastName
          ? clientLastName.charAt(0).toUpperCase() + clientLastName.slice(1)
          : '';
        const fullName = [first, last].filter(Boolean).join(' ').trim();
        if (fullName) {
          const genderKey = (clientRow.gender as string | null)?.trim().toLowerCase();
          clientDisplayName =
            genderKey === 'female' || genderKey === 'f' || genderKey === 'w' || genderKey === 'weiblich'
              ? `Frau ${fullName}`
              : genderKey === 'male' || genderKey === 'm' || genderKey === 'maennlich' || genderKey === 'männlich'
                ? `Herr ${fullName}`
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
      clientFirstName,
      clientLastName,
    });

    if (!authResult.ok) {
      console.error(`[client-portal-login] auth session creation failed: ${authResult.error}`);
      return jsonResponse({ ok: false, error: 'Sitzung konnte nicht erstellt werden.' }, 500);
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
    console.error('[client-portal-login] unexpected error', err);
    return jsonResponse({ ok: false, error: 'Anmeldung ist vorübergehend nicht verfügbar.' }, 500);
  }
});
