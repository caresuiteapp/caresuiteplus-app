import type { ServiceResult } from '@/types';

export type PasswordResetInfo = {
  channel: 'office_admin';
  message: string;
};

/** Passwort-Rücksetzung — nur über Office/Verwaltung */
export async function fetchPasswordResetInfo(): Promise<ServiceResult<PasswordResetInfo>> {
  await new Promise((r) => setTimeout(r, 80));
  return {
    ok: true,
    data: {
      channel: 'office_admin',
      message:
        'Passwort-Rücksetzungen werden ausschließlich über CareSuite+ Office / Verwaltung ausgelöst.',
    },
  };
}
