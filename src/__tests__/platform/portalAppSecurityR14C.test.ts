import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { hashSecret, needsSecretRehash, verifySecret } from '@/lib/auth/passwordHash';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

describe('R14-C portal app security', () => {
  it('uses PBKDF2 with random per-record salts and verifies credentials', async () => {
    const first = await hashSecret('CareSuite-Sicher-2026!');
    const second = await hashSecret('CareSuite-Sicher-2026!');

    expect(first).toMatch(/^pbkdf2-sha256:310000:[a-f0-9]{32}:[a-f0-9]{64}$/);
    expect(second).toMatch(/^pbkdf2-sha256:310000:[a-f0-9]{32}:[a-f0-9]{64}$/);
    expect(first).not.toBe(second);
    await expect(verifySecret('CareSuite-Sicher-2026!', first)).resolves.toBe(true);
    await expect(verifySecret('falsch', first)).resolves.toBe(false);
    expect(needsSecretRehash(first)).toBe(false);
  });

  it('accepts valid legacy SHA-256 only for automatic migration', async () => {
    const salt = 'legacy-salt';
    const value = 'AltesPasswort1!';
    const digest = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(`${salt}:${value}`),
    );
    const hex = Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
    const legacy = `sha256:${salt}:${hex}`;

    await expect(verifySecret(value, legacy)).resolves.toBe(true);
    await expect(verifySecret('falsch', legacy)).resolves.toBe(false);
    expect(needsSecretRehash(legacy)).toBe(true);
  });

  it('stores native bearer credentials in SecureStore and migrates AsyncStorage', () => {
    const storage = read('src/lib/security/sensitiveAuthStorage.ts');
    const portalSession = read('src/lib/auth/portalSessionStore.ts');
    const supabaseClient = read('src/lib/supabase/client.ts');
    const appConfig = read('app.config.ts');

    expect(storage).toContain("import('expo-secure-store')");
    expect(storage).toContain('One-time migration');
    expect(storage).toContain('WHEN_UNLOCKED_THIS_DEVICE_ONLY');
    expect(portalSession).toContain('sensitiveAuthStorage');
    expect(supabaseClient).toContain('storage: sensitiveAuthStorage');
    expect(appConfig).toContain("'expo-secure-store'");
  });

  it('uses cryptographic randomness for issued portal credentials', () => {
    const password = read('src/lib/auth/temporaryPassword.ts');
    const code = read('src/lib/auth/portalCodeGenerator.ts');
    const random = read('src/lib/security/secureRandom.ts');

    expect(password).toContain('secureRandomInt');
    expect(code).toContain('secureRandomInt');
    expect(password).not.toContain('Math.random');
    expect(code).not.toContain('Math.random');
    expect(random).toContain('crypto.getRandomValues');
  });

  it('rate-limits both live portal logins and stores only session token digests', () => {
    for (const path of [
      'supabase/functions/employee-portal-login/index.ts',
      'supabase/functions/client-portal-login/index.ts',
    ]) {
      const source = read(path);
      expect(source).toContain('isLoginRateLimited');
      expect(source).toContain('hashOpaqueToken');
      expect(source).toContain('sessionTokenHash');
      expect(source).not.toContain('session_token: sessionToken,');
    }
  });

  it('revokes portal sessions on logout and retires code-only authentication', () => {
    expect(read('src/lib/auth/AuthProvider.tsx')).toContain('revokePortalSession');
    expect(read('supabase/functions/portal-session-logout/index.ts')).toContain("status: 'logged_out'");
    expect(read('supabase/functions/portal-code-login/index.ts')).toContain('LEGACY_CODE_LOGIN_RETIRED');
  });

  it('fails closed for disabled portal JWTs and hides credential columns from RLS', () => {
    const migration = read('supabase/migrations/20260827103000_portal_app_security_r14c.sql');

    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.current_portal_account_id()');
    expect(migration).toContain("cpa.status = 'aktiv'");
    expect(migration).toContain("epa.status IN ('active', 'pending_first_login', 'password_reset_required')");
    expect(migration).toContain('REVOKE SELECT, INSERT, UPDATE, DELETE ON public.portal_sessions');
    expect(migration).toContain('REVOKE SELECT ON public.client_portal_access');
    expect(migration).not.toMatch(/GRANT SELECT \([^;]*portal_access_code_hash/s);
  });

  it('uses strong OS facial biometrics without collecting face images', () => {
    const service = read('src/lib/auth/portalBiometricService.ts');
    const gate = read('src/components/auth/PortalBiometricGate.tsx');
    const settings = read('src/components/auth/PortalBiometricSettingsCard.tsx');
    const portalRoot = read('app-portal/_layout.tsx');
    const employeeProfile = read('src/screens/portal/EmployeeProfileScreen.tsx');
    const clientProfile = read('src/screens/portal/ClientPortalProfileScreen.tsx');
    const appConfig = read('app.config.ts');

    expect(service).toContain('AuthenticationType.FACIAL_RECOGNITION');
    expect(service).toContain('SecurityLevel.BIOMETRIC_STRONG');
    expect(service).toContain("biometricsSecurityLevel: 'strong'");
    expect(service).toContain('disableDeviceFallback: true');
    expect(service).toContain('sensitiveAuthStorage');
    expect(service).not.toContain('expo-camera');
    expect(service).not.toContain('upload');
    expect(gate).toContain('AppState.addEventListener');
    expect(gate).toContain('Abmelden und normal anmelden');
    expect(settings).toContain('Gesichtsdaten bleiben ausschließlich');
    expect(portalRoot).toContain('<PortalBiometricGate>');
    expect(employeeProfile).toContain('<PortalBiometricSettingsCard />');
    expect(clientProfile).toContain('<PortalBiometricSettingsCard />');
    expect(appConfig).toContain("'expo-local-authentication'");
  });
});
