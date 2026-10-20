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
      ...{
        totalResidents: 42,
        activeCount: 38,
        newAdmissionsCount: 2,
        occupancyPercent: 91,
        handoverPendingCount: 1,
      },
      freeBeds: 0,
      totalBeds: 0,
      admissionsToday: 0,
      admissionsThisWeek: 0,
      dischargesToday: 0,
      dischargesThisWeek: 0,
      openRoomAssignments: 0,
      activeLivingAreas: 0,
      openDailyStructureCount: 0,
      openMealPlanningCount: 0,
      openHandoversCount: 0,
      openHandoverReportsCount: 0,
      alertsCount: 0,
      openResidentPlanningCount: 0,
      roomConflictCount: 0,
    });
    expect(kpis).toHaveLength(3);
    expect(kpis[0]?.value).toBe('42');
    expect(kpis[1]?.value).toBe('91 %');
  });

  it('StationaerIndexScreen nutzt ModuleDashboardShell mit StationaerDashboardView', () => {
    const screen = readSrc('src/screens/stationaer/StationaerIndexScreen.tsx');
    expect(screen).toContain('ModuleDashboardShell');
    expect(screen).toContain('StationaerDashboardView');
    expect(screen).toContain('InfoBanner');
    expect(screen).toContain('isPreviewData');
    expect(screen).toContain('STATIONAER_EXTENSION_PREPARED_MESSAGE');
    expect(screen).not.toContain('CareLightModuleDashboard');
    expect(screen).not.toContain('StatTile');
  });

  it('Erweiterungen sind demo-funktional', () => {
    expect(isStationaerExtensionLiveReady()).toBe(true);
  });
});
