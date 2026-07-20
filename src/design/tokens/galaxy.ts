/**
 * CareSuite+ Galaxy / Space design palette (Prompt 101).
 * Single source for premium auth & landing surfaces.
 */
import { popupShellHeaderGradientDark } from './popupShellTokens';
import { SYSTEM_LIQUID_COLORS, systemLiquidGlass } from './systemLiquidGlass';
export const galaxyPalette = {
  deepSpace: systemLiquidGlass.pageDeep,
  spaceNavy: SYSTEM_LIQUID_COLORS.navy,
  midnightBlue: systemLiquidGlass.pageElevated,
  galaxyPurple: SYSTEM_LIQUID_COLORS.electricBlue,
  galaxyCyan: SYSTEM_LIQUID_COLORS.electricBlue,
  glowBlue: SYSTEM_LIQUID_COLORS.electricBlue,
  glowViolet: SYSTEM_LIQUID_COLORS.electricBlue,
  careOrange: SYSTEM_LIQUID_COLORS.electricBlue,
  success: '#22C55E',
  warning: '#F59E0B',
  danger: '#EF4444',
  textPrimary: systemLiquidGlass.text.primary,
  textSecondary: systemLiquidGlass.text.secondary,
  textMuted: systemLiquidGlass.text.muted,
  borderGlass: systemLiquidGlass.border,
  cardGlass: systemLiquidGlass.card,
} as const;

export const galaxyGradients = {
  screen: [galaxyPalette.deepSpace, galaxyPalette.spaceNavy, galaxyPalette.midnightBlue] as const,
  accent: [galaxyPalette.galaxyPurple, galaxyPalette.midnightBlue] as const,
  /** Modal / thread hero headers — violet depth for LinearGradient color stops. */
  dashboardHero: [galaxyPalette.galaxyPurple, '#181040', galaxyPalette.midnightBlue] as const,
  /** Colorful modal header — purple → magenta → lavender (horizontal). */
  modalHeader: popupShellHeaderGradientDark,
  primaryCta: [SYSTEM_LIQUID_COLORS.electricBlue, '#4A9AFF'] as const,
  glowOrbCyan: [`${galaxyPalette.galaxyCyan}18`, 'transparent'] as const,
  glowOrbViolet: [`${galaxyPalette.glowViolet}14`, 'transparent'] as const,
} as const;

export type GalaxyGradientKey = keyof typeof galaxyGradients;

const DEFAULT_GALAXY_GRADIENT: GalaxyGradientKey = 'accent';

/** Safe color-stop array for LinearGradient — never throws on missing keys. */
export function resolveGalaxyGradientColors(
  key: GalaxyGradientKey,
  fallback: GalaxyGradientKey = DEFAULT_GALAXY_GRADIENT,
): readonly [string, ...string[]] {
  const candidate = galaxyGradients[key] ?? galaxyGradients[fallback];
  if (Array.isArray(candidate) && candidate.length >= 2) {
    return candidate;
  }
  return galaxyGradients.screen;
}

export const galaxyGlow = {
  cyan: {
    shadowColor: galaxyPalette.galaxyCyan,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  violet: {
    shadowColor: galaxyPalette.glowViolet,
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  orange: {
    shadowColor: galaxyPalette.careOrange,
    shadowOpacity: 0.32,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
} as const;
