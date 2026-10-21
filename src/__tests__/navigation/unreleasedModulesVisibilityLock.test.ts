import { describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/beratung/workspaceRelease', () => ({ isConsultationWorkspaceEnabled: () => false }));
import { buildDesktopApps } from '@/liquid-command/navigation/desktopAppCatalog.web';
import { checkProductAccess } from '@/lib/navigation/redirects';
import { getUnreleasedModuleKeyFromPath, isUnreleasedCatalogModuleKey, isUnreleasedModuleKey } from '@/lib/modules/constants';
import { readFileSync } from 'node:fs';

const LOCKED_ROOTS = ['/pflege', '/stationaer', '/beratung'] as const;
const ACADEMY_WORKSPACE_ROUTES = [
  '/akademie', '/akademie/vorlagen', '/akademie/kurse', '/akademie/kurse/new',
  '/akademie/kurse/course-id', '/akademie/courses/course-id',
  '/akademie/teilnehmer', '/akademie/teilnehmer/enrollment-id',
  '/akademie/zertifikate', '/akademie/zertifikate/certificate-id',
  '/akademie/schulungsplan', '/akademie/pflichtschulungen',
  '/akademie/pruefungen', '/akademie/mediathek', '/akademie/auswertungen',
] as const;

describe('globale Sichtbarkeits- und Routensperre unveroeffentlichter Module', () => {
  it('entfernt alle gesperrten Module und Unterseiten aus Navigation und Apps', () => {
    const apps = buildDesktopApps([], 'business_admin');

    for (const app of apps) {
      expect(LOCKED_ROOTS.some((root) => app.route === root || app.route.startsWith(`${root}/`))).toBe(false);
    }
  });

  it.each(LOCKED_ROOTS)('blockiert Admin-Direktzugriff auf %s', (route) => {
    const decision = checkProductAccess(route, 'business_admin', 'tenant-live');

    expect(decision.shouldRedirect).toBe(true);
    expect(decision.reason).toBe('module_disabled');
    expect(decision.target).toBe('/Desktop');
  });

  it('entfernt die Produkte auch aus Dock und Befehlspalette', () => {
    const shell = readFileSync('src/liquid-command/shell/LiquidCommandShell.tsx', 'utf8');

    expect(shell).toContain('!isUnreleasedModuleKey(module.key)');
    expect(shell).toContain('!isUnreleasedModuleRoute(shortcut.route)');
  });

  it('gibt die veröffentlichte Web-Akademie im vorhandenen App-Katalog frei', () => {
    const apps = buildDesktopApps([], 'business_admin');
    expect(isUnreleasedModuleKey('akademie')).toBe(false);
    expect(apps.map(app => app.route)).toEqual(expect.arrayContaining([
      '/akademie', '/akademie/vorlagen', '/akademie/kurse',
      '/akademie/schulungsplan', '/akademie/pruefungen',
    ]));
  });

  it.each(ACADEMY_WORKSPACE_ROUTES)('erreicht den veröffentlichten Web-Arbeitsbereich %s auch mit Query oder Hash', route => {
    expect(getUnreleasedModuleKeyFromPath(`${route}/?view=course#details`)).toBeNull();
  });

  it.each(['/akademie/not-published', '/akademie/kurse/id/lessons', '/akademie/vorlagen/new'])('sperrt nicht veröffentlichte Akademierouten %s', route => {
    expect(getUnreleasedModuleKeyFromPath(route)).toBe('akademie');
    expect(checkProductAccess(route, 'business_admin', 'tenant-live')).toMatchObject({
      shouldRedirect: true, reason: 'module_disabled', target: '/Desktop',
    });
  });

  it('gibt durch den Lernarbeitsbereich keinen Leistungs- oder Preiskatalog frei', () => {
    expect(isUnreleasedCatalogModuleKey('akademie')).toBe(true);
    expect(isUnreleasedCatalogModuleKey('beratung')).toBe(true);
  });

  it.each(['android', 'ios'])('behält die bisherige Akademiesperre unter %s bei', async platform => {
    vi.resetModules();
    vi.doMock('react-native', async () => {
      const actual = await vi.importActual<typeof import('react-native')>('react-native');
      return { ...actual, Platform: { ...actual.Platform, OS: platform } };
    });
    try {
      const native = await import('@/lib/modules/constants');
      expect(native.isUnreleasedModuleKey('akademie')).toBe(true);
      expect(native.isUnreleasedCatalogModuleKey('akademie')).toBe(true);
      for (const route of ACADEMY_WORKSPACE_ROUTES) {
        expect(native.getUnreleasedModuleKeyFromPath(route)).toBe('akademie');
      }
    } finally {
      vi.doUnmock('react-native');
      vi.resetModules();
    }
  });
});
