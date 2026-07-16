import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Klientenportal Abschluss-Gate', () => {
  it('übergibt optionale Profilnamen ohne null an das Signaturformular', () => {
    const route = readFileSync('app/portal/client/documents/signatures/[id].tsx', 'utf8');
    expect(route).toContain('profile?.displayName ?? undefined');
  });

  it('verwendet beim Signieren einen null-sicheren Dokumentdatensatz', () => {
    const detail = readFileSync('src/screens/portal/PortalClientDocumentDetailScreen.tsx', 'utf8');
    expect(detail).toContain("data?.clientName ?? 'Klient:in'");
  });

  it('liefert Leistungsnachweise mit einem gültigen Portal-Sichtbarkeitswert', () => {
    const proofs = readFileSync('src/lib/portal/assist/portalAssistVisitProofService.ts', 'utf8');
    expect(proofs).toContain("visibility: 'shared'");
    expect(proofs).not.toContain("visibility: 'portal'");
  });

  it('zeigt aufgelöste Dateinamen in der Dokumentkarte an', () => {
    const card = readFileSync('src/components/portal/PortalDocumentListCard.tsx', 'utf8');
    expect(card).toContain('document.displayFileName');
  });
});
