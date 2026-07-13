import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { APP_START_ENTRIES } from '@/data/landing/appStartEntries';
import {
  BUSINESS_TABS,
  PORTAL_CLIENT_TABS,
  PORTAL_EMPLOYEE_TABS,
  getTabsForArea,
} from '@/lib/navigation/shellConfig';
import { resolveSessionHomeRoute, shouldShowPortalChoice } from '@/lib/navigation/sessionRouting';
import { resolveVoiceFlowVisibility } from '@/lib/ui/voiceFlowVisibility';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

const PUBLIC_FORBIDDEN = [
  'VoiceFlow',
  'VoiceFlowPanel',
  'preparedOnly',
  'ModuleTile',
  'CareLightModuleTile',
  'RLS',
  'Supabase',
  'Prototyp',
  'Debug',
  'AuthInfoCard',
  'PlanPilotPanel',
];

describe('Native app structure (Prompt 110)', () => {
  it('1. no session → portal choice', () => {
    expect(shouldShowPortalChoice(false)).toBe(true);
    expect(shouldShowPortalChoice(true)).toBe(false);
    const start = readSrc('src/screens/AppStartScreen.tsx');
    expect(start).toContain('shouldShowPortalChoice');
    expect(start).toContain('PortalCard');
    expect(start).toContain('FooterLinks');
  });

  it('2. business session → admin dashboard route', () => {
    expect(resolveSessionHomeRoute('business_admin')).toBe('/business');
    expect(resolveSessionHomeRoute('business_manager')).toBe('/business');
    const start = readSrc('src/screens/AppStartScreen.tsx');
    expect(start).toContain('resolveAuthSessionTarget');
    expect(start).toContain('<Redirect href={homePath');
    expect(start).toContain('router.replace(homePath');
  });

  it('3. employee session → employee dashboard', () => {
    expect(resolveSessionHomeRoute('employee_portal')).toBe('/portal/employee');
    expect(resolveSessionHomeRoute('caregiver')).toBe('/portal/employee');
    expect(resolveSessionHomeRoute('nurse')).toBe('/portal/employee');
  });

  it('4. client session → client dashboard', () => {
    expect(resolveSessionHomeRoute('client_portal')).toBe('/portal/client');
    expect(resolveSessionHomeRoute('family_portal')).toBe('/portal/client');
  });

  it('5. login does not return to public start when authenticated', () => {
    const authLayout = readSrc('app/auth/_layout.tsx');
    expect(authLayout).toContain('RedirectIfAuthenticated');
    const guard = readSrc('src/lib/auth/RedirectIfAuthenticated.tsx');
    expect(guard).toContain('resolveAuthSessionTarget');
    expect(guard).toContain('<Redirect href={homePath');
    expect(guard).toContain('router.replace(homePath');
    expect(guard).not.toContain("router.replace('/' as never)");
  });

  it('6. logout → portal choice', () => {
    const topbar = readSrc('src/components/layout/platform/platformtopbar.tsx');
    expect(topbar).toContain('signOut().then(() => router.replace');
    expect(topbar).toContain("router.replace('/' as never)");
    const portalTab = readSrc('src/screens/portal/PortalTabScreen.tsx');
    expect(portalTab).toContain("router.replace('/' as never)");
  });

  it('7. public start has exactly four actions', () => {
    expect(APP_START_ENTRIES).toHaveLength(4);
    expect(APP_START_ENTRIES.map((entry) => entry.label)).toEqual([
      'Anmeldung Verwaltung',
      'Anmeldung Mitarbeiter:in Portal',
      'Anmeldung Klient:innen Portal',
      'Kostenlos Registrieren',
    ]);
  });

  it('8. no specialty features on public start', () => {
    const start = readSrc('src/screens/AppStartScreen.tsx');
    for (const needle of PUBLIC_FORBIDDEN) {
      expect(start).not.toContain(needle);
    }
  });

  it('9. VoiceFlow is not public', () => {
    const start = readSrc('src/screens/AppStartScreen.tsx');
    expect(start).not.toContain('VoiceFlow');
    const visibility = resolveVoiceFlowVisibility({
      isAuthenticated: false,
      roleKey: null,
      assignmentId: null,
      documentationAllowed: false,
    });
    expect(visibility.showPanel).toBe(false);
    expect(visibility.showStartButton).toBe(false);
  });

  it('10. employee nav has no admin routes', () => {
    const hrefs = PORTAL_EMPLOYEE_TABS.map((tab) => tab.href);
    for (const href of hrefs) {
      expect(href.startsWith('/portal/employee')).toBe(true);
    }
    const tabs = getTabsForArea('portal_employee', { roleKey: 'employee_portal' });
    expect(tabs.some((tab) => tab.href.startsWith('/business'))).toBe(false);
    expect(tabs.some((tab) => tab.href.startsWith('/office'))).toBe(false);
  });

  it('11. client nav has no admin routes', () => {
    const hrefs = PORTAL_CLIENT_TABS.map((tab) => tab.href);
    for (const href of hrefs) {
      expect(href.startsWith('/portal/client')).toBe(true);
    }
    const tabs = getTabsForArea('portal_client', { roleKey: 'client_portal' });
    expect(tabs.some((tab) => tab.href.startsWith('/business'))).toBe(false);
    expect(tabs.some((tab) => tab.href.startsWith('/office'))).toBe(false);
  });

  it('12. public buttons navigate to real routes', () => {
    const start = readSrc('src/screens/AppStartScreen.tsx');
    expect(start).toContain('router.push(entry.path');
    for (const entry of APP_START_ENTRIES) {
      expect(entry.path).toMatch(/^\/auth\//);
    }
    const footer = readSrc('src/design/components/FooterLinks.tsx');
    expect(footer).toContain('router.push(DEMO_START_PATH');
    expect(footer).not.toMatch(/onPress=\{\(\)\s*=>\s*\{\s*\}\}/);
  });

  it('13. production start has no debug info', () => {
    const start = readSrc('src/screens/AppStartScreen.tsx');
    for (const needle of ['__DEV__', 'console.log', 'preparedOnly', 'Debug', 'Prototyp']) {
      expect(start).not.toContain(needle);
    }
  });

  it('14. NotFound screen is user-friendly', () => {
    const notFound = readSrc('app/+not-found.tsx');
    expect(notFound).toContain('Seite nicht gefunden');
    expect(notFound).toContain('ErrorState');
    expect(notFound).toContain('Zum Dashboard');
    expect(notFound).toContain('Zum Start');
    expect(notFound).not.toContain('PremiumCard');
  });

  it('admin shell uses native primary navigation labels', () => {
    expect(BUSINESS_TABS.map((tab) => tab.label)).toEqual([
      'Dashboard',
      'Dienstplan',
      'Klient:innen',
      'Mitarbeitende',
      'Nachrichten',
      'Mehr',
    ]);
  });

  it('employee shell uses native primary navigation labels', () => {
    expect(PORTAL_EMPLOYEE_TABS.map((tab) => tab.label)).toEqual([
      'Übersicht',
      'Einsätze',
      'Kalender',
      'Nachrichten',
      'Profil',
    ]);
  });

  it('client shell uses native primary navigation labels', () => {
    expect(PORTAL_CLIENT_TABS.map((tab) => tab.label)).toEqual([
      'Termine',
      'Dokumente',
      'Nachrichten',
      'Profil',
    ]);
  });

  it('auth index redirects to public portal choice', () => {
    const authIndex = readSrc('app/auth/index.tsx');
    expect(authIndex).toContain('Redirect');
    expect(authIndex).toContain('href="/"');
  });
});
