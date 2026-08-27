import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders, getServiceClient, jsonResponse, readClientMeta, tryInsert } from '../_shared/http.ts';
import { normalizePortalUsername } from '../_shared/portalUsername.ts';
import { verifyEmployeePortalPassword } from '../_shared/verifyEmployeePortalPassword.ts';
import { ensurePortalSupabaseAuth } from '../_shared/portalAuth.ts';
import {
  createOpaqueToken,
  hashOpaqueToken,
  hashSecret,
  needsSecretRehash,
} from '../_shared/crypto.ts';
import {
  INVALID_PORTAL_CREDENTIALS_MESSAGE,
  isLoginRateLimited,
  RATE_LIMIT_MESSAGE,
} from '../_shared/loginSecurity.ts';

type LoginBody = { username: string; password: string };

function mapAccount(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    employeeId: row.employee_id as string,
    username: row.username as string,
    status: row.status as string,
    mustChangePassword: row.must_change_password as boolean,
    firstLoginCompleted: row.first_login_completed as boolean,
    temporaryPasswordCreatedAt: (row.temporary_password_created_at as string | null) ?? null,
    temporaryPasswordExpiresAt: (row.temporary_password_expires_at as string | null) ?? null,
    lastLoginAt: (row.last_login_at as string | null) ?? null,
    createdBy: (row.created_by as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    blockedAt: (row.blocked_at as string | null) ?? null,
    blockedBy: (row.blocked_by as string | null) ?? null,
    blockedReason: (row.blocked_reason as string | null) ?? null,
  };
}

