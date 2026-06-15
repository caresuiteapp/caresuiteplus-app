import type { ServiceResult } from '@/types';
import { getServiceMode } from '@/lib/services/mode';
import { requestPasswordResetEmail } from '@/lib/supabase/authService';

export type PasswordResetInfo = {
  channel: 'supabase_email' | 'office_admin';
  message: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function fetchPasswordResetInfo(): Promise<ServiceResult<PasswordResetInfo>> {
  if (getServiceMode() === 'supabase') {
    return {
      ok: true,
      data: {
        channel: 'supabase_email',
        message:
          'Geben Sie Ihre E-Mail-Adresse ein. Sie erhalten einen Link zum Zurücksetzen des Passworts.',
      },
    };
  }

  return {
    ok: true,
    data: {
      channel: 'office_admin',
      message:
        'Passwort-Rücksetzungen werden im Demo-Modus über CareSuite+ Office / Verwaltung ausgelöst.',
    },
  };
}

export async function requestBusinessPasswordReset(
  contact: string,
): Promise<ServiceResult<{ message: string; bridgePath?: string }>> {
  const email = contact.trim().toLowerCase();

  if (!email) {
    return { ok: false, error: 'Bitte geben Sie Ihre E-Mail-Adresse ein.' };
  }

  if (!EMAIL_PATTERN.test(email)) {
    return { ok: false, error: 'Bitte geben Sie eine gültige E-Mail-Adresse ein.' };
  }

  if (getServiceMode() !== 'supabase') {
    return {
      ok: false,
      error: 'Passwort-Rücksetzung ist im Demo-Modus nicht verfügbar. Bitte wenden Sie sich an die Verwaltung.',
    };
  }

  const result = await requestPasswordResetEmail(email);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  return {
    ok: true,
    data: {
      message:
        'Falls ein Konto mit dieser E-Mail existiert, wurde ein Link zum Zurücksetzen des Passworts versendet. Bitte prüfen Sie auch den Spam-Ordner.',
      bridgePath: '/auth/recovery-bridge',
    },
  };
}
