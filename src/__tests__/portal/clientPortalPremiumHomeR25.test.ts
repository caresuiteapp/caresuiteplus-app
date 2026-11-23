import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { clientPortalLayout } from '@/components/portal/client/clientPortalDesign';

const root = path.join(__dirname, '..', '..', '..');
const read = (relativePath: string) => readFileSync(path.join(root, relativePath), 'utf8');

describe('client portal premium home R25', () => {
  it('uses one shared premium dashboard for desktop, tablet and phone', () => {
    const desktop = read('src/components/portal/assist/AssistPortalOverview.tsx');
    const mobile = read('src/components/portal/assist/MobilePortalDashboard.tsx');
    expect(desktop).toContain('ClientPortalHomeDashboard');
    expect(mobile).toContain('ClientPortalHomeDashboard');
    expect(desktop).not.toContain('PortalKpiCard');
    expect(mobile).not.toContain('MobilePortalKpiCard');
  });

  it('replaces technical portal copy and emoji tiles with a contextual guide', () => {
    const home = read('src/components/portal/assist/ClientPortalHomeDashboard.tsx');
    expect(home).toContain('PortalInfoButton');
    expect(home).toContain('resolveClientPortalHomeGuide');
    expect(home).toContain('Ihre Unterschrift wird benötigt');
    expect(home).toContain('Alles Wichtige ist vorbereitet');
    expect(home).not.toContain('Rolle: Klient:in');
    expect(home).not.toContain('Freigabe aktiv');
    expect(home).not.toMatch(/icon="[📅💬📄✍️📨📰🚗]"/u);
  });

  it('keeps only meaningful information on the home instead of empty KPI boxes', () => {
    const home = read('src/components/portal/assist/ClientPortalHomeDashboard.tsx');
    expect(home).toContain('data.kpis.signatures > 0');
    expect(home).toContain('data.kpis.messages > 0');
    expect(home).toContain('data.kpis.proofs > 0');
    expect(home).toContain('data.kpis.activities > 0');
    expect(home).not.toContain('Keine Aktivitäten.');
    expect(home).not.toContain('Keine Nachweise offen.');
  });

  it('offers real direct actions without duplicating technical navigation', () => {
    const home = read('src/components/portal/assist/ClientPortalHomeDashboard.tsx');
    expect(home).toContain('Einsatz anfragen');
    expect(home).toContain('Nachricht schreiben');
    expect(home).toContain('Dokument hochladen');
    expect(home).toContain('Rückruf anfordern');
    expect(home).toContain("'/portal/client/messages?compose=1'");
    expect(home).toContain("'/portal/client/documents/signatures'");
  });

  it('keeps phone content usable and reduces columns as text grows', () => {
    for (const width of [320, 390, 768, 1440, 1920]) {
      const normal = clientPortalLayout(width);
      const large = clientPortalLayout(width, 1.5);
      expect(normal.contentWidth).toBeGreaterThan(0);
      expect(normal.contentWidth + (normal.phone ? 0 : normal.railWidth)).toBe(width);
      expect(large.contentColumns).toBeLessThanOrEqual(normal.contentColumns);
      if (width < 640) expect(normal.contentColumns).toBe(1);
    }
  });

  it('renders a compact readable next appointment with real actions', () => {
    const appointment = read('src/components/portal/assist/PortalNextAppointmentHero.tsx');
    expect(appointment).toContain('IHR NÄCHSTER EINSATZ');
    expect(appointment).toContain('Einsatz ansehen');
    expect(appointment).toContain('Änderung mitteilen');
    expect(appointment).toContain('appointmentBodyPhone');
    expect(appointment).toContain('ClientPortalArtwork');
    expect(appointment).toContain('PremiumButton');
  });
});
