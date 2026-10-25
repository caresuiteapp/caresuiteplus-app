import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('R19 stabile Modul-Startseiten und lesbare Popups', () => {
  it('rendert unter /assist ausschließlich den vollständigen Assist-Arbeitsbereich', () => {
    const direct = read('app/assist/index.tsx');

    expect(direct).toContain('ModuleWorkspaceScreen');
    expect(direct).toContain('moduleKey="assist"');
    expect(direct).not.toContain('AssistIndexScreen');
    expect(existsSync(path.join(root, 'app/assist/(tabs)/index.tsx'))).toBe(false);
  });

  it('leitet /office ohne Laden des alten Dashboards zum kanonischen Fachbereich weiter', () => {
    const direct = read('app/office/index.tsx');

    expect(direct).toContain('canonicalDesktopCatalogRoute');
    expect(direct).toContain('<Redirect href={target');
    expect(direct).toContain('useLocalSearchParams');
    expect(direct).toContain('Office-Arbeitsbereich nicht gefunden');
    expect(direct).not.toContain('BusinessDashboardScreen');
    expect(direct).not.toContain('OfficeIndexScreen');
    expect(existsSync(path.join(root, 'app/office/(tabs)/index.tsx'))).toBe(false);
  });

  it('gibt dem gesamten PlatformModal den tatsächlichen Oberflächenkontrast vor', () => {
    const modal = read('src/components/layout/platform/platformmodal.tsx');
    const palette = read('src/design/tokens/carelightadaptive.ts');

    expect(modal).toContain("<SurfaceContrastProvider tone={lightModal ? 'light' : 'dark'}>");
    expect(palette).toContain('const surfaceTone = useSurfaceContrastTone()');
    expect(palette).toContain("surfaceTone === 'light'");
    expect(palette).toContain("surfaceTone === 'dark'");
  });

  it('setzt Integrationsnamen auf hellen Karten explizit lesbar', () => {
    const integrations = read('src/screens/integrations/IntegrationsListScreen.tsx');

    expect(integrations).toContain('useCareLightPalette');
    expect(integrations).toContain('color: c.text');
    expect(integrations).toContain('color: c.muted');
  });
});
