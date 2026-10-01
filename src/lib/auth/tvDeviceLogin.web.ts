import { getSupabaseConfig, isDemoMode } from '@/lib/supabase/config';
import { getSupabaseClient } from '@/lib/supabase/client';
import type { PortalSessionRecord } from './portalSessionStore';

export type TvLoginRole = 'administration' | 'employee' | 'client';
export type TvLoginStatus = 'pending' | 'approved' | 'consumed' | 'denied' | 'expired' | 'cancelled' | 'failed';
export type TvLoginChallenge = {
  id: string;
  deviceSecret: string;
  userCode: string;
  verificationCode: string;
  expiresAt: string;
};
export type TvLoginInspection = {
  role: TvLoginRole;
  status: TvLoginStatus;
  verificationCode: string;
  expiresAt: string;
};
export type TvLoginSession = {
  role: TvLoginRole;
  status: 'consumed';
  supabaseAccessToken: string;
  supabaseRefreshToken: string;
  portalSession?: PortalSessionRecord;
};
export const TV_LOGIN_ROLES: ReadonlyArray<{ role: TvLoginRole; title: string; description: string; loginPath: string }> = [
  { role: 'administration', title: 'Verwaltung', description: 'Organisation, Planung und Überblick', loginPath: '/auth/business-login' },
  { role: 'employee', title: 'Mitarbeitende', description: 'Einsätze, Zeiten und Dokumentation', loginPath: '/auth/employee-login' },
  { role: 'client', title: 'Klient:innen', description: 'Termine, Dokumente und Nachrichten', loginPath: '/auth/client-login' },
];
export const isTvUserCode = (code: unknown): code is string => typeof code === 'string' && /^[A-Za-z0-9_-]{43}$/.test(code);
export const isTvRole = (role: unknown): role is TvLoginRole => TV_LOGIN_ROLES.some((entry) => entry.role === role);
const statuses: TvLoginStatus[] = ['pending', 'approved', 'consumed', 'denied', 'expired', 'cancelled', 'failed'];
const unavailable = 'Die QR-Anmeldung ist derzeit nicht verfügbar. Bitte später erneut versuchen oder die normale Anmeldung verwenden.';

async function request<T>(body: Record<string, unknown>, signal?: AbortSignal, authenticated = false): Promise<T> {
  const { url, anonKey } = getSupabaseConfig();
  if (!url || !anonKey || isDemoMode()) throw new Error(unavailable);
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(abort, 15_000);
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json', apikey: anonKey };
    if (authenticated) {
      const client = getSupabaseClient();
      const result = await client?.auth.getSession();
      if (!result?.data.session?.access_token) throw new Error('Bitte zuerst auf diesem Handy anmelden.');
      headers.Authorization = `Bearer ${result.data.session.access_token}`;
    }
    const response = await fetch(`${url.replace(/\/$/, '')}/functions/v1/tv-device-login`, {
      method: 'POST', headers, body: JSON.stringify(body), signal: controller.signal,
      cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer',
    });
    const payload = await response.json().catch(() => null) as (T & { ok?: boolean; error?: unknown }) | null;
    if (!response.ok || payload?.ok !== true) {
      if (response.status >= 500 || response.status === 404 || !payload) throw new Error(unavailable);
      throw new Error(typeof payload.error === 'string' ? payload.error : 'Die Geräteanmeldung konnte nicht bestätigt werden. Bitte einen neuen QR-Code anfordern.');
    }
    return payload;
  } catch (error) {
    if (signal?.aborted) throw new DOMException('Abgebrochen', 'AbortError');
    if (controller.signal.aborted) throw new Error('Die Verbindung antwortet nicht. Bitte erneut versuchen.');
    if (error instanceof TypeError) throw new Error(unavailable);
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}

export async function createTvLogin(role: TvLoginRole, signal?: AbortSignal): Promise<TvLoginChallenge> {
  const data = await request<TvLoginChallenge>({ action: 'create', role }, signal);
  if (!data.id || typeof data.deviceSecret !== 'string' || data.deviceSecret.length < 32 || !isTvUserCode(data.userCode) || !/^\d{6}$/.test(data.verificationCode) || !Number.isFinite(Date.parse(data.expiresAt))) throw new Error(unavailable);
  return data;
}
export async function inspectTvLogin(userCode: string, signal?: AbortSignal): Promise<TvLoginInspection> {
  if (!isTvUserCode(userCode)) throw new Error('Dieser QR-Link ist ungültig. Bitte den aktuellen Code am TV erneut scannen.');
  const data = await request<TvLoginInspection>({ action: 'inspect', userCode }, signal);
  if (!isTvRole(data.role) || !statuses.includes(data.status) || !/^\d{6}$/.test(data.verificationCode) || !Number.isFinite(Date.parse(data.expiresAt))) throw new Error(unavailable);
  return data;
}
export async function pollTvLogin(challenge: TvLoginChallenge, signal?: AbortSignal) {
  const data = await request<{ status: TvLoginStatus; role: TvLoginRole; expiresAt: string }>({ action: 'poll', id: challenge.id, deviceSecret: challenge.deviceSecret }, signal);
  if (!isTvRole(data.role) || !statuses.includes(data.status) || !Number.isFinite(Date.parse(data.expiresAt))) throw new Error(unavailable);
  return data;
}
export const cancelTvLogin = (challenge: TvLoginChallenge) => request({ action: 'cancel', id: challenge.id, deviceSecret: challenge.deviceSecret });
export const consumeTvLogin = (challenge: TvLoginChallenge, signal?: AbortSignal) => request<TvLoginSession>({ action: 'consume', id: challenge.id, deviceSecret: challenge.deviceSecret }, signal);
export const decideTvLogin = (userCode: string, verificationCode: string, decision: 'approve' | 'deny', portalSessionToken?: string, signal?: AbortSignal) => request({ action: decision, userCode, verificationCode, confirmed: true, ...(portalSessionToken ? { portalSessionToken } : {}) }, signal, true);

/** Only the random public challenge code enters the QR. TV secrets stay in memory. */
export function tvConfirmationUrl(userCode: string, origin: string): string {
  if (!isTvUserCode(userCode)) throw new Error('Ungültige Geräteanfrage.');
  return `${new URL(origin).origin}/device/confirm?code=${encodeURIComponent(userCode)}`;
}
