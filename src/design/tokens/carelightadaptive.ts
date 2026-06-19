import { useMemo } from 'react';
import type { TextStyle, ViewStyle } from 'react-native';
import { useThemeMode } from '@/design/ThemeModeProvider';
import { careSuiteColors } from '@/design/tokens/colors';
import {
  auroraGlass as glassTokens,
  useAuroraGlassCardStyle,
  useAuroraGlassInputStyle,
  useAuroraGlassModalStyle,
  useAuroraGlassPanelStyle,
} from '@/design/tokens/auroraGlass';
import { careLightColors } from '@/design/tokens/lightTheme';
import { careTypography } from '@/design/tokens/typography';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { designTokens } from '@/theme';

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
  const { mode, desktopThemeMode } = useThemeMode();
  const isDark = mode === 'dark' || desktopThemeMode === 'aurora-glass';
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

/** Glass panel surface for dark PlatformShell / Aurora routes. */
export function useGlassPanelStyle(): ViewStyle {
  return useAuroraGlassPanelStyle();
}

/** Card-level glass surface (slightly more opaque than panel). */
export function useGlassCardStyle(): ViewStyle {
  return useAuroraGlassCardStyle();
}

/** Modal sheet glass body. */
export function useGlassModalStyle(): ViewStyle {
  return useAuroraGlassModalStyle();
}

/** Form input glass fill on aurora desktop. */
export function useGlassInputStyle(): ViewStyle {
  return useAuroraGlassInputStyle();
}

export { glassTokens as glass };

/** List-hero typography that stays readable on glass panels in dark mode. */
export function useListHeroTextStyles() {
  const { isDark, c } = useCareLightPalette();
  return useMemo(
    () => ({
      eyebrow: {
        ...careTypography.caption,
        color: isDark ? c.cyan : careLightColors.cyan,
        letterSpacing: designTokens.hero.eyebrowLetterSpacing,
        fontWeight: '700' as TextStyle['fontWeight'],
      },
      title: {
        ...careTypography.h2,
        color: isDark ? c.text : careLightColors.navy,
      },
      meta: {
        ...careTypography.caption,
        color: isDark ? c.muted : careLightColors.muted,
      },
      iconBorder: {
        borderColor: isDark ? c.border : careLightColors.border,
      },
    }),
    [c.border, c.cyan, c.muted, c.text, isDark],
  );
}
