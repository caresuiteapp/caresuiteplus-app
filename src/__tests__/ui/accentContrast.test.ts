import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  ACCENT_DARK_SOFT_BASE,
  ACCENT_ICON_FRAME_GRADIENT,
  accentDarkSoftBackdrop,
  accentDarkSoftBorder,
  isLightAccentColor,
  relativeAccentLuminance,
  resolveAccentTextChipStyle,
  resolveLightColoredTextColor,
  resolveLightPrimaryButtonStyle,
} from '@/design/tokens/accentContrast';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('accentContrast tokens', () => {
  it('defines dark soft backdrop base opacity', () => {
    expect(ACCENT_DARK_SOFT_BASE).toBe('rgba(15, 23, 42, 0.72)');
    expect(accentDarkSoftBackdrop()).toBe(ACCENT_DARK_SOFT_BASE);
    expect(accentDarkSoftBackdrop(true)).toContain('0.82');
  });

  it('detects akademie yellow as a light accent', () => {
    expect(isLightAccentColor('#FACC15')).toBe(true);
    expect(relativeAccentLuminance('#FACC15')).toBeGreaterThan(0.55);
  });

  it('treats office orange and beratung violet as readable saturated accents', () => {
    expect(isLightAccentColor('#FF7A1A')).toBe(false);
    expect(isLightAccentColor('#8B5CF6')).toBe(false);
  });

  it('resolves text chip with colored label on dark soft pill', () => {
    const chip = resolveAccentTextChipStyle('#FACC15');
    expect(chip.backgroundColor).toBe(ACCENT_DARK_SOFT_BASE);
    expect(chip.color).toBe('#FACC15');
    expect(chip.borderColor).toContain('rgba');
  });

  it('uses dark soft primary button for light accents', () => {
    const yellowBtn = resolveLightPrimaryButtonStyle('#FACC15');
    expect(yellowBtn.backgroundColor).toBe(ACCENT_DARK_SOFT_BASE);
    expect(yellowBtn.color).toBe('#FACC15');

    const orangeBtn = resolveLightPrimaryButtonStyle('#FF7A1A');
    expect(orangeBtn.backgroundColor).toBe('#FF7A1A');
    expect(orangeBtn.color).toBe('#FFFFFF');
  });

  it('falls back to dark text for light accents on plain surfaces', () => {
    expect(resolveLightColoredTextColor('#FACC15')).toBe('#0F172A');
    expect(resolveLightColoredTextColor('#8B5CF6')).toBe('#8B5CF6');
  });
});

describe('AccentIconBackdrop integration', () => {
  it('AccentIconBackdrop uses shared frame gradient tokens', () => {
    const source = readSrc('src/components/ui/AccentIconBackdrop.tsx');
    expect(source).toContain('ACCENT_ICON_FRAME_GRADIENT');
    expect(source).toContain('accentDarkSoftBorder');
  });

  it('SpaceIconShell applies dark soft backing in light mode', () => {
    const source = readSrc('src/components/icons/space/SpaceIconShell.tsx');
    expect(source).toContain('darkSoftBacking');
    expect(source).toContain('ACCENT_ICON_FRAME_GRADIENT');
    expect(source).not.toContain('withAlpha(accentColor, active ? 0.24 : 0.12)');
  });

  it('PremiumBadge uses accent text chip in light mode', () => {
    const source = readSrc('src/components/ui/PremiumBadge.tsx');
    expect(source).toContain('resolveAccentTextChipStyle');
    expect(source).toContain('useLegacyTheme');
  });

  it('exports icon backdrop frame gradient from design tokens', () => {
    expect(ACCENT_ICON_FRAME_GRADIENT).toEqual(['#030711', '#101833', '#07101F']);
  });
});
