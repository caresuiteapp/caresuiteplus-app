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
    expect(hero).toContain('guardServiceTenant');
  });

  it('buildAssistDashboardKpis mappt Stats ehrlich', () => {
    const kpis = buildAssistDashboardKpis({
      totalAssignments: 30,
      todayCount: 5,
      activeCount: 8,
      inProgressCount: 2,
      completedTodayCount: 1,
      upcomingCount: 12,
    });
    expect(kpis[0]?.value).toBe('5');
    expect(kpis[1]?.value).toBe('8');
    expect(kpis[2]?.value).toBe('12');
  });

  it('AssistIndexScreen nutzt CareLightModuleDashboard (light premium)', () => {
    const screen = readSrc('src/screens/assist/AssistIndexScreen.tsx');
    expect(screen).toContain('CareLightScreen');
    expect(screen).toContain('CareLightModuleDashboard');
    expect(screen).toContain('InfoBanner');
    expect(screen).toContain('ASSIST_EXTENSION_PREPARED_MESSAGE');
    expect(screen).not.toContain('AdaptiveModuleDashboard');
    expect(screen).not.toContain('StatKpi');
  });

  it('Erweiterungen sind demo-funktional', () => {
    expect(isAssistExtensionLiveReady()).toBe(true);
  });
});
