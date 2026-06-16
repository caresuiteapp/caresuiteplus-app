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

  it('defines five public entry cards with correct routes', () => {
    expect(APP_START_ENTRIES).toHaveLength(5);
    expect(APP_START_ENTRIES.map((e) => e.path)).toEqual([
      '/auth/business-login',
      '/auth/employee-login',
      '/auth/portal-code-login',
      '/auth/register-business',
      '/auth/demo',
    ]);
  });

  it('includes a prominent demo entry card', () => {
    const demo = APP_START_ENTRIES.find((e) => e.path === '/auth/demo');
    expect(demo?.label).toBe('Demo mit Beispieldaten ansehen');
  });

  it('includes registration entry', () => {
    const register = APP_START_ENTRIES.find((e) => e.path === '/auth/register-business');
    expect(register?.label).toBe('Registrieren');
  });

  it('AppStartScreen source has no dev-only navigation content', () => {
    const source = readSrc('src/screens/AppStartScreen.tsx');
    for (const needle of DEV_STRINGS) {
      expect(source).not.toContain(needle);
    }
    expect(source).toContain('fetchAppStartSnapshot');
    expect(source).toContain('CareSuiteLogo');
    expect(source).toContain('CareAdaptiveShell');
  });

  it('AppStartScreen shows demo badge only when demo mode', () => {
    const source = readSrc('src/screens/AppStartScreen.tsx');
    expect(source).toContain('isDemoMode()');
    expect(source).toContain('Demo-Modus aktiv');
    expect(source).toContain('Demo-Dashboard öffnen');
    expect(source).toContain('openDemoDashboard');
    expect(source).not.toContain('PUBLIC_ENTRIES');
    expect(source).not.toContain('ModuleTile');
  });

  it('demo auth route serves login or hint by mode', () => {
    const demoRoute = readSrc('app/auth/demo.tsx');
    expect(demoRoute).toContain('DemoLoginScreen');
    expect(demoRoute).toContain('DemoModeHintScreen');
    expect(demoRoute).toContain('isDemoMode()');
  });

  it('footer demo link targets demo route', () => {
    const footer = readSrc('src/components/layout/AppStartFooter.tsx');
    expect(footer).toContain('Demo ansehen');
    expect(footer).toContain('DEMO_START_PATH');
    expect(footer).not.toContain("router.push('/auth/business-login'");
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
    expect(readSrc('src/data/demo/navigation.ts')).toContain('/business/admin/architecture');
    expect(readSrc('src/data/demo/navigation.ts')).toContain('/business/admin/design-system');
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
