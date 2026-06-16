import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { APP_START_ENTRIES } from '@/data/landing/appStartEntries';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

const PUBLIC_AUTH_SCREENS = [
  'src/screens/AppStartScreen.tsx',
  'src/screens/auth/BusinessLoginScreen.tsx',
  'src/screens/auth/EmployeePortalLoginScreen.tsx',
  'src/screens/auth/PortalCodeLoginScreen.tsx',
  'src/screens/auth/BusinessRegisterScreen.tsx',
];

const TECHNICAL_NEEDLES = [
  'preparedOnly',
  'AuthInfoCard',
  'RLS',
  'Supabase',
  'Prototyp',
  'Kein Store-Release',
  'Module aktivieren',
  'AuthLoginHero',
  'CareBotCard',
  'VoiceFlowPanel',
  'Modul suchen',
  'Demo-Modus aktiv',
  'Demo-Dashboard',
];

describe('User guidance — public auth surfaces', () => {
  it('start page defines exactly four main actions', () => {
    expect(APP_START_ENTRIES).toHaveLength(4);
    expect(APP_START_ENTRIES.map((e) => e.path)).toEqual([
      '/auth/business-login',
      '/auth/employee-login',
      '/auth/portal-code-login',
      '/auth/register-business',
    ]);
  });

  it('start screen renders four PortalCard actions without demo card', () => {
    const source = readSrc('src/screens/AppStartScreen.tsx');
    expect(source).toContain('PortalCard');
    expect(source).toContain('fetchAppStartSnapshot');
    expect(source).not.toContain('openDemoDashboard');
    expect(source).not.toContain('Demo mit Beispieldaten');
  });

  it('business login has no technical cards or hero clutter', () => {
    const source = readSrc('src/screens/auth/BusinessLoginScreen.tsx');
    expect(source).toContain('AuthLayout');
    expect(source).toContain('InputField');
    expect(source).toContain('Einloggen');
    expect(source).toContain('Passwort vergessen');
    for (const needle of ['AuthInfoCard', 'AuthLoginHero', 'RLS', 'preparedOnly', 'Prototyp']) {
      expect(source).not.toContain(needle);
    }
  });

  it('employee login has no module activation or registration', () => {
    const source = readSrc('src/screens/auth/EmployeePortalLoginScreen.tsx');
    expect(source).toContain('Hilfe bei Zugang');
    expect(source).not.toContain('Module aktivieren');
    expect(source).not.toMatch(/registrieren/i);
    expect(source).not.toContain('AuthLoginHero');
  });

  it('client login has no admin or employee guidance', () => {
    const source = readSrc('src/screens/auth/PortalCodeLoginScreen.tsx');
    expect(source).toContain('Hilfe anfordern');
    expect(source).not.toContain('Mitarbeiter');
    expect(source).not.toContain('Verwaltung');
    expect(source).not.toContain('AuthLoginHero');
  });

  it('registration shows Office always included', () => {
    const source = readSrc('src/screens/auth/BusinessRegisterScreen.tsx');
    expect(source).toContain('RegisterLayout');
    expect(source).toContain('Office ist immer enthalten');
    expect(source).toContain('immer enthalten');
    expect(source).toContain('Prüfen und registrieren');
  });

  it('public auth screens expose no raw preparedOnly strings', () => {
    for (const file of PUBLIC_AUTH_SCREENS) {
      const source = readSrc(file);
      expect(source).not.toContain('preparedOnly');
    }
    const notice = readSrc('src/components/billing/PremiumPreparedNotice.tsx');
    expect(notice).not.toContain('preparedOnly');
    expect(notice).toContain('Demnächst verfügbar');
  });

  it('start page has no duplicate register CTAs', () => {
    const start = readSrc('src/screens/AppStartScreen.tsx');
    const registerMatches = start.match(/registrieren/gi) ?? [];
    expect(registerMatches.length).toBe(0);
    expect(APP_START_ENTRIES.filter((e) => e.path.includes('register'))).toHaveLength(1);
  });

  it('auth shell hides back navigation on mobile by default', () => {
    const shell = readSrc('src/design/components/AuthPageShell.tsx');
    const register = readSrc('src/design/components/RegisterLayout.tsx');
    expect(shell).toContain('isPhone');
    expect(shell).toContain('!isPhone');
    expect(register).toContain('!isPhone');
  });

  it('production public screens avoid prototype and debug hints', () => {
    for (const file of PUBLIC_AUTH_SCREENS) {
      const source = readSrc(file);
      expect(source).not.toContain('Prototyp');
      expect(source).not.toContain('debug');
      expect(source).not.toContain('Kein Store-Release');
    }
  });

  it('navigation paths remain wired on start entries', () => {
    const labels = APP_START_ENTRIES.map((e) => e.label);
    expect(labels).toContain('Unternehmen / Verwaltung');
    expect(labels).toContain('Mitarbeiterportal');
    expect(labels).toContain('Klient:innen / Angehörige');
    expect(labels).toContain('Neues Unternehmen registrieren');
  });

  it('footer links stay compact for public surfaces', () => {
    const footer = readSrc('src/design/components/FooterLinks.tsx');
    expect(footer).toContain('Demo ansehen');
    expect(footer).toContain('Hilfe');
    expect(footer).toContain('Datenschutz');
    expect(footer).toContain('Impressum');
    expect(footer).toContain('Nutzungsbedingungen');
    expect(footer).toContain('Version');
  });
});
