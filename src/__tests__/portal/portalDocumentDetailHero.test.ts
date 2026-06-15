import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

function readSrc(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Portal Document Detail Hero (Sprint 83)', () => {
  it('PortalDocumentDetailHero nutzt PremiumListHeroFrame mit beiden Portal-Sichten', () => {
    const hero = readSrc('src/components/portal/PortalDocumentDetailHero.tsx');
    expect(hero).toContain('PremiumListHeroFrame');
    expect(hero).toContain('KLIENT:INNENPORTAL');
    expect(hero).toContain('MITARBEITERPORTAL');
    expect(hero).toContain('DOKUMENT');
    expect(hero).toContain('PremiumKpiCard');
    expect(hero).toContain('formatFileSize');
  });

  it('PortalDocumentDetailScreen ersetzt flache PremiumCard', () => {
    const screen = readSrc('src/screens/portal/PortalDocumentDetailScreen.tsx');
    expect(screen).toContain('PortalDocumentDetailHero');
    expect(screen).toContain('scope="employee"');
    expect(screen).not.toContain('PremiumCard accentColor');
  });

  it('PortalClientDocumentDetailScreen ersetzt flache PremiumCard', () => {
    const screen = readSrc('src/screens/portal/PortalClientDocumentDetailScreen.tsx');
    expect(screen).toContain('PortalDocumentDetailHero');
    expect(screen).toContain('scope="client"');
    expect(screen).not.toContain('PremiumCard accentColor');
  });
});
