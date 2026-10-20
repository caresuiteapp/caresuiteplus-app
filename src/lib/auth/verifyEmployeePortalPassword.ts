import { verifySecret } from './passwordHash';
import type { EmployeePortalLoginFailureClass } from './normalizePortalUsername';

export type EmployeePortalAccountRow = {
  temporary_password_hash?: string | null;
  temporary_password_expires_at?: string | null;
  first_login_completed?: boolean;
  status?: string;
};

export async function verifyEmployeePortalPassword(
  password: string,
  row: EmployeePortalAccountRow,
): Promise<{ ok: true } | { ok: false; reason: string; failureClass: EmployeePortalLoginFailureClass }> {
  const hash = row.temporary_password_hash ?? null;
  if (!hash) {
    return { ok: false, reason: 'Kein Passwort hinterlegt.', failureClass: 'password_missing' };
  }

  const expiresAt = row.temporary_password_expires_at ?? null;
  const firstLoginCompleted = Boolean(row.first_login_completed);

  if (!firstLoginCompleted && expiresAt && new Date(expiresAt).getTime() < Date.now()) {
    return { ok: false, reason: 'Einmalpasswort ist abgelaufen.', failureClass: 'password_expired' };
  }

  const valid = await verifySecret(password, hash);
  if (!valid) {
    return {
      ok: false,
      reason: 'Benutzername oder Passwort ist falsch.',
      failureClass: 'invalid_password',
    };
  }

  return { ok: true };
}
