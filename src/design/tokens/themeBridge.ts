import { useMemo } from 'react';
import { useThemeMode } from '@/design/ThemeModeProvider';
import { portalPremium, usePortalPremiumTheme } from '@/design/tokens/portalPremium';
import {
  liquidColors,
  liquidShadows,
} from '@/liquid-command/foundation/tokens';
import type { ColorMode } from './colors';
import { resolveCareTypography } from './typography';

export type { ColorMode };

export type LegacyColors = ReturnType<typeof legacyColorsFromPalette>;
export type LegacyGradients = ReturnType<typeof resolveLegacyGradients>;

/**
 * Maps CareSuite+ adaptive tokens to legacy @/theme color keys.
 * Dark palette is the default for existing Premium screens.
 */
export function legacyColorsFromPalette(mode: ColorMode = 'dark') {
  if (mode === 'light') {
    return {
      bgDeep: portalPremium.backdropStrong,
      bgBase: portalPremium.backdrop,
      bgPremium: portalPremium.surfaceSoft,
      bgSurface: portalPremium.surface,
      bgElevated: portalPremium.surfaceRaised,
      bgPanel: portalPremium.surface,
      bgInput: portalPremium.surfaceRaised,

      textPrimary: portalPremium.text.primary,
      textSecondary: portalPremium.text.secondary,
      textMuted: portalPremium.text.muted,
      textDisabled: '#91A4B6',

      orange: portalPremium.accent.blue,
      amber: portalPremium.accent.amber,
      deepOrange: portalPremium.accent.blueDark,
      gold: portalPremium.accent.amber,
      cyan: portalPremium.accent.blue,
      cyanSoft: '#4C9CFF',
      blue: portalPremium.accent.blue,
      violet: portalPremium.accent.violet,

      success: portalPremium.accent.success,
      warning: portalPremium.accent.amber,
      danger: portalPremium.accent.danger,
      info: portalPremium.accent.blue,

      borderSoft: portalPremium.borderSoft,
      borderStrong: portalPremium.borderStrong,
      borderOrange: portalPremium.borderStrong,
      borderCyan: portalPremium.borderStrong,

      glowOrange: 'rgba(5,108,232,0.14)',
      glowAmber: 'rgba(168,97,0,0.12)',
      glowCyan: 'rgba(5,108,232,0.14)',
      glowDark: 'rgba(0,38,82,0.10)',

      primary: portalPremium.accent.blue,
      error: portalPremium.accent.danger,
    } as const;
  }

  return {
    bgDeep: liquidColors.navy950,
    bgBase: liquidColors.navy900,
    bgPremium: liquidColors.navy800,
    bgSurface: 'rgba(6,27,53,0.88)',
    bgElevated: 'rgba(10,42,82,0.78)',
    bgPanel: 'rgba(6,27,53,0.76)',
    bgInput: 'rgba(1,8,23,0.74)',

    textPrimary: liquidColors.white,
    textSecondary: liquidColors.white88,
    textMuted: liquidColors.white64,
    textDisabled: liquidColors.white32,

    // Compatibility names intentionally resolve to the one Liquid Command accent.
    orange: liquidColors.blue500,
    amber: liquidColors.blue300,
    deepOrange: liquidColors.blue600,
    gold: liquidColors.blue200,
    cyan: liquidColors.blue400,
    cyanSoft: liquidColors.blue300,
    blue: liquidColors.blue500,
    violet: liquidColors.blue400,

    success: liquidColors.success,
    warning: liquidColors.warning,
    danger: liquidColors.danger,
    info: liquidColors.blue400,

    borderSoft: liquidColors.white12,
    borderStrong: liquidColors.blue300Alpha32,
    borderOrange: liquidColors.blue400,
    borderCyan: liquidColors.blue400,

    glowOrange: liquidColors.blue300Alpha32,
    glowAmber: liquidColors.blue300Alpha32,
    glowCyan: liquidColors.blue300Alpha32,
    glowDark: liquidColors.black24,

    primary: liquidColors.blue500,
    error: liquidColors.danger,
  } as const;
}

