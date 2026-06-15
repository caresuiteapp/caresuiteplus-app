import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { buildReleaseDetailKpis } from '@/lib/release/releaseDetailStats';
import { buildRoadmapDetailKpis } from '@/lib/roadmap/roadmapDetailStats';
import { releaseDemoList, versionManifest } from '@/data/demo/domains/releaseDemo';

function readSrc(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Business Detail Heroes (Sprint 97)', () => {
  it('ReleaseDetailHero nutzt PremiumListHeroFrame mit preparedOnly', () => {
    const hero = readSrc('src/components/release/ReleaseDetailHero.tsx');
    expect(hero).toContain('PremiumListHeroFrame');
    expect(hero).toContain('isReleaseLiveReady');
    expect(readSrc('src/screens/release/ReleaseDetailScreen.tsx')).toContain('ReleaseDetailHero');
  });

  it('RoadmapDetailHero nutzt PremiumListHeroFrame mit preparedOnly', () => {
    const hero = readSrc('src/components/roadmap/RoadmapDetailHero.tsx');
    expect(hero).toContain('PremiumListHeroFrame');
    expect(hero).toContain('isRoadmapLiveReady');
    expect(readSrc('src/screens/roadmap/RoadmapDetailScreen.tsx')).toContain('RoadmapDetailHero');
  });

  it('buildReleaseDetailKpis berechnet Checklisten-Fortschritt', () => {
    const detail = {
      ...releaseDemoList[0],
      summary: 'Test',
      checklist: [
        { id: '1', label: 'A', done: true, assignee: 'Dev' },
        { id: '2', label: 'B', done: false, assignee: 'QA' },
      ],
      manifest: versionManifest,
    };
    const kpis = buildReleaseDetailKpis(detail);
    expect(kpis[1]?.value).toBe('50 %');
    expect(kpis[1]?.subValue).toBe('1/2 erledigt');
  });

  it('buildRoadmapDetailKpis nutzt Phase und Erfolgskriterien', () => {
    const kpis = buildRoadmapDetailKpis({
      id: 'rm-001',
      tenantId: 't1',
      title: 'Pilot',
      phase: 'launch',
      quarter: 'Q3 2026',
      status: 'in_bearbeitung',
      updatedAt: '2026-06-01',
      summary: 'Test',
      owner: 'Product',
      market: 'DE',
      successCriteria: ['KPI A', 'KPI B'],
    });
    expect(kpis[0]?.value).toBe('Markteintritt');
    expect(kpis[3]?.value).toBe('2');
  });
});
