import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { buildAssistDashboardKpis } from '@/lib/assist/assistDashboardStats';
import { isAssistExtensionLiveReady } from '@/lib/assist/assistModuleConfig';

function readSrc(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Assist Dashboard Hero (Sprint 81)', () => {
  it('AssistDashboardHero nutzt PremiumListHeroFrame mit KPIs', () => {
    const hero = readSrc('src/components/assist/AssistDashboardHero.tsx');
    expect(hero).toContain('PremiumListHeroFrame');
    expect(hero).toContain('Einsatzplanung');
    expect(hero).toContain('AdaptiveKpiGrid');
    expect(hero).toContain('buildAssistDashboardKpis');
  });

  it('buildAssistDashboardKpis mappt Stats ehrlich', () => {
    const kpis = buildAssistDashboardKpis({
      totalAssignments: 30,
      todayCount: 5,
      activeCount: 8,
      inProgressCount: 2,
      completedTodayCount: 1,
      upcomingCount: 12,
      atRiskCount: 3,
      incompleteCount: 4,
      openProofCount: 2,
      openSignatureCount: 1,
      openTripsCount: 2,
    });
    expect(kpis[0]?.value).toBe('5');
    expect(kpis[1]?.value).toBe('8');
    expect(kpis[5]?.value).toBe('2');
    expect(kpis[6]?.value).toBe('1');
    expect(kpis[7]?.value).toBe('2');
    expect(kpis[3]?.navigationTarget).toBe('/assist/qualitaet');
  });

  it('AssistIndexScreen nutzt ScreenShell und AssistDashboardHero', () => {
    const screen = readSrc('src/screens/assist/AssistIndexScreen.tsx');
    expect(screen).toContain('ScreenShell');
    expect(screen).toContain('AssistDashboardHero');
    expect(screen).toContain('SectionPanel');
    expect(screen).toContain('Live-Aktivität');
    expect(screen).toContain('InfoBanner');
    expect(screen).toContain('ASSIST_EXTENSION_PREPARED_MESSAGE');
    expect(screen).not.toContain('CareLightScreen');
    expect(screen).not.toContain('CareLightModuleDashboard');
  });

  it('Erweiterungen sind demo-funktional', () => {
    expect(isAssistExtensionLiveReady()).toBe(true);
  });
});
