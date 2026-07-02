import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  HEALTHOS_NAV_BY_ROLE,
  HEALTHOS_OFFICE_NAV,
  HEALTHOS_ASSIST_NAV,
  HEALTHOS_EMPLOYEE_PORTAL_NAV,
  HEALTHOS_CLIENT_PORTAL_NAV,
  getNavAreaKeys,
  getVisibleNavItemsForRole,
  resolveNavVisibility,
  toMobileShellTabs,
} from '@/components/healthos/navigation';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

const SHELL_FILES = [
  'src/components/healthos/shell/HealthOSAppShell.tsx',
  'src/components/healthos/shell/HealthOSDesktopSidebar.tsx',
  'src/components/healthos/shell/HealthOSMobileBottomNav.tsx',
  'src/components/healthos/shell/HealthOSTopBar.tsx',
  'src/components/healthos/shell/HealthOSBreadcrumbs.tsx',
  'src/components/healthos/shell/HealthOSRoleNavigation.tsx',
  'src/components/healthos/shell/HealthOSTenantContext.tsx',
  'src/components/healthos/shell/HealthOSNotificationArea.tsx',
  'src/components/healthos/shell/HealthOSPortalShell.tsx',
  'src/components/healthos/shell/HealthOSModuleShell.tsx',
  'src/components/healthos/shell/healthosShellLayoutRules.ts',
  'src/components/healthos/navigation/healthosNavigationConfig.ts',
  'src/components/healthos/navigation/resolveHealthOSNavigation.ts',
  'src/components/healthos/navigation/healthosDualRoutingPlan.ts',
];

const FORBIDDEN_IMPORTS = [
  '@/features/assistWorkflow',
  'finalizeVisit',
  'clientBudgetTransactionService',
  'wfmClockService',
  'wfmAssistAdapter',
  'saveVisitDocumentation',
  'assistExecutionProblemInboxService',
  'EmployeePortalVisitExecutionScreen',
  'useEmployeePermissionOnboardingGate',
];

const RED_ZONE_FILES = [
  'src/features/assistWorkflow/finalizeVisit.ts',
  'src/screens/portal/EmployeePortalVisitExecutionScreen.tsx',
];

describe('HealthOS H2 navigation config', () => {
  it('defines all four role areas', () => {
    expect(Object.keys(HEALTHOS_NAV_BY_ROLE).sort()).toEqual([
      'assist',
      'client_portal',
      'employee_portal',
      'office',
    ]);
  });

  it('office nav contains expected top-level areas', () => {
    const keys = getNavAreaKeys('office');
    expect(keys).toContain('command-center');
    expect(keys).toContain('clients');
    expect(keys).toContain('employees');
    expect(keys).toContain('documents');
    expect(keys).toContain('communication');
    expect(keys).toContain('settings');
  });

  it('assist nav contains dashboard and live assignments', () => {
    const keys = getNavAreaKeys('assist');
    expect(keys).toContain('dashboard');
    expect(keys).toContain('planning');
    expect(keys).toContain('live');
    expect(keys).toContain('proofs');
  });

  it('employee portal nav excludes execute workflow from visible items', () => {
    const visible = getVisibleNavItemsForRole('employee_portal');
    expect(visible.some((i) => i.key === 'current-assignment')).toBe(false);
    expect(visible.some((i) => i.key === 'assignments')).toBe(true);
  });

  it('client portal hides budget from mobile tabs', () => {
    const tabs = toMobileShellTabs('client_portal');
    expect(tabs.some((t) => t.key === 'budget')).toBe(false);
  });

  it('hidden items are not included in visible nav', () => {
    const officeBudget = HEALTHOS_OFFICE_NAV.groups
      .flatMap((g) => g.items)
      .find((i) => i.key === 'budgets');
    expect(resolveNavVisibility(officeBudget!)).toBe('hidden');
    expect(getNavAreaKeys('office')).not.toContain('budgets');
  });

  it('disabled items remain in sidebar config but without href navigation', () => {
    const disabled = HEALTHOS_ASSIST_NAV.groups
      .flatMap((g) => g.items)
      .find((i) => i.key === 'service-types');
    expect(resolveNavVisibility(disabled!)).toBe('disabled');
    expect(getVisibleNavItemsForRole('assist').some((i) => i.key === 'service-types')).toBe(true);
  });

  it('employee times route stays hidden (P0 WFM)', () => {
    const times = HEALTHOS_EMPLOYEE_PORTAL_NAV.groups
      .flatMap((g) => g.items)
      .find((i) => i.key === 'times');
    expect(resolveNavVisibility(times!)).toBe('hidden');
  });

  it('client budget stays hidden', () => {
    const budget = HEALTHOS_CLIENT_PORTAL_NAV.groups
      .flatMap((g) => g.items)
      .find((i) => i.key === 'budget');
    expect(resolveNavVisibility(budget!)).toBe('hidden');
  });
});

