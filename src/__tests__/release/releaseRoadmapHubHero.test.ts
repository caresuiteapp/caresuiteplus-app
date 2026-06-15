import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { isReleaseLiveReady } from '@/lib/release/releaseModuleConfig';
import { isRoadmapLiveReady } from '@/lib/roadmap/roadmapModuleConfig';

function readSrc(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Release Hub Hero (Sprint 64)', () => {
  it('ReleaseHubHero nutzt PremiumListHeroFrame mit Release-KPIs', () => {
    const hero = readSrc('src/components/release/ReleaseHubHero.tsx');
    expect(hero).toContain('PremiumListHeroFrame');
    expect(hero).toContain('Release & Deployment');
    expect(hero).toContain('PremiumKpiCard');
  });

  it('ReleaseHubHero zeigt ehrliches preparedOnly-Badge', () => {
    const hero = readSrc('src/components/release/ReleaseHubHero.tsx');
    const config = readSrc('src/lib/release/releaseModuleConfig.ts');
    expect(config).toContain('isReleaseLiveReady');
    expect(hero).toContain('isReleaseLiveReady');
    expect(hero).toContain('Live-Deployment in Vorbereitung');
    expect(isReleaseLiveReady()).toBe(false);
  });

  it('ReleaseHubScreen nutzt Hero und InfoBanner', () => {
    const screen = readSrc('src/screens/release/ReleaseHubScreen.tsx');
    expect(screen).toContain('ReleaseHubHero');
    expect(screen).toContain('InfoBanner');
    expect(screen).toContain('RELEASE_PREPARED_MESSAGE');
    expect(screen).not.toContain('service_role');
  });
});

describe('Roadmap Hub Hero (Sprint 64)', () => {
  it('RoadmapHubHero nutzt PremiumListHeroFrame mit Roadmap-KPIs', () => {
    const hero = readSrc('src/components/roadmap/RoadmapHubHero.tsx');
    expect(hero).toContain('PremiumListHeroFrame');
    expect(hero).toContain('Strategische Roadmap');
    expect(hero).toContain('PremiumKpiCard');
  });

  it('RoadmapHubHero zeigt ehrliches preparedOnly-Badge', () => {
    const hero = readSrc('src/components/roadmap/RoadmapHubHero.tsx');
    const config = readSrc('src/lib/roadmap/roadmapModuleConfig.ts');
    expect(config).toContain('isRoadmapLiveReady');
    expect(hero).toContain('isRoadmapLiveReady');
    expect(hero).toContain('Live-Sync in Vorbereitung');
    expect(isRoadmapLiveReady()).toBe(false);
  });

  it('RoadmapHubScreen nutzt Hero und InfoBanner', () => {
    const screen = readSrc('src/screens/roadmap/RoadmapHubScreen.tsx');
    expect(screen).toContain('RoadmapHubHero');
    expect(screen).toContain('InfoBanner');
    expect(screen).toContain('ROADMAP_PREPARED_MESSAGE');
    expect(screen).not.toContain('service_role');
  });
});
