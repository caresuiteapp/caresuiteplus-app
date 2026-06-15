import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

function readSrc(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Portal Tab Heroes (Sprint 53)', () => {
  it('PortalTabHero nutzt PremiumListHeroFrame für beide Portale', () => {
    const hero = readSrc('src/components/portal/PortalTabHero.tsx');
    expect(hero).toContain('PremiumListHeroFrame');
    expect(hero).toContain('portal_employee');
    expect(hero).toContain('portal_client');
    expect(hero).toContain('MITARBEITERPORTAL');
    expect(hero).toContain('KLIENT:INNENPORTAL');
  });

  it('PortalTabHero deckt Nachrichten, Dokumente und Termine ab', () => {
    const hero = readSrc('src/components/portal/PortalTabHero.tsx');
    expect(hero).toContain("'messages'");
    expect(hero).toContain("'documents'");
    expect(hero).toContain("'appointments'");
    expect(hero).toContain('Einsätze');
    expect(hero).toContain('Termine');
  });

  it('PortalMessagesTab integriert PortalTabHero', () => {
    const tab = readSrc('src/components/portal/PortalMessagesTab.tsx');
    expect(tab).toContain('PortalTabHero');
    expect(tab).toContain('resolvePortalScope');
    expect(tab).toContain('tab="messages"');
  });

  it('PortalDocumentsTab integriert PortalTabHero', () => {
    const tab = readSrc('src/components/portal/PortalDocumentsTab.tsx');
    expect(tab).toContain('PortalTabHero');
    expect(tab).toContain('tab="documents"');
  });

  it('PortalAppointmentsTab integriert PortalTabHero', () => {
    const tab = readSrc('src/components/portal/PortalAppointmentsTab.tsx');
    expect(tab).toContain('PortalTabHero');
    expect(tab).toContain('tab="appointments"');
  });

  it('PortalMessagesListShell integriert PortalTabHero für Tab-Routen', () => {
    const shell = readSrc('src/screens/communication/PortalMessagesScreens.tsx');
    expect(shell).toContain('PortalTabHero');
    expect(shell).toContain('EmployeePortalMessagesScreen');
    expect(shell).toContain('ClientPortalMessagesScreen');
  });
});