async function resolveEmployeeDisplayName(
  supabase: ReturnType<typeof getServiceClient>, employeeId: string, fallbackUsername: string,
): Promise<string> {
  const { data: employeeRow } = await supabase.from('employees').select('first_name, last_name').eq('id', employeeId).maybeSingle();
  if (employeeRow) {
    const first = ((employeeRow.first_name as string | null) ?? '').trim();
    const last = ((employeeRow.last_name as string | null) ?? '').trim();
    const fullName = [first, last].filter(Boolean).join(' ').trim();
    if (fullName) return fullName;
  }
  return fallbackUsername;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ ok: false, error: 'Methode nicht erlaubt.', errorClass: 'unknown' }, 405);

  try {
    const body = (await req.json()) as LoginBody;
    const username = normalizePortalUsername(body.username ?? '');
    // Passwörter sind exakte Geheimnisse. Niemals trimmen, normalisieren oder
    // unsichtbare Zeichen entfernen: Der gespeicherte Hash wurde aus exakt
    // denselben Zeichen gebildet.
    const password = typeof body.password === 'string' ? body.password : '';
    if (!username || !password) {
      return jsonResponse({ ok: false, error: 'Benutzername und Passwort sind erforderlich.', errorClass: 'missing_credentials' }, 400);
    }

    const supabase = getServiceClient();
    const meta = readClientMeta(req);
    if (await isLoginRateLimited(supabase, {
      loginType: 'employee_portal',
      ipAddress: meta.ipAddress,
      accountHint: username,
    })) {
      return jsonResponse({ ok: false, error: RATE_LIMIT_MESSAGE, errorClass: 'rate_limited' }, 429);
    }

    const { data: matches, error } = await supabase.from('employee_portal_accounts').select('*').ilike('username', username);
    if (error) {
      console.error(`[employee-portal-login] account lookup failed: ${error.message}`);
      return jsonResponse({ ok: false, error: 'Anmeldung ist vorübergehend nicht verfügbar.', errorClass: 'unknown' }, 500);
    }

    const rows = matches ?? [];
    const activeCandidates = rows.filter((row) =>
      ['active', 'pending_first_login', 'password_reset_required'].includes(String(row.status))
    );
    const duplicateActive = activeCandidates.length > 1;
    let matched: Record<string, unknown> | null = null;
    let lastFailureClass = 'invalid_password';

    for (const row of activeCandidates) {
      const check = await verifyEmployeePortalPassword(password, row as Record<string, unknown>);
      if (check.ok) { matched = row as Record<string, unknown>; break; }
      lastFailureClass = check.failureClass;
    }

    if (!matched) {
      const blocked = rows.find((row) => row.status === 'blocked');
      const failureReason = blocked
        ? 'Zugang gesperrt. Bitte wenden Sie sich an die Verwaltung.'
        : duplicateActive
          ? 'Mehrere aktive Zugänge mit gleichem Benutzernamen. Bitte Verwaltung kontaktieren.'
          : rows.length === 0
            ? 'Benutzername oder Passwort ist falsch.'
            : lastFailureClass === 'password_expired'
              ? 'Einmalpasswort ist abgelaufen.'
              : lastFailureClass === 'password_missing'
                ? 'Kein Passwort hinterlegt. Bitte Verwaltung kontaktieren.'
                : 'Benutzername oder Passwort ist falsch.';
      await tryInsert(supabase, 'login_audit_events', { tenant_id: blocked?.tenant_id ?? rows[0]?.tenant_id ?? null, login_type: 'employee_portal', account_id: blocked?.id ?? rows[0]?.id ?? null, username_or_code_hint: username, success: false, failure_reason: failureReason, ip_address: meta.ipAddress, user_agent: meta.userAgent });
      return jsonResponse({
        ok: false,
        error: INVALID_PORTAL_CREDENTIALS_MESSAGE,
        errorClass: 'invalid_credentials',
      }, 401);
    }

    const now = new Date().toISOString();
    const sessionToken = createOpaqueToken();
    const sessionTokenHash = await hashOpaqueToken(sessionToken);
    const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
    const storedPasswordHash = matched.temporary_password_hash as string | null;
    const accountUpdate: Record<string, unknown> = { last_login_at: now };
    if (storedPasswordHash && needsSecretRehash(storedPasswordHash)) {
      accountUpdate.temporary_password_hash = await hashSecret(password);
    }
    const { error: updateError } = await supabase.from('employee_portal_accounts').update(accountUpdate).eq('id', matched.id);
    if (updateError) {
      console.error(`[employee-portal-login] account update failed: ${updateError.message}`);
      return jsonResponse({ ok: false, error: 'Anmeldung ist vorübergehend nicht verfügbar.', errorClass: 'unknown' }, 500);
    }

    const { error: sessionError } = await supabase.from('portal_sessions').insert({ tenant_id: matched.tenant_id, portal_type: 'employee', employee_id: matched.employee_id, status: 'active', session_token: sessionTokenHash, started_at: now, last_seen_at: now, expires_at: expiresAt, ip_address: meta.ipAddress, user_agent: meta.userAgent, metadata: { account_id: matched.id, portal_account_id: matched.id, token_format: 'sha256' } });
    if (sessionError) {
      console.error(`[employee-portal-login] session insert failed: ${sessionError.message}`);
      return jsonResponse({ ok: false, error: 'Sitzung konnte nicht erstellt werden.', errorClass: 'session_error' }, 500);
    }
    await tryInsert(supabase, 'login_audit_events', { tenant_id: matched.tenant_id as string, login_type: 'employee_portal', account_id: matched.id as string, username_or_code_hint: username, success: true, failure_reason: null, ip_address: meta.ipAddress, user_agent: meta.userAgent });

    const account = mapAccount(matched);
    const mustChangePassword = account.mustChangePassword || !account.firstLoginCompleted;
    const displayName = await resolveEmployeeDisplayName(supabase, matched.employee_id as string, account.username);
    const authResult = await ensurePortalSupabaseAuth(supabase, { portalType: 'employee', accountId: account.id, tenantId: account.tenantId, roleKey: 'employee_portal', displayName, linkTable: 'employee_portal_accounts', linkRowId: account.id });
    if (!authResult.ok) {
      console.error(`[employee-portal-login] auth session creation failed: ${authResult.error}`);
      return jsonResponse({ ok: false, error: 'Sitzung konnte nicht erstellt werden.', errorClass: 'unknown' }, 500);
    }

    return jsonResponse({ ok: true, account, mustChangePassword, sessionToken, expiresAt, supabaseAccessToken: authResult.accessToken, supabaseRefreshToken: authResult.refreshToken });
  } catch (err) {
    console.error('[employee-portal-login] unexpected error', err);
    return jsonResponse({ ok: false, error: 'Anmeldung ist vorübergehend nicht verfügbar.', errorClass: 'unknown' }, 500);
  }
});
