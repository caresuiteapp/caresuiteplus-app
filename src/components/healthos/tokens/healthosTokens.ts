/**
 * CareSuite+ HealthOS — semantic design tokens (H1).
 * Bridges existing care design tokens; does not replace legacy themes.
 */
import { breakpoints } from '@/design/tokens/breakpoints';
import { careEffects } from '@/design/tokens/effects';
import { careRadius } from '@/design/tokens/radius';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography, resolveCareTypography } from '@/design/tokens/typography';
import { careSuiteColors, resolveCareSuitePalette, type ColorMode } from '@/design/tokens/colors';

export type HealthOSBadgeTone = 'muted' | 'cyan' | 'green' | 'orange' | 'red' | 'purple';

export type HealthOSSemanticColor = keyof typeof careSuiteColors.light.status;

export const healthosZIndex = {
  base: 0,
  sticky: 10,
  dropdown: 20,
  overlay: 30,
  modal: 40,
  toast: 50,
  tooltip: 60,
} as const;

export const healthosDensity = {
  /** Office / Assist desktop cards */
  card: {
    padding: careSpacing.md,
    paddingCompact: careSpacing.sm,
    gap: careSpacing.sm,
  },
  /** Employee / client portal surfaces */
  portal: {
    padding: careSpacing.shell.mobilePadding,
    paddingDesktop: careSpacing.shell.desktopPadding,
    gap: careSpacing.md,
  },
  section: {
    paddingVertical: careSpacing.lg,
    gap: careSpacing.md,
  },
  page: {
    paddingHorizontal: careSpacing.shell.mobilePadding,
    paddingVertical: careSpacing.lg,
    gap: careSpacing.lg,
  },
} as const;

export const healthosTokens = {
  spacing: careSpacing,
  radius: careRadius,
  breakpoints,
  effects: careEffects,
  typography: careTypography,
  zIndex: healthosZIndex,
  density: healthosDensity,
  badgeTones: {
    muted: { premiumVariant: 'muted' as const },
    cyan: { premiumVariant: 'cyan' as const },
    green: { premiumVariant: 'green' as const },
    orange: { premiumVariant: 'orange' as const },
    red: { premiumVariant: 'red' as const },
    purple: { premiumVariant: 'purple' as const },
  },
} as const;

export function resolveHealthOSPalette(mode: ColorMode = 'dark') {
  return resolveCareSuitePalette(mode);
}

export function resolveHealthOSTypography(mode: ColorMode = 'dark') {
  return resolveCareTypography(mode);
}

export function resolveHealthOSStatusColors(mode: ColorMode = 'dark') {
  const palette = resolveHealthOSPalette(mode);
  return palette.status;
}
