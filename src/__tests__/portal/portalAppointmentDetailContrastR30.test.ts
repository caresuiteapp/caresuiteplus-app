import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('portal appointment detail contrast R30', () => {
  it('renders the client detail with explicit premium contrast and a reset inner scroll area', () => {
    const screen = readSrc('src/screens/portal/PortalClientAppointmentDetailScreen.tsx');

    expect(screen).toContain('client-appointment-readable-details');
    expect(screen).toContain('portalPremium.text.primary');
    expect(screen).toContain('client-appointment-detail-scroll');
    expect(screen).toContain("scrollTo({ y: 0, animated: false })");
    expect(screen).toContain('overflowY: \'auto\'');
    expect(screen).not.toContain('DetailInfoRow');
    expect(screen).not.toContain('SectionPanel');
  });

  it('replaces the technical live-location fallback with understandable client copy', () => {
    const screen = readSrc('src/screens/portal/PortalClientAppointmentDetailScreen.tsx');
    const preview = readSrc('src/components/portal/ClientPortalAssignmentPreviewSheet.tsx');

    expect(screen).toContain('Noch ist keine Live-Anfahrt aktiv');
    expect(screen).toContain('Sie müssen nichts einstellen.');
    expect(preview).toContain('Die Karte erscheint automatisch kurz vor dem Termin');
    expect(screen).not.toContain('sichtbaren Zeitfenster');
    expect(preview).not.toContain('sichtbaren Zeitfenster');
  });

  it('keeps employee-only work actions out of the client preview', () => {
    const preview = readSrc('src/components/portal/ClientPortalAssignmentPreviewSheet.tsx');

    expect(preview).toContain('Einsatz vollständig öffnen');
    expect(preview).not.toContain('Fahrt starten');
    expect(preview).not.toContain('Route öffnen');
    expect(preview).not.toContain('Zur Durchführung');
    expect(preview).not.toContain('Dokumentation fortsetzen');
  });

  it('uses the same bounded modal foundation for client and employee previews', () => {
    for (const file of [
      'src/components/portal/ClientPortalAssignmentPreviewSheet.tsx',
      'src/components/portal/EmployeePortalAssignmentPreviewSheet.tsx',
    ]) {
      const preview = readSrc(file);
      expect(preview, file).toContain('PlatformModal');
      expect(preview, file).toContain('minWidth={0}');
      expect(preview, file).toContain('maxHeightRatio={isPhone ? 0.9 : 0.86}');
      expect(preview, file).toContain("variant={isPhone ? 'bottomSheet' : 'center'}");
      expect(preview, file).toContain('portalPremium.surfaceRaised');
      expect(preview, file).not.toMatch(
        /import\s*\{[^}]*\bModal\b[^}]*\}\s*from\s*['"]react-native/,
      );
    }
  });

  it('removes the legacy adaptive detail rows from both portal detail pages', () => {
    expect(readSrc('src/screens/portal/PortalClientAppointmentDetailScreen.tsx')).not.toContain(
      'DetailInfoRow',
    );
    expect(readSrc('src/screens/portal/PortalAssignmentDetailScreen.tsx')).not.toContain(
      'DetailInfoRow',
    );
  });
});
