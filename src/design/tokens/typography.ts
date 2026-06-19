import type { TextStyle } from 'react-native';
import { webScaledFontMetric } from '@/design/web/webFontSize';
import { type ColorMode, resolveCareSuitePalette } from './colors';

function buildCareTypography(mode: ColorMode) {
  const palette = resolveCareSuitePalette(mode);
  const size = webScaledFontMetric;

  return {
  display: {
    fontSize: size(36),
    lineHeight: size(42),
    fontWeight: '800',
    letterSpacing: -0.6,
    color: palette.text.primary,
  } as TextStyle,
  hero: {
    fontSize: size(34),
    lineHeight: size(40),
    fontWeight: '800',
    letterSpacing: -0.5,
    color: palette.text.primary,
  } as TextStyle,
  h1: {
    fontSize: size(28),
    lineHeight: size(34),
    fontWeight: '800',
    letterSpacing: -0.3,
    color: palette.text.primary,
  } as TextStyle,
  h2: {
    fontSize: size(22),
    lineHeight: size(28),
    fontWeight: '700',
    color: palette.text.primary,
  } as TextStyle,
  h3: {
    fontSize: size(18),
    lineHeight: size(24),
    fontWeight: '700',
    color: palette.text.primary,
  } as TextStyle,
  body: {
    fontSize: size(15),
    lineHeight: size(22),
    fontWeight: '400',
    color: palette.text.secondary,
  } as TextStyle,
  bodyStrong: {
    fontSize: size(15),
    lineHeight: size(22),
    fontWeight: '600',
    color: palette.text.primary,
  } as TextStyle,
  caption: {
    fontSize: size(12),
    lineHeight: size(16),
    fontWeight: '500',
    color: palette.text.muted,
  } as TextStyle,
  label: {
    fontSize: size(13),
    lineHeight: size(18),
    fontWeight: '600',
    color: palette.text.secondary,
  } as TextStyle,
  button: {
    fontSize: size(16),
    lineHeight: size(22),
    fontWeight: '700',
    color: palette.text.primary,
  } as TextStyle,
  kpi: {
    fontSize: size(24),
    lineHeight: size(28),
    fontWeight: '800',
    letterSpacing: -0.5,
  } as TextStyle,
  } as const;
}

/** Dark typography — default for legacy StyleSheet.create blocks. */
export const careTypography = buildCareTypography('dark');

export function resolveCareTypography(mode: ColorMode = 'dark') {
  return buildCareTypography(mode);
}
