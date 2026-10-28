import { buildSync } from 'esbuild';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { desktopAreaForRoute, desktopAreaStorageKey, introduceOfficeNotesWidget } from '@/liquid-command/navigation/desktopAreas';
import { buildDesktopNavigationGroups, desktopModuleForRoute, restoreDesktopWidgetIds } from '@/liquid-command/navigation/moduleDesktopModel';
import { getRouteByPath } from '@/lib/navigation/routes';
import { checkProductAccess, checkRoleAccess } from '@/lib/navigation/redirects';
import { safeWebReturnPath } from '@/lib/navigation/webLoginReturn';
import { isHealthOSContextualPopupRoute } from '@/lib/navigation/healthosRoutePresentation';
import { initializeModuleAccessStore, resetModuleAccessStore } from '@/lib/modules/moduleAccessService';
import { resetPlatformTenantModuleStore, seedPlatformTenantModulesForDemo } from '@/lib/modules/platformTenantModuleAccess';
import { buildWorkspaceAccessContext, checkWorkspaceAreaAccess } from '@/lib/permissions/workspaceAccess';
import type { DesktopApp } from '@/liquid-command/navigation/desktopAppCatalogModel';

const route = '/office/notizen';
const bundle = buildSync({
  stdin: { contents: `
    export { WIDGETS, DEFAULT_DESKTOP_IDS } from './src/liquid-command/screens/administrationDesktopCatalog';
    export { buildDesktopApps } from './src/liquid-command/navigation/desktopAppCatalogModel';
    export { describeLiquidRoute } from './src/liquid-command/navigation/routeContext';
    export { officeNav } from './src/lib/navigation/moduleNav/officeNav';
    export { APP_ROUTES } from './src/lib/navigation/routes';
  `, resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, write: false, format: 'cjs', platform: 'node',
  loader: { '.png': 'empty', '.jpg': 'empty' }, external: ['react-native'],
}).outputFiles[0].text;
function catalog(platform: 'web' | 'android') {
  const loaded = { exports: {} as any };
  new Function('require', 'module', 'exports', bundle)((id: string) => {
    if (id === 'react-native') return { Platform: { OS: platform } };
    throw new Error(`Unexpected catalogue dependency: ${id}`);
  }, loaded, loaded.exports);
  return loaded.exports;
}

describe('Office Notes desktop entry and route', () => {
  it('offers one searchable Office destination, a dedicated illustration and a default widget', () => {
    const web = catalog('web');
    const widget = web.WIDGETS.find((item: DesktopApp) => item.id === 'notes');
    expect(widget).toMatchObject({ label: 'Notizen', route, category: 'Verwaltung' });
    expect(widget.images.medium.uri).toMatch(/^data:image\/svg\+xml,/);
    expect(web.DEFAULT_DESKTOP_IDS).toContain('notes');
    const apps: DesktopApp[] = web.buildDesktopApps(web.WIDGETS, 'business_admin');
    expect(apps.filter(app => app.route === route)).toHaveLength(1);
    const matches = buildDesktopNavigationGroups(apps, ['office'], 'Notizen');
    expect(matches.find(group => group.title === 'Organisation')?.items.some(app => app.route === route)).toBe(true);
    expect(buildDesktopNavigationGroups(apps, ['assist'], 'Notizen')).toEqual([]);
    expect(web.describeLiquidRoute(route, 'office')).toMatchObject({ areaId: 'notes', contextLabel: 'Notizen' });
  });

  it('offers the native note workspace in the same default desktop order as Web', () => {
    const android = catalog('android');
    expect(android.WIDGETS.some((item: DesktopApp) => item.id === 'notes')).toBe(true);
    expect(android.DEFAULT_DESKTOP_IDS).toEqual(catalog('web').DEFAULT_DESKTOP_IDS);
    expect(android.buildDesktopApps(android.WIDGETS, 'business_admin').some((item: DesktopApp) => item.route === route)).toBe(true);
    expect(android.officeNav.groups.flatMap((group: any) => group.items).some((item: any) => item.href === route)).toBe(true);
    expect(android.APP_ROUTES.some((item: any) => item.path === route)).toBe(true);
  });

  it('appends once to a full saved desktop without moving or dropping existing widgets', () => {
    const saved = Array.from({ length: 12 }, (_, index) => `widget-${index}`);
    const available = [...saved, 'notes'];
    const restored = restoreDesktopWidgetIds(JSON.stringify(saved), [], available, ['notes']);
    const introduced = introduceOfficeNotesWidget(restored, available, false);
    expect(introduced).toEqual([...saved, 'notes']);
    expect(restoreDesktopWidgetIds(JSON.stringify(introduced), [], available, [])).toEqual(introduced);
    expect(introduceOfficeNotesWidget(introduced, available, false)).toEqual(introduced);
    expect(saved).toHaveLength(12);
  });

  it('respects an empty desktop, later removal, an existing position and unavailable widgets', () => {
    expect(introduceOfficeNotesWidget([], ['notes'], false)).toEqual([]);
    expect(introduceOfficeNotesWidget(['clients'], ['clients', 'notes'], true)).toEqual(['clients']);
    expect(introduceOfficeNotesWidget(['notes', 'clients'], ['clients', 'notes'], false)).toEqual(['notes', 'clients']);
    expect(introduceOfficeNotesWidget(['clients'], ['clients'], false)).toEqual(['clients']);
    const keys = [['tenant-a', 'user-a', 'office'], ['tenant-b', 'user-a', 'office'], ['tenant-a', 'user-b', 'office'], ['tenant-a', 'user-a', 'assist']] as const;
    expect(new Set(keys.map(([tenant, user, area]) => `${desktopAreaStorageKey(tenant, user, area)}.notes.v1`)).size).toBe(4);
  });

  it('retains Office role/product guards and safe refresh return URLs', () => {
    expect(getRouteByPath(route)).toMatchObject({ path: route, label: 'Notizen', requiresAuth: true, productKey: 'office' });
    expect(getRouteByPath(route)?.allowedRoles).toEqual(getRouteByPath('/office')?.allowedRoles);
    expect(checkRoleAccess(route, 'billing').shouldRedirect).toBe(false);
    expect(checkRoleAccess(route, 'employee_portal').shouldRedirect).toBe(true);
    expect(checkRoleAccess(route, null).shouldRedirect).toBe(true);
    expect(desktopAreaForRoute(route)).toBe('office');
    expect(desktopModuleForRoute(route)).toBe('office');
    expect(isHealthOSContextualPopupRoute(route)).toBe(true);
    expect(safeWebReturnPath(`${route}?note=one#editor`)).toBe(`${route}?note=one#editor`);
    expect(safeWebReturnPath(`https://example.invalid${route}`)).toBeNull();
    const context = buildWorkspaceAccessContext({ userId: 'user-a', tenantId: 'tenant-a', roleKey: 'business_admin', environment: 'production', isDemoMode: false });
    expect(checkWorkspaceAreaAccess(route, context)).toEqual({ allowed: true });
    expect(checkWorkspaceAreaAccess(route, { ...context, tenantId: null }).allowed).toBe(false);
    expect(checkWorkspaceAreaAccess(route, { ...context, roleKey: 'client_portal' }).allowed).toBe(false);
  });
});

describe('Office Notes module protection', () => {
  beforeEach(() => { vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true'); resetModuleAccessStore(); resetPlatformTenantModuleStore(); initializeModuleAccessStore('tenant-notes'); });
  afterEach(() => { resetModuleAccessStore(); resetPlatformTenantModuleStore(); });
  it.each(['disabled', 'locked'] as const)('blocks an explicitly %s Office module even for an administrator', status => {
    seedPlatformTenantModulesForDemo('tenant-notes', [{ moduleKey: 'office', status, isTrial: false, trialEndsAt: null, startsAt: null, endsAt: null, manualOverride: true }]);
    expect(checkProductAccess(route, 'business_admin', 'tenant-notes').shouldRedirect).toBe(true);
  });
});
