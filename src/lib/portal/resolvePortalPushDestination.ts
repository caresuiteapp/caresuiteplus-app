import { getActivePortalSession, type PortalSessionRecord } from '@/lib/auth/portalSessionStore';
import { getSupabaseClient } from '@/lib/supabase/client';
import { portalPushDestination } from './portalPushNavigation';

const NOTIFICATION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LOOKUP_TIMEOUT_MS = 12_000;

function isCurrentSession(session: PortalSessionRecord): boolean {
  const current = getActivePortalSession();
  return !!current && !current.mustChangePassword &&
    current.sessionToken === session.sessionToken &&
    current.accountId === session.accountId && current.tenantId === session.tenantId &&
    current.roleKey === session.roleKey &&
    new Date(current.expiresAt).getTime() > Date.now();
}

/** Expo receives only an opaque ID. Resolve its destination inside the signed-in backend. */
export async function resolvePortalPushDestination(
  data: Record<string, unknown> | undefined,
  session: PortalSessionRecord | null,
): Promise<string | null> {
  if (!data || !session || !isCurrentSession(session)) return null;
  if (!('notificationId' in data)) return portalPushDestination(data, session);
  if (typeof data.notificationId !== 'string' || !NOTIFICATION_ID.test(data.notificationId)) return null;

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const client = getSupabaseClient();
    if (!client) return null;
    // The deployed additive RPC is newer than the repository's generated schema.
    // Limit that schema gap to this single RPC call; validate its response below.
    const result = await Promise.race([
      client.rpc('portal_push_resolve_destination' as never, {
        p_notification_id: data.notificationId,
        p_expected_account_id: session.accountId,
      } as never),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Push destination lookup timed out')), LOOKUP_TIMEOUT_MS);
      }),
    ]);
    const rows: unknown = result.data;
    if (result.error || !isCurrentSession(session) || !Array.isArray(rows) || rows.length !== 1) return null;
    const row: unknown = rows[0];
    if (!row || typeof row !== 'object') return null;
    const resolved = row as Record<string, unknown>;
    return portalPushDestination({
      route: resolved.route,
      accountId: resolved.account_id,
      tenantId: resolved.tenant_id,
    }, session);
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
