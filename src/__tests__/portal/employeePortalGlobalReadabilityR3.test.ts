import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8').replace(/\r\n/g, '\n');
}

describe('Mitarbeitendenportal globale Lesbarkeit R3', () => {
  it('legt jede reguläre Portalseite auf eine feste helle Arbeitsfläche', () => {
    const frame = readSrc('src/components/portal/EmployeePortalPageFrame.tsx');

    expect(frame).toContain('<SurfaceContrastProvider tone="light">');
    expect(frame).toContain('contentStyle={styles.workspace}');
    expect(frame).toContain('backgroundColor: portalPremium.surface');
    expect(frame).toContain('borderColor: portalPremium.borderStrong');
    expect(frame).toContain('boxShadow: portalPremium.shadow.panel');
    expect(frame).toContain('employee-portal-contrast-r4-workspace');
  });

  it('führt alle regulären Mitarbeitendenrouten durch den lesbaren Seitenrahmen', () => {
    const screen = readSrc('src/screens/portal/PortalTabScreen.tsx');

    expect(screen).toContain("const isEmployeePortal = pathname.startsWith('/portal/employee')");
    expect(screen).toContain('<EmployeePortalPageFrame');
    expect(screen).toContain('{children}');
  });

  it('zeigt Hinweise auf hellen Portalflächen deckend und auf dunklen Flächen invers', () => {
    const banner = readSrc('src/components/ui/InfoBanner.tsx');

    expect(banner).toContain("const darkSurface = onDarkSurface || surfaceTone === 'dark'");
    expect(banner).toContain("? '#FFF3D6'");
    expect(banner).toContain("? '#FFE8ED'");
    expect(banner).toContain("? '#E4F7F1'");
    expect(banner).toContain("darkSurface ? '#F8FBFF' : text.primary");
  });
});
