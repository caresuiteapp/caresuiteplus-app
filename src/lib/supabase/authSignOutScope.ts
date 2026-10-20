import type { SupabaseClient } from '@supabase/supabase-js';

// Device pairing is a Web-only flow. Native keeps its existing global logout.
export function markTvDeviceSession(_accessToken: string): boolean { return false; }
export function isTvDeviceSession(_accessToken: string): boolean { return false; }
export function clearTvDeviceSession(): void {}
export async function getAuthSignOutOptions(
  _client: Pick<SupabaseClient, 'auth'>,
): Promise<{ scope: 'local' } | undefined> { return undefined; }
