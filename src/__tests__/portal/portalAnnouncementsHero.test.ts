import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

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

  it('Announcement-Screens use the portal-specific canonical hero', () => {
    expect(readSrc('src/screens/portal/EmployeePortalAnnouncementsScreen.tsx')).toContain(
      'PortalAnnouncementsHero',
    );
    expect(readSrc('src/screens/portal/ClientPortalAnnouncementsScreen.tsx')).toContain('PortalGlassHero');
  });

  it('Klient:innen-Mitteilungen werden live geladen und als gelesen bestätigt', () => {
    const clientAnnouncements = readSrc('src/screens/portal/ClientPortalAnnouncementsScreen.tsx');
    const broadcastService = readSrc('src/lib/office/broadcastservice.ts');
    const migration = readSrc(
      'supabase/migrations/20260808130000_client_portal_announcements_and_signed_proof_delivery.sql',
    );

    expect(clientAnnouncements).toContain("useNotifications('broadcasts')");
    expect(clientAnnouncements).toContain('fetchBroadcastForNotification');
    expect(clientAnnouncements).toContain('markNotificationRead');
    expect(broadcastService).toContain("segment === 'clients'");
    expect(broadcastService).toContain('show_in_client_portal');
    expect(migration).toContain('notification_broadcasts_client_portal_select');
    expect(migration).toContain('FROM public.office_notifications notification');
    expect(migration).not.toContain('FROM public.notifications notification');
    expect(migration).toContain('notification.recipient_user_id = auth.uid()');
  });

  it('buildPortalAnnouncementsKpis zählt aktive Einträge', () => {
    const stats = readSrc('src/lib/portal/portalAnnouncementsStats.ts');
    expect(stats).toContain('buildPortalAnnouncementsKpis');
    expect(stats).toContain("'Einträge'");
    expect(stats).toContain("'Aktiv'");
  });
});
