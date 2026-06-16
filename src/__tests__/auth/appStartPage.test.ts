import { describe, expect, it, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { APP_START_ENTRIES, DEMO_START_PATH } from '@/data/landing/appStartEntries';

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

  it('includes registration entry', () => {
    const register = APP_START_ENTRIES.find((e) => e.path === '/auth/register-business');
    expect(register?.label).toBe('Neues Unternehmen registrieren');
  });

  it('AppStartScreen source has no dev-only navigation content', () => {
    const source = readSrc('src/screens/AppStartScreen.tsx');
    for (const needle of DEV_STRINGS) {
      expect(source).not.toContain(needle);
    }
    expect(source).toContain('fetchAppStartSnapshot');
    expect(source).toContain('PortalCard');
    expect(source).toContain('AppScreen');
  });

  it('demo is available via footer link only', () => {
    const source = readSrc('src/screens/AppStartScreen.tsx');
    expect(source).not.toContain('openDemoDashboard');
    expect(source).not.toContain('Demo mit Beispieldaten');
    const footer = readSrc('src/design/components/FooterLinks.tsx');
    expect(footer).toContain('DEMO_START_PATH');
    expect(DEMO_START_PATH).toBe('/auth/demo');
  });

  it('demo auth route serves login or hint by mode', () => {
    const demoRoute = readSrc('app/auth/demo.tsx');
    expect(demoRoute).toContain('DemoLoginScreen');
    expect(demoRoute).toContain('DemoModeHintScreen');
    expect(demoRoute).toContain('isDemoMode()');
  });

  it('auth alias routes redirect to canonical paths', () => {
    const register = readSrc('app/auth/register.tsx');
    const clientLogin = readSrc('app/auth/client-login.tsx');
    expect(register).toContain('/auth/register-business');
    expect(clientLogin).toContain('/auth/portal-code-login');
  });

  it('footer uses supportLinks for legal URLs', () => {
    const footer = readSrc('src/design/components/FooterLinks.tsx');
    expect(footer).toContain('SUPPORT_LINKS');
    expect(footer).toContain('Hilfe & Support');
    expect(footer).toContain('Datenschutz');
    expect(footer).toContain('Impressum');
    expect(footer).toContain('Nutzungsbedingungen');
    expect(footer).toContain('Version');
  });
});
