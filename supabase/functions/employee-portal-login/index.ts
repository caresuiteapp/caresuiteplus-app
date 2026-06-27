import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { verifySecret } from '../_shared/crypto.ts';
import { corsHeaders, getServiceClient, jsonResponse, readClientMeta, tryInsert } from '../_shared/http.ts';
import { ensurePortalSupabaseAuth } from '../_shared/portalAuth.ts';

type LoginBody = {
  username: string;
  password: string;
};

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

async function verifyEmployeePassword(
  password: string,
  row: Record<string, unknown>,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const hash = row.temporary_password_hash as string | null;
  if (!hash) {
    return { ok: false, reason: 'Kein Passwort hinterlegt.' };
  }

  const expiresAt = row.temporary_password_expires_at as string | null;
  const firstLoginCompleted = row.first_login_completed as boolean;

  if (!firstLoginCompleted && expiresAt && new Date(expiresAt).getTime() < Date.now()) {
    return { ok: false, reason: 'Einmalpasswort ist abgelaufen.' };
  }

  const valid = await verifySecret(password, hash);
  if (!valid) {
    return { ok: false, reason: 'Benutzername oder Passwort ist falsch.' };
  }

  return { ok: true };
}

async function resolveEmployeeDisplayName(
  supabase: ReturnType<typeof getServiceClient>,
  employeeId: string,
  fallbackUsername: string,
): Promise<string> {
  const { data: employeeRow } = await supabase
    .from('employees')
    .select('first_name, last_name')
    .eq('id', employeeId)
    .maybeSingle();

  if (employeeRow) {
    const first = ((employeeRow.first_name as string | null) ?? '').trim();
    const last = ((employeeRow.last_name as string | null) ?? '').trim();
    const fullName = [first, last].filter(Boolean).join(' ').trim();
    if (fullName) return fullName;
  }

  return fallbackUsername;
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
    const username = body.username?.trim();
    if (!username || !body.password) {
      return jsonResponse({ ok: false, error: 'Benutzername und Passwort sind erforderlich.' }, 400);
    }

    const supabase = getServiceClient();
    const meta = readClientMeta(req);

    const { data: matches, error } = await supabase
      .from('employee_portal_accounts')
      .select('*')
      .ilike('username', username);

    if (error) {
      return jsonResponse({ ok: false, error: error.message }, 500);
    }

    const candidates = (matches ?? []).filter(
      (row) => row.status !== 'archived' && row.status !== 'blocked',
    );

    let matched: Record<string, unknown> | null = null;
    for (const row of candidates) {
      const check = await verifyEmployeePassword(body.password, row as Record<string, unknown>);
      if (check.ok) {
        matched = row as Record<string, unknown>;
        break;
      }
    }

    if (!matched) {
      const blocked = (matches ?? []).find((row) => row.status === 'blocked');
      await tryInsert(supabase, 'login_audit_events', {
        tenant_id: blocked?.tenant_id ?? null,
        login_type: 'employee_portal',
        account_id: blocked?.id ?? null,
        username_or_code_hint: username,
        success: false,
        failure_reason: blocked ? 'Zugang gesperrt.' : 'Benutzername oder Passwort ist falsch.',
        ip_address: meta.ipAddress,
        user_agent: meta.userAgent,
      });

      return jsonResponse({
        ok: false,
        error: blocked
          ? 'Zugang gesperrt. Bitte wenden Sie sich an die Verwaltung.'
          : 'Benutzername oder Passwort ist falsch.',
      }, 401);
    }

    const now = new Date().toISOString();
    const sessionToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();

    const { error: updateError } = await supabase
      .from('employee_portal_accounts')
      .update({ last_login_at: now })
      .eq('id', matched.id);

    if (updateError) {
      return jsonResponse({ ok: false, error: updateError.message }, 500);
    }

    const { error: sessionError } = await supabase.from('portal_sessions').insert({
      tenant_id: matched.tenant_id,
      portal_type: 'employee',
      employee_id: matched.employee_id,
      status: 'active',
      session_token: sessionToken,
      started_at: now,
      last_seen_at: now,
      expires_at: expiresAt,
      ip_address: meta.ipAddress,
      user_agent: meta.userAgent,
      metadata: { account_id: matched.id },
    });

    if (sessionError) {
      return jsonResponse({ ok: false, error: sessionError.message }, 500);
    }

    await tryInsert(supabase, 'login_audit_events', {
      tenant_id: matched.tenant_id as string,
      login_type: 'employee_portal',
      account_id: matched.id as string,
      username_or_code_hint: username,
      success: true,
      failure_reason: null,
      ip_address: meta.ipAddress,
      user_agent: meta.userAgent,
    });

    const account = mapAccount(matched);
    const mustChangePassword = account.mustChangePassword || !account.firstLoginCompleted;

    const displayName = await resolveEmployeeDisplayName(
      supabase,
      matched.employee_id as string,
      account.username,
    );

    const authResult = await ensurePortalSupabaseAuth(supabase, {
      portalType: 'employee',
      accountId: account.id,
      tenantId: account.tenantId,
      roleKey: 'employee_portal',
      displayName,
      linkTable: 'employee_portal_accounts',
      linkRowId: account.id,
    });

    if (!authResult.ok) {
      return jsonResponse({ ok: false, error: authResult.error }, 500);
    }

    return jsonResponse({
      ok: true,
      account,
      mustChangePassword,
      sessionToken,
      expiresAt,
      supabaseAccessToken: authResult.accessToken,
      supabaseRefreshToken: authResult.refreshToken,
    });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) }, 500);
  }
});
