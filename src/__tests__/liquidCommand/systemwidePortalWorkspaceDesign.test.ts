import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (relativePath: string) =>
  readFileSync(join(root, relativePath), 'utf8').replace(/\r\n/g, '\n');

const PRODUCT_MODULES = [
  'office',
  'assist',
  'pflege',
  'stationaer',
  'beratung',
  'akademie',
  'robotics',
] as const;

describe('systemwide portal workspace design', () => {
  it('routes every productive module through the shared premium workspace boundary', () => {
    const layout = read('src/liquid-command/shell/LiquidModuleRouteLayout.tsx');
    expect(layout).toContain('<PortalPremiumProvider kind="workspace">');

    for (const module of PRODUCT_MODULES) {
      expect(read(`app/${module}/_layout.tsx`), module).toContain('LiquidModuleRouteLayout');
    }

    expect(read('app/settings/_layout.tsx')).toContain('LiquidModuleRouteLayout');
  });

  it('includes the independent platform console in the same workspace theme', () => {
    const platformLayout = read('app/platform/_layout.tsx');
    const platformColors = read('src/components/platformConsole/PlatformColors.ts');
    const platformShell = read('src/components/platformConsole/PlatformShellLayout.tsx');

    expect(platformLayout).toContain('<PortalPremiumProvider kind="workspace">');
    expect(platformColors).toContain("import { portalPremium }");
    expect(platformColors).toContain('panel: portalPremium.surfaceRaised');
    expect(platformColors).toContain('sidebar: portalPremium.backdropStrong');
    expect(platformShell).toContain('<LiquidLogo compact />');
    expect(platformShell).toContain('<PortalTextSizeControls />');
  });

  it('propagates portal surfaces through the shared card, form and table systems', () => {
    const expectedThemeAwareFiles = [
      'src/components/ui/PremiumCard.tsx',
      'src/components/ui/PremiumButton.tsx',
      'src/components/ui/PremiumInput.tsx',
      'src/components/ui/PremiumKpiCard.tsx',
      'src/components/ui/PremiumListRow.tsx',
      'src/components/ui/SectionPanel.tsx',
      'src/components/ui/SegmentedTabs.tsx',
      'src/components/ui/FilterChip.tsx',
      'src/components/layout/HealthOSPageSurface.tsx',
    ];

    for (const file of expectedThemeAwareFiles) {
      expect(read(file), file).toContain('usePortalPremiumTheme');
    }

    const themeBridge = read('src/design/tokens/themeBridge.ts');
    const glass = read('src/design/tokens/auroraGlass.ts');
    expect(themeBridge).toContain("const mode: ColorMode = portal.active ? 'light' : 'dark'");
    expect(glass).toContain('portalPremiumGlass');
  });
});
