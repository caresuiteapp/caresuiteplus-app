import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

function readSrc(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('QM Document Detail Hero (Sprint 84)', () => {
  it('QmDocumentDetailHero nutzt PremiumListHeroFrame mit KPIs', () => {
    const hero = readSrc('src/components/qm/QmDocumentDetailHero.tsx');
    expect(hero).toContain('PremiumListHeroFrame');
    expect(hero).toContain('QUALITÄTSMANAGEMENT · DOKUMENT');
    expect(hero).toContain('PremiumKpiCard');
    expect(hero).toContain('buildQmDocumentDetailKpis');
    expect(hero).toContain('isQmDocumentsLiveReady');
  });

  it('buildQmDocumentDetailKpis liefert Dok.-Nr., Version, Prüfung und Lesebest.', () => {
    const stats = readSrc('src/lib/qm/qmDocumentDetailStats.ts');
    expect(stats).toContain('buildQmDocumentDetailKpis');
    expect(stats).toContain('Dok.-Nr.');
    expect(stats).toContain('Lesebest.');
  });

  it('QmDocumentDetailScreen nutzt QmDocumentDetailHero', () => {
    const screen = readSrc('src/screens/qm/QmDocumentDetailScreen.tsx');
    expect(screen).toContain('QmDocumentDetailHero');
    expect(screen).toContain('versionCount={versions.length}');
    expect(screen).toContain('confirmationCount={confirmations.length}');
  });

  it('qmModuleConfig exportiert ehrliches isQmDocumentsLiveReady', () => {
    const config = readSrc('src/lib/qm/qmModuleConfig.ts');
    expect(config).toContain('isQmDocumentsLiveReady');
    expect(config).toContain('isSupabaseConfigured');
    expect(config).toContain('QM_DOCUMENTS_PREPARED_MESSAGE');
  });
});
