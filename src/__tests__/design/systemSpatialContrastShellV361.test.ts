import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { auroraGlass, darkGlassSurfaceText } from '@/design/tokens/auroraGlass';
import { galaxyPalette } from '@/design/tokens/galaxy';
import { systemLiquidGlass } from '@/design/tokens/systemLiquidGlass';

const readSource = (path: string) => readFileSync(path, 'utf8');

describe('System Spatial Contrast Shell V36.1', () => {
  it('uses readable light ink on every canonical dark surface', () => {
    expect(darkGlassSurfaceText.primary).toBe(systemLiquidGlass.text.primary);
    expect(auroraGlass.text.primary).toBe(systemLiquidGlass.text.primary);
    expect(galaxyPalette.textPrimary).toBe(systemLiquidGlass.text.primary);
    expect(auroraGlass.text.primary).not.toBe('#000000');
  });

  it('keeps dark and light glass token sets separate', () => {
    expect(auroraGlass.panel).not.toBe('rgba(255,255,255,0.30)');
    expect(auroraGlass.panel).toBe(systemLiquidGlass.panel);
  });

  it('lets the shared shell own scrolling instead of nesting page scroll views', () => {
    const source = readSource('src/components/healthos/HealthOSPage.tsx');
    expect(source).not.toContain('<ScrollView');
    expect(source.slice(0, 240)).not.toContain('ScrollView');
    expect(source).toContain('Scrolling belongs to ScreenShell/PortalShellLayout');
  });

  it('does not force black ink in portal cards and platform controls', () => {
    const portalSources = [
      'src/components/portal/EmployeePortalAssignmentCard.tsx',
      'src/components/portal/ClientPortalAssignmentCard.tsx',
      'src/components/portal/EmployeePortalAssignmentPreviewSheet.tsx',
      'src/components/portal/ClientPortalAssignmentPreviewSheet.tsx',
    ].map(readSource).join('\n');
    const platformSources = [
      'src/components/layout/platform/PlatformProfileMenu.tsx',
      'src/components/layout/platform/PlatformContextSearch.tsx',
    ].map(readSource).join('\n');

    expect(portalSources).not.toContain('lightSurfaceText');
    expect(portalSources).toContain('darkGlassSurfaceText');
    expect(platformSources).not.toContain("color: '#000000'");
    expect(platformSources).not.toContain('placeholderTextColor="#000000"');
  });
});
