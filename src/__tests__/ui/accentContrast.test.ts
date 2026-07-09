import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  ACCENT_DARK_SOFT_BASE,
  ACCENT_ICON_FRAME_GRADIENT,
  AURORA_SURFACE_TEXT,
  APP_SURFACE_TEXT,
  RAIL_ICON_GLASS_LIGHT,
  accentDarkSoftBackdrop,
  accentDarkSoftBorder,
  isLightAccentColor,
  relativeAccentLuminance,
  resolveAccentTextChipStyle,
  resolveLightColoredTextColor,
  resolveLightPrimaryButtonStyle,
  resolveInteractiveTextColor,
} from '@/design/tokens/accentContrast';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('accentContrast tokens', () => {
  it('defines light glass backdrop base opacity', () => {
    expect(ACCENT_DARK_SOFT_BASE).toBe('rgba(255, 255, 255, 0.42)');
    expect(accentDarkSoftBackdrop()).toBe(ACCENT_DARK_SOFT_BASE);
    expect(accentDarkSoftBackdrop(true)).toContain('0.52');
  });

  it('detects akademie yellow as a light accent', () => {
    expect(isLightAccentColor('#FACC15')).toBe(true);
    expect(relativeAccentLuminance('#FACC15')).toBeGreaterThan(0.55);
  });

  it('treats office orange and beratung violet as readable saturated accents', () => {
    expect(isLightAccentColor('#FF7A1A')).toBe(false);
    expect(isLightAccentColor('#8B5CF6')).toBe(false);
  });

  it('resolves text chip with colored label on light glass pill', () => {
    const chip = resolveAccentTextChipStyle('#FACC15');
    expect(chip.backgroundColor).toBe(ACCENT_DARK_SOFT_BASE);
    expect(chip.color).toBe('#FACC15');
    expect(chip.borderColor).toContain('rgba');
  });

  it('uses light glass primary button for light accents', () => {
    const yellowBtn = resolveLightPrimaryButtonStyle('#FACC15');
    expect(yellowBtn.backgroundColor).toBe(ACCENT_DARK_SOFT_BASE);
    expect(yellowBtn.color).toBe('#FACC15');

    const orangeBtn = resolveLightPrimaryButtonStyle('#FF7A1A');
    expect(orangeBtn.backgroundColor).toBe('#FF7A1A');
    expect(orangeBtn.color).toBe('#000000');
  });

  it('falls back to dark text for light accents on plain surfaces', () => {
    expect(resolveLightColoredTextColor('#FACC15')).toBe('#000000');
    expect(resolveLightColoredTextColor('#8B5CF6')).toBe('#8B5CF6');
  });

  it('uses dark interactive text on light surfaces', () => {
    expect(
      resolveInteractiveTextColor({ isLight: true, accentOnDark: '#62F3FF' }),
    ).toBe(APP_SURFACE_TEXT);
    expect(
      resolveInteractiveTextColor({ isLight: false, onGradientHero: true, accentOnDark: '#FFFFFF' }),
    ).toBe(AURORA_SURFACE_TEXT);
    expect(
      resolveInteractiveTextColor({ isLight: false, accentOnDark: '#62F3FF' }),
    ).toBe(APP_SURFACE_TEXT);
  });
});

describe('AccentIconBackdrop integration', () => {
  it('AccentIconBackdrop uses shared frame gradient tokens', () => {
    const source = readSrc('src/components/ui/AccentIconBackdrop.tsx');
    expect(source).toContain('ACCENT_ICON_FRAME_GRADIENT');
    expect(source).toContain('accentDarkSoftBorder');
  });

  it('SpaceIconShell applies light glass backing in light mode for card frames', () => {
    const source = readSrc('src/components/icons/space/SpaceIconShell.tsx');
    expect(source).toContain('useGlassFrame');
    expect(source).toContain('RAIL_ICON_GLASS_LIGHT');
    expect(source).toContain('railGlassWebFx');
    expect(source).not.toContain('darkSoftBacking');
  });

  it('defines pure rail glass tokens without dark tint overlay', () => {
    expect(RAIL_ICON_GLASS_LIGHT.surface).toBe('rgba(255,255,255,0.30)');
    expect(RAIL_ICON_GLASS_LIGHT.surfaceActive).toBe('rgba(255,255,255,0.38)');
    expect(RAIL_ICON_GLASS_LIGHT.border).toContain('255,255,255');
    expect(RAIL_ICON_GLASS_LIGHT.blurPx).toBeGreaterThanOrEqual(18);
    expect(RAIL_ICON_GLASS_LIGHT).not.toHaveProperty('darkTint');
    expect(RAIL_ICON_GLASS_LIGHT.surface).not.toContain('0.72');
    expect(RAIL_ICON_GLASS_LIGHT.surface).not.toContain('15,23,42');
  });

  it('SpaceIconShell rail frame has no dark tint overlay layer', () => {
    const source = readSrc('src/components/icons/space/SpaceIconShell.tsx');
    expect(source).not.toContain('railDarkTint');
    expect(source).not.toContain('darkTint');
    expect(source).toContain('railGlassWebFx');
  });

  it('PremiumBadge uses accent text chip in light mode', () => {
    const source = readSrc('src/components/ui/PremiumBadge.tsx');
    expect(source).toContain('resolveAccentTextChipStyle');
    expect(source).toContain('useLegacyTheme');
  });

  it('exports icon backdrop frame gradient from design tokens', () => {
    expect(ACCENT_ICON_FRAME_GRADIENT).toEqual([
      'rgba(255,255,255,0.58)',
      'rgba(248,250,252,0.48)',
      'rgba(255,255,255,0.40)',
    ]);
  });
});
