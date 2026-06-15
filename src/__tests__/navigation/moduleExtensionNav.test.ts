import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  APP_ROUTES,
  getModuleExtensionLinks,
  getModuleExtensionPaths,
  getRouteByPath,
} from '@/lib/navigation';

function readSrc(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

const MODULE_EXTENSION_PATHS = [
  '/stationaer/wohnbereiche',
  '/stationaer/uebergabebericht',
  '/stationaer/auswertungen',
  '/stationaer/settings',
  '/akademie/teilnehmer',
  '/akademie/zertifikate',
  '/akademie/auswertungen',
  '/akademie/settings',
  '/beratung/protokolle',
  '/beratung/wiedervorlagen',
  '/beratung/auswertungen',
  '/beratung/settings',
];

describe('Module Extension Navigation (Sprint 100)', () => {
  it('APP_ROUTES enthält Modul-Erweiterungs-Pfade', () => {
    for (const routePath of MODULE_EXTENSION_PATHS) {
      expect(APP_ROUTES.some((r) => r.path === routePath)).toBe(true);
    }
  });

  it('getRouteByPath löst Stationär-Wohnbereiche per Prefix', () => {
    const route = getRouteByPath('/stationaer/wohnbereiche');
    expect(route?.path).toBe('/stationaer/wohnbereiche');
    expect(route?.productKey).toBe('stationaer');
  });

  it('getModuleExtensionLinks liefert Schnellnavigation pro Modul', () => {
    const stationaer = getModuleExtensionLinks('stationaer');
    expect(stationaer.length).toBeGreaterThanOrEqual(4);
    expect(stationaer.some((l) => l.path === '/stationaer/wohnbereiche')).toBe(true);

    const akademie = getModuleExtensionPaths('akademie');
    expect(akademie).toContain('/akademie/teilnehmer');
    expect(akademie).toContain('/akademie/zertifikate');
  });

  it('ModuleExtensionNavStrip ist in Extension-Screens eingebunden', () => {
    expect(readSrc('src/components/stationaer/LivingAreasListView.tsx')).toContain('ModuleExtensionNavStrip');
    expect(readSrc('src/components/akademie/EnrollmentsListView.tsx')).toContain('ModuleExtensionNavStrip');
    expect(readSrc('src/components/beratung/ProtocolsListView.tsx')).toContain('ModuleExtensionNavStrip');
    expect(readSrc('src/components/assist/CareRecordsListView.tsx')).toContain('ModuleExtensionNavStrip');
  });

  it('breadcrumbs.ts enthält Extension-Segment-Labels', () => {
    const breadcrumbs = readSrc('src/lib/navigation/breadcrumbs.ts');
    expect(breadcrumbs).toContain('wohnbereiche');
    expect(breadcrumbs).toContain('teilnehmer');
    expect(breadcrumbs).toContain('protokolle');
    expect(breadcrumbs).toContain('audit');
  });
});
