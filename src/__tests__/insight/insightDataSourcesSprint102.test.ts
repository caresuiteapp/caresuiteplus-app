import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('InsightCenter Data Sources (Sprint 102)', () => {
  it('InsightDataSourcesListHero nutzt PremiumListHeroFrame', () => {
    const hero = readSrc('src/components/insight/InsightDataSourcesListHero.tsx');
    expect(hero).toContain('PremiumListHeroFrame');
    expect(readSrc('src/components/insight/InsightDataSourcesListView.tsx')).toContain('InsightDataSourcesListHero');
  });

  it('InsightDataSourceDetailHero und Route existieren', () => {
    expect(readSrc('src/components/insight/InsightDataSourceDetailHero.tsx')).toContain('PremiumListHeroFrame');
    expect(readSrc('app/insight/data-sources/index.tsx')).toContain('InsightDataSourcesListScreen');
    expect(readSrc('app/insight/data-sources/[id].tsx')).toContain('InsightDataSourceDetailScreen');
  });

  it('fetchInsightDataSources in insightDashboardService', () => {
    const service = readSrc('src/lib/insight/insightDashboardService.ts');
    expect(service).toContain('fetchInsightDataSources');
    expect(service).toContain('fetchInsightDataSourceDetail');
  });

  it('InsightIndexScreen verlinkt Datenquellen', () => {
    const screen = readSrc('src/screens/insight/InsightIndexScreen.tsx');
    expect(screen).toContain('/insight/data-sources');
    expect(screen).toContain('Datenquellen');
  });
});

describe('Settings and Business Hub Polish (Sprint 102)', () => {
  it('PrivacySettingsHero auf DSGVO-Screens', () => {
    expect(readSrc('src/screens/settings/DataRequestScreen.tsx')).toContain('PrivacySettingsHero');
    expect(readSrc('src/screens/settings/AccountDeletionRequestScreen.tsx')).toContain('PrivacySettingsHero');
  });

  it('SubscriptionHero auf SubscriptionScreen', () => {
    expect(readSrc('src/screens/business/SubscriptionScreen.tsx')).toContain('SubscriptionHero');
  });

  it('PlatformHubHero auf PlatformHubScreen', () => {
    expect(readSrc('src/screens/platform/PlatformHubScreen.tsx')).toContain('PlatformHubHero');
  });
});

describe('Migration 0036 Module Extensions (Sprint 102)', () => {
  it('0036_module_extensions_prepared.sql existiert mit RLS', () => {
    const migration = readSrc('supabase/migrations/0036_module_extensions_prepared.sql');
    expect(migration).toContain('stationaer_living_areas');
    expect(migration).toContain('akademie_enrollments');
    expect(migration).toContain('ENABLE ROW LEVEL SECURITY');
    expect(migration).not.toContain('DROP TABLE');
  });
});
