import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

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
    const statsModule = readSrc('src/lib/beratung/beratungDashboardStats.ts');
    expect(statsModule).toContain('openCount');
    expect(statsModule).toContain('upcomingAppointmentsCount');
    expect(statsModule).toContain('closedThisMonthCount');
  });

  it('BeratungIndexScreen nutzt ModuleDashboardShell (UI Reality Fix)', () => {
    const screen = readSrc('src/screens/beratung/BeratungIndexScreen.tsx');
    expect(screen).toContain('ModuleDashboardShell');
    expect(screen).toContain('BeratungDashboardView');
    expect(screen).toContain('Fälle, Protokolle und Wiedervorlagen im Überblick');
    expect(screen).not.toContain('CareLightModuleDashboard');
    expect(screen).not.toContain('CareLightScreen');
    expect(screen).toContain("moduleColor('beratung')");
  });

  it('Erweiterungen sind demo-funktional', () => {
    const config = readSrc('src/lib/beratung/beratungModuleConfig.ts');
    expect(config).toContain('isBeratungExtensionLiveReady');
    expect(config).toContain('return true');
  });
});
