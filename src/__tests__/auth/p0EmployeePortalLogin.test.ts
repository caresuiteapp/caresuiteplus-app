import { describe, expect, it } from 'vitest';
import {
  classifyEmployeePortalLoginFailure,
  normalizePortalUsername,
} from '@/lib/auth/normalizePortalUsername';
import { verifyEmployeePortalPassword } from '@/lib/auth/verifyEmployeePortalPassword';
import { hashSecret } from '@/lib/auth/passwordHash';

describe('normalizePortalUsername', () => {
  it('trims and lowercases usernames', () => {
    expect(normalizePortalUsername('  helfe.Mhia.Jlelat  ')).toBe('helfe.mhia.jlelat');
    expect(normalizePortalUsername('audit-employee@caresuiteplus.test')).toBe(
      'audit-employee@caresuiteplus.test',
    );
  });
});

describe('classifyEmployeePortalLoginFailure', () => {
  it('classifies blocked accounts', () => {
    expect(
      classifyEmployeePortalLoginFailure({
        matches: 1,
        blocked: true,
        archived: false,
        duplicateActive: false,
        passwordMissing: false,
        passwordExpired: false,
      }),
    ).toBe('account_blocked');
  });

  it('classifies duplicate active accounts', () => {
    expect(
      classifyEmployeePortalLoginFailure({
        matches: 2,
        blocked: false,
        archived: false,
        duplicateActive: true,
        passwordMissing: false,
        passwordExpired: false,
      }),
    ).toBe('duplicate_accounts');
  });

  it('classifies missing password hash', () => {
    expect(
      classifyEmployeePortalLoginFailure({
        matches: 1,
        blocked: false,
        archived: false,
        duplicateActive: false,
        passwordMissing: true,
        passwordExpired: false,
      }),
    ).toBe('password_missing');
  });
});

describe('verifyEmployeePortalPassword', () => {
  it('accepts matching audit password hash', async () => {
    const password = 'CareSuiteEmployee2026!';
    const hash = await hashSecret(password, 'cs-test');
    const result = await verifyEmployeePortalPassword(password, {
      temporary_password_hash: hash,
      first_login_completed: true,
      temporary_password_expires_at: null,
    });
    expect(result.ok).toBe(true);
  });

  it('rejects wrong password', async () => {
    const hash = await hashSecret('correct-password', 'cs-test');
    const result = await verifyEmployeePortalPassword('wrong-password', {
      temporary_password_hash: hash,
      first_login_completed: true,
      temporary_password_expires_at: null,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failureClass).toBe('invalid_password');
    }
  });

  it('rejects expired one-time password before first login', async () => {
    const password = 'CareSuiteEmployee2026!';
    const hash = await hashSecret(password, 'cs-expired');
    const result = await verifyEmployeePortalPassword(password, {
      temporary_password_hash: hash,
      first_login_completed: false,
      temporary_password_expires_at: '2020-01-01T00:00:00.000Z',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failureClass).toBe('password_expired');
    }
  });

  it('rejects deactivated account without password hash', async () => {
    const result = await verifyEmployeePortalPassword('any', {
      temporary_password_hash: null,
      first_login_completed: true,
      temporary_password_expires_at: null,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failureClass).toBe('password_missing');
    }
  });
});
