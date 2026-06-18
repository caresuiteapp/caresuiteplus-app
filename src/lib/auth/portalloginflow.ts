import type { ServiceResult } from '@/types';
import type { PortalSessionRecord } from './portalSessionStore';
import {
  mapPortalSupabaseTokensFromEdge,
  signInWithPortalSupabaseTokens,
  type PortalSupabaseTokens,
} from './portalsupabaseauth';

export type PortalLoginResult = {
  portalSession: PortalSessionRecord;
  supabaseTokens: PortalSupabaseTokens | null;
};

/** Persists portal session and optionally establishes Supabase auth for RLS-backed services. */
export async function completePortalLogin(
  portalSession: PortalSessionRecord,
  edgeData?: { supabaseAccessToken?: string; supabaseRefreshToken?: string },
): Promise<ServiceResult<PortalLoginResult>> {
  const supabaseTokens = edgeData ? mapPortalSupabaseTokensFromEdge(edgeData) : null;

  if (supabaseTokens) {
    const sessionResult = await signInWithPortalSupabaseTokens(supabaseTokens);
    if (!sessionResult.ok) {
      return { ok: false, error: sessionResult.error };
    }
  }

  return {
    ok: true,
    data: { portalSession, supabaseTokens },
  };
}
