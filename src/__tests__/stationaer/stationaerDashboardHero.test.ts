import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { buildStationaerDashboardKpis } from '@/lib/stationaer/stationaerDashboardStats';
import { isStationaerExtensionLiveReady } from '@/lib/stationaer/stationaerModuleConfig';

function readSrc(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Stationaer Dashboard Hero (Sprint 75)', () => {
  it('StationaerDashboardHero nutzt PremiumListHeroFrame mit KPIs', () => {
    const hero = readSrc('src/components/stationaer/StationaerDashboardHero.tsx');
    expect(hero).toContain('PremiumListHeroFrame');
    expect(hero).toContain('Pflegeheim');
    expect(hero).toContain('AdaptiveKpiGrid');
    expect(hero).toContain('buildStationaerDashboardKpis');
  });

  it('buildStationaerDashboardKpis mappt Stats ehrlich', () => {
    const kpis = buildStationaerDashboardKpis({
      totalResidents: 42,
      activeCount: 38,
      newAdmissionsCount: 2,
      occupancyPercent: 91,
      handoverPendingCount: 1,
    });
    expect(kpis).toHaveLength(3);
    expect(kpis[0]?.value).toBe('42');
    expect(kpis[1]?.value).toBe('91 %');
  });

  it('StationaerIndexScreen nutzt CareLightModuleDashboard (light premium)', () => {
    const screen = readSrc('src/screens/stationaer/StationaerIndexScreen.tsx');
    expect(screen).toContain('CareLightScreen');
    expect(screen).toContain('CareLightModuleDashboard');
    expect(screen).toContain('InfoBanner');
    expect(screen).toContain('DEMO_DATA_BANNER');
    expect(screen).toContain('isPreviewData');
    expect(screen).toContain('STATIONAER_EXTENSION_PREPARED_MESSAGE');
    expect(screen).not.toContain('AdaptiveModuleDashboard');
    expect(screen).not.toContain('StatTile');
  });

  it('Erweiterungen sind demo-funktional', () => {
    expect(isStationaerExtensionLiveReady()).toBe(true);
  });
});
