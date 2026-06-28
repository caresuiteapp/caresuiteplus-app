/**
 * Resolve Google Maps JavaScript API key for browser use.
 * Priority: EXPO_PUBLIC env → tenant_runtime_settings → maps-runtime-config edge function.
 * Never commit API keys to the repo.
 */

import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { isMissingTableError } from '@/lib/supabase/missingtablefallback';

let cachedKey: string | null | undefined;
let cacheExpiresAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

function readExpoPublicKey(): string | null {
  const key = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();
  return key || null;
}

async function fetchTenantRuntimeKey(tenantId: string): Promise<string | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await fromUnknownTable(supabase, 'tenant_runtime_settings')
    .select('setting_value')
    .eq('tenant_id', tenantId)
    .eq('setting_key', 'google_maps_browser_key')
    .maybeSingle();

  if (error) {
    if (!isMissingTableError(error)) {
      console.warn('[getGoogleMapsBrowserKey] tenant_runtime_settings:', error.message);
    }
    return null;
  }

  const value = (data as { setting_value?: string | null } | null)?.setting_value?.trim();
  return value || null;
}

async function fetchEdgeRuntimeKey(): Promise<string | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase.functions.invoke('maps-runtime-config', {
      body: {},
    });

    if (error) {
      console.warn('[getGoogleMapsBrowserKey] maps-runtime-config:', error.message);
      return null;
    }

    const payload = data as { ok?: boolean; browserKey?: string | null } | null;
    if (payload?.ok && payload.browserKey?.trim()) {
      return payload.browserKey.trim();
    }
  } catch (err) {
    console.warn('[getGoogleMapsBrowserKey] edge invoke failed:', err);
  }

  return null;
}

export function resetGoogleMapsBrowserKeyCacheForTests(): void {
  cachedKey = undefined;
  cacheExpiresAt = 0;
}

/** Returns browser-safe Google Maps API key or null if unavailable. */
export async function getGoogleMapsBrowserKey(tenantId?: string | null): Promise<string | null> {
  const expoKey = readExpoPublicKey();
  if (expoKey) return expoKey;

  const now = Date.now();
  if (cachedKey !== undefined && now < cacheExpiresAt) {
    return cachedKey;
  }

  let key: string | null = null;

  if (tenantId?.trim()) {
    key = await fetchTenantRuntimeKey(tenantId);
  }

  if (!key) {
    key = await fetchEdgeRuntimeKey();
  }

  cachedKey = key;
  cacheExpiresAt = now + CACHE_TTL_MS;
  return key;
}

/** Sync check — true only when EXPO_PUBLIC key is present (no async fetch). */
export function isGoogleMapsBrowserKeyConfiguredSync(): boolean {
  return Boolean(readExpoPublicKey());
}
