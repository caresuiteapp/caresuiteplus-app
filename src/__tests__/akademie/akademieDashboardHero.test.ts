import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { buildAkademieDashboardKpis } from '@/lib/akademie/akademieDashboardStats';
import { isAkademieExtensionLiveReady } from '@/lib/akademie/akademieModuleConfig';

function readSrc(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Akademie Dashboard Hero (Sprint 76)', () => {
  it('AkademieDashboardHero nutzt PremiumListHeroFrame mit KPIs', () => {
    const hero = readSrc('src/components/akademie/AkademieDashboardHero.tsx');
    expect(hero).toContain('PremiumListHeroFrame');
    expect(hero).toContain('Schulungen & Zertifikate');
    expect(hero).toContain('AdaptiveKpiGrid');
  });

  it('buildAkademieDashboardKpis mappt Stats ehrlich', () => {
    const kpis = buildAkademieDashboardKpis({
      totalCourses: 12,
      activeCoursesCount: 8,
      mandatoryCount: 3,
      totalEnrollments: 45,
      upcomingStartsCount: 2,
    });
    expect(kpis[0]?.value).toBe('8');
    expect(kpis[2]?.value).toBe('45');
  });

  it('AkademieIndexScreen nutzt CareLightModuleDashboard (light premium)', () => {
    const screen = readSrc('src/screens/akademie/AkademieIndexScreen.tsx');
    expect(screen).toContain('CareLightScreen');
    expect(screen).toContain('CareLightModuleDashboard');
    expect(screen).toContain('InfoBanner');
    expect(screen).not.toContain('AdaptiveModuleDashboard');
    expect(screen).not.toContain('StatTile');
  });

  it('Erweiterungen sind demo-funktional', () => {
    expect(isAkademieExtensionLiveReady()).toBe(true);
  });
});
