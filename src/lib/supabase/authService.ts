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

  const { data, error } = await client.auth.signInWithPassword({ email, password });
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

  const { data, error } = await client.auth.getSession();
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
