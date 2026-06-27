import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

function readSrc(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Portal Message Detail Hero (Sprint 82)', () => {
  it('PortalMessageDetailHero nutzt PremiumListHeroFrame mit beiden Portal-Sichten', () => {
    const hero = readSrc('src/components/portal/PortalMessageDetailHero.tsx');
    expect(hero).toContain('PremiumListHeroFrame');
    expect(hero).toContain('KLIENT:INNENPORTAL');
    expect(hero).toContain('MITARBEITERPORTAL');
    expect(hero).toContain('scopeLabel');
    expect(hero).toContain('PremiumKpiCard');
  });

  it('PortalMessageDetailScreen ersetzt flache PremiumCard', () => {
    const screen = readSrc('src/screens/portal/PortalMessageDetailScreen.tsx');
    expect(screen).toContain('PortalMessageDetailHero');
    expect(screen).toContain('scope="employee"');
    expect(screen).not.toContain('PremiumCard accentColor');
  });

  it('PortalClientMessageDetailScreen ersetzt flache PremiumCard', () => {
    const screen = readSrc('src/screens/portal/PortalClientMessageDetailScreen.tsx');
    expect(screen).toContain('PortalMessageDetailHero');
    expect(screen).toContain('scope="client"');
    expect(screen).not.toContain('PremiumCard accentColor');
  });
});
