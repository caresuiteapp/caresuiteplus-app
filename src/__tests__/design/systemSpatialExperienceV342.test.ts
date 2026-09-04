import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { spatialCare, spatialModuleAccents } from '@/design/tokens/spatialCareSuite';
import { systemLiquidGlass } from '@/design/tokens/systemLiquidGlass';

const root = process.cwd();
const read = (relative: string) => readFileSync(path.join(root, relative), 'utf8');

describe('System Spatial Experience V34.2', () => {
  it('verwendet die durchgängige helle ORBIT-Arbeitsfläche', () => {
    expect(systemLiquidGlass.page).toBe('#FFFFFF');
    expect(spatialCare.stage).toContain('6, 27, 53');
    expect(systemLiquidGlass.panel).toContain('255, 255, 255');
  });

  it('behält die Modulidentitäten und kollabiert nicht in eine reine Blauwelt', () => {
    expect(new Set(Object.values(spatialModuleAccents)).size).toBeGreaterThanOrEqual(5);
    expect(spatialModuleAccents.office).not.toBe(spatialModuleAccents.assist);
    expect(spatialModuleAccents.pflege).not.toBe(spatialModuleAccents.beratung);
  });

  it('verbindet Office, Assist, Portale und Anmeldung mit derselben Designbasis', () => {
    expect(read('src/components/layout/platform/platformshell.tsx')).toContain('OrbitTopNavigation');
    expect(read('src/components/layout/portal/PortalShellLayout.tsx')).toContain('PORTAL_MOBILE_NAV_HEIGHT');
    expect(read('src/design/components/AuthPageShell.tsx')).toContain('portalPremium');
    expect(read('src/design/components/GlassCard.tsx')).toContain("'rgba(6,27,53,0.94)'");
  });

  it('verwendet die statische räumliche Code-Szene ohne Testdesign', () => {
    const background = read('src/components/ui/effects/globalanimatedbackground.tsx');
    const backgroundBarrel = read('src/components/backgrounds/index.ts');
    const css = read('src/design/web/lightLiquidGlassSurfaceCss.ts');
    expect(background).toContain('SpatialCareBackground');
    expect(background).not.toContain('DarkLiquidGlassBackground');
    expect(backgroundBarrel).not.toContain('DarkLiquidGlassBackground');
    expect(css).toContain('background: #071225 !important');
    expect(css).toContain('color-scheme: dark');
  });
});
