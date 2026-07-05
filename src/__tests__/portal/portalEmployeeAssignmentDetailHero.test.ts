import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

function readSrc(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Portal Employee Assignment Detail Hero (Sprint 81)', () => {
  it('PortalEmployeeAssignmentDetailHero nutzt PremiumListHeroFrame', () => {
    const hero = readSrc('src/components/portal/PortalEmployeeAssignmentDetailHero.tsx');
    expect(hero).toContain('PremiumListHeroFrame');
    expect(hero).toContain('PORTAL_EMPLOYEE_LABEL');
    expect(hero).toContain('PremiumKpiCard');
    expect(hero).toContain('AdaptiveKpiGrid');
    expect(hero).toContain('usePremiumHeroTextStyles');
    expect(hero).not.toContain('rgba(255,255,255');
  });

  it('PortalAssignmentDetailScreen ersetzt flache PremiumCard', () => {
    const screen = readSrc('src/screens/portal/PortalAssignmentDetailScreen.tsx');
    expect(screen).toContain('PortalEmployeeAssignmentDetailHero');
    expect(screen).not.toContain('PremiumCard accentColor');
  });
});
