import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { hashOpaqueToken } from '../_shared/crypto.ts';
import { corsHeaders, getServiceClient, jsonResponse } from '../_shared/http.ts';
import { ensurePortalSupabaseAuth } from '../_shared/portalAuth.ts';

type RefreshBody = { sessionToken?: string };

function metadataId(metadata: unknown, keys: string[]): string | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const source = metadata as Record<string, unknown>;
  for (const key of keys) {
    if (typeof source[key] === 'string' && source[key]) return source[key] as string;
  }
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'Methode nicht erlaubt.' }, 405);
  }

  try {
    const body = (await req.json()) as RefreshBody;
    const sessionToken = body.sessionToken?.trim() ?? '';
    if (sessionToken.length < 16) {
      return jsonResponse({ ok: false, error: 'Sitzung ungültig.' }, 401);
    }

    const tokenHash = await hashOpaqueToken(sessionToken);
    const supabase = getServiceClient();
    const now = new Date().toISOString();
    const { data: sessionRow, error: sessionError } = await supabase
      .from('portal_sessions')
      .select('id, tenant_id, portal_type, employee_id, client_id, metadata, expires_at')
      .in('session_token', [tokenHash, sessionToken])
      .eq('status', 'active')
      .gt('expires_at', now)
      .maybeSingle();

    if (sessionError || !sessionRow) {
      return jsonResponse({ ok: false, error: 'Sitzung ist abgelaufen. Bitte erneut anmelden.' }, 401);
    }

    const portalType = String(sessionRow.portal_type);
    const tenantId = String(sessionRow.tenant_id);
    let authResult;

    if (portalType === 'employee' && sessionRow.employee_id) {
      const accountId = metadataId(sessionRow.metadata, ['account_id', 'portal_account_id']);
      let accountQuery = supabase
        .from('employee_portal_accounts')
        .select('id, username, employee_id')
        .eq('tenant_id', tenantId)
        .eq('employee_id', sessionRow.employee_id)
        .in('status', ['active', 'pending_first_login', 'password_reset_required']);
      if (accountId) accountQuery = accountQuery.eq('id', accountId);
      const { data: account } = await accountQuery.maybeSingle();
      if (!account) {
        return jsonResponse({ ok: false, error: 'Mitarbeitendenkonto ist nicht mehr aktiv verknüpft.' }, 401);
      }
      const { data: employee } = await supabase
        .from('employees')
        .select('first_name, last_name')
        .eq('id', account.employee_id)
        .maybeSingle();
      const displayName = [employee?.first_name, employee?.last_name]
        .filter((part) => typeof part === 'string' && part.trim())
        .join(' ')
        .trim() || String(account.username);
      authResult = await ensurePortalSupabaseAuth(supabase, {
        portalType: 'employee',
        accountId: String(account.id),
        tenantId,
        roleKey: 'employee_portal',
        displayName,
        linkTable: 'employee_portal_accounts',
        linkRowId: String(account.id),
      });
    } else if (portalType === 'client' && sessionRow.client_id) {
      const accessId = metadataId(sessionRow.metadata, ['portal_access_id', 'portal_account_id']);
      let accessQuery = supabase
        .from('client_portal_access')
        .select('id, portal_username, client_id')
        .eq('tenant_id', tenantId)
        .eq('client_id', sessionRow.client_id)
        .eq('portal_enabled', true)
        .eq('status', 'aktiv');
      if (accessId) accessQuery = accessQuery.eq('id', accessId);
      const { data: access } = await accessQuery.maybeSingle();
      if (!access) {
        return jsonResponse({ ok: false, error: 'Klient:innenkonto ist nicht mehr aktiv verknüpft.' }, 401);
      }
      const { data: client } = await supabase
        .from('clients')
        .select('first_name, last_name')
        .eq('id', access.client_id)
        .maybeSingle();
      const firstName = (client?.first_name as string | null)?.trim() || null;
      const lastName = (client?.last_name as string | null)?.trim() || null;
      const displayName = [firstName, lastName].filter(Boolean).join(' ').trim()
        || String(access.portal_username ?? 'Klient:in');
      authResult = await ensurePortalSupabaseAuth(supabase, {
        portalType: 'client',
        accountId: String(access.id),
        tenantId,
        roleKey: 'client_portal',
        displayName,
        linkTable: 'client_portal_access',
        linkRowId: String(access.id),
        clientFirstName: firstName,
        clientLastName: lastName,
      });
    } else {
      return jsonResponse({ ok: false, error: 'Dieser Portaltyp kann nicht automatisch erneuert werden.' }, 400);
    }

    if (!authResult.ok) {
      console.error(`[portal-session-refresh] auth repair failed: ${authResult.error}`);
      return jsonResponse({ ok: false, error: 'Sichere Sitzung konnte nicht erneuert werden.' }, 500);
    }

    await supabase
      .from('portal_sessions')
      .update({ last_seen_at: now, updated_at: now })
      .eq('id', sessionRow.id);

    return jsonResponse({
      ok: true,
      supabaseAccessToken: authResult.accessToken,
      supabaseRefreshToken: authResult.refreshToken,
    });
  } catch (error) {
    console.error('[portal-session-refresh] unexpected error', error);
    return jsonResponse({ ok: false, error: 'Sichere Sitzung konnte nicht erneuert werden.' }, 500);
  }
});
