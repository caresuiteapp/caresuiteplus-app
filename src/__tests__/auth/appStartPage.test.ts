import { describe, expect, it, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { APP_START_ENTRIES } from '@/data/landing/appStartEntries';
import { canAccessDeveloperTools } from '@/lib/auth/devAccess';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

const DEV_STRINGS = [
  'Technisches Fundament',
  'Design System',
  'Architektur-Dokumentation',
  'WP 001',
  'WP 002',
  'WP 021',
  'Routen & Navigationsfluss',
  'PUBLIC_ENTRIES',
];

describe('App start page', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('defines four public entry cards with correct routes', () => {
    expect(APP_START_ENTRIES).toHaveLength(4);
    expect(APP_START_ENTRIES.map((e) => e.path)).toEqual([
      '/auth/business-login',
      '/auth/employee-login',
      '/auth/portal-code-login',
      '/auth/register-business',
    ]);
  });

  it('includes Kostenlos Registrieren registration entry', () => {
    const register = APP_START_ENTRIES.find((e) => e.path === '/auth/register-business');
    expect(register?.label).toBe('Kostenlos Registrieren');
  });

  it('AppStartScreen source has no dev-only navigation content', () => {
    const source = readSrc('src/screens/AppStartScreen.tsx');
    for (const needle of DEV_STRINGS) {
      expect(source).not.toContain(needle);
    }
    expect(source).toContain('fetchAppStartSnapshot');
    expect(source).toContain('CareSuiteLogo');
    expect(source).toContain('AppScreen');
  });

  it('AppStartScreen shows no demo mode badge or dashboard entry', () => {
    const source = readSrc('src/screens/AppStartScreen.tsx');
    expect(source).not.toContain('isDemoMode()');
    expect(source).not.toContain('Demo-Modus aktiv');
    expect(source).not.toContain('Demo-Dashboard öffnen');
    expect(source).not.toContain('openDemoDashboard');
    expect(source).not.toContain('PUBLIC_ENTRIES');
    expect(source).not.toContain('ModuleTile');
  });

  it('footer has no demo login link', () => {
    const footer = readSrc('src/components/layout/AppStartFooter.tsx');
    expect(footer).not.toContain('Demo ansehen');
    expect(footer).not.toContain('DEMO_START_PATH');
    expect(footer).not.toContain('/auth/demo');
  });

  it('auth alias routes redirect to canonical paths', () => {
    const register = readSrc('app/auth/register.tsx');
    const clientLogin = readSrc('app/auth/client-login.tsx');
    expect(register).toContain('/auth/register-business');
    expect(clientLogin).toContain('/auth/portal-code-login');
  });

  it('developer tools moved to business admin routes', () => {
    expect(readSrc('app/business/admin/developer/index.tsx')).toContain('DeveloperHubScreen');
    expect(readSrc('app/business/admin/architecture/index.tsx')).toContain('FundamentScreen');
    expect(readSrc('src/data/navigation/moduleNavConfig.ts')).toContain('/business/admin/architecture');
    expect(readSrc('src/data/navigation/moduleNavConfig.ts')).toContain('/business/admin/design-system');
  });

  it('public fundament and design-system routes are gated', () => {
    expect(readSrc('app/fundament.tsx')).toContain('DevToolGate');
    expect(readSrc('app/design-system/_layout.tsx')).toContain('DevToolGate');
  });

  it('canAccessDeveloperTools allows business_admin and rejects employee portal', () => {
    expect(canAccessDeveloperTools('business_admin')).toBe(true);
    expect(canAccessDeveloperTools('business_manager')).toBe(true);
    expect(canAccessDeveloperTools('employee_portal')).toBe(false);
    expect(canAccessDeveloperTools(null)).toBe(false);
  });

  it('footer uses supportLinks for legal URLs', () => {
    const footer = readSrc('src/components/layout/AppStartFooter.tsx');
    expect(footer).toContain('SUPPORT_LINKS');
    expect(footer).toContain('Hilfe & Support');
    expect(footer).toContain('Datenschutz');
    expect(footer).toContain('Impressum');
    expect(footer).toContain('Nutzungsbedingungen');
    expect(footer).toContain('Version');
  });
});
