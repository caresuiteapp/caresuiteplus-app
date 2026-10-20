import { describe, expect, it } from 'vitest';
import { desktopAreaForRoute, desktopAreaStorageKey, introduceOfficeDocumentCatalogWidget } from '@/liquid-command/navigation/desktopAreas';
import { buildDesktopApps } from '@/liquid-command/navigation/desktopAppCatalogModel';
import { buildDesktopNavigationGroups, restoreDesktopWidgetIds } from '@/liquid-command/navigation/moduleDesktopModel';

const catalogId = 'document-catalog';
const route = '/business/office/document-catalog';

describe('Office document catalogue access and desktop introduction', () => {
  it('keeps the catalogue reachable through Office navigation and its canonical route', () => {
    const apps = buildDesktopApps([], 'business_admin');
    const matches = buildDesktopNavigationGroups(apps, ['office'], 'Dokumentenkatalog').flatMap(group => group.items);
    expect(matches.some(app => app.route === route)).toBe(true);
    expect(desktopAreaForRoute(route)).toBe('office');
    expect(desktopAreaForRoute('/office/document-catalog?tab=records')).toBe('office');
    expect(buildDesktopNavigationGroups(apps, ['assist'], 'Dokumentenkatalog')).toEqual([]);
  });

  it('adds the catalogue on the first page without losing a full saved desktop on reload', () => {
    const savedIds = Array.from({ length: 12 }, (_, index) => `custom-${index}`);
    const availableIds = [catalogId, ...savedIds];
    const restored = restoreDesktopWidgetIds(JSON.stringify(savedIds), [], availableIds, [catalogId]);
    const introduced = introduceOfficeDocumentCatalogWidget(restored, availableIds, false);
    expect(introduced[0]).toBe(catalogId);
    expect(introduced.slice(1)).toEqual(savedIds);
    expect(restoreDesktopWidgetIds(JSON.stringify(introduced), [], availableIds, [])).toEqual(introduced);
    expect(savedIds).toHaveLength(12);
  });

  it('respects removal and an intentionally empty desktop after the introduction', () => {
    const availableIds = [catalogId, 'documents', 'clients'];
    const saved = restoreDesktopWidgetIds(JSON.stringify(['documents']), [], availableIds, [catalogId]);
    expect(introduceOfficeDocumentCatalogWidget(saved, availableIds, true)).toEqual(['documents']);
    expect(introduceOfficeDocumentCatalogWidget([], availableIds, true)).toEqual([]);
    expect(introduceOfficeDocumentCatalogWidget(['documents', catalogId], availableIds, false)).toEqual(['documents', catalogId]);
  });

  it('adds no inaccessible widget and isolates the introduction by company, person and area', () => {
    expect(introduceOfficeDocumentCatalogWidget(['clients'], ['clients'], false)).toEqual(['clients']);
    const keys = [desktopAreaStorageKey('a', 'x', 'office'), desktopAreaStorageKey('b', 'x', 'office'), desktopAreaStorageKey('a', 'y', 'office'), desktopAreaStorageKey('a', 'x', 'assist')].map(key => `${key}.document-catalog.v1`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
