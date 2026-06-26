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
    expect(hero).toContain('PremiumKpiCard');
    expect(hero).toContain('formatOfficeDocumentSizeDisplay');
    expect(hero).toContain('viewReady');
    expect(hero).toContain('downloadSubLabel');
    expect(hero).toContain('isDemoMode');
    expect(hero).toContain('Inhalt ausstehend');
    expect(hero).not.toContain('Download vorbereitet');
    expect(hero).not.toMatch(/subValue=\{document\.downloadReady \? 'Demo-Download'/);
  });

  it('PortalDocumentDetailHero uses AdaptiveKpiGrid with 2-column mobile layout', () => {
    const hero = readSrc('src/components/portal/PortalDocumentDetailHero.tsx');
    expect(hero).toContain('AdaptiveKpiGrid');
    expect(hero).toContain('useDeviceClass');
    expect(hero).toContain('phone: 2');
    expect(hero).toContain('tablet: 2');
    expect(hero).toContain('desktop: 4');
    expect(hero).toContain('labelCase');
    expect(hero).toContain('valueLines={2}');
    expect(hero).not.toContain('kpiRow');
    expect(hero).not.toContain('minWidth: 100');
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
    expect(screen).toContain('useDeviceClass');
    expect(screen).toContain('usePlatformLayout');
    expect(screen).not.toContain('PremiumCard accentColor');
  });
});
