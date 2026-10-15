import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RoleKey } from '@/types/core/auth';
import { getRouteByPath } from '@/lib/navigation/routes';
import { checkProductAccess, checkRoleAccess } from '@/lib/navigation/redirects';
import { resolveMainModuleFromPath } from '@/lib/navigation/resolvemainmodule';
import { safeWebReturnPath } from '@/lib/navigation/webLoginReturn';
import { isHealthOSContextualPopupRoute } from '@/lib/navigation/healthosRoutePresentation';
import { resolveModuleScopeFromPath } from '@/lib/modules/moduleVisibilityService';
import { initializeModuleAccessStore, resetModuleAccessStore } from '@/lib/modules/moduleAccessService';
import { resetPlatformTenantModuleStore, seedPlatformTenantModulesForDemo } from '@/lib/modules/platformTenantModuleAccess';
import { buildWorkspaceAccessContext, checkWorkspaceAreaAccess, resolveWorkspaceAreaForPath } from '@/lib/permissions/workspaceAccess';
import { desktopAreaForRoute } from '@/liquid-command/navigation/desktopAreas';
import { buildDesktopNavigationGroups, type DesktopApp } from '@/liquid-command/navigation/desktopAppCatalog.web';
import { buildModuleDesktopNavigation, desktopModuleForRoute } from '@/liquid-command/navigation/moduleDesktop.web';
import { isLiquidCommandRoutePath } from '@/liquid-command/navigation/isLiquidCommandRoute';
import { describeLiquidRoute } from '@/liquid-command/navigation/routeContext';

const TENANT = 'tenant-company-route';
const COMPANY = '/unternehmen';

function seedOfficeAccess(status: 'enabled' | 'disabled' | 'locked') {
  seedPlatformTenantModulesForDemo(TENANT, [{
    moduleKey: 'office', status, isTrial: false, trialEndsAt: null,
    startsAt: null, endsAt: null, manualOverride: true,
  }]);
}

describe('company route access and desktop context', () => {
  beforeEach(() => {
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');
    resetModuleAccessStore();
    resetPlatformTenantModuleStore();
    initializeModuleAccessStore(TENANT);
  });

  afterEach(() => {
    resetModuleAccessStore();
    resetPlatformTenantModuleStore();
    vi.unstubAllEnvs();
  });

  it('registers the company route with the same authentication, product and roles as Office', () => {
    const office = getRouteByPath('/office');
    const company = getRouteByPath(`${COMPANY}?tab=contact`);
    expect(company).toMatchObject({ path: COMPANY, label: 'Unternehmen', requiresAuth: true, productKey: 'office' });
    expect(company?.allowedRoles).toEqual(office?.allowedRoles);
  });

  it('retains access for every existing Office role', () => {
    const roles: RoleKey[] = ['business_admin', 'business_manager', 'billing', 'dispatch', 'nurse', 'caregiver', 'counselor'];
    for (const role of roles) {
      expect(checkRoleAccess(COMPANY, role).shouldRedirect, role).toBe(false);
    }
  });

  it.each<RoleKey | null>(['employee_portal', 'client_portal', 'family_portal', null])(
    'preserves the Office role redirect for %s',
    role => {
      const decision = checkRoleAccess(COMPANY, role);
      expect(decision.shouldRedirect).toBe(true);
      expect(decision).toEqual(checkRoleAccess('/office', role));
    },
  );

  it('applies administration checks, including missing identity and tenant, to direct company links', () => {
    const context = buildWorkspaceAccessContext({
      userId: 'user-company', tenantId: TENANT, roleKey: 'business_admin',
      environment: 'production', isDemoMode: false,
    });
    expect(resolveWorkspaceAreaForPath(`${COMPANY}?tab=contact#address`)).toBe('administration');
    expect(checkWorkspaceAreaAccess(COMPANY, context)).toEqual({ allowed: true });
    for (const overrides of [
      { userId: null }, { tenantId: null }, { roleKey: null },
      { roleKey: 'employee_portal' as const }, { roleKey: 'client_portal' as const },
      { isDemoMode: true },
    ]) {
      const restricted = { ...context, ...overrides };
      const decision = checkWorkspaceAreaAccess(COMPANY, restricted);
      expect(decision.allowed).toBe(false);
      expect(decision).toEqual(checkWorkspaceAreaAccess('/office', restricted));
    }
  });

  it.each(['disabled', 'locked'] as const)('honors an explicitly %s Office module even for administrators', status => {
    seedOfficeAccess(status);
    const decision = checkProductAccess(COMPANY, 'business_admin', TENANT);
    expect(decision.shouldRedirect).toBe(true);
    expect(decision).toEqual(checkProductAccess('/office', 'business_admin', TENANT));
  });

  it('allows the company route when Office is enabled for the tenant', () => {
    seedOfficeAccess('enabled');
    expect(checkProductAccess(COMPANY, 'billing', TENANT)).toEqual({ shouldRedirect: false, target: COMPANY });
  });

  it('keeps the canonical route in the Office product and main module', () => {
    for (const path of [COMPANY, `${COMPANY}?tab=contact`]) {
      expect(resolveModuleScopeFromPath(path)).toBe('office');
      expect(resolveMainModuleFromPath(path)).toBe('office');
      expect(desktopAreaForRoute(path)).toBe('office');
      expect(desktopModuleForRoute(path)).toBe('office');
    }
  });

  it('keeps the company widget in the Office navigation and its overview group', () => {
    const widget: DesktopApp = {
      id: 'company', label: 'Unternehmen', route: COMPANY,
      description: 'Unternehmensakte', category: 'Verwaltung',
    };
    expect(buildDesktopNavigationGroups([widget])).toEqual([{ title: 'Office', items: [widget] }]);
    const groups = buildModuleDesktopNavigation([widget], 'office');
    expect(groups).toHaveLength(1);
    expect(groups[0].title).toBe('Übersicht');
    expect(groups[0].items[0]).toMatchObject({ id: 'company', route: COMPANY, label: 'Unternehmen' });
    expect(buildModuleDesktopNavigation([widget], 'assist')).toEqual([]);
  });

  it('uses the company visual context inside the existing Liquid window presentation', () => {
    expect(isLiquidCommandRoutePath(COMPANY)).toBe(true);
    expect(isHealthOSContextualPopupRoute(COMPANY)).toBe(true);
    expect(describeLiquidRoute(`${COMPANY}?tab=contact`, 'office')).toMatchObject({
      areaId: 'company', contextLabel: 'Unternehmen',
    });
  });

  it('does not classify similarly named routes as the company workspace', () => {
    const unrelated = '/unternehmen-alt';
    expect(getRouteByPath(unrelated)).toBeUndefined();
    expect(resolveModuleScopeFromPath(unrelated)).toBeNull();
    expect(resolveWorkspaceAreaForPath(unrelated)).toBeNull();
    expect(desktopAreaForRoute(unrelated)).toBeNull();
    expect(desktopModuleForRoute(unrelated)).toBeNull();
    expect(isLiquidCommandRoutePath(unrelated)).toBe(false);
  });

  it('preserves company return URLs for login and page history without accepting lookalike or external routes', () => {
    for (const path of [COMPANY, `${COMPANY}?tab=contact#address`]) {
      expect(safeWebReturnPath(path)).toBe(path);
    }
    expect(safeWebReturnPath('/unternehmen-alt')).toBeNull();
    expect(safeWebReturnPath('//unternehmen')).toBeNull();
    expect(safeWebReturnPath('https://example.com/unternehmen')).toBeNull();
  });
});
