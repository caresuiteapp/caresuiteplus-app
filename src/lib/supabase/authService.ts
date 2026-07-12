import type {
  AuthChangeEvent,
  AuthError,
  Session,
  Subscription,
} from '@supabase/supabase-js';
import { getSupabaseClient } from './client';
import { getAuthRedirectBaseUrl, isDemoMode, isSupabaseConfigured } from './config';

export type AuthServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const AUTH_REQUEST_TIMEOUT_MS = 10_000;

async function withAuthRequestTimeout<T>(
  request: PromiseLike<T>,
  label: string,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      request,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`${label} hat zu lange gedauert.`));
        }, AUTH_REQUEST_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export function toGermanAuthError(error: AuthError | Error | null | undefined): string {
  if (!error) return 'Ein unerwarteter Anmeldefehler ist aufgetreten.';

  const msg = error.message ?? '';
  if (msg.includes('Invalid login credentials')) {
    return 'E-Mail oder Passwort ist falsch.';
  }
  if (msg.includes('Email not confirmed')) {
    return 'Bitte bestätigen Sie zuerst Ihre E-Mail-Adresse.';
  }
  if (msg.includes('User already registered')) {
    return 'Diese E-Mail-Adresse ist bereits registriert.';
  }
  if (msg.includes('Password should be at least')) {
    return 'Das Passwort erfüllt nicht die Mindestanforderungen.';
  }
  if (msg.includes('rate limit') || msg.includes('Rate limit')) {
    return 'Zu viele Anmeldeversuche. Bitte warten Sie einen Moment.';
  }
  if (msg.includes('Network') || msg.includes('fetch')) {
    return 'Netzwerkfehler. Bitte Verbindung prüfen und erneut versuchen.';
  }

  return 'Anmeldung fehlgeschlagen. Bitte erneut versuchen.';
}

function demoBypassError(): AuthServiceResult<never> {
  return {
    ok: false,
    error: 'Supabase-Authentifizierung ist im Demo-Modus nicht verfügbar.',
  };
}

function notConfiguredError(): AuthServiceResult<never> {
  return {
    ok: false,
    error: 'Supabase ist nicht konfiguriert.',
  };
}

export async function signInWithPassword(
  email: string,
  password: string,
): Promise<AuthServiceResult<Session>> {
  if (isDemoMode()) {
    return demoBypassError();
  }

  const client = getSupabaseClient();
  if (!client) {
    return notConfiguredError();
  }

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedPassword = password.trim();

  let result: Awaited<ReturnType<typeof client.auth.signInWithPassword>>;
  try {
    result = await withAuthRequestTimeout(
      client.auth.signInWithPassword({
        email: normalizedEmail,
        password: normalizedPassword,
      }),
      'Anmeldung',
    );
  } catch (cause) {
    return {
      ok: false,
      error:
        cause instanceof Error
          ? cause.message
          : 'Anmeldung hat zu lange gedauert. Bitte erneut versuchen.',
    };
  }

  const { data, error } = result;
  if (error || !data.session) {
    return { ok: false, error: toGermanAuthError(error) };
  }

  return { ok: true, data: data.session };
}

export async function signOut(): Promise<AuthServiceResult<null>> {
  if (isDemoMode()) {
    return { ok: true, data: null };
  }

  const client = getSupabaseClient();
  if (!client) {
    return { ok: true, data: null };
  }

  const { error } = await client.auth.signOut();
  if (error) {
    return { ok: false, error: toGermanAuthError(error) };
  }

  return { ok: true, data: null };
}

export async function getSession(): Promise<AuthServiceResult<Session | null>> {
  if (isDemoMode()) {
    return { ok: true, data: null };
  }

  const client = getSupabaseClient();
  if (!client) {
    return { ok: true, data: null };
  }

  let result: Awaited<ReturnType<typeof client.auth.getSession>>;
  try {
    result = await withAuthRequestTimeout(client.auth.getSession(), 'Sitzungsprüfung');
  } catch (cause) {
    return {
      ok: false,
      error:
        cause instanceof Error
          ? cause.message
          : 'Sitzungsprüfung hat zu lange gedauert.',
    };
  }

  const { data, error } = result;
  if (error) {
    return { ok: false, error: toGermanAuthError(error) };
  }

  return { ok: true, data: data.session };
}

export type AuthStateChangeCallback = (
  event: AuthChangeEvent,
  session: Session | null,
) => void;

export type AuthStateChangeHandle = {
  unsubscribe: () => void;
};

export function onAuthStateChange(
  callback: AuthStateChangeCallback,
): AuthStateChangeHandle {
  if (isDemoMode() || !isSupabaseConfigured()) {
    return { unsubscribe: () => {} };
  }

  const client = getSupabaseClient();
  if (!client) {
    return { unsubscribe: () => {} };
  }

  const { data } = client.auth.onAuthStateChange(callback);
  const subscription: Subscription = data.subscription;

  return {
    unsubscribe: () => subscription.unsubscribe(),
  };
}

export function getPasswordResetRedirectUrl(): string {
  return `${getAuthRedirectBaseUrl()}/auth/reset-password`;
}

export async function requestPasswordResetEmail(
  email: string,
): Promise<AuthServiceResult<null>> {
  if (isDemoMode()) {
    return demoBypassError();
  }

  const client = getSupabaseClient();
  if (!client) {
    return notConfiguredError();
  }

  const { error } = await client.auth.resetPasswordForEmail(email, {
    redirectTo: getPasswordResetRedirectUrl(),
  });
  if (error) {
    return { ok: false, error: toGermanAuthError(error) };
  }

  return { ok: true, data: null };
}

export async function updatePassword(password: string): Promise<AuthServiceResult<null>> {
  if (isDemoMode()) {
    return demoBypassError();
  }

  const client = getSupabaseClient();
  if (!client) {
    return notConfiguredError();
  }

  const { error } = await client.auth.updateUser({ password });
  if (error) {
    return { ok: false, error: toGermanAuthError(error) };
  }

  return { ok: true, data: null };
}
