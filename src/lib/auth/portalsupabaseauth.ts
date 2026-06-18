import type { Session } from '@supabase/supabase-js';
import type { AuthServiceResult } from '@/lib/supabase/authService';
import { toGermanAuthError } from '@/lib/supabase/authService';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isDemoMode } from '@/lib/supabase/config';

export type PortalSupabaseTokens = {
  accessToken: string;
  refreshToken: string;
};

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
