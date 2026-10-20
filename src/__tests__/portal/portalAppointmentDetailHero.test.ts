import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

function readSrc(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Portal Appointment Detail Hero (Sprint 80)', () => {
  it('PortalAppointmentDetailHero nutzt PremiumListHeroFrame', () => {
    const hero = readSrc('src/components/portal/PortalAppointmentDetailHero.tsx');
    expect(hero).toContain('PremiumListHeroFrame');
    expect(hero).toContain('KLIENT:INNENPORTAL');
    expect(hero).toContain('MITARBEITERPORTAL');
    expect(hero).toContain('scopeLabel');
    expect(hero).toContain('PremiumKpiCard');
  });

  it('PortalClientAppointmentDetailScreen ersetzt flache PremiumCard', () => {
    const screen = readSrc('src/screens/portal/PortalClientAppointmentDetailScreen.tsx');
    expect(screen).toContain('PortalAppointmentDetailHero');
    expect(screen).not.toContain('PremiumCard accentColor');
  });
});
