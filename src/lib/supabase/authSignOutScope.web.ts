import type { SupabaseClient } from '@supabase/supabase-js';

const TV_SESSION_KEY = 'caresuite.tv-device-session-id.v1';
const SESSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
let memorySessionId: string | null = null;
let memoryOnly = false;

function sessionIdFromToken(accessToken: string): string | null {
  try {
    const parts = accessToken.split('.');
    if (parts.length !== 3 || parts[1].length > 32_768) return null;
    const encoded = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = encoded.padEnd(Math.ceil(encoded.length / 4) * 4, '=');
    const payload: unknown = JSON.parse(atob(padded));
    if (!payload || typeof payload !== 'object' || !('session_id' in payload)) return null;
    const id = payload.session_id;
    return typeof id === 'string' && SESSION_ID.test(id) ? id : null;
  } catch {
    return null;
  }
}

function readTvSessionId(): string | null {
  if (typeof window === 'undefined') return null;
  if (memoryOnly) return memorySessionId;
  try {
    const stored = window.localStorage.getItem(TV_SESSION_KEY);
    // Prefer current browser storage so another tab's login/clear is respected.
    memorySessionId = stored && SESSION_ID.test(stored) ? stored : null;
  } catch {
    // Private/embedded TV browsers may deny storage while their current page works.
  }
  return memorySessionId;
}

/** Record only the non-secret session ID of the newly granted TV session. */
export function markTvDeviceSession(accessToken: string): boolean {
  if (typeof window === 'undefined') return false;
  const sessionId = sessionIdFromToken(accessToken);
  if (!sessionId) return false;
  memorySessionId = sessionId;
  try {
    window.localStorage.setItem(TV_SESSION_KEY, sessionId);
    memoryOnly = false;
  } catch {
    memoryOnly = true;
  }
  return true;
}

/** Scope selection only; decoding a JWT here never grants authentication. */
export function isTvDeviceSession(accessToken: string): boolean {
  const markedSessionId = readTvSessionId();
  return markedSessionId !== null && sessionIdFromToken(accessToken) === markedSessionId;
}

export function clearTvDeviceSession(): void {
  memorySessionId = null;
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(TV_SESSION_KEY);
    memoryOnly = false;
  } catch {
    // Ignore any stale persisted value if removal was blocked in this document.
    memoryOnly = true;
  }
}

export async function getAuthSignOutOptions(
  client: Pick<SupabaseClient, 'auth'>,
): Promise<{ scope: 'local' } | undefined> {
  if (!readTvSessionId()) return undefined;
  const { data, error } = await client.auth.getSession();
  // An indeterminate TV session must never silently turn into a global logout.
  if (error) throw error;
  return data.session && isTvDeviceSession(data.session.access_token)
    ? { scope: 'local' }
    : undefined;
}
