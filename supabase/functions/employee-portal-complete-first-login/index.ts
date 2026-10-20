import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { hashOpaqueToken, hashSecret, verifySecret } from '../_shared/crypto.ts';
import { corsHeaders, getServiceClient, jsonResponse, readClientMeta, tryInsert } from '../_shared/http.ts';

type CompleteFirstLoginBody = {
  accountId: string;
  sessionToken: string;
  newPassword: string;
  confirmPassword: string;
  currentPassword?: string;
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

function validatePermanentPassword(password: string, confirmPassword: string): string | null {
  if (password.length < 10) {
    return 'Das Passwort muss mindestens 10 Zeichen haben.';
  }
  if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
    return 'Das Passwort muss Groß-, Kleinbuchstaben und Zahlen enthalten.';
  }
  if (!/[!@#$%&*?]/.test(password)) {
    return 'Das Passwort muss mindestens ein Sonderzeichen enthalten (!@#$%&*?).';
  }
  if (password !== confirmPassword) {
    return 'Passwörter stimmen nicht überein.';
  }
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'Methode nicht erlaubt.' }, 405);
  }

  try {
    const body = (await req.json()) as CompleteFirstLoginBody;
    const accountId = body.accountId?.trim();
    const sessionToken = body.sessionToken?.trim();

    if (!accountId || !sessionToken || !body.newPassword || !body.confirmPassword) {
      return jsonResponse({ ok: false, error: 'Pflichtfelder fehlen.' }, 400);
    }

    const validationError = validatePermanentPassword(body.newPassword, body.confirmPassword);
    if (validationError) {
      return jsonResponse({ ok: false, error: validationError }, 400);
    }

    const supabase = getServiceClient();
    const sessionTokenHash = await hashOpaqueToken(sessionToken);

    const { data: sessionRow, error: sessionError } = await supabase
      .from('portal_sessions')
      .select('id, tenant_id, status, expires_at, metadata, session_token')
      .in('session_token', [sessionTokenHash, sessionToken])
      .eq('portal_type', 'employee')
      .maybeSingle();

    if (sessionError) {
      console.error(`[employee-portal-complete-first-login] session lookup failed: ${sessionError.message}`);
      return jsonResponse({ ok: false, error: 'Sitzung konnte nicht geprüft werden.' }, 500);
    }

    if (!sessionRow || sessionRow.status !== 'active') {
      return jsonResponse({ ok: false, error: 'Sitzung ungültig. Bitte erneut anmelden.' }, 401);
    }

    if (new Date(sessionRow.expires_at as string).getTime() <= Date.now()) {
      return jsonResponse({ ok: false, error: 'Sitzung abgelaufen. Bitte erneut anmelden.' }, 401);
    }

    const metadata = (sessionRow.metadata as Record<string, unknown> | null) ?? {};
    const sessionAccountId = metadata.account_id as string | undefined;
    if (sessionAccountId !== accountId) {
      return jsonResponse({ ok: false, error: 'Sitzung passt nicht zum Zugang.' }, 403);
    }

    if (sessionRow.session_token === sessionToken) {
      const { error: tokenMigrationError } = await supabase
        .from('portal_sessions')
        .update({
          session_token: sessionTokenHash,
          last_seen_at: new Date().toISOString(),
          metadata: { ...metadata, token_format: 'sha256' },
        })
        .eq('id', sessionRow.id);
      if (tokenMigrationError) {
        console.error(`[employee-portal-complete-first-login] token migration failed: ${tokenMigrationError.message}`);
        return jsonResponse({ ok: false, error: 'Sitzung konnte nicht abgesichert werden.' }, 500);
      }
    }

    const { data: accountRow, error: accountError } = await supabase
      .from('employee_portal_accounts')
      .select('*')
      .eq('id', accountId)
      .eq('tenant_id', sessionRow.tenant_id)
      .maybeSingle();

    if (accountError) {
      console.error(`[employee-portal-complete-first-login] account lookup failed: ${accountError.message}`);
      return jsonResponse({ ok: false, error: 'Zugang konnte nicht geprüft werden.' }, 500);
    }

    if (!accountRow) {
      return jsonResponse({ ok: false, error: 'Zugang nicht gefunden.' }, 404);
    }

    const mustChange =
      Boolean(accountRow.must_change_password) || !Boolean(accountRow.first_login_completed);
    if (!mustChange) {
      return jsonResponse({ ok: false, error: 'Passwort wurde bereits gesetzt.' }, 400);
    }

    const storedHash = accountRow.temporary_password_hash as string | null;
    if (body.currentPassword?.trim()) {
      if (!storedHash || !(await verifySecret(body.currentPassword, storedHash))) {
        return jsonResponse({ ok: false, error: 'Aktuelles Passwort ist ungültig.' }, 401);
      }
    }

    if (storedHash && (await verifySecret(body.newPassword, storedHash))) {
      return jsonResponse(
        { ok: false, error: 'Das neue Passwort darf nicht mit dem Einmalpasswort identisch sein.' },
        400,
      );
    }

    const now = new Date().toISOString();
    const newHash = await hashSecret(body.newPassword);

    const { error: updateError } = await supabase
      .from('employee_portal_accounts')
      .update({
        temporary_password_hash: newHash,
        temporary_password_created_at: now,
        temporary_password_expires_at: null,
        must_change_password: false,
        first_login_completed: true,
        status: 'active',
        updated_at: now,
      })
      .eq('id', accountId);

    if (updateError) {
      console.error(`[employee-portal-complete-first-login] account update failed: ${updateError.message}`);
      return jsonResponse({ ok: false, error: 'Passwort konnte nicht gespeichert werden.' }, 500);
    }

    const { data: refreshed, error: refreshError } = await supabase
      .from('employee_portal_accounts')
      .select('*')
      .eq('id', accountId)
      .single();

    if (refreshError || !refreshed) {
      if (refreshError) {
        console.error(`[employee-portal-complete-first-login] refresh failed: ${refreshError.message}`);
      }
      return jsonResponse({ ok: false, error: 'Zugang konnte nach der Änderung nicht geladen werden.' }, 500);
    }

    const meta = readClientMeta(req);
    await tryInsert(supabase, 'login_audit_events', {
      tenant_id: refreshed.tenant_id as string,
      login_type: 'employee_portal',
      account_id: accountId,
      username_or_code_hint: refreshed.username as string,
      success: true,
      failure_reason: 'Erstlogin: Passwort geändert.',
      ip_address: meta.ipAddress,
      user_agent: meta.userAgent,
    });

    return jsonResponse({
      ok: true,
      account: mapAccount(refreshed as Record<string, unknown>),
    });
  } catch (err) {
    console.error('[employee-portal-complete-first-login] unexpected error', err);
    return jsonResponse({ ok: false, error: 'Passwortänderung ist vorübergehend nicht verfügbar.' }, 500);
  }
});
