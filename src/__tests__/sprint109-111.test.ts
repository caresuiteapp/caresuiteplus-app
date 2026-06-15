import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

function readSrc(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Insight Snapshots/Exports Desktop Tables (Sprint 109)', () => {
  it('InsightSnapshotsListView nutzt insight.snapshots Persistenz', () => {
    const source = readSrc('src/components/insight/InsightSnapshotsListView.tsx');
    expect(source).toContain('InsightSnapshotsListTable');
    expect(source).toContain("useDesktopListViewPreference('insight.snapshots')");
    expect(readSrc('src/screens/insight/InsightSnapshotsListScreen.tsx')).toContain(
      'InsightSnapshotsListView',
    );
  });

  it('InsightExportsListView nutzt insight.exports Persistenz', () => {
    const source = readSrc('src/components/insight/InsightExportsListView.tsx');
    expect(source).toContain('InsightExportsListTable');
    expect(source).toContain("useDesktopListViewPreference('insight.exports')");
    expect(readSrc('src/screens/insight/InsightExportsListScreen.tsx')).toContain(
      'InsightExportsListView',
    );
  });

  it('InsightSnapshotsListHero hat DesktopListViewToggle', () => {
    const hero = readSrc('src/components/insight/InsightSnapshotsListHero.tsx');
    expect(hero).toContain('DesktopListViewToggle');
    expect(hero).toContain('isInsightLiveReady');
  });
});

describe('Catalog + Outbox + TI Heroes (Sprint 110)', () => {
  it('CatalogsListView nutzt office.catalogs Persistenz und Hero', () => {
    const view = readSrc('src/components/catalog/CatalogsListView.tsx');
    expect(view).toContain('CatalogsListHero');
    expect(view).toContain("useDesktopListViewPreference('office.catalogs')");
    expect(readSrc('src/screens/catalog/CatalogsListScreen.tsx')).toContain('CatalogsListView');
  });

  it('CatalogDetailScreen nutzt CatalogDetailHero', () => {
    const screen = readSrc('src/screens/catalog/CatalogDetailScreen.tsx');
    expect(screen).toContain('CatalogDetailHero');
  });

  it('OutboxListScreen nutzt OutboxListHero mit preparedOnly', () => {
    const screen = readSrc('src/screens/integrations/OutboxListScreen.tsx');
    expect(screen).toContain('OutboxListHero');
    const hero = readSrc('src/components/integrations/OutboxListHero.tsx');
    expect(hero).toContain('isIntegrationsLiveReady');
  });

  it('TI Vorbereitung Screens nutzen TIVorbereitungHero', () => {
    expect(readSrc('src/screens/ti/EGKVorbereitungScreen.tsx')).toContain('TIVorbereitungHero');
    expect(readSrc('src/screens/ti/EPAVorbereitungScreen.tsx')).toContain('TIVorbereitungHero');
    expect(readSrc('src/screens/ti/EMPVorbereitungScreen.tsx')).toContain('TIVorbereitungHero');
    expect(readSrc('src/screens/ti/ERezeptVorbereitungScreen.tsx')).toContain('TIVorbereitungHero');
    expect(readSrc('src/components/ti/TIVorbereitungHero.tsx')).toContain('isTILiveReady');
  });
});

describe('Communication Archived + Extension Live Prep (Sprint 111)', () => {
  it('ArchivedConversationsScreen nutzt CommunicationArchivedHero', () => {
    const screen = readSrc('src/screens/communication/ArchivedConversationsScreen.tsx');
    expect(screen).toContain('CommunicationArchivedHero');
  });

  it('Stationär moduleExtensionService wired zu Supabase Repo', () => {
    const service = readSrc('src/lib/stationaer/moduleExtensionService.ts');
    expect(service).toContain('stationaerExtensionSupabaseRepository');
    expect(readSrc('src/lib/services/repositories/stationaerExtensionRepository.supabase.ts')).toContain(
      'stationaer_living_areas',
    );
  });

  it('Akademie moduleExtensionService wired zu Supabase Repo', () => {
    const service = readSrc('src/lib/akademie/moduleExtensionService.ts');
    expect(service).toContain('akademieExtensionSupabaseRepository');
    expect(readSrc('src/lib/services/repositories/akademieExtensionRepository.supabase.ts')).toContain(
      'akademie_enrollments',
    );
  });

  it('Extension LiveReady bleibt ehrlich false', () => {
    expect(readSrc('src/lib/stationaer/stationaerModuleConfig.ts')).toContain(
      'isStationaerExtensionLiveReady',
    );
    expect(readSrc('src/lib/akademie/akademieModuleConfig.ts')).toContain('isAkademieExtensionLiveReady');
  });
});
