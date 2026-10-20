import { verifySecret } from './crypto.ts';
import type { EmployeePortalLoginFailureClass } from './portalUsername.ts';

export async function verifyEmployeePortalPassword(
  password: string,
  row: Record<string, unknown>,
): Promise<{ ok: true } | { ok: false; reason: string; failureClass: EmployeePortalLoginFailureClass }> {
  const hash = row.temporary_password_hash as string | null;
  if (!hash) {
    return { ok: false, reason: 'Kein Passwort hinterlegt.', failureClass: 'password_missing' };
  }

  const expiresAt = row.temporary_password_expires_at as string | null;
  const firstLoginCompleted = row.first_login_completed as boolean;

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