/** Light/dark gradient sets for Premium cards, heroes, and glass surfaces. */
export function resolveLegacyGradients(mode: ColorMode = 'dark') {
  if (mode === 'light') {
    return {
      card: {
        default: ['#FFFFFF', '#EEF7FF'] as [string, string],
        elevated: ['#FFFFFF', '#E4F2FF'] as [string, string],
      },
      primary: [portalPremium.accent.blueDark, portalPremium.accent.blue] as [
        string,
        string,
      ],
      sheen: {
        subtle: ['rgba(255,255,255,0.86)', 'rgba(112,181,255,0.12)', 'transparent'] as [
          string,
          string,
          string,
        ],
        strong: ['rgba(255,255,255,0.96)', 'rgba(112,181,255,0.20)', 'transparent'] as [
          string,
          string,
          string,
        ],
      },
      glass: {
        panel: ['rgba(255,255,255,0.96)', 'rgba(234,244,255,0.97)'] as [string, string],
        overlay: ['rgba(247,251,255,0.94)', 'rgba(220,238,255,0.98)'] as [string, string],
      },
      ambient: {
        orange: ['rgba(5,108,232,0.15)', 'transparent'] as [string, string],
        cyan: ['rgba(112,181,255,0.22)', 'transparent'] as [string, string],
      },
      hero: {
        list: ['#FFFFFF', '#EAF4FF', '#CFE7FF'] as [string, string, string],
        aurora: ['#FFFFFF', '#F2F8FF', '#DCEEFF', '#C5E2FF'] as [
          string,
          string,
          string,
          string,
        ],
      },
    };
  }

  return {
    card: {
      default: ['rgba(6,27,53,0.92)', 'rgba(3,17,39,0.96)'] as [string, string],
      elevated: ['rgba(10,42,82,0.90)', 'rgba(6,27,53,0.96)'] as [string, string],
    },
    primary: [liquidColors.blue600, liquidColors.blue400] as [
      string,
      string,
    ],
    sheen: {
      subtle: ['rgba(255,255,255,0.14)', 'rgba(255,255,255,0.04)', 'transparent'] as [
        string,
        string,
        string,
      ],
      strong: ['rgba(255,255,255,0.22)', 'rgba(255,255,255,0.06)', 'transparent'] as [
        string,
        string,
        string,
      ],
    },
    glass: {
      panel: ['rgba(6,27,53,0.90)', 'rgba(3,17,39,0.96)'] as [string, string],
      overlay: ['rgba(1,8,23,0.56)', 'rgba(1,8,23,0.88)'] as [string, string],
    },
    ambient: {
      orange: [liquidColors.blue500Alpha16, 'transparent'] as [string, string],
      cyan: [liquidColors.blue500Alpha16, 'transparent'] as [string, string],
    },
    hero: {
      list: [liquidColors.navy800, liquidColors.navy700, liquidColors.navy900] as [
        string,
        string,
        string,
      ],
      aurora: [
        liquidColors.navy950,
        liquidColors.navy800,
        liquidColors.navy700,
        liquidColors.navy900,
      ] as [string, string, string, string],
    },
  };
}

/**
 * React hook — bridges ThemeModeProvider to legacy @/theme keys for Premium components.
 */
export function useLegacyTheme() {
  useThemeMode();
  const portal = usePortalPremiumTheme();
  const mode: ColorMode = portal.active ? 'light' : 'dark';

  return useMemo(
    () => {
      const isLight = mode === 'light';
      return {
        mode,
        colors: legacyColorsFromPalette(mode),
        typography: resolveCareTypography(mode),
        gradients: resolveLegacyGradients(mode),
        palette: {
        background: {
          app: isLight ? portalPremium.backdrop : liquidColors.navy900,
          soft: isLight ? portalPremium.surfaceSoft : liquidColors.navy800,
          elevated: isLight ? portalPremium.surfaceRaised : liquidColors.navy700,
          dark: liquidColors.navy950,
          darkElevated: isLight ? portalPremium.backdrop : liquidColors.navy800,
        },
        brand: {
          navy: liquidColors.navy900,
          orange: isLight ? portalPremium.accent.blue : liquidColors.blue500,
          gold: isLight ? portalPremium.accent.amber : liquidColors.blue200,
          cyan: isLight ? portalPremium.accent.blue : liquidColors.blue400,
          violet: isLight ? portalPremium.accent.violet : liquidColors.blue400,
        },
        text: {
          primary: isLight ? portalPremium.text.primary : liquidColors.white,
          secondary: isLight ? portalPremium.text.secondary : liquidColors.white88,
          muted: isLight ? portalPremium.text.muted : liquidColors.white64,
          inverse: liquidColors.navy950,
        },
        status: {
          success: isLight ? portalPremium.accent.success : liquidColors.success,
          warning: isLight ? portalPremium.accent.amber : liquidColors.warning,
          danger: isLight ? portalPremium.accent.danger : liquidColors.danger,
          info: isLight ? portalPremium.accent.blue : liquidColors.blue400,
        },
        module: {
          office: liquidColors.blue500,
          assist: liquidColors.blue400,
          pflege: liquidColors.blue300,
          beratung: liquidColors.blue400,
          stationaer: liquidColors.blue200,
          akademie: liquidColors.white,
          qm: liquidColors.blue300,
          insight: liquidColors.blue400,
        },
      },
        isLight,
        isDark: !isLight,
        shadow: isLight ? portalPremium.shadow.card : liquidShadows.panel,
      };
    },
    [mode],
  );
}

/** Default PlanPilot entry routes per module dashboard. */
export const planPilotRoutes: Record<string, string> = {
  office: '/office',
  assist: '/assist/calendar',
  pflege: '/pflege/shift-schedule',
  beratung: '/beratung/cases',
  stationaer: '/stationaer',
  akademie: '/akademie',
  qm: '/business/office/qm',
  insight: '/insight/snapshots',
};
