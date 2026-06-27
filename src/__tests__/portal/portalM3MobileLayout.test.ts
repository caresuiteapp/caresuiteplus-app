import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  PORTAL_EMPLOYEE_MOBILE_TAB_KEYS,
  PORTAL_MOBILE_TAB_KEYS,
  resolveFixedMobileEmployeePortalTabs,
  resolveFixedMobilePortalTabs,
} from '@/lib/navigation/portalMobileTabs';
import { PORTAL_EMPLOYEE_TABS } from '@/lib/navigation/shellConfig';
import type { ShellTabConfig } from '@/types/navigation/shell';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

const clientTabs: ShellTabConfig[] = [
  { key: 'overview', label: 'Übersicht', icon: '🏠', href: '/portal/client' },
  { key: 'assist-appointments', label: 'Einsätze', icon: '📅', href: '/portal/client/appointments' },
  { key: 'documents', label: 'Dokumente', icon: '📄', href: '/portal/client/documents' },
  { key: 'messages', label: 'Nachrichten', icon: '💬', href: '/portal/client/messages' },
  { key: 'profile', label: 'Profil', icon: '👤', href: '/portal/client/profile' },
];

describe('portal M.3 mobile layout', () => {
  it('employee tabs match spec labels and order', () => {
    expect(PORTAL_EMPLOYEE_TABS.map((tab) => tab.label)).toEqual([
      'Übersicht',
      'Einsätze',
      'Dienstplan',
      'Nachrichten',
      'Profil',
    ]);
    expect(resolveFixedMobileEmployeePortalTabs(PORTAL_EMPLOYEE_TABS).map((tab) => tab.key)).toEqual([
      ...PORTAL_EMPLOYEE_MOBILE_TAB_KEYS,
    ]);
  });

  it('client tabs remain five fixed tabs', () => {
    expect(resolveFixedMobilePortalTabs(clientTabs).map((tab) => tab.key)).toEqual([
      ...PORTAL_MOBILE_TAB_KEYS,
    ]);
  });

  it('employee and client shells wrap stack at layout root', () => {
    const employeeLayout = readSrc('app/portal/employee/_layout.tsx');
    const clientLayout = readSrc('app/portal/client/_layout.tsx');
    expect(employeeLayout).toContain('EmployeePortalShell');
    expect(clientLayout).toContain('ClientPortalShell');
    expect(readSrc('app/portal/employee/(tabs)/_layout.tsx')).not.toContain('EmployeePortalShell');
    expect(readSrc('app/portal/client/(tabs)/_layout.tsx')).not.toContain('ClientPortalShell');
  });

  it('employee and client portal layouts constrain stack slot for mobile safe area', () => {
    const employeeLayout = readSrc('app/portal/employee/_layout.tsx');
    const clientLayout = readSrc('app/portal/client/_layout.tsx');
    expect(employeeLayout).toContain('overflow:');
    expect(clientLayout).toContain('overflow:');
  });

  it('EmployeeProfileScreen imports usePermissions', () => {
    const profile = readSrc('src/screens/portal/EmployeeProfileScreen.tsx');
    expect(profile).toContain('usePermissions');
    expect(profile).toMatch(/import\s*\{[^}]*usePermissions[^}]*\}\s*from\s*['"]@\/hooks\/usePermissions['"]/);
  });

  it('PortalShellLayout passes employee mobile nav area', () => {
    const shell = readSrc('src/components/layout/portal/PortalShellLayout.tsx');
    expect(shell).toContain("'portal_employee'");
    expect(shell).toContain('portalKind={kind}');
    expect(shell).toContain('area={mobileNavArea}');
  });

  it('employee overview uses dedicated dashboard screen', () => {
    const route = readSrc('app/portal/employee/(tabs)/index.tsx');
    expect(route).toContain('EmployeePortalDashboardScreen');
    expect(route).not.toContain('PortalOverviewTab');
    expect(route).toContain('hideHeaderOnPhone');
  });

  it('employee schedule route uses live portal appointments hook', () => {
    const route = readSrc('app/portal/employee/(tabs)/schedule.tsx');
    expect(route).toContain('usePortalAppointments');
    expect(route).not.toContain('fetchEmployeePortalOverview');
  });

  it('portal welcome gate is mounted at app root', () => {
    const layout = readSrc('app/_layout.tsx');
    expect(layout).toContain('PortalWelcomeGate');
  });

  it('login screens mark portal welcome pending', () => {
    expect(readSrc('src/screens/auth/EmployeePortalLoginScreen.tsx')).toContain(
      "markPortalWelcomePending('employee')",
    );
    expect(readSrc('src/screens/auth/PortalCodeLoginScreen.tsx')).toContain(
      "markPortalWelcomePending('client')",
    );
  });

  it('MobilePortalDashboard uses shell scroll surface only', () => {
    const mobile = readSrc('src/components/portal/assist/MobilePortalDashboard.tsx');
    expect(mobile).not.toContain('ScrollView');
    expect(mobile).not.toContain('PORTAL_MOBILE_NAV_HEIGHT');
    expect(mobile).toContain('Wichtig für Sie');
    expect(mobile).toContain('resolveTimeBasedGermanGreeting');
  });

  it('removes Portal-Sicht placeholder badges from portal heroes', () => {
    expect(readSrc('src/components/portal/PortalDashboardHero.tsx')).not.toContain('Portal-Sicht');
    expect(readSrc('src/components/portal/PortalTabHero.tsx')).not.toContain('Portal-Sicht');
    expect(readSrc('src/components/portal/PortalAppointmentDetailHero.tsx')).not.toContain('Portal-Sicht');
    expect(readSrc('src/components/portal/PortalEmployeeAssignmentDetailHero.tsx')).not.toContain('Portal-Sicht');
  });

  it('login screens redirect to portal dashboard after sign-in', () => {
    expect(readSrc('src/screens/auth/EmployeePortalLoginScreen.tsx')).toContain(
      "router.replace(resolvePostLoginRoute('employee_portal')",
    );
    expect(readSrc('src/screens/auth/PortalCodeLoginScreen.tsx')).toContain(
      "router.replace(resolvePostLoginRoute('client_portal')",
    );
  });

  it('TopbarProfileAvatar resolves display URLs with cache bust', () => {
    expect(readSrc('src/components/layout/TopbarProfileAvatar.tsx')).toContain(
      'resolveProfileAvatarDisplayUrl',
    );
    expect(readSrc('src/lib/auth/profileAvatarUrl.ts')).toContain('appendProfileAvatarCacheBust');
  });

  it('landing cards include German descriptions', () => {
    const entries = readSrc('src/data/landing/appStartEntries.ts');
    expect(entries).toContain('Office, Personal, Abrechnung');
    expect(entries).toContain('Einsätze, Dienstplan');
    expect(entries).toContain('Termine, Dokumente');
  });

  it('AdaptivePortalOverview avoids nested ScrollView on phone', () => {
    const overview = readSrc('src/components/portal/AdaptivePortalOverview.tsx');
    expect(overview).toContain('if (isPhone)');
    expect(overview).toContain('<View style={styles.container}>{overviewBody}</View>');
  });

  it('PortalDocumentsTab and PortalMessagesTab avoid nested ScrollView on phone', () => {
    const documents = readSrc('src/components/portal/PortalDocumentsTab.tsx');
    const messages = readSrc('src/components/portal/PortalMessagesTab.tsx');
    expect(documents).toContain('if (isPhone)');
    expect(messages).toContain('if (isPhone)');
  });

  it('TopbarProfileAvatar resolves signed avatar URLs', () => {
    expect(readSrc('src/lib/auth/profileAvatarUrl.ts')).toContain('createSignedUrl');
    expect(readSrc('src/components/layout/TopbarProfileAvatar.tsx')).toContain(
      'resolveProfileAvatarDisplayUrl',
    );
  });

  it('TopbarProfileAvatar imports useMemo when styles hook is used', () => {
    const avatar = readSrc('src/components/layout/TopbarProfileAvatar.tsx');
    expect(avatar).toContain('useMemo(');
    expect(avatar).toMatch(/import\s*\{[^}]*useMemo[^}]*\}\s*from\s*['"]react['"]/);
  });
});
