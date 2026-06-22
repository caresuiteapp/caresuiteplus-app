import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { designTokens, gradients } from '@/theme';
import { AURORA_HERO_GRADIENT, AURORA_BUTTON_PRIMARY } from '@/theme/careSuiteAurora';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('Design token consolidation', () => {
  it('gradients.hero.list definiert Aurora Hero-Verlauf', () => {
    expect(gradients.hero.list.length).toBe(3);
    expect(gradients.hero.list[0]).toBe(AURORA_HERO_GRADIENT[0]);
  });

  it('gradients.primary nutzt Aurora Button-Verlauf', () => {
    expect(gradients.primary[0]).toBe(AURORA_BUTTON_PRIMARY[0]);
  });

  it('designTokens.hero enthält zentrale Hero-Meta', () => {
    expect(designTokens.hero.iconBadgeSize).toBe(48);
    expect(designTokens.hero.eyebrowLetterSpacing).toBe(1);
  });

  it('PremiumListHeroFrame nutzt Aurora Hero-Tokens', () => {
    const source = readSrc('src/components/ui/PremiumListHeroFrame.tsx');
    expect(source).toContain('AURORA_HERO_COLORS');
    expect(source).toContain('designTokens.hero');
    expect(source).toContain('auroraSharedStyles');
  });

  it('PremiumButton nutzt Aurora Primary-Gradient', () => {
    const source = readSrc('src/components/ui/PremiumButton.tsx');
    expect(source).toContain('AURORA_BUTTON_PRIMARY');
    expect(source).not.toContain("colors={['#FF9500'");
  });

  it('InvoicesListHero nutzt PremiumListHeroFrame', () => {
    const source = readSrc('src/components/office/InvoicesListHero.tsx');
    expect(source).toContain('PremiumListHeroFrame');
    expect(source).not.toContain("colors={['#1A2030'");
  });

  it('CarePlansListHero nutzt PremiumListHeroFrame', () => {
    const source = readSrc('src/components/pflege/CarePlansListHero.tsx');
    expect(source).toContain('PremiumListHeroFrame');
  });

  it('ClientsListHero nutzt PremiumListHeroFrame', () => {
    const source = readSrc('src/components/office/ClientsListHero.tsx');
    expect(source).toContain('PremiumListHeroFrame');
    expect(source).not.toContain('CareLightListHeroFrame');
  });

  it('EmployeesListHero nutzt PremiumListHeroFrame', () => {
    const source = readSrc('src/components/office/EmployeesListHero.tsx');
    expect(source).toContain('PremiumListHeroFrame');
    expect(source).not.toContain('CareLightListHeroFrame');
  });

  it('DocumentsListHero nutzt PremiumListHeroFrame', () => {
    const source = readSrc('src/components/office/DocumentsListHero.tsx');
    expect(source).toContain('PremiumListHeroFrame');
    expect(source).not.toContain("colors={['#1A2030'");
  });
});
