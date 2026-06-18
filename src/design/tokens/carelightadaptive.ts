import { useMemo } from 'react';
import { useThemeMode } from '@/design/ThemeModeProvider';
import { careSuiteColors } from '@/design/tokens/colors';
import { careLightColors } from '@/design/tokens/lightTheme';
import { useLegacyTheme } from '@/design/tokens/themeBridge';

export type CareLightResolved = {
  isDark: boolean;
  page: string;
  surface: string;
  surfaceAlt: string;
  text: string;
  muted: string;
  border: string;
  shadow: string;
  violet: string;
  cyan: string;
  orange: string;
  danger: string;
  warning: string;
  green: string;
  navy: string;
};

export function resolveCareLightPalette(isDark: boolean): CareLightResolved {
  if (!isDark) {
    return {
      isDark: false,
      page: careLightColors.page,
      surface: careLightColors.surface,
      surfaceAlt: '#F1F5F9',
      text: careLightColors.text,
      muted: careLightColors.muted,
      border: careLightColors.border,
      shadow: careLightColors.navy,
      violet: careLightColors.violet,
      cyan: careLightColors.cyan,
      orange: careLightColors.orange,
      danger: careLightColors.danger,
      warning: careLightColors.warning,
      green: careLightColors.green,
      navy: careLightColors.navy,
    };
  }

  const dark = careSuiteColors.dark;
  return {
    isDark: true,
    page: dark.background.app,
    surface: dark.background.elevated,
    surfaceAlt: dark.background.soft,
    text: dark.text.primary,
    muted: dark.text.muted,
    border: 'rgba(255,255,255,0.10)',
    shadow: '#000000',
    violet: dark.brand.violet,
    cyan: dark.brand.cyan,
    orange: dark.brand.orange,
    danger: dark.status.danger,
    warning: dark.status.warning,
    green: dark.status.success,
    navy: dark.brand.navy,
  };
}

export function useCareLightPalette(): { isDark: boolean; c: CareLightResolved } {
  const { mode } = useThemeMode();
  const isDark = mode === 'dark';
  return useMemo(() => ({ isDark, c: resolveCareLightPalette(isDark) }), [isDark]);
}

/**
 * Colors (`c`) + typography from theme bridge.
 * useCareLightPalette does NOT expose typography — never use `c.typography`.
 */
export function useCareAdaptiveTokens() {
  const { isDark, c } = useCareLightPalette();
  const { colors, typography } = useLegacyTheme();
  return useMemo(() => ({ isDark, c, colors, typography }), [c, colors, isDark, typography]);
}
