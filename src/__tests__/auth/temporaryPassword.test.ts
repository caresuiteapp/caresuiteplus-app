import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createTemporaryPasswordRecord,
  generateTemporaryPassword,
  validatePermanentPassword,
  verifyTemporaryPassword,
  DEFAULT_TEMP_PASSWORD_POLICY,
} from '@/lib/auth/temporaryPassword';

describe('temporaryPassword', () => {
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0.42);
  });

  it('generates passwords with required complexity', () => {
    const password = generateTemporaryPassword();
    expect(password.length).toBeGreaterThanOrEqual(DEFAULT_TEMP_PASSWORD_POLICY.minLength);
    expect(/[A-Z]/.test(password)).toBe(true);
    expect(/[a-z]/.test(password)).toBe(true);
    expect(/[0-9]/.test(password)).toBe(true);
  });

  it('stores only hashed records', async () => {
    const plain = 'TempPass123!';
    const record = await createTemporaryPasswordRecord(plain);
    expect(record.hash).not.toBe(plain);
    expect(record.consumedAt).toBeNull();
  });

  it('rejects consumed temporary passwords', async () => {
    const plain = generateTemporaryPassword();
    const record = await createTemporaryPasswordRecord(plain);
    record.consumedAt = new Date().toISOString();
    const result = await verifyTemporaryPassword(plain, record);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/bereits verwendet/);
    }
  });

  it('rejects expired temporary passwords', async () => {
    const plain = generateTemporaryPassword();
    const record = await createTemporaryPasswordRecord(plain, {
      ...DEFAULT_TEMP_PASSWORD_POLICY,
      expiresInHours: 0,
    });
    record.expiresAt = new Date(Date.now() - 1000).toISOString();
    const result = await verifyTemporaryPassword(plain, record);
    expect(result.ok).toBe(false);
  });

  it('validates permanent password rules', () => {
    expect(validatePermanentPassword('Short1', 'Short1')).toMatch(/10 Zeichen/);
    expect(validatePermanentPassword('alllowercase1', 'alllowercase1')).toMatch(/Groß/);
    expect(validatePermanentPassword('ValidPass1', 'ValidPass1')).toMatch(/Sonderzeichen/);
    expect(validatePermanentPassword('ValidPass1!', 'ValidPass1!')).toBeNull();
    expect(validatePermanentPassword('ValidPass1!', 'OtherPass1!')).toMatch(/stimmen nicht/);
    expect(
      validatePermanentPassword('ValidPass1!', 'ValidPass1!', { rejectPassword: 'ValidPass1!' }),
    ).toMatch(/Einmalpasswort/);
  });
});
