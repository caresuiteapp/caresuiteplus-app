import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { buildQmDashboardKpis } from '@/lib/qm/qmDashboardStats';

function readSrc(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('QM Dashboard Hero (Sprint 97)', () => {
  it('QmDashboardHero nutzt PremiumListHeroFrame mit isQmDashboardLiveReady', () => {
    const hero = readSrc('src/components/qm/QmDashboardHero.tsx');
    expect(hero).toContain('PremiumListHeroFrame');
    expect(hero).toContain('isQmDashboardLiveReady');
    expect(hero).toContain('QM-Dashboard');
  });

  it('QmDashboardScreen nutzt CareLightModuleDashboard statt PreparedModeBanner', () => {
    const screen = readSrc('src/screens/qm/QmDashboardScreen.tsx');
    expect(screen).toContain('CareLightScreen');
    expect(screen).toContain('CareLightModuleDashboard');
    expect(screen).toContain('InfoBanner');
    expect(screen).not.toContain('PreparedModeBanner');
    expect(screen).not.toContain('AdaptiveModuleDashboard');
  });

  it('qmModuleConfig exportiert isQmDashboardLiveReady', () => {
    const config = readSrc('src/lib/qm/qmModuleConfig.ts');
    expect(config).toContain('isQmDashboardLiveReady');
    expect(config).toContain('QM_DASHBOARD_PREPARED_MESSAGE');
  });

  it('buildQmDashboardKpis liefert Kennzahlen', () => {
    const kpis = buildQmDashboardKpis({
      chapterCount: 12,
      documentCount: 34,
      complianceOpenCount: 2,
      mdPackageCount: 5,
      pendingApprovals: 1,
      recentChanges: [],
      upcomingAudits: [],
    });
    expect(kpis[0]?.value).toBe('12');
    expect(kpis[4]?.value).toBe('1');
  });
});
