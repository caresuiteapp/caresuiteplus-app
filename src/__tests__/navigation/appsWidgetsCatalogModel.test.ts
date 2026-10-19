import { describe, expect, it } from 'vitest';
import type { PermissionKey } from '@/types/permissions';
import {
  canShowDesktopCatalogRoute,
  canonicalDesktopCatalogRoute,
  desktopCatalogAreaForRoute,
  filterDesktopCatalogEntries,
  type DesktopCatalogAccess,
} from '@/liquid-command/navigation/appsWidgetsCatalogModel.web';
import { buildDesktopApps } from '@/liquid-command/navigation/desktopAppCatalog.web';

const admin: DesktopCatalogAccess = {
  roleKey: 'business_admin', can: () => true, hasModuleGate: () => true,
};
const withPermissions = (...permissions: PermissionKey[]): DesktopCatalogAccess => ({
  ...admin, can: permission => permission === 'office.access' || permissions.includes(permission),
});

describe('Web apps and widgets catalog', () => {
  it.each([
    ['/business/office/permissions', 'settings'],
    ['/business/integrations?tab=connections', 'settings'],
    ['/business/templates/documents-hub#texts', 'settings'],
    ['/support', 'settings'],
    ['/settings/tenant/', 'settings'],
    ['/business/templates', 'office'],
    ['/business/office/document-catalog', 'office'],
    ['/business/office/documents', 'office'],
    ['/assist/kalender', 'assist'],
    ['/business/subscription', 'premium'],
    ['/business/connect', 'office'],
    ['/business/reporting', 'office'],
    ['/business/qm', 'office'],
    ['/settings-extra', null],
  ])('places %s in its actual area', (route, area) => {
    expect(desktopCatalogAreaForRoute(route)).toBe(area);
  });

  it('exposes real Settings destinations from the existing app catalog', () => {
    const apps = buildDesktopApps([], 'business_admin');
    const settings = filterDesktopCatalogEntries(apps, 'settings', admin);
    expect(settings.map(app => app.route)).toEqual(expect.arrayContaining([
      '/settings', '/settings/tenant', '/settings/profile', '/settings/appearance',
      '/business/office/permissions', '/business/integrations',
      '/business/templates/documents-hub', '/support',
    ]));
    expect(settings.some(app => app.route === '/business/office/document-catalog')).toBe(false);
    expect(filterDesktopCatalogEntries(apps, 'office', admin).some(app => app.route === '/business/integrations')).toBe(false);
  });

  it('keeps personal settings usable while enforcing individual company permissions', () => {
    const access = withPermissions();
    expect(canShowDesktopCatalogRoute('/settings/profile', access)).toBe(true);
    expect(canShowDesktopCatalogRoute('/settings/appearance', access)).toBe(true);
    expect(canShowDesktopCatalogRoute('/settings/tenant', access)).toBe(false);
    expect(canShowDesktopCatalogRoute('/business/integrations', access)).toBe(false);
    expect(canShowDesktopCatalogRoute('/settings/tenant', withPermissions('business.tenant.manage'))).toBe(true);
    expect(canShowDesktopCatalogRoute('/business/integrations', withPermissions('integrations.view'))).toBe(true);
  });

  it('preserves both permitted ways to open template settings without granting document access', () => {
    for (const permission of ['settings.templates.view', 'office.catalogs.view'] as const) {
      const access = withPermissions(permission);
      expect(canShowDesktopCatalogRoute('/business/templates/documents-hub', access)).toBe(true);
      expect(canShowDesktopCatalogRoute('/business/templates', access)).toBe(false);
    }
    expect(canShowDesktopCatalogRoute('/business/templates', withPermissions('office.documents.view'))).toBe(true);
    expect(canShowDesktopCatalogRoute('/business/templates/create', withPermissions('office.catalogs.view'))).toBe(false);
  });

  it('requires both payroll rights and the currently active module gate', () => {
    expect(canShowDesktopCatalogRoute('/business/office/payroll', withPermissions('office.employees.view'))).toBe(false);
    expect(canShowDesktopCatalogRoute('/business/office/payroll', withPermissions('office.employees.view', 'time.tracking.team.view'))).toBe(true);
    expect(canShowDesktopCatalogRoute('/assist/calendar', { ...admin, hasModuleGate: module => module !== 'assist' })).toBe(false);
    expect(canShowDesktopCatalogRoute('/business/integrations', { ...admin, hasModuleGate: () => false })).toBe(false);
    expect(canShowDesktopCatalogRoute('/settings/profile', { ...admin, hasModuleGate: () => false })).toBe(true);
  });

  it('does not turn a workflow action into read-only navigation', () => {
    const entries = [
      { id: 'calendar', route: '/assist/calendar' },
      { id: 'plan', route: '/assist/kalender', permission: 'assist.assignments.manage' as const },
    ];
    const reader = withPermissions('assist.access', 'assist.assignments.view');
    expect(filterDesktopCatalogEntries(entries, 'assist', reader).map(item => item.id)).toEqual(['calendar']);
    expect(canShowDesktopCatalogRoute('/business/office/clients/new', withPermissions('office.clients.view'))).toBe(false);
    expect(canShowDesktopCatalogRoute('/business/office/clients/new', withPermissions('office.clients.create'))).toBe(true);
  });

  it('checks existing Google Workspace role restrictions for every service tab', () => {
    expect(canShowDesktopCatalogRoute('/business/connect/google-workspace?service=gmail', admin)).toBe(true);
    expect(canShowDesktopCatalogRoute('/business/connect/google-workspace?service=calendar', { ...admin, roleKey: 'business_manager' })).toBe(true);
    expect(canShowDesktopCatalogRoute('/business/connect/google-workspace?service=gmail', { ...admin, roleKey: 'dispatch' })).toBe(false);
  });

  it('preserves the independent robotics capability instead of enabling it by area selection', () => {
    expect(canShowDesktopCatalogRoute('/robotics?area=devices', withPermissions())).toBe(false);
    expect(canShowDesktopCatalogRoute('/robotics?area=devices', admin)).toBe(true);
  });

  it('matches existing message and document read access without requiring unrelated catalog or portal-edit rights', () => {
    expect(canShowDesktopCatalogRoute('/office/messages/templates', withPermissions('office.messages.view'))).toBe(true);
    expect(canShowDesktopCatalogRoute('/office/messages/settings', withPermissions('office.messages.view'))).toBe(false);
    expect(canShowDesktopCatalogRoute('/business/messages', withPermissions('communication.view_center'))).toBe(false);
    expect(canShowDesktopCatalogRoute('/business/office/documents/signatures', withPermissions('office.documents.view'))).toBe(true);
  });

  it('restores the real Connect entry and unifies QM aliases without exposing prepared-only products', () => {
    expect(canShowDesktopCatalogRoute('/business/connect', withPermissions())).toBe(false);
    expect(canShowDesktopCatalogRoute('/business/connect', withPermissions('connect.view'))).toBe(true);
    for (const route of ['/business/qm', '/business/office/qm', '/office/qm']) {
      expect(canonicalDesktopCatalogRoute(`${route}?tab=handbook#overview`)).toBe('/office/qm?tab=handbook#overview');
      expect(canShowDesktopCatalogRoute(route, withPermissions('qm.view'))).toBe(true);
      expect(canShowDesktopCatalogRoute(route, withPermissions())).toBe(false);
    }
    for (const route of ['/business/modules', '/insight', '/business/ops']) {
      expect(canShowDesktopCatalogRoute(route, admin)).toBe(false);
    }
    expect(canShowDesktopCatalogRoute('/business/reporting', withPermissions('business.reporting.view'))).toBe(true);
    expect(canShowDesktopCatalogRoute('/business/office/reporting', withPermissions())).toBe(true);
    expect(canonicalDesktopCatalogRoute('/business/office/reporting')).toBe('/office/reporting');
  });

  it('respects route registry role restrictions even when granular permissions are granted', () => {
    expect(canShowDesktopCatalogRoute('/business/connect', { ...admin, roleKey: 'dispatch' })).toBe(false);
    expect(canShowDesktopCatalogRoute('/business/reporting', { ...admin, roleKey: 'dispatch' })).toBe(true);
  });

  it.each(['/pflege', '/pflege/planung', '/stationaer/bewohner', '/beratung/faelle', '/akademie'])('keeps unreleased %s locked even when all permissions are granted', route => {
    expect(canShowDesktopCatalogRoute(route, admin)).toBe(false);
  });

  it.each([
    '/settings/tenant/not-reviewed', '/business/templates/not-reviewed',
    '/business/office/clients/not-reviewed', '/assist/calendar/not-reviewed',
    '/settings-extra', 'https://example.com/settings', '//example.com/settings',
  ])('does not inherit access for unknown or external destination %s', route => {
    expect(canShowDesktopCatalogRoute(route, admin)).toBe(false);
  });

  it.each([null, '', 'employee_portal', 'client_portal', 'family_portal'])('never uses launcher filtering to grant administration access to %s', roleKey => {
    expect(canShowDesktopCatalogRoute('/settings', { ...admin, roleKey })).toBe(false);
  });

  it('filters independently for apps, widgets and actions without modifying their source records', () => {
    const entries = [
      { id: 'company', route: '/settings/tenant', custom: 'preserve' },
      { id: 'appearance', route: '/settings/appearance', custom: 'preserve' },
      { id: 'documents', route: '/business/office/document-catalog', custom: 'preserve' },
    ];
    const original = structuredClone(entries);
    const filtered = filterDesktopCatalogEntries(entries, 'settings', withPermissions());
    expect(filtered).toEqual([entries[1]]);
    expect(filtered[0]).toBe(entries[1]);
    expect(entries).toEqual(original);
  });
});
