import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

/** Portal mobile heroes/cards must not force dark navy on light LLGAN shell. */
const PORTAL_MOBILE_LIGHT_SURFACES = [
  'src/components/portal/assist/PortalGlassHero.tsx',
  'src/components/portal/assist/MobilePortalKpiCard.tsx',
  'src/components/portal/assist/PortalNextAppointmentHero.tsx',
  'src/components/portal/assist/MobilePortalSidebarCards.tsx',
] as const;

describe('portal mobile light theme surfaces', () => {
  it.each(PORTAL_MOBILE_LIGHT_SURFACES)('%s uses useLightLiquidGlassShell for dark overrides', (file) => {
    const src = readSrc(file);
    expect(src).toContain('useLightLiquidGlassShell');
  });

  it('PortalGlassHero gates compactCardDark behind !useLightGlass', () => {
    const src = readSrc('src/components/portal/assist/PortalGlassHero.tsx');
    expect(src).toContain('compactCardDark');
    expect(src).toMatch(/!useLightGlass.*compactCardDark|compactCardDark.*!useLightGlass/s);
    expect(src).not.toMatch(/compactCard:\s*\{[^}]*backgroundColor:\s*'rgba\(20,27,40/);
  });

  it('MobilePortalKpiCard gates cardDark behind !useLightGlass', () => {
    const src = readSrc('src/components/portal/assist/MobilePortalKpiCard.tsx');
    expect(src).toContain('cardDark');
    expect(src).toMatch(/!useLightGlass.*cardDark|cardDark.*!useLightGlass/s);
    expect(src).not.toMatch(/card:\s*\{[^}]*backgroundColor:\s*'rgba\(20,27,40/);
  });

  it('PortalNextAppointmentHero gates cardPhoneDark behind !useLightGlass', () => {
    const src = readSrc('src/components/portal/assist/PortalNextAppointmentHero.tsx');
    expect(src).toContain('cardPhoneDark');
    expect(src).toMatch(/!useLightGlass.*cardPhoneDark|cardPhoneDark.*!useLightGlass/s);
  });

  it('MobilePortalSidebarCards avoids bare auroraGlass chip in StyleSheet', () => {
    const src = readSrc('src/components/portal/assist/MobilePortalSidebarCards.tsx');
    expect(src).toContain('lightLiquidGlass.chip');
    expect(src).not.toMatch(/quickPill:[\s\S]*auroraGlass\.chip/);
    expect(src).not.toMatch(/mandantIconWrap:[\s\S]*auroraGlass\.chip/);
  });

  it('PortalTopBar profile chip uses light tokens when bar is light', () => {
    const src = readSrc('src/components/layout/portal/PortalTopBar.tsx');
    expect(src).toContain('profileChipSurface');
    expect(src).toContain('lightLiquidGlass.chip');
    expect(src).not.toMatch(/profileChip:[\s\S]*auroraGlass\.chip/);
  });

  it('profile/messages/dashboard routes use PortalGlassHero (fixed shared hero)', () => {
    expect(readSrc('src/screens/portal/ClientPortalProfileScreen.tsx')).toContain('PortalGlassHero');
    expect(readSrc('src/screens/portal/portalofficemessagesscreens.tsx')).toContain('PortalGlassHero');
    expect(readSrc('src/components/portal/assist/MobilePortalDashboard.tsx')).toContain('PortalGlassHero');
  });

  it('Termine tab hero uses adaptive text via PremiumListHeroFrame', () => {
    const hero = readSrc('src/components/portal/PortalTabHero.tsx');
    expect(hero).toContain('usePremiumHeroTextStyles');
    expect(hero).toContain('PremiumListHeroFrame');
  });
});
