import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');
const read = (relativePath: string) => readFileSync(path.join(root, relativePath), 'utf8');

describe('employee portal mobile/tablet parity R10.8', () => {
  it('redirects an authenticated employee at the main address to the canonical dashboard', () => {
    const entry = read('src/liquid-command/screens/LiquidCommandEntryScreen.tsx');
    const webEntry = read('src/liquid-command/screens/LiquidCommandEntryScreen.web.tsx');
    const target = read('src/lib/auth/sessionTarget.ts');
    const routing = read('src/lib/navigation/sessionRouting.ts');
    for (const source of [entry, webEntry]) {
      expect(source).toContain('if (!auth.authReady)');
      expect(source).toContain('resolveAuthSessionTarget(auth)');
      expect(source).toContain("canRedirectHome && homePath !== '/'");
      expect(source).toContain('<Redirect href={homePath as never} />');
    }
    expect(target).toContain('resolveSessionHomeRoute(roleKey, input.portalSession)');
    expect(routing).toContain("['employee_portal', 'caregiver', 'nurse']");
    expect(routing).toMatch(/EMPLOYEE_HOME_ROLES\.includes\(roleKey\)[\s\S]*?return '\/portal\/employee'/);
    expect(entry).not.toContain('<PortalHomeScreen portal="employee" />');
  });

  it('never renders the legacy employee dashboard from its former direct route', () => {
    const route = read('app/liquid-command/portal/employee.tsx');
    expect(route).toContain('<Redirect href="/portal/employee" />');
    expect(route).not.toContain('PortalHomeScreen');
  });

  it('keeps the canonical route on the shared productive tablet and phone dashboard', () => {
    const route = read('app/portal/employee/(tabs)/index.tsx');
    const overview = read('src/screens/portal/EmployeePortalOverviewScreen.tsx');
    const dashboard = read('src/screens/portal/EmployeePortalDashboardScreen.tsx');
    expect(route).toContain('EmployeePortalOverviewScreen');
    expect(overview).toContain('EmployeePortalDashboardScreen');
    expect(dashboard).toContain('HealthOSEmployeePortalTodayView');
  });

  it('keeps the fixed five-slot canonical phone navigation without horizontal scrolling', () => {
    const shell = read('src/liquid-command/shell/LiquidPortalRouteLayout.tsx');
    expect(shell).toContain("maxWidth: '20%'");
    expect(shell).toContain('flexBasis: 0');
    expect(shell).not.toContain('<PortalNavigation');
  });
});
