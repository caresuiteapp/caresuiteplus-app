import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

function readSrc(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Portal Employee Assignment Detail Hero (Sprint 81)', () => {
  it('PortalEmployeeAssignmentDetailHero nutzt eine ruhige statische HealthOS-Fläche', () => {
    const hero = readSrc('src/components/portal/PortalEmployeeAssignmentDetailHero.tsx');
    expect(hero).toContain('healthCard');
    expect(hero).toContain('PORTAL_EMPLOYEE_LABEL');
    expect(hero).toContain('Geplante Dauer');
    expect(hero).toContain('taskCount');
    expect(hero).toContain('usePremiumHeroTextStyles');
    expect(hero).toContain("backgroundColor: 'rgba(255,255,255,0.94)'");
    expect(hero).not.toContain('PremiumListHeroFrame');
    expect(hero).not.toContain('PremiumKpiCard');
    expect(hero).not.toContain('AdaptiveKpiGrid');
  });

  it('PortalAssignmentDetailScreen ersetzt flache PremiumCard', () => {
    const screen = readSrc('src/screens/portal/PortalAssignmentDetailScreen.tsx');
    expect(screen).toContain('PortalEmployeeAssignmentDetailHero');
    expect(screen).not.toContain('PremiumCard accentColor');
  });
});
