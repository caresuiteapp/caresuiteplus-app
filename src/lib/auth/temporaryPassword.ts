import type { ISODateTime } from '@/types/core/base';
import { hashSecret, verifySecret } from './passwordHash';

const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWER = 'abcdefghijkmnpqrstuvwxyz';
const DIGITS = '23456789';
const SPECIAL = '!@#$%&*?';
const ALL = `${UPPER}${LOWER}${DIGITS}${SPECIAL}`;

export type TemporaryPasswordRecord = {
  hash: string;
  createdAt: ISODateTime;
  expiresAt: ISODateTime | null;
  consumedAt: ISODateTime | null;
};

export type TemporaryPasswordPolicy = {
  minLength: number;
  includeSpecial: boolean;
  expiresInHours: number | null;
};

export const DEFAULT_TEMP_PASSWORD_POLICY: TemporaryPasswordPolicy = {
  minLength: 10,
  includeSpecial: true,
  expiresInHours: 72,
};

function randomChar(pool: string): string {
  const index = Math.floor(Math.random() * pool.length);
  return pool[index] ?? 'a';
}

export function generateTemporaryPassword(
  policy: TemporaryPasswordPolicy = DEFAULT_TEMP_PASSWORD_POLICY,
): string {
  const required = [
    randomChar(UPPER),
    randomChar(LOWER),
    randomChar(DIGITS),
    ...(policy.includeSpecial ? [randomChar(SPECIAL)] : []),
  ];

  while (required.length < policy.minLength) {
    required.push(randomChar(ALL));
  }

  for (let index = required.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [required[index], required[swapIndex]] = [required[swapIndex], required[index]];
  }

  return required.join('');
}

export async function createTemporaryPasswordRecord(
  plainPassword: string,
  policy: TemporaryPasswordPolicy = DEFAULT_TEMP_PASSWORD_POLICY,
): Promise<TemporaryPasswordRecord> {
  const createdAt = new Date().toISOString();
  const expiresAt =
    policy.expiresInHours == null
      ? null
      : new Date(Date.now() + policy.expiresInHours * 60 * 60 * 1000).toISOString();

  return {
    hash: await hashSecret(plainPassword),
    createdAt,
    expiresAt,
    consumedAt: null,
  };
}

export async function verifyTemporaryPassword(
  plainPassword: string,
  record: TemporaryPasswordRecord | null | undefined,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!record) {
    return { ok: false, reason: 'Kein gültiges Einmalpasswort hinterlegt.' };
  }
  if (record.consumedAt) {
    return { ok: false, reason: 'Einmalpasswort wurde bereits verwendet.' };
  }
  if (record.expiresAt && new Date(record.expiresAt).getTime() < Date.now()) {
    return { ok: false, reason: 'Einmalpasswort ist abgelaufen.' };
  }

  const valid = await verifySecret(plainPassword, record.hash);
  if (!valid) {
    return { ok: false, reason: 'Benutzername oder Passwort ist falsch.' };
  }

  return { ok: true };
}

export function validatePermanentPassword(password: string, confirmPassword: string): string | null {
  if (password.length < 10) {
    return 'Das Passwort muss mindestens 10 Zeichen haben.';
  }
  if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
    return 'Das Passwort muss Groß-, Kleinbuchstaben und Zahlen enthalten.';
  }
  if (password !== confirmPassword) {
    return 'Passwörter stimmen nicht überein.';
  }
  return null;
}
