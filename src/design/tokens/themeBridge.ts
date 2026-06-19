import { useMemo } from 'react';
import { useThemeMode } from '@/design/ThemeModeProvider';
import { careSuiteColors, type ColorMode } from './colors';
import { resolveCareTypography } from './typography';

export type { ColorMode };

export type LegacyColors = ReturnType<typeof legacyColorsFromPalette>;
export type LegacyGradients = ReturnType<typeof resolveLegacyGradients>;

/**
 * Maps CareSuite+ adaptive tokens to legacy @/theme color keys.
 * Dark palette is the default for existing Premium screens.
 */
export function legacyColorsFromPalette(mode: ColorMode = 'dark') {
  const p = careSuiteColors[mode];
  const isDark = mode === 'dark';

  return {
    bgDeep: p.background.dark,
    bgBase: p.background.app,
    bgPremium: p.background.soft,
    bgSurface: p.background.elevated,
    bgElevated: isDark ? '#20242D' : p.background.elevated,
    bgPanel: isDark ? '#252A33' : p.background.soft,
    bgInput: isDark ? '#1A202A' : p.background.app,

    textPrimary: p.text.primary,
    textSecondary: p.text.secondary,
    textMuted: p.text.muted,
    textDisabled: isDark ? '#5E6675' : '#94A3B8',

    orange: p.brand.orange,
    amber: isDark ? '#FFB020' : p.brand.gold,
    deepOrange: isDark ? '#F97316' : p.brand.orange,
    gold: p.brand.gold,

    cyan: p.brand.cyan,
    cyanSoft: isDark ? '#8BEFFF' : p.brand.cyan,
    blue: isDark ? '#3B82F6' : p.status.info,
    violet: p.brand.violet,

    success: p.status.success,
    warning: p.status.warning,
    danger: p.status.danger,
    info: p.status.info,

    borderSoft: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(7,18,42,0.08)',
    borderStrong: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(7,18,42,0.14)',
    borderOrange: `rgba(${isDark ? '255,149,0' : '255,122,26'},0.34)`,
    borderCyan: isDark ? 'rgba(98,243,255,0.24)' : 'rgba(53,215,255,0.24)',

    glowOrange: isDark ? 'rgba(255,149,0,0.38)' : 'rgba(255,122,26,0.28)',
    glowAmber: isDark ? 'rgba(255,176,32,0.30)' : 'rgba(255,179,71,0.24)',
    glowCyan: isDark ? 'rgba(98,243,255,0.24)' : 'rgba(53,215,255,0.20)',
    glowDark: 'rgba(0,0,0,0.45)',

    primary: p.brand.orange,
    error: p.status.danger,
  } as const;
}

/** Light/dark gradient sets for Premium cards, heroes, and glass surfaces. */
export function resolveLegacyGradients(mode: ColorMode = 'dark') {
  const p = careSuiteColors[mode];
  const isDark = mode === 'dark';

  return {
    card: {
      default: (isDark ? ['#1E2330', '#171B22'] : [p.background.elevated, p.background.soft]) as [
        string,
        string,
      ],
      elevated: (isDark ? ['#252A35', '#1E2330'] : [p.background.soft, p.background.elevated]) as [
        string,
        string,
      ],
    },
    primary: [p.brand.orange, p.brand.gold] as [string, string],
    sheen: {
      subtle: (isDark
        ? ['rgba(255,255,255,0.14)', 'rgba(255,255,255,0.04)', 'transparent']
        : ['rgba(255,255,255,0.55)', 'rgba(255,255,255,0.18)', 'transparent']) as [
        string,
        string,
        string,
      ],
      strong: (isDark
        ? ['rgba(255,255,255,0.22)', 'rgba(255,255,255,0.06)', 'transparent']
        : ['rgba(255,255,255,0.72)', 'rgba(255,255,255,0.28)', 'transparent']) as [
        string,
        string,
        string,
      ],
    },
    glass: {
      panel: (isDark
        ? ['rgba(23,27,34,0.72)', 'rgba(16,24,39,0.58)']
        : ['rgba(255,255,255,0.82)', 'rgba(248,250,252,0.72)']) as [string, string],
      overlay: (isDark
        ? ['rgba(8,13,26,0.55)', 'rgba(5,7,17,0.82)']
        : ['rgba(7,18,42,0.28)', 'rgba(7,18,42,0.48)']) as [string, string],
    },
    ambient: {
      orange: [`${p.brand.orange}2E`, 'transparent'] as [string, string],
      cyan: [`${p.brand.cyan}1F`, 'transparent'] as [string, string],
    },
    hero: {
      list: (isDark
        ? ['#1A2030', '#12182A', '#0D1220']
        : [p.background.soft, p.background.app, p.background.dark]) as [string, string, string],
    },
  };
}

/**
 * React hook — bridges ThemeModeProvider to legacy @/theme keys for Premium components.
 */
export function useLegacyTheme() {
  const { mode, desktopThemeMode } = useThemeMode();
  const effectiveMode: ColorMode =
    desktopThemeMode === 'aurora-glass' ? 'dark' : mode;

  return useMemo(
    () => ({
      mode: effectiveMode,
      colors: legacyColorsFromPalette(effectiveMode),
      typography: resolveCareTypography(effectiveMode),
      gradients: resolveLegacyGradients(effectiveMode),
      palette: careSuiteColors[effectiveMode],
      isLight: effectiveMode === 'light',
      isDark: effectiveMode === 'dark',
    }),
    [effectiveMode],
  );
}

/** Default PlanPilot entry routes per module dashboard. */
export const planPilotRoutes: Record<string, string> = {
  office: '/office/calendar',
  assist: '/assist/calendar',
  pflege: '/pflege/shift-schedule',
  beratung: '/beratung/cases',
  stationaer: '/stationaer',
  akademie: '/akademie',
  qm: '/business/office/qm',
  insight: '/insight/snapshots',
};
