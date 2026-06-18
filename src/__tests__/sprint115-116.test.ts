import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  countInsightLiveFlipBlockersRemaining,
  getInsightLiveFlipBlockers,
  isInsightLiveReady,
  mapInsightDataSourceRow,
  mapInsightExportRow,
} from '@/lib/insight';

function readSrc(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Demo Entry Screen Heroes (Sprint 115)', () => {
  it('PilotReadinessScreen nutzt PilotReadinessHero statt flachem PremiumCard-Header', () => {
    const screen = readSrc('src/screens/pilot/PilotReadinessScreen.tsx');
    expect(screen).toContain('PilotReadinessHero');
    expect(screen).not.toContain('PremiumKpiCard');
    const hero = readSrc('src/components/pilot/PilotReadinessHero.tsx');
    expect(hero).toContain('PremiumListHeroFrame');
    expect(hero).toContain('preparedOnly Pilot');
  });

  it('DemoLoginScreen nutzt DemoLoginHero statt PremiumCard-Hint', () => {
    const screen = readSrc('src/screens/DemoLoginScreen.tsx');
    expect(screen).toContain('DemoLoginHero');
    expect(screen).not.toContain('PremiumCard accentColor');
    const hero = readSrc('src/components/auth/DemoLoginHero.tsx');
    expect(hero).toContain('CareLightListHeroFrame');
    expect(hero).toContain('preparedOnly Auth');
  });

  it('DemoModeHintScreen nutzt DemoModeHintHero', () => {
    const screen = readSrc('src/screens/DemoModeHintScreen.tsx');
    expect(screen).toContain('DemoModeHintHero');
    expect(screen).not.toContain('PremiumCard accentColor');
    const hero = readSrc('src/components/auth/DemoModeHintHero.tsx');
    expect(hero).toContain('PremiumListHeroFrame');
    expect(hero).toContain('EXPO_PUBLIC_DEMO_MODE');
  });
});

describe('InsightCenter Live Wiring Prep (Sprint 116)', () => {
  it('isInsightLiveReady bleibt ehrlich false', () => {
    expect(isInsightLiveReady()).toBe(false);
  });

  it('getInsightLiveFlipBlockers listet offene Blocker', () => {
    const blockers = getInsightLiveFlipBlockers();
    expect(blockers.length).toBeGreaterThanOrEqual(4);
    expect(blockers.every((b) => !b.resolved)).toBe(true);
    expect(countInsightLiveFlipBlockersRemaining()).toBe(blockers.length);
  });

  it('mapInsightExportRow und mapInsightDataSourceRow mappen Live-Zeilen', () => {
    const exportRow = mapInsightExportRow({
      id: 'exp-1',
      tenant_id: 't1',
      title: 'Office KPI Export',
      format: 'csv',
      schedule_label: 'Monatlich',
      status: 'planned',
      updated_at: '2026-06-14T10:00:00.000Z',
    });
    expect(exportRow.format).toBe('csv');
    expect(exportRow.status).toBe('planned');

    const sourceRow = mapInsightDataSourceRow({
      id: 'ds-1',
      tenant_id: 't1',
      module_key: 'office',
      label: 'Office KPIs',
      connection_status: 'prepared',
      created_at: '2026-06-14T10:00:00.000Z',
    });
    expect(sourceRow.moduleKey).toBe('office');
    expect(sourceRow.connectionStatus).toBe('prepared');
  });

  it('insightLiveMapper exportiert alle Tabellen-Mapper', () => {
    const mapper = readSrc('src/lib/insight/insightLiveMapper.ts');
    expect(mapper).toContain('mapInsightExportRow');
    expect(mapper).toContain('mapInsightDataSourceRow');
  });
});
