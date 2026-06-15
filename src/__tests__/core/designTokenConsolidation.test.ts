import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { designTokens, gradients } from '@/theme';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('Design token consolidation', () => {
  it('gradients.hero.list definiert Dark Premium Hero-Verlauf', () => {
    expect(gradients.hero.list.length).toBe(3);
    expect(gradients.hero.list[0]).toBe('#1A2030');
  });

  it('designTokens.hero enthält zentrale Hero-Meta', () => {
    expect(designTokens.hero.iconBadgeSize).toBe(48);
    expect(designTokens.hero.eyebrowLetterSpacing).toBe(1);
  });

  it('PremiumListHeroFrame nutzt zentrale Theme-Tokens', () => {
    const source = readSrc('src/components/ui/PremiumListHeroFrame.tsx');
    expect(source).toContain('gradients.hero.list');
    expect(source).toContain('designTokens.hero');
    expect(source).toContain('sheen');
  });

  it('InvoicesListHero nutzt CareLightListHeroFrame', () => {
    const source = readSrc('src/components/office/InvoicesListHero.tsx');
    expect(source).toContain('CareLightListHeroFrame');
    expect(source).not.toContain("colors={['#1A2030'");
  });

  it('CarePlansListHero nutzt CareLightListHeroFrame', () => {
    const source = readSrc('src/components/pflege/CarePlansListHero.tsx');
    expect(source).toContain('CareLightListHeroFrame');
  });

  it('ClientsListHero nutzt CareLightListHeroFrame', () => {
    const source = readSrc('src/components/office/ClientsListHero.tsx');
    expect(source).toContain('CareLightListHeroFrame');
    expect(source).not.toContain("colors={['#1A2030'");
  });

  it('EmployeesListHero nutzt CareLightListHeroFrame', () => {
    const source = readSrc('src/components/office/EmployeesListHero.tsx');
    expect(source).toContain('CareLightListHeroFrame');
    expect(source).not.toContain("colors={['#1A2030'");
  });

  it('DocumentsListHero nutzt CareLightListHeroFrame', () => {
    const source = readSrc('src/components/office/DocumentsListHero.tsx');
    expect(source).toContain('CareLightListHeroFrame');
    expect(source).not.toContain("colors={['#1A2030'");
  });
});
