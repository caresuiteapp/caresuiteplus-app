import { describe, expect, it } from 'vitest';
import { careSuiteColors } from '@/design/tokens/colors';
import {
  legacyColorsFromPalette,
  resolveLegacyGradients,
  useLegacyTheme,
} from '@/design/tokens/themeBridge';
import { resolveCareTypography } from '@/design/tokens/typography';
import { colors, darkColors, lightColors } from '@/theme/colors';

describe('design token bridge', () => {
  it('mappt dark legacy colors aus careSuiteColors', () => {
    const dark = legacyColorsFromPalette('dark');
    expect(dark.bgBase).toBe('#031127');
    expect(dark.orange).toBe(careSuiteColors.dark.brand.orange);
    expect(dark.cyan).toBe(careSuiteColors.dark.brand.cyan);
    expect(darkColors.bgBase).toBe(dark.bgBase);
    expect(colors.textPrimary).toBe(lightColors.textPrimary);
    expect(colors.bgBase).toBe(lightColors.bgBase);
  });

  it('liefert light legacy colors', () => {
    expect(lightColors.bgBase).toBe(legacyColorsFromPalette('light').bgBase);
    expect(lightColors.textPrimary).toBe(legacyColorsFromPalette('light').textPrimary);
  });

  it('resolveCareTypography passt Textfarbe an Mode an', () => {
    const light = resolveCareTypography('light');
    const dark = resolveCareTypography('dark');
    expect(light.h1.color).toBe(careSuiteColors.light.text.primary);
    expect(dark.h1.color).toBe(careSuiteColors.dark.text.primary);
  });

  it('resolveLegacyGradients liefert light und dark Varianten', () => {
    const light = resolveLegacyGradients('light');
    const dark = resolveLegacyGradients('dark');
    expect(light.card.default[0]).toBe('#FFFFFF');
    expect(dark.card.default[0]).toContain('rgba(6,27,53');
  });

  it('exportiert useLegacyTheme Hook', () => {
    expect(typeof useLegacyTheme).toBe('function');
  });
});
