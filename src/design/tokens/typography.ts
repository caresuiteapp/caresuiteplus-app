import type { TextStyle } from 'react-native';
import { type ColorMode, resolveCareSuitePalette } from './colors';

function buildCareTypography(mode: ColorMode) {
  const palette = resolveCareSuitePalette(mode);

  return {
  display: {
    fontSize: 36,
    lineHeight: 42,
    fontWeight: '800',
    letterSpacing: -0.6,
    color: palette.text.primary,
  } as TextStyle,
  hero: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: palette.text.primary,
  } as TextStyle,
  h1: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    letterSpacing: 0,
    color: palette.text.primary,
  } as TextStyle,
  h2: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    color: palette.text.primary,
  } as TextStyle,
  h3: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
    color: palette.text.primary,
  } as TextStyle,
  body: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400',
    color: palette.text.secondary,
  } as TextStyle,
  bodyStrong: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
    color: palette.text.primary,
  } as TextStyle,
  bodySmall: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
    color: palette.text.secondary,
  } as TextStyle,
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    color: palette.text.muted,
  } as TextStyle,
  label: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    color: palette.text.secondary,
  } as TextStyle,
  button: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
    color: palette.text.primary,
  } as TextStyle,
  kpi: {
    fontSize: 24,
    lineHeight: 28,
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
