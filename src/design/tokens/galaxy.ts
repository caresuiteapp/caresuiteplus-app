/**
 * CareSuite+ Galaxy / Space design palette (Prompt 101).
 * Single source for premium auth & landing surfaces.
 */
export const galaxyPalette = {
  deepSpace: '#050816',
  spaceNavy: '#08111F',
  midnightBlue: '#0B1026',
  galaxyPurple: '#271A5D',
  galaxyCyan: '#22D3EE',
  glowBlue: '#38BDF8',
  glowViolet: '#8B5CF6',
  careOrange: '#FF6B1A',
  success: '#22C55E',
  warning: '#F59E0B',
  danger: '#EF4444',
  textPrimary: '#F8FAFC',
  textSecondary: '#CBD5E1',
  textMuted: '#94A3B8',
  borderGlass: 'rgba(255,255,255,0.12)',
  cardGlass: 'rgba(255,255,255,0.08)',
} as const;

export const galaxyGradients = {
  screen: [galaxyPalette.deepSpace, galaxyPalette.spaceNavy, galaxyPalette.midnightBlue] as const,
  accent: [galaxyPalette.galaxyPurple, galaxyPalette.midnightBlue] as const,
  primaryCta: [galaxyPalette.careOrange, '#FF8F4A'] as const,
  glowOrbCyan: [`${galaxyPalette.galaxyCyan}18`, 'transparent'] as const,
  glowOrbViolet: [`${galaxyPalette.glowViolet}14`, 'transparent'] as const,
} as const;

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
