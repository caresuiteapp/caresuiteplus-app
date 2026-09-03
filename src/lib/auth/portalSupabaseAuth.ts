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

export type PortalWriteCapability = 'session' | 'messages' | 'workflow';

const PORTAL_SESSION_CHECK_TIMEOUT_MS = 12_000;

async function withPortalSessionTimeout<T>(operation: PromiseLike<T>): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error('Zeitüberschreitung bei der sicheren Sitzungsprüfung.')),
          PORTAL_SESSION_CHECK_TIMEOUT_MS,
        );
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

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
  try {
    const refreshed = await withPortalSessionTimeout(invokeEdgeFunction<{
      supabaseAccessToken?: string;
      supabaseRefreshToken?: string;
    }>('portal-session-refresh', { sessionToken: portalSession.sessionToken }));
    if (!refreshed.ok) return refreshed;
    const tokens = mapPortalSupabaseTokensFromEdge(refreshed.data);
    if (!tokens) {
      return { ok: false, error: 'Die erneuerte Portalsitzung enthält keine Schreibberechtigung.' };
    }
    return await withPortalSessionTimeout(signInWithPortalSupabaseTokens(tokens));
  } catch (cause) {
    return {
      ok: false,
      error:
        cause instanceof Error && cause.message.includes('Zeitüberschreitung')
          ? 'Die sichere Sitzung antwortet nicht. Bitte Verbindung prüfen und erneut versuchen.'
          : 'Die sichere Sitzung konnte nicht erneuert werden. Bitte erneut anmelden.',
    };
  }
}

/**
 * Verifies the real Supabase/RLS identity immediately before a portal write.
 * Existing portal UI state is not evidence of a writable database session:
 * after an app update the opaque portal session can outlive an old Supabase JWT.
 */
export async function ensurePortalWriteSession(
  portalSession: PortalSessionRecord | null | undefined,
  capability: PortalWriteCapability = 'session',
): Promise<AuthServiceResult<Session>> {
  if (!portalSession) {
    return { ok: false, error: 'Keine aktive Portalsitzung gefunden. Bitte erneut anmelden.' };
  }

  const client = getSupabaseClient();
  if (!client) {
    return { ok: false, error: 'Supabase ist nicht konfiguriert.' };
  }

  try {
    const current = await withPortalSessionTimeout(client.auth.getSession());
    let session: Session;
    if (!current.error && isPortalSupabaseSessionAligned(current.data.session, portalSession)) {
      session = current.data.session!;
    } else {
      const refreshed = await refreshPortalSupabaseSession(portalSession);
      if (!refreshed.ok) return refreshed;
      session = refreshed.data;
    }

    if (capability !== 'session') {
      const runtimeClient = client as unknown as {
        rpc: (
          name: string,
          args: Record<string, unknown>,
        ) => PromiseLike<{
          data: unknown;
          error: { message?: string } | null;
        }>;
      };
      const probe = await withPortalSessionTimeout(
        runtimeClient.rpc('portal_runtime_write_probe', { p_capability: capability }),
      );
      if (probe.error) {
        return {
          ok: false,
          error: `Produktionsprüfung fehlgeschlagen: ${probe.error.message?.trim() || 'Datenbankfunktion nicht verfügbar.'}`,
        };
      }
      const payload = probe.data as { ok?: boolean; error?: string } | null;
      if (!payload?.ok) {
        return {
          ok: false,
          error: payload?.error?.trim() || 'Die produktive Schreibberechtigung fehlt.',
        };
      }
    }

    return { ok: true, data: session };
  } catch {
    return {
      ok: false,
      error: 'Die sichere Sitzung antwortet nicht. Bitte Verbindung prüfen und erneut versuchen.',
    };
  }
}
