import { describe, expect, it } from 'vitest';
import { desktopStorageKey, restoreDesktopWidgetIds, previousDesktopWidgetIds, buildDesktopNavigationGroups } from '@/liquid-command/navigation/moduleDesktopModel';
import { buildDesktopApps } from '@/liquid-command/navigation/desktopAppCatalogModel';
const available = ['office-client', 'assist-visit', 'weather'];
describe('desktop without a module selector', () => {
  it('keeps current preferences ahead of corrupt previous module preferences', () => {
    expect(restoreDesktopWidgetIds('["weather"]', ['broken'], available, available)).toEqual(['weather']);
    expect(restoreDesktopWidgetIds('[]', ['["assist-visit"]'], available, available)).toEqual([]);
  });
  it('merges previous Office and Assist widgets without duplicate or unavailable IDs', () => {
    expect(restoreDesktopWidgetIds(null, ['["office-client","weather"]', '["assist-visit","weather","old"]'], available, available)).toEqual(['office-client', 'weather', 'assist-visit']);
    expect(restoreDesktopWidgetIds(null, ['[]', null], available, available)).toEqual([]);
  });
  it('does not silently overwrite corrupt current settings with defaults', () => {
    expect(() => restoreDesktopWidgetIds('broken', ['["weather"]'], available, available)).toThrow();
    expect(() => restoreDesktopWidgetIds('{}', [], available, available)).toThrow();
  });
  it('isolates stored widgets between users and tenants', () => {
    expect(new Set([desktopStorageKey('tenant-a', 'user-a'), desktopStorageKey('tenant-b', 'user-a'), desktopStorageKey('tenant-a', 'user-b')]).size).toBe(3);
  });
  it('preserves every available migrated widget beyond the first desktop page', () => {
    const ids = Array.from({ length: 20 }, (_, index) => `widget-${index}`);
    expect(restoreDesktopWidgetIds(null, [JSON.stringify(ids.slice(0, 12)), JSON.stringify(ids.slice(12))], ids, [])).toEqual(ids);
    expect(restoreDesktopWidgetIds(JSON.stringify(ids), [], ids, [])).toEqual(ids);
    expect(previousDesktopWidgetIds(['broken', JSON.stringify(ids)], ids)).toEqual(ids);
  });
  it('provides both permitted Office and Assist navigation without any bodymap destination', () => {
    const apps = buildDesktopApps([], 'business_admin');
    expect(apps.some(app => /bodymap/i.test(app.route))).toBe(false);
    const groups = buildDesktopNavigationGroups(apps, ['office', 'assist']);
    expect(groups.some(group => group.title === 'Klient:innen')).toBe(true);
    expect(groups.some(group => group.title === 'Planung')).toBe(true);
    expect(new Set(groups.map(group => group.title)).size).toBe(groups.length);
    expect(groups.flatMap(group => group.items).some(app => app.route.startsWith('/pflege'))).toBe(false);
  });
});
