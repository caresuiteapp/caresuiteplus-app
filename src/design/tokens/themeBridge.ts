import { useMemo } from 'react';
import { useThemeMode } from '@/design/ThemeModeProvider';
import {
  AURORA_BUTTON_PRIMARY,
  AURORA_HERO_GRADIENT,
  careSuiteAuroraTheme,
} from '@/theme/careSuiteAurora';
import { careSuiteColors, type ColorMode } from './colors';
import { systemLiquidGlass } from './systemLiquidGlass';
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
  return {
    bgDeep: p.background.dark,
    bgBase: p.background.app,
    bgPremium: p.background.soft,
    bgSurface: p.background.elevated,
    bgElevated: p.background.elevated,
    bgPanel: p.background.soft,
    bgInput: p.background.app,

    textPrimary: p.text.primary,
    textSecondary: p.text.secondary,
    textMuted: p.text.muted,
    textDisabled: systemLiquidGlass.text.disabled,

    orange: p.brand.orange,
    amber: p.brand.gold,
    deepOrange: p.brand.orange,
    gold: p.brand.gold,

    cyan: p.brand.cyan,
    cyanSoft: '#4A9AFF',
    blue: p.status.info,
    violet: p.brand.violet,

    success: p.status.success,
    warning: p.status.warning,
    danger: p.status.danger,
    info: p.status.info,

    borderSoft: systemLiquidGlass.border,
    borderStrong: systemLiquidGlass.borderStrong,
    borderOrange: systemLiquidGlass.borderActive,
    borderCyan: systemLiquidGlass.borderActive,

    glowOrange: systemLiquidGlass.glow.medium,
    glowAmber: systemLiquidGlass.glow.medium,
    glowCyan: systemLiquidGlass.glow.medium,
    glowDark: 'rgba(3,10,24,0.48)',

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
      default: [p.background.elevated, p.background.soft] as [string, string],
      elevated: [p.background.soft, p.background.elevated] as [string, string],
    },
    primary: (isDark ? [...AURORA_BUTTON_PRIMARY] : [p.brand.orange, p.brand.gold]) as [
      string,
      string,
      ...string[],
    ],
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
      panel: ['rgba(72,72,108,0.90)', 'rgba(34,35,65,0.94)'] as [string, string],
      overlay: ['rgba(8,10,24,0.42)', 'rgba(8,10,24,0.72)'] as [string, string],
    },
    ambient: {
      orange: [`${p.brand.orange}2E`, 'transparent'] as [string, string],
      cyan: [`${p.brand.cyan}1F`, 'transparent'] as [string, string],
    },
    hero: {
      list: [...AURORA_HERO_GRADIENT] as [string, string, string],
      aurora: [...careSuiteAuroraTheme.gradients.heroAurora] as [string, string, string, string],
    },
  };
}

/**
 * React hook — bridges ThemeModeProvider to legacy @/theme keys for Premium components.
 */
export function useLegacyTheme() {
  useThemeMode();
  const mode: ColorMode = 'dark';

  return useMemo(
    () => ({
      mode,
      colors: legacyColorsFromPalette(mode),
      typography: resolveCareTypography(mode),
      gradients: resolveLegacyGradients(mode),
      palette: careSuiteColors[mode],
      isLight: mode === 'light',
      isDark: mode === 'dark',
    }),
    [],
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
