import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { buildPortalAnnouncementsKpis } from '@/lib/portal/portalAnnouncementsStats';

function readSrc(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Portal Announcements Hero (Sprint 98)', () => {
  it('PortalAnnouncementsHero nutzt PremiumListHeroFrame für beide Portale', () => {
    const hero = readSrc('src/components/portal/PortalAnnouncementsHero.tsx');
    expect(hero).toContain('PremiumListHeroFrame');
    expect(hero).toContain('portal_employee');
    expect(hero).toContain('portal_client');
    expect(hero).toContain('MITARBEITERPORTAL');
    expect(hero).toContain('KLIENT:INNENPORTAL');
  });

  it('Announcement-Screens integrieren PortalAnnouncementsHero', () => {
    expect(readSrc('src/screens/portal/EmployeePortalAnnouncementsScreen.tsx')).toContain(
      'PortalAnnouncementsHero',
    );
    expect(readSrc('src/screens/portal/ClientPortalAnnouncementsScreen.tsx')).toContain(
      'PortalAnnouncementsHero',
    );
  });

  it('buildPortalAnnouncementsKpis zählt aktive Einträge', () => {
    const kpis = buildPortalAnnouncementsKpis(3, 2);
    expect(kpis[0]?.value).toBe('3');
    expect(kpis[1]?.value).toBe('2');
  });
});
