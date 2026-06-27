import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { registerBusinessTenant, loginBusinessUser } from '@/lib/auth/businessAuthService';
import { loginEmployeePortal } from '@/lib/auth/employeePortalAuthService';
import { validatePortalCodeLogin } from '@/lib/auth/clientPortalAuthService';
import { getServiceMode } from '@/lib/services/mode';

vi.mock('react-native-url-polyfill/auto', () => ({}));
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

const invokeEdgeFunction = vi.fn();
vi.mock('@/lib/supabase/edgeFunctions', () => ({
  invokeEdgeFunction: (...args: unknown[]) => invokeEdgeFunction(...args),
}));

const signInWithPassword = vi.fn();
vi.mock('@/lib/supabase/authService', () => ({
  signInWithPassword: (...args: unknown[]) => signInWithPassword(...args),
}));

describe('liveSupabaseAuthServices', () => {
  beforeEach(() => {
    invokeEdgeFunction.mockReset();
    signInWithPassword.mockReset();
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'false');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', 'anon-key');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('uses supabase service mode', () => {
    expect(getServiceMode()).toBe('supabase');
  });

  it('registers business tenant via edge function and signs in', async () => {
    invokeEdgeFunction.mockResolvedValue({
      ok: true,
      data: {
        tenantId: 'tenant-1',
        owner: {
          id: 'owner-1',
          tenantId: 'tenant-1',
          username: 'helfe.kevi.reinhar',
          roleKey: 'owner',
          email: 'kevin@helferhasen.app',
          displayName: 'Kevin Reinhardt',
        },
        credentials: { username: 'helfe.kevi.reinhar' },
      },
    });
    signInWithPassword.mockResolvedValue({
      ok: true,
      data: { user: { id: 'auth-1' }, access_token: 'token' },
    });

    const result = await registerBusinessTenant({
      companyName: 'Helferhasen+ UG',
      legalForm: 'UG',
      industry: 'Betreuung',
      street: 'Test 1',
      zip: '10115',
      city: 'Berlin',
      phone: '+49 30 123',
      email: 'info@helferhasen.app',
      contactFirstName: 'Kevin',
      contactLastName: 'Reinhardt',
      contactRole: 'GF',
      adminFirstName: 'Kevin',
      adminLastName: 'Reinhardt',
      adminEmail: 'kevin@helferhasen.app',
      adminPassword: 'SecurePass1',
      selectedModules: ['assist'],
    });

    expect(invokeEdgeFunction).toHaveBeenCalledWith('register-business-tenant', expect.any(Object));
    expect(signInWithPassword).toHaveBeenCalledWith('kevin@helferhasen.app', 'SecurePass1');
    expect(result.ok).toBe(true);
  });

  it('logs in employee portal via edge function', async () => {
    invokeEdgeFunction.mockResolvedValue({
      ok: true,
      data: {
        account: {
          id: 'epa-1',
          tenantId: 'tenant-1',
          employeeId: 'emp-1',
          username: 'helfe.max.must',
          status: 'pending_first_login',
          mustChangePassword: true,
          firstLoginCompleted: false,
          temporaryPasswordCreatedAt: null,
          temporaryPasswordExpiresAt: null,
          lastLoginAt: null,
          createdBy: null,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
          blockedAt: null,
          blockedBy: null,
          blockedReason: null,
        },
        mustChangePassword: true,
        sessionToken: 'session-token',
        expiresAt: '2026-01-02T00:00:00.000Z',
        supabaseAccessToken: 'access-token',
        supabaseRefreshToken: 'refresh-token',
      },
    });

    const result = await loginEmployeePortal('helfe.max.must', 'TempPass1!');
    expect(invokeEdgeFunction).toHaveBeenCalledWith('employee-portal-login', {
      username: 'helfe.max.must',
      password: 'TempPass1!',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.portalSession?.sessionToken).toBe('session-token');
      expect(result.data.portalSession?.mustChangePassword).toBe(true);
      expect(result.data.mustChangePassword).toBe(true);
    }
  });

  it('completes employee first login via edge function', async () => {
    invokeEdgeFunction.mockResolvedValueOnce({
      ok: true,
      data: {
        account: {
          id: 'epa-1',
          tenantId: 'tenant-1',
          employeeId: 'emp-1',
          username: 'helfe.max.must',
          status: 'active',
          mustChangePassword: false,
          firstLoginCompleted: true,
          temporaryPasswordCreatedAt: null,
          temporaryPasswordExpiresAt: null,
          lastLoginAt: null,
          createdBy: null,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
          blockedAt: null,
          blockedBy: null,
          blockedReason: null,
        },
      },
    });

    const { completeFirstLogin } = await import('@/lib/auth/employeePortalAuthService');
    const result = await completeFirstLogin({
      accountId: 'epa-1',
      sessionToken: 'session-token',
      newPassword: 'NeuesPasswort1',
      confirmPassword: 'NeuesPasswort1',
    });

    expect(invokeEdgeFunction).toHaveBeenCalledWith('employee-portal-complete-first-login', {
      accountId: 'epa-1',
      sessionToken: 'session-token',
      newPassword: 'NeuesPasswort1',
      confirmPassword: 'NeuesPasswort1',
      currentPassword: undefined,
    });
    expect(result.ok).toBe(true);
  });

  it('validates client portal login via edge function with username and code', async () => {
    invokeEdgeFunction.mockResolvedValue({
      ok: true,
      data: {
        portalAccountId: 'cpc-1',
        tenantId: 'tenant-1',
        clientId: 'client-1',
        portalType: 'client',
        sessionToken: 'portal-token',
        expiresAt: '2026-01-02T00:00:00.000Z',
        supabaseAccessToken: 'access-token',
        supabaseRefreshToken: 'refresh-token',
      },
    });

    const result = await validatePortalCodeLogin('AB12CD', 'client', 'max.mustermann');
    expect(invokeEdgeFunction).toHaveBeenCalledWith('client-portal-login', {
      username: 'max.mustermann',
      code: 'AB12CD',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.portalSession?.sessionToken).toBe('portal-token');
      expect(result.data.portalSession?.clientId).toBe('client-1');
      expect(result.data.supabaseAccessToken).toBe('access-token');
    }
  });

  it('delegates business login to supabase auth in live mode', async () => {
    signInWithPassword.mockResolvedValue({
      ok: false,
      error: 'E-Mail oder Passwort ist falsch.',
    });

    const result = await loginBusinessUser('admin@example.com', 'wrong');
    expect(signInWithPassword).toHaveBeenCalled();
    expect(result.ok).toBe(false);
  });
});

describe('PortalCodeLoginScreen', () => {
  it('collects username and portal code for client login', () => {
    const source = readFileSync(
      path.join(__dirname, '..', '..', 'screens', 'auth', 'PortalCodeLoginScreen.tsx'),
      'utf8',
    );
    expect(source).toContain('Anmeldung Klient:innen Portal');
    expect(source).toContain('Benutzername');
    expect(source).toContain('Portal-Code (6-stellig)');
    expect(source).toContain('loginClientPortal');
    expect(source).toContain('completePortalLogin');
    expect(source).not.toContain('AuthLoginHero');
  });
});
