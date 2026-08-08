import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('R19 stabile Modul-Startseiten und lesbare Popups', () => {
  it('rendert unter /assist ausschließlich die produktive Assist-Startseite', () => {
    const direct = read('app/assist/index.tsx');
    const tabs = read('app/assist/(tabs)/index.tsx');

    expect(direct).toContain('AssistIndexScreen');
    expect(direct).toContain('export default AssistIndexScreen');
    expect(direct).not.toContain('ModuleWorkspaceScreen');
    expect(tabs).toContain('AssistIndexScreen');
  });

  it('rendert unter /office ausschließlich das produktive Office Command Center', () => {
    const direct = read('app/office/index.tsx');
    const tabs = read('app/office/(tabs)/index.tsx');

    expect(direct).toContain('OfficeIndexScreen');
    expect(direct).toContain('export default OfficeIndexScreen');
    expect(direct).not.toContain('ModuleWorkspaceScreen');
    expect(tabs).toContain('OfficeIndexScreen');
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
