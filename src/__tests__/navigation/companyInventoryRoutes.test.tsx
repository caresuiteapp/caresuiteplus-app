/// <reference types="vite/client" />
import type { ComponentType, ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Platform } from 'react-native';
import { canonicalCompanyInventoryHref } from '@/lib/navigation/companyInventoryRoute';
import { getRouteByPath } from '@/lib/navigation/routes';
import { checkRoleAccess } from '@/lib/navigation/redirects';
import { resolveWorkspaceAreaForPath } from '@/lib/permissions/workspaceAccess';
import { resolveModuleScopeFromPath } from '@/lib/modules/moduleVisibilityService';
import { resolveMainModuleFromPath } from '@/lib/navigation/resolvemainmodule';
import { safeWebReturnPath } from '@/lib/navigation/webLoginReturn';
import { desktopAreaForRoute } from '@/liquid-command/navigation/desktopAreas';
import { buildDesktopApps, buildDesktopNavigationGroups } from '@/liquid-command/navigation/desktopAppCatalog.web';
import { desktopModuleForRoute, normalizeNavigationApp } from '@/liquid-command/navigation/moduleDesktopModel';
import { describeLiquidRoute } from '@/liquid-command/navigation/routeContext';
import { resolveHealthOSPopupFallbackPath } from '@/lib/navigation/healthosRoutePresentation';
import CompanyInventoryRoute from '../../../app/unternehmen/inventar.web';
import NativeCompanyInventoryRoute from '../../../app/unternehmen/inventar';

const state = vi.hoisted(() => ({ params: {} as Record<string, string> }));
vi.mock('expo-router', () => ({
  useLocalSearchParams: () => state.params,
  Redirect: ({ href }: { href: string | { pathname: string; params: Record<string, string> } }) => (
    <a href={typeof href === 'string' ? href : `${href.pathname}${Object.keys(href.params).length ? `?${new URLSearchParams(href.params)}` : ''}`}>Weiterleitung</a>
  ),
}));
vi.mock('@/liquid-command/screens/CompanyWorkspaceScreen.web', () => ({
  CompanyWorkspaceScreen: ({ initialTab }: { initialTab: string }) => <span>{initialTab}</span>,
}));
vi.mock('@/liquid-command/shell/LiquidModuleRouteLayout', () => ({
  LiquidModuleRouteLayout: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));

const aliases = import.meta.glob<{ default: ComponentType }>('../../../app/{office,business/office}/inventory/*.web.tsx', { eager: true });
const expectedViews: Record<string, string | undefined> = {
  index: undefined, items: 'stock', assignments: 'assignments', returns: 'assignments',
  protocols: 'assignments', categories: 'locations', locations: 'locations', damage: 'damage',
  employees: 'offboarding', offboarding: 'offboarding', audit: 'history',
  barcode: 'stock', mdm: 'stock', settings: 'stock',
};
const inventoryApp = (route: string) => ({ id: 'inventory', label: 'Inventar', route, category: 'Verwaltung' as const, description: 'Geräte, Ausgabe und Rückgabe' });

beforeEach(() => { state.params = {}; });

describe('inventory inside the company workspace', () => {
  it('opens the company inventory tab and keeps the native workflow unchanged', () => {
    expect(renderToStaticMarkup(<CompanyInventoryRoute />)).toBe('<main><span>inventory</span></main>');
    expect(renderToStaticMarkup(<NativeCompanyInventoryRoute />)).toContain('href="/business/office/inventory"');
  });

  it('covers every existing Office inventory destination in both route trees', () => {
    expect(Object.keys(aliases)).toHaveLength(28);
    for (const [path, { default: Alias }] of Object.entries(aliases)) {
      const name = path.split('/').at(-1)!.replace('.web.tsx', '');
      state.params = { employeeId: 'person-42' };
      const expected = `/unternehmen/inventar?employeeId=person-42${expectedViews[name] ? `&amp;ansicht=${expectedViews[name]}` : ''}`;
      expect(renderToStaticMarkup(<Alias />), path).toContain(`href="${expected}"`);
    }
  });

  it('retains selected views on old root links and maps deep links without losing context', () => {
    expect(canonicalCompanyInventoryHref('/office/inventory?ansicht=damage')).toBe('/unternehmen/inventar?ansicht=damage');
    expect(canonicalCompanyInventoryHref('/business/office/inventory/employees?employeeId=e-1#selected')).toBe('/unternehmen/inventar?employeeId=e-1&ansicht=offboarding#selected');
    expect(canonicalCompanyInventoryHref('/business/office/inventory/audit?ansicht=stock')).toBe('/unternehmen/inventar?ansicht=history');
    expect(canonicalCompanyInventoryHref('/business/office/inventory/unknown')).toBeNull();
    expect(canonicalCompanyInventoryHref('/office/inventory-fake')).toBeNull();
  });

  it('preserves inventory widgets and deduplicates saved Office aliases', () => {
    const original = inventoryApp('/business/office/inventory');
    expect(normalizeNavigationApp(original)).toMatchObject({ id: 'inventory', label: 'Inventar', route: '/unternehmen/inventar' });
    expect(original.route).toBe('/business/office/inventory');
    const apps = buildDesktopApps([original, { ...inventoryApp('/office/inventory'), id: 'legacy' }], 'business_admin');
    const inventories = apps.filter(app => app.route === '/unternehmen/inventar');
    expect(inventories).toHaveLength(1);
    expect(inventories[0].id).toBe('inventory');
    expect(buildDesktopNavigationGroups(inventories)).toEqual([{ title: 'Office', items: inventories }]);
  });

  it('does not rewrite native inventory destinations', () => {
    const original = Object.getOwnPropertyDescriptor(Platform, 'OS')!;
    Object.defineProperty(Platform, 'OS', { ...original, value: 'android' });
    try {
      expect(normalizeNavigationApp(inventoryApp('/business/office/inventory')).route).toBe('/business/office/inventory');
    } finally {
      Object.defineProperty(Platform, 'OS', original);
    }
  });

  it('applies the existing Office access boundary and retains inventory roles', () => {
    const path = '/unternehmen/inventar?ansicht=stock';
    expect(getRouteByPath(path)).toMatchObject({ path: '/unternehmen/inventar', label: 'Inventar', requiresAuth: true, productKey: 'office' });
    expect(getRouteByPath(path)?.allowedRoles).toEqual(getRouteByPath('/office')?.allowedRoles);
    expect(checkRoleAccess(path, 'dispatch').shouldRedirect).toBe(false);
    for (const role of ['employee_portal', 'client_portal', 'family_portal'] as const) {
      expect(checkRoleAccess(path, role).shouldRedirect).toBe(true);
    }
    expect(resolveWorkspaceAreaForPath(path)).toBe('administration');
    expect(resolveWorkspaceAreaForPath('/unternehmen-alt/inventar')).toBeNull();
  });

  it('keeps navigation, reload, login return and page close in the company context', () => {
    const path = '/unternehmen/inventar?ansicht=assignments';
    expect(resolveModuleScopeFromPath(path)).toBe('office');
    expect(resolveMainModuleFromPath(path)).toBe('office');
    expect(desktopAreaForRoute(path)).toBe('office');
    expect(desktopModuleForRoute(path)).toBe('office');
    expect(describeLiquidRoute(path, 'office')).toMatchObject({ areaId: 'inventory', contextLabel: 'Inventar' });
    expect(safeWebReturnPath(path)).toBe(path);
    expect(resolveHealthOSPopupFallbackPath(path)).toBe('/unternehmen');
  });
});
