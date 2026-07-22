import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

describe('System Spatial Unification V35', () => {
  it('verwendet genau eine Karten- und Button-Grundlage', () => {
    const card = read('src/components/ui/PremiumCard.tsx');
    const button = read('src/components/ui/PremiumButton.tsx');

    expect(card).toContain('spatialCareGradients.nightGlass');
    expect(card).not.toContain('CareLightCard');
    expect(card).not.toContain('LightLlganPremiumCard');
    expect(button).not.toContain('CareLightButton');
  });

  it('verwendet genau eine Seitenschale mit sichtbarem Kopf', () => {
    const shell = read('src/components/layout/ScreenShell.tsx');
    const header = read('src/components/layout/ScreenHeader.tsx');

    expect(shell).not.toContain('CareLightPageShell');
    expect(shell).not.toContain('isLight');
    expect(header).toContain('spatialCare.navigation');
    expect(header).not.toContain('desktopA11yHeader');
  });

  it('erzwingt echte transparente Glasflächen statt weißer DOM-Overrides', () => {
    const adapter = read('src/design/web/applyLlganGlassDom.tsx');

    expect(adapter).toContain("setProperty('backdrop-filter', `blur(");
    expect(adapter).not.toContain("backdropFilter: 'none'");
    expect(adapter).toContain("surface: 'rgba(44,45,76,.78)'");
  });

  it('hält Assist-Karten und Breadcrumbs kompakt und kontrastreich', () => {
    const assignment = read('src/components/assist/AssignmentCompactCard.tsx');
    const breadcrumb = read('src/components/layout/BreadcrumbTrail.tsx');

    expect(assignment).toContain('flexGrow: 0');
    expect(assignment).not.toContain('actionBtn: { flex: 1');
    expect(breadcrumb).toContain('spatialCareColors.cyanLight');
    expect(breadcrumb).toContain('spatialCareColors.white');
  });

  it('leitet direkte CareLight-Altimporte auf dieselben Systembausteine um', () => {
    const card = read('src/components/ui/CareLightCard.tsx');
    const button = read('src/components/ui/CareLightButton.tsx');
    const shell = read('src/components/layout/CareLightPageShell.tsx');

    expect(card).toContain('<PremiumCard');
    expect(button).toContain('<PremiumButton');
    expect(shell).toContain('<ScreenShell');
  });
});
