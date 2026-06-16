import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  buildInsightSnapshotDetailKpis,
  buildInsightSnapshotListKpis,
  isInsightLiveReady,
} from '@/lib/insight';
import { getDemoInsightSnapshotDetail } from '@/data/demo/insightDemo';

function readSrc(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('InsightCenter List/Detail (Sprint 91)', () => {
  it('isInsightLiveReady bleibt ehrlich false', () => {
    expect(isInsightLiveReady()).toBe(false);
  });

  it('InsightSnapshotsListHero nutzt PremiumListHeroFrame mit preparedOnly', () => {
    const hero = readSrc('src/components/insight/InsightSnapshotsListHero.tsx');
    expect(hero).toContain('PremiumListHeroFrame');
    expect(hero).toContain('INSIGHTCENTER');
    expect(hero).toContain('isInsightLiveReady');
  });

  it('InsightSnapshotDetailHero nutzt PremiumListHeroFrame', () => {
    const hero = readSrc('src/components/insight/InsightSnapshotDetailHero.tsx');
    expect(hero).toContain('PremiumListHeroFrame');
    expect(hero).toContain('preparedOnly');
  });

  it('Routes /insight/snapshots und /insight/exports registriert', () => {
    const routes = readSrc('src/lib/navigation/routes.ts');
    expect(routes).toContain("path: '/insight/snapshots'");
    expect(routes).toContain("path: '/insight/exports'");
  });

  it('InsightIndexScreen verlinkt Snapshots und Exporte', () => {
    const screen = readSrc('src/screens/insight/InsightIndexScreen.tsx');
    expect(screen).toContain('/insight/snapshots');
    expect(screen).toContain('/insight/exports');
  });

  it('buildInsightSnapshotListKpis liefert Scaffold-Werte', () => {
    const kpis = buildInsightSnapshotListKpis([
      { id: '1', title: 'Test', moduleLabel: 'Office', updatedAt: '2026-06-01' },
    ]);
    expect(kpis[0]?.value).toBe('1');
    expect(kpis[2]?.subValue).toContain('In Vorbereitung');
  });

  it('Demo-Snapshot-Detail ist preparedOnly', () => {
    const detail = getDemoInsightSnapshotDetail('snap-office-001');
    expect(detail?.status).toBe('prepared');
    const kpis = buildInsightSnapshotDetailKpis(detail!.kpiCount, detail!.periodLabel);
    expect(kpis[2]?.subValue).toContain('In Vorbereitung');
  });
});
