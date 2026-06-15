import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { buildBeratungDashboardKpis } from '@/lib/beratung/beratungDashboardStats';
import { isBeratungExtensionLiveReady } from '@/lib/beratung/beratungModuleConfig';

function readSrc(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Beratung Dashboard Hero (Sprint 76)', () => {
  it('BeratungDashboardHero nutzt PremiumListHeroFrame mit KPIs', () => {
    const hero = readSrc('src/components/beratung/BeratungDashboardHero.tsx');
    expect(hero).toContain('PremiumListHeroFrame');
    expect(hero).toContain('Sozial- und Pflegeberatung');
    expect(hero).toContain('AdaptiveKpiGrid');
    expect(hero).toContain('buildBeratungDashboardKpis');
  });

  it('buildBeratungDashboardKpis mappt Stats ehrlich', () => {
    const kpis = buildBeratungDashboardKpis({
      totalCases: 20,
      openCount: 5,
      activeCount: 8,
      upcomingAppointmentsCount: 3,
      closedThisMonthCount: 4,
    });
    expect(kpis[0]?.value).toBe('5');
    expect(kpis[1]?.value).toBe('3');
  });

  it('BeratungIndexScreen nutzt CareLightModuleDashboard (light premium)', () => {
    const screen = readSrc('src/screens/beratung/BeratungIndexScreen.tsx');
    expect(screen).toContain('CareLightScreen');
    expect(screen).toContain('CareLightModuleDashboard');
    expect(screen).toContain('InfoBanner');
    expect(screen).not.toContain('AdaptiveModuleDashboard');
    expect(screen).not.toContain('StatTile');
    expect(screen).toContain("moduleColor('beratung')");
  });

  it('Erweiterungen sind demo-funktional', () => {
    expect(isBeratungExtensionLiveReady()).toBe(true);
  });
});
