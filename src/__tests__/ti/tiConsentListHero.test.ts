import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { buildTIConsentListKpis } from '@/lib/ti/tiConsentListStats';

function readSrc(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('TI Consent List Hero (Sprint 99)', () => {
  it('TIConsentListHero nutzt CareLightListHeroFrame mit isTILiveReady', () => {
    const hero = readSrc('src/components/ti/TIConsentListHero.tsx');
    expect(hero).toContain('CareLightListHeroFrame');
    expect(hero).toContain('isTILiveReady');
    expect(readSrc('src/screens/ti/TIConsentManagementScreen.tsx')).toContain('TIConsentListHero');
  });

  it('buildTIConsentListKpis zählt ausstehende Einwilligungen', () => {
    const kpis = buildTIConsentListKpis([
      { status: 'pending' } as never,
      { status: 'granted' } as never,
      { status: 'granted' } as never,
    ]);
    expect(kpis[0]?.value).toBe('3');
    expect(kpis[1]?.value).toBe('1');
    expect(kpis[2]?.value).toBe('2');
  });
});
