import { describe, expect, it } from 'vitest';
import { buildDesktopApps } from '@/liquid-command/navigation/desktopAppCatalog.web';
import { buildModuleDesktopNavigation, desktopModuleForRoute, moduleDesktopStorageKey, normalizeModuleWidgets } from '@/liquid-command/navigation/moduleDesktop.web';

describe('module desktops', () => {
  it('keeps every navigation entry in its selected module, including search results', () => {
    const apps = buildDesktopApps([], 'business_admin');
    for (const module of ['office', 'assist', 'pflege', 'stationaer'] as const) {
      const entries = buildModuleDesktopNavigation(apps, module).flatMap(group => group.items);
      expect(entries.every(app => desktopModuleForRoute(app.route) === module)).toBe(true);
      expect(buildModuleDesktopNavigation(apps, module, '___missing___')).toEqual([]);
    }
    expect(buildModuleDesktopNavigation(apps, 'office').flatMap(g => g.items).length).toBeGreaterThan(0);
    expect(buildModuleDesktopNavigation(apps, 'assist').flatMap(g => g.items).length).toBeGreaterThan(0);
  });
  it('recognizes aliases and rejects similarly named or global routes', () => {
    expect(desktopModuleForRoute('/business/office/clients?view=table')).toBe('office');
    expect(desktopModuleForRoute('/assist/kalender')).toBe('assist');
    expect(desktopModuleForRoute('/pflege/touren')).toBe('pflege');
    expect(desktopModuleForRoute('/assistance')).toBeNull();
    expect(desktopModuleForRoute('/settings')).toBeNull();
  });
  it('isolates stored desktops by tenant, user and module', () => {
    const keys = [moduleDesktopStorageKey('tenant-a', 'user-a', 'office'), moduleDesktopStorageKey('tenant-a', 'user-a', 'assist'), moduleDesktopStorageKey('tenant-b', 'user-a', 'office'), moduleDesktopStorageKey('tenant-a', 'user-b', 'office')];
    expect(new Set(keys).size).toBe(4);
    expect(moduleDesktopStorageKey('a.b', 'c', 'office')).not.toBe(moduleDesktopStorageKey('a', 'b.c', 'office'));
  });
  it('imports only widgets belonging to the module, preserving order and an intentionally empty desktop', () => {
    expect(normalizeModuleWidgets(['assist-calendar', 'office-clients', 'office-clients', 7], ['office-clients'], [])).toEqual(['office-clients']);
    expect(normalizeModuleWidgets([], ['office-clients'], ['office-clients'])).toEqual([]);
    expect(normalizeModuleWidgets(null, ['office-clients'], ['office-clients'])).toEqual(['office-clients']);
    const ids = Array.from({ length: 14 }, (_, index) => String(index));
    expect(normalizeModuleWidgets(ids, ids, [])).toHaveLength(12);
  });
});


describe('navigation cleanup', () => {
  const app = (route: string) => ({ id: route, route, label: route, description: '', category: 'Übersicht' as const });
  it('collapses confirmed Assist redirects into one canonical entry', () => {
    const groups = buildModuleDesktopNavigation(['/assist/einsaetze', '/assist/assignments', '/assist/kalender', '/assist/calendar'].map(app), 'assist');
    expect(groups.flatMap(g => g.items).map(a => a.route)).toEqual(['/assist/calendar', '/assist/assignments']);
    expect(groups.map(g => g.title)).toEqual(['Planung', 'Einsätze & Durchführung']);
  });
  it('keeps distinct timekeeping functions and merges identical portal dashboards', () => {
    const entries = buildModuleDesktopNavigation(['/business/office/time-tracking', '/business/office/time-tracking/live', '/business/office/access', '/business/office/portals'].map(app), 'office').flatMap(g => g.items);
    expect(entries.map(a => a.label)).toEqual(['Zeitkonten & Arbeitszeit', 'Live-Anwesenheit', 'Benutzer & Portale']);
  });
  it('places messages, signatures and quality in their own areas', () => {
    const groups = buildModuleDesktopNavigation(['/office/messages/templates', '/business/office/documents/signatures', '/business/office/qm'].map(app), 'office');
    expect(groups.map(g => g.title)).toEqual(['Dokumente', 'Kommunikation', 'Qualität & Auswertung']);
    expect(groups.find(g => g.title === 'Kommunikation')?.items[0].route).toBe('/office/messages/templates');
  });
  it('bundles Workspace navigation without mutating the full app catalog', () => {
    const apps = ['/business/connect/google-workspace', '/business/connect/google-workspace?service=gmail'].map(app);
    expect(buildModuleDesktopNavigation(apps, 'office')[0].items).toHaveLength(1);
    expect(apps).toHaveLength(2);
  });
});
