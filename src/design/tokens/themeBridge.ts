import { useMemo } from 'react';
import { useThemeMode } from '@/design/ThemeModeProvider';
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
  void mode;
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
  void mode;

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
  const mode: ColorMode = 'dark';

  return useMemo(
    () => ({
      mode,
      colors: legacyColorsFromPalette(mode),
      typography: resolveCareTypography(mode),
      gradients: resolveLegacyGradients(mode),
      palette: {
        background: {
          app: liquidColors.navy900,
          soft: liquidColors.navy800,
          elevated: liquidColors.navy700,
          dark: liquidColors.navy950,
          darkElevated: liquidColors.navy800,
        },
        brand: {
          navy: liquidColors.navy900,
          orange: liquidColors.blue500,
          gold: liquidColors.blue200,
          cyan: liquidColors.blue400,
          violet: liquidColors.blue400,
        },
        text: {
          primary: liquidColors.white,
          secondary: liquidColors.white88,
          muted: liquidColors.white64,
          inverse: liquidColors.navy950,
        },
        status: {
          success: liquidColors.success,
          warning: liquidColors.warning,
          danger: liquidColors.danger,
          info: liquidColors.blue400,
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
      isLight: false,
      isDark: true,
      shadow: liquidShadows.panel,
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