describe('HealthOS H2 shell layer', () => {
  it('exports shell components from healthos index', () => {
    const index = readSrc('src/components/healthos/index.ts');
    expect(index).toContain("export * from './shell'");
    expect(index).toContain("export * from './navigation'");
    const shellIndex = readSrc('src/components/healthos/shell/index.ts');
    expect(shellIndex).toContain('HealthOSAppShell');
    expect(shellIndex).toContain('HealthOSRoleNavigationSidebar');
    expect(shellIndex).toContain('healthosShellLayoutRules');
  });

  it.each(SHELL_FILES)('%s exists', (file) => {
    expect(() => readSrc(file)).not.toThrow();
  });

  it('shell layer does not import P0 workflow services', () => {
    for (const file of SHELL_FILES) {
      const source = readSrc(file);
      for (const forbidden of FORBIDDEN_IMPORTS) {
        expect(source, `${file} must not import ${forbidden}`).not.toContain(forbidden);
      }
    }
  });

  it('HealthOSPortalShell delegates to PortalShellLayout only', () => {
    const source = readSrc('src/components/healthos/shell/HealthOSPortalShell.tsx');
    expect(source).toContain('PortalShellLayout');
    expect(source).not.toMatch(/import.*PlatformShell/);
    expect(source).not.toMatch(/import.*EmployeePortalShell/);
  });

  it('HealthOSModuleShell does not import PlatformShell', () => {
    const source = readSrc('src/components/healthos/shell/HealthOSModuleShell.tsx');
    expect(source).not.toMatch(/import.*PlatformShell/);
    expect(source).toContain('HealthOSAppShell');
  });

  it('mobile bottom nav component is self-contained', () => {
    const source = readSrc('src/components/healthos/shell/HealthOSMobileBottomNav.tsx');
    expect(source).toContain('healthos-mobile-bottom-nav');
    expect(source).not.toContain('PortalMobileNav');
  });

  it('desktop sidebar supports disabled state', () => {
    const source = readSrc('src/components/healthos/shell/HealthOSDesktopSidebar.tsx');
    expect(source).toContain("'disabled'");
    expect(source).toContain('opacity: disabled ? 0.45 : 1');
  });

  it('dual routing plan documents without redirect code', () => {
    const source = readSrc('src/components/healthos/navigation/healthosDualRoutingPlan.ts');
    expect(source).toContain('HEALTHOS_DUAL_ROUTES');
    expect(source).not.toContain('router.replace');
    expect(source).not.toMatch(/<Redirect|from 'expo-router'.*Redirect/);
  });

  it('red zone source files were not modified in H2', () => {
    for (const file of RED_ZONE_FILES) {
      const source = readSrc(file);
      expect(source).not.toContain('HealthOS');
    }
  });

  it('existing PlatformShell and officeNav remain unchanged', () => {
    const platform = readSrc('src/components/layout/platform/platformshell.tsx');
    const officeNav = readSrc('src/lib/navigation/modulenav/officenav.ts');
    expect(platform).not.toContain('HealthOS');
    expect(officeNav).not.toContain('HealthOS');
  });
});
