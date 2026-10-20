import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { isTILiveReady } from '@/lib/ti/tiModuleConfig';

function readSrc(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('TI/KIM Dashboard Hero (Sprint 56)', () => {
  it('TIDashboardHero nutzt PremiumListHeroFrame mit TI-KPIs', () => {
    const hero = readSrc('src/components/ti/TIDashboardHero.tsx');
    expect(hero).toContain('PremiumListHeroFrame');
    expect(hero).toContain('Telematikinfrastruktur');
    expect(hero).toContain('PremiumKpiCard');
    expect(hero).toContain('data.kpis.map');
  });

  it('TIDashboardHero zeigt ehrliches preparedOnly-Badge', () => {
    const hero = readSrc('src/components/ti/TIDashboardHero.tsx');
    const config = readSrc('src/lib/ti/tiModuleConfig.ts');
    expect(config).toContain('isTILiveReady');
    expect(hero).toContain('isTILiveReady');
    expect(hero).toContain('TI in Vorbereitung');
    expect(isTILiveReady()).toBe(false);
  });

  it('TIDashboardScreen ersetzt flaches KPI-Grid durch Hero und Banner', () => {
    const screen = readSrc('src/screens/ti/TIDashboardScreen.tsx');
    expect(screen).toContain('TIDashboardHero');
    expect(screen).toContain('InfoBanner');
    expect(screen).toContain('TI_PREPARED_MESSAGE');
    expect(screen).not.toContain('styles.kpiRow');
  });

  it('TI-Service bleibt Demo-only ohne service_role', () => {
    const service = readSrc('src/lib/ti/index.ts');
    expect(service).toContain('getTIDashboardSnapshot');
    expect(service).not.toContain('service_role');
  });
});
