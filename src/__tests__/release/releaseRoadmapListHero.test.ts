import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { releaseDemoList } from '@/data/demo/domains/releaseDemo';
import { roadmapDemoList } from '@/data/demo/domains/roadmapDemo';
import { buildReleaseListKpis } from '@/lib/release/releaseListStats';
import { buildRoadmapListKpis } from '@/lib/roadmap/roadmapListStats';
import { isReleaseLiveReady } from '@/lib/release/releaseModuleConfig';
import { isRoadmapLiveReady } from '@/lib/roadmap/roadmapModuleConfig';

function readSrc(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Release List Hero (Sprint 70)', () => {
  it('ReleaseListHero nutzt PremiumListHeroFrame mit Release-Listen-KPIs', () => {
    const hero = readSrc('src/components/release/ReleaseListHero.tsx');
    expect(hero).toContain('PremiumListHeroFrame');
    expect(hero).toContain('Release-Checklisten');
    expect(hero).toContain('buildReleaseListKpis');
    expect(hero).toContain('PremiumKpiCard');
  });

  it('ReleaseListHero zeigt ehrliches preparedOnly-Badge', () => {
    const hero = readSrc('src/components/release/ReleaseListHero.tsx');
    expect(hero).toContain('isReleaseLiveReady');
    expect(hero).toContain('Live-Deployment in Vorbereitung');
    expect(isReleaseLiveReady()).toBe(false);
  });

  it('ReleaseListScreen nutzt Hero und InfoBanner', () => {
    const screen = readSrc('src/screens/release/ReleaseListScreen.tsx');
    expect(screen).toContain('ReleaseListHero');
    expect(screen).toContain('InfoBanner');
    expect(screen).toContain('RELEASE_PREPARED_MESSAGE');
    expect(screen).not.toContain('service_role');
  });

  it('buildReleaseListKpis aggregiert Releases und Checklisten', () => {
    const kpis = buildReleaseListKpis(releaseDemoList);
    expect(kpis.some((k) => k.id === 'total')).toBe(true);
    expect(kpis.some((k) => k.id === 'in-progress')).toBe(true);
    expect(kpis.some((k) => k.id === 'checklist')).toBe(true);
  });
});

describe('Roadmap List Hero (Sprint 70)', () => {
  it('RoadmapListHero nutzt PremiumListHeroFrame mit Roadmap-Listen-KPIs', () => {
    const hero = readSrc('src/components/roadmap/RoadmapListHero.tsx');
    expect(hero).toContain('PremiumListHeroFrame');
    expect(hero).toContain('Meilenstein-Übersicht');
    expect(hero).toContain('buildRoadmapListKpis');
    expect(hero).toContain('PremiumKpiCard');
  });

  it('RoadmapListHero zeigt ehrliches preparedOnly-Badge', () => {
    const hero = readSrc('src/components/roadmap/RoadmapListHero.tsx');
    expect(hero).toContain('isRoadmapLiveReady');
    expect(hero).toContain('Live-Sync in Vorbereitung');
    expect(isRoadmapLiveReady()).toBe(false);
  });

  it('RoadmapListScreen nutzt Hero und InfoBanner', () => {
    const screen = readSrc('src/screens/roadmap/RoadmapListScreen.tsx');
    expect(screen).toContain('RoadmapListHero');
    expect(screen).toContain('InfoBanner');
    expect(screen).toContain('ROADMAP_PREPARED_MESSAGE');
    expect(screen).not.toContain('service_role');
  });

  it('buildRoadmapListKpis aggregiert Meilensteine und Phasen', () => {
    const kpis = buildRoadmapListKpis(roadmapDemoList);
    expect(kpis.some((k) => k.id === 'total')).toBe(true);
    expect(kpis.some((k) => k.id === 'active')).toBe(true);
    expect(kpis.some((k) => k.id === 'launch')).toBe(true);
    expect(kpis.some((k) => k.id === 'top-phase')).toBe(true);
  });
});
