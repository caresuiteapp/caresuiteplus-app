import { useMemo } from 'react';
import { StyleSheet, type TextStyle, type ViewStyle } from 'react-native';
import { useThemeMode } from '@/design/ThemeModeProvider';
import { careSuiteColors } from '@/design/tokens/colors';
import {
  auroraGlass as glassTokens,
  useAuroraAdaptiveText,
  useAuroraGlassActive,
  useAuroraGlassCardStyle,
  useAuroraGlassInputStyle,
  useAuroraGlassModalStyle,
  useAuroraGlassPanelStyle,
  useLightLiquidGlassShell,
} from '@/design/tokens/auroraGlass';
import { careLightColors } from '@/design/tokens/lightTheme';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography } from '@/design/tokens/typography';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { designTokens } from '@/theme';
import {
  AURORA_SURFACE_TEXT,
  LIGHT_SURFACE_INTERACTIVE_TEXT,
  resolveInteractiveTextColor,
} from '@/design/tokens/accentContrast';
import { ListHeroSurfaceContext, useListHeroSurface } from '@/design/tokens/listHeroSurfaceContext';
import { resolveGalaxyTypography } from '@/design/tokens/responsiveTypography';
import { useDeviceClass } from '@/hooks/platform/useDeviceClass';

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

/**
 * Text color for interactive controls (back links, tab pills, outline buttons).
 * Dark on light surfaces; accent/white preserved on gradient heroes and dark aurora.
 */
export function useInteractiveTextColor(accentOnDark?: string) {
  const { isLight, colors } = useLegacyTheme();
  const text = useAuroraAdaptiveText();
  const surface = useListHeroSurface();

  return useMemo(
    () =>
      resolveInteractiveTextColor({
        isLight,
        onGradientHero: surface === 'gradient',
        accentOnDark: accentOnDark ?? colors.cyan,
        lightText: text.primary,
      }),
    [accentOnDark, colors.cyan, isLight, surface, text.primary],
  );
}

export { LIGHT_SURFACE_INTERACTIVE_TEXT };

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

/**
 * Adaptive typography + text colors for SectionPanel / PremiumCard children.
 * Prefer this over static `@/theme` or `careLightColors.*` in panel content.
 */
export function useAdaptiveContentStyles() {
  const text = useAuroraAdaptiveText();
  const lightShell = useLightLiquidGlassShell();
  const { typography, colors } = useLegacyTheme();

  return useMemo(() => {
    const secondaryInk = lightShell ? text.primary : text.secondary;
    const bodyInk = lightShell ? text.primary : text.secondary;
    const labelInk = lightShell ? text.primary : text.secondary;

    return StyleSheet.create({
      primary: { color: text.primary },
      secondary: { color: secondaryInk },
      muted: { color: text.muted },
      body: { ...typography.body, color: bodyInk },
      bodyStrong: { ...typography.bodyStrong, color: text.primary },
      label: { ...typography.label, color: labelInk },
      caption: { ...typography.caption, color: text.muted },
      title: { ...typography.bodyStrong, color: text.primary },
      subheading: { ...typography.bodyStrong, color: text.primary, marginTop: careSpacing.sm },
      link: {
        ...typography.caption,
        color: text.primary,
        fontWeight: '600' as TextStyle['fontWeight'],
      },
      error: { ...typography.caption, color: colors.error },
    });
  }, [colors.error, lightShell, text.muted, text.primary, text.secondary, typography]);
}

/** Static StyleSheet helper for components already using `useCareLightPalette()`. */
export function createCareLightContentStyles(c: CareLightResolved) {
  return StyleSheet.create({
    body: { ...careTypography.body, color: c.text },
    bodyStrong: { ...careTypography.bodyStrong, color: c.text },
    caption: { ...careTypography.caption, color: c.muted },
    label: { ...careTypography.caption, color: c.muted, fontWeight: '600' as TextStyle['fontWeight'] },
    title: { ...careTypography.bodyStrong, color: c.text },
    link: { ...careTypography.caption, color: c.text, fontWeight: '600' as TextStyle['fontWeight'] },
  });
}

export type ListHeroTextVariant = 'gradient' | 'light';

type ListHeroTextStyleOptions = {
  /** `gradient` = white on colored/gradient heroes; `light` = dark on light surfaces. */
  variant?: ListHeroTextVariant;
  /** Shorthand for `variant: 'gradient' | 'light'`. */
  onGradient?: boolean;
};

/** List-hero typography — context-aware contrast for gradient vs light hero surfaces. */
export function useListHeroTextStyles(options?: ListHeroTextStyleOptions) {
  const text = useAuroraAdaptiveText();
  const lightShell = useLightLiquidGlassShell();
  const { c } = useCareLightPalette();
  const surface = useListHeroSurface();

  const variant: ListHeroTextVariant =
    options?.variant ??
    (options?.onGradient === true
      ? 'gradient'
      : options?.onGradient === false
        ? 'light'
        : surface);

  return useMemo(() => {
    if (variant === 'light') {
      return {
        eyebrow: {
          ...careTypography.caption,
          color: lightShell ? text.primary : text.muted,
          letterSpacing: designTokens.hero.eyebrowLetterSpacing,
          fontWeight: '700' as TextStyle['fontWeight'],
        },
        title: {
          ...careTypography.h2,
          color: text.primary,
          fontWeight: '800' as TextStyle['fontWeight'],
        },
        meta: {
          ...careTypography.caption,
          color: lightShell ? text.primary : text.secondary,
        },
        iconBorder: {
          borderColor: c.border,
        },
      };
    }

    return {
      eyebrow: {
        ...careTypography.caption,
        color: AURORA_SURFACE_TEXT,
        letterSpacing: designTokens.hero.eyebrowLetterSpacing,
        fontWeight: '700' as TextStyle['fontWeight'],
      },
      title: {
        ...careTypography.h2,
        color: AURORA_SURFACE_TEXT,
        fontWeight: '800' as TextStyle['fontWeight'],
      },
      meta: {
        ...careTypography.caption,
        color: AURORA_SURFACE_TEXT,
      },
      iconBorder: {
        borderColor: 'rgba(255,255,255,0.4)',
      },
    };
  }, [c.border, lightShell, text.muted, text.primary, text.secondary, variant]);
}

/** Shared hero typography for PremiumListHeroFrame children (list/detail/form heroes). */
export function usePremiumHeroTextStyles() {
  const hero = useListHeroTextStyles();
  const { typography, colors } = useLegacyTheme();
  const { c } = useCareLightPalette();
  const surface = useListHeroSurface();
  const isOnGradient = surface === 'gradient';

  return useMemo(
    () => ({
      eyebrow: hero.eyebrow,
      title: hero.title,
      meta: hero.meta,
      subtitle: { ...typography.caption, color: hero.meta.color },
      iconBadge: {
        borderColor: isOnGradient ? 'rgba(255,255,255,0.4)' : c.border,
        backgroundColor: isOnGradient ? 'rgba(255,255,255,0.16)' : colors.bgElevated,
      },
    }),
    [c.border, colors.bgElevated, hero.eyebrow, hero.meta, hero.title, isOnGradient, typography.caption],
  );
}
