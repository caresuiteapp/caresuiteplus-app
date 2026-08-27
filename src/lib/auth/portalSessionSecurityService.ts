import { invokeEdgeFunction } from '@/lib/supabase/edgeFunctions';

const SERVER_LOGOUT_TIMEOUT_MS = 2_500;

/** Best-effort server revocation; local/Supabase sign-out must still proceed offline. */
export async function revokePortalSession(sessionToken: string): Promise<void> {
  if (sessionToken.trim().length < 16) return;
  const result = await Promise.race([
    invokeEdgeFunction<{ ok: true }>('portal-session-logout', { sessionToken }),
    new Promise<{ ok: false; error: string }>((resolve) => {
      setTimeout(
        () => resolve({ ok: false, error: 'Server-Abmeldung wurde lokal fortgesetzt.' }),
        SERVER_LOGOUT_TIMEOUT_MS,
      );
    }),
  ]);
  if (!result.ok) {
    console.warn('[portalSessionSecurityService] server logout pending:', result.error);
  }
}
