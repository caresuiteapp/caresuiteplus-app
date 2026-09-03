import type { Session } from '@supabase/supabase-js';
import type { AuthServiceResult } from '@/lib/supabase/authService';
import { toGermanAuthError } from '@/lib/supabase/authService';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isDemoMode } from '@/lib/supabase/config';
import { invokeEdgeFunction } from '@/lib/supabase/edgeFunctions';
import type { PortalSessionRecord } from './portalSessionStore';

export type PortalSupabaseTokens = {
  accessToken: string;
  refreshToken: string;
};

function expectedPortalType(portalSession: PortalSessionRecord): string {
  if (portalSession.loginType === 'employee_portal') return 'employee';
  if (portalSession.loginType === 'client_portal') return 'client';
  return 'relative';
}

export function isPortalSupabaseSessionAligned(
  session: Session | null | undefined,
  portalSession: PortalSessionRecord,
  nowMs = Date.now(),
): boolean {
  if (!session) return false;
  const metadata = session.user.app_metadata ?? {};
  const expiresAtMs = session.expires_at ? session.expires_at * 1_000 : null;
  const expectedRole = portalSession.roleKey;

  return (
    metadata.tenant_id === portalSession.tenantId &&
    metadata.role_key === expectedRole &&
    metadata.portal_type === expectedPortalType(portalSession) &&
    metadata.portal_account_id === portalSession.accountId &&
    (expiresAtMs === null || expiresAtMs > nowMs + 60_000)
  );
}

/** Establishes authenticated Supabase session after portal edge login (required for RLS). */
export async function signInWithPortalSupabaseTokens(
  tokens: PortalSupabaseTokens,
): Promise<AuthServiceResult<Session>> {
  if (isDemoMode()) {
    return { ok: false, error: 'Supabase-Authentifizierung ist im Demo-Modus nicht verfügbar.' };
  }

  const client = getSupabaseClient();
  if (!client) {
    return { ok: false, error: 'Supabase ist nicht konfiguriert.' };
  }

  const { data, error } = await client.auth.setSession({
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
  });

  if (error || !data.session) {
    return { ok: false, error: toGermanAuthError(error) };
  }

  return { ok: true, data: data.session };
}

export function hasPortalSupabaseTokens(
  data: Record<string, unknown> | null | undefined,
): data is PortalSupabaseTokens & Record<string, unknown> {
  return (
    typeof data?.accessToken === 'string' &&
    typeof data?.refreshToken === 'string' &&
    data.accessToken.length > 0 &&
    data.refreshToken.length > 0
  );
}

/** Maps edge function snake_case token fields to client shape. */
export function mapPortalSupabaseTokensFromEdge(data: {
  supabaseAccessToken?: string;
  supabaseRefreshToken?: string;
}): PortalSupabaseTokens | null {
  if (!data.supabaseAccessToken || !data.supabaseRefreshToken) return null;
  return {
    accessToken: data.supabaseAccessToken,
    refreshToken: data.supabaseRefreshToken,
  };
}

/** Repairs the authenticated RLS session for an already valid portal session. */
export async function refreshPortalSupabaseSession(
  portalSession: PortalSessionRecord,
): Promise<AuthServiceResult<Session>> {
  const refreshed = await invokeEdgeFunction<{
    supabaseAccessToken?: string;
    supabaseRefreshToken?: string;
  }>('portal-session-refresh', { sessionToken: portalSession.sessionToken });
  if (!refreshed.ok) return refreshed;
  const tokens = mapPortalSupabaseTokensFromEdge(refreshed.data);
  if (!tokens) {
    return { ok: false, error: 'Die erneuerte Portalsitzung enthält keine Schreibberechtigung.' };
  }
  return signInWithPortalSupabaseTokens(tokens);
}

/**
 * Verifies the real Supabase/RLS identity immediately before a portal write.
 * Existing portal UI state is not evidence of a writable database session:
 * after an app update the opaque portal session can outlive an old Supabase JWT.
 */
export async function ensurePortalWriteSession(
  portalSession: PortalSessionRecord | null | undefined,
): Promise<AuthServiceResult<Session>> {
  if (!portalSession) {
    return { ok: false, error: 'Keine aktive Portalsitzung gefunden. Bitte erneut anmelden.' };
  }

  const client = getSupabaseClient();
  if (!client) {
    return { ok: false, error: 'Supabase ist nicht konfiguriert.' };
  }

  const current = await client.auth.getSession();
  if (!current.error && isPortalSupabaseSessionAligned(current.data.session, portalSession)) {
    return { ok: true, data: current.data.session! };
  }

  return refreshPortalSupabaseSession(portalSession);
}
