import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { buildInsightDashboardKpis } from '@/lib/insight/insightDashboardStats';
import { isInsightLiveReady } from '@/lib/insight/insightModuleConfig';

function readSrc(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('InsightCenter Module Scaffold (Sprint 89)', () => {
  it('isInsightLiveReady bleibt ehrlich false', () => {
    expect(isInsightLiveReady()).toBe(false);
  });

  it('InsightDashboardHero nutzt PremiumListHeroFrame mit preparedOnly', () => {
    const hero = readSrc('src/components/insight/InsightDashboardHero.tsx');
    expect(hero).toContain('PremiumListHeroFrame');
    expect(hero).toContain('INSIGHTCENTER');
    expect(hero).toContain('isInsightLiveReady');
    expect(hero).toContain('Demo / preparedOnly');
  });

  it('InsightIndexScreen nutzt CareLightModuleDashboard (light premium)', () => {
    const screen = readSrc('src/screens/insight/InsightIndexScreen.tsx');
    expect(screen).toContain('CareLightScreen');
    expect(screen).toContain('CareLightModuleDashboard');
    expect(screen).toContain('moduleKey="insight"');
    expect(screen).toContain('isActive onPress');
    expect(screen).toContain('INSIGHT_PREPARED_MESSAGE');
    expect(screen).not.toContain('AdaptiveModuleDashboard');
  });

  it('Route /insight ist registriert', () => {
    const routes = readSrc('src/lib/navigation/routes.ts');
    expect(routes).toContain("path: '/insight'");
    expect(routes).toContain('InsightCenter');
  });

  it('buildInsightDashboardKpis liefert Scaffold-Werte', () => {
    const kpis = buildInsightDashboardKpis({
      configuredDashboards: 0,
      savedReports: 0,
      scheduledExports: 0,
      dataSourcesReady: 0,
    });
    expect(kpis[0]?.value).toBe('0');
    expect(kpis[3]?.subValue).toContain('Warehouse');
  });
});
