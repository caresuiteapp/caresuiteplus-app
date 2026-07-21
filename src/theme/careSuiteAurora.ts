/**
 * CareSuite HealthOS Liquid Glass — compatibility tokens backed by the
 * three-colour system palette.
 */
import { SYSTEM_BLUE_GRADIENT, SYSTEM_LIQUID_COLORS, systemLiquidGlass } from '@/design/tokens/systemLiquidGlass';

export const careSuiteAuroraTheme = {
  background: systemLiquidGlass.page,
  gradients: {
    primaryAurora: [...SYSTEM_BLUE_GRADIENT] as const,
    heroAurora: ['#252742', '#353658', '#45415F', '#272842'] as const,
    buttonPrimary: [...SYSTEM_BLUE_GRADIENT] as const,
    buttonSecondary: ['rgba(255,255,255,0.07)', 'rgba(105,232,255,0.14)'] as const,
    buttonSuccess: ['#1478FF', '#4A9AFF'] as const,
    buttonDanger: ['#C83A50', '#FF5D6C'] as const,
    orangeLegacyOnlyIfNeeded: [...SYSTEM_BLUE_GRADIENT] as const,
  },
  glass: {
    background: systemLiquidGlass.panel,
    backgroundStrong: systemLiquidGlass.panelStrong,
    border: systemLiquidGlass.border,
    borderStrong: systemLiquidGlass.borderStrong,
  },
  text: {
    primary: systemLiquidGlass.text.primary,
    secondary: systemLiquidGlass.text.secondary,
    muted: systemLiquidGlass.text.muted,
    darkOnLightGradient: '#F8F6FF',
  },
  glow: {
    pink: systemLiquidGlass.glow.medium,
    violet: systemLiquidGlass.glow.medium,
    cyan: systemLiquidGlass.glow.medium,
    orange: systemLiquidGlass.glow.medium,
  },
  accent: {
    violet: SYSTEM_LIQUID_COLORS.electricBlue,
    pink: SYSTEM_LIQUID_COLORS.electricBlue,
    cyan: SYSTEM_LIQUID_COLORS.electricBlue,
    magenta: SYSTEM_LIQUID_COLORS.electricBlue,
  },
} as const;

export type CareSuiteAuroraTheme = typeof careSuiteAuroraTheme;

/** Three-stop hero gradient for list/detail headers. */
export const AURORA_HERO_GRADIENT = ['#252742', '#353658', '#45415F'] as const;

/** Primary CTA button gradient. */
export const AURORA_BUTTON_PRIMARY = careSuiteAuroraTheme.gradients.buttonPrimary;

/** Active chip/tab tint (violet, not orange). */
export const AURORA_CHIP_ACTIVE = systemLiquidGlass.chipActive;
export const AURORA_ROW_SELECTED = systemLiquidGlass.rowSelected;
