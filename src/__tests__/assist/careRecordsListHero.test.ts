import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { buildCareRecordsListKpis } from '@/lib/assist/careRecordsListStats';

function readSrc(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Care Records List Hero (Sprint 99)', () => {
  it('CareRecordsListHero nutzt PremiumListHeroFrame', () => {
    const hero = readSrc('src/components/assist/CareRecordsListHero.tsx');
    expect(hero).toContain('PremiumListHeroFrame');
    expect(hero).toContain('Leistungsnachweise');
    expect(readSrc('src/components/assist/CareRecordsListView.tsx')).toContain('CareRecordsListHero');
  });

  it('buildCareRecordsListKpis zählt signierte Nachweise', () => {
    const kpis = buildCareRecordsListKpis(
      [
        { hasSignature: true, pdfReady: true, status: 'abgeschlossen' } as never,
        { hasSignature: false, pdfReady: false, status: 'aktiv' } as never,
      ],
      4,
    );
    expect(kpis[0]?.value).toBe('4');
    expect(kpis[1]?.value).toBe('1');
    expect(kpis[2]?.value).toBe('1');
  });
});
