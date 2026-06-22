/**
 * CareSuite+ Aurora Space Glass — canonical color & gradient tokens.
 * Used system-wide for headers, CTAs, glass surfaces, and glow effects.
 */
export const careSuiteAuroraTheme = {
  background: '#070A1F',
  gradients: {
    primaryAurora: ['#7C3AED', '#A855F7', '#EC4899', '#06B6D4'] as const,
    heroAurora: ['#6D28D9', '#A21CAF', '#EC4899', '#0891B2'] as const,
    buttonPrimary: ['#8B5CF6', '#D946EF', '#EC4899'] as const,
    buttonSecondary: ['rgba(139, 92, 246, 0.32)', 'rgba(6, 182, 212, 0.22)'] as const,
    buttonSuccess: ['#10B981', '#06B6D4'] as const,
    buttonDanger: ['#EF4444', '#EC4899'] as const,
    orangeLegacyOnlyIfNeeded: ['#FB923C', '#F97316'] as const,
  },
  glass: {
    background: 'rgba(15, 23, 42, 0.52)',
    backgroundStrong: 'rgba(15, 23, 42, 0.72)',
    border: 'rgba(255, 255, 255, 0.14)',
    borderStrong: 'rgba(255, 255, 255, 0.24)',
  },
  text: {
    primary: '#FFFFFF',
    secondary: 'rgba(255, 255, 255, 0.78)',
    muted: 'rgba(255, 255, 255, 0.56)',
    darkOnLightGradient: '#070A1F',
  },
  glow: {
    pink: 'rgba(236, 72, 153, 0.45)',
    violet: 'rgba(139, 92, 246, 0.45)',
    cyan: 'rgba(6, 182, 212, 0.35)',
    orange: 'rgba(249, 115, 22, 0.30)',
  },
  accent: {
    violet: '#8B5CF6',
    pink: '#EC4899',
    cyan: '#06B6D4',
    magenta: '#D946EF',
  },
} as const;

export type CareSuiteAuroraTheme = typeof careSuiteAuroraTheme;

/** Three-stop hero gradient for list/detail headers. */
export const AURORA_HERO_GRADIENT = ['#7C3AED', '#EC4899', '#06B6D4'] as const;

/** Primary CTA button gradient. */
export const AURORA_BUTTON_PRIMARY = careSuiteAuroraTheme.gradients.buttonPrimary;

/** Active chip/tab tint (violet, not orange). */
export const AURORA_CHIP_ACTIVE = 'rgba(139, 92, 246, 0.22)';
export const AURORA_ROW_SELECTED = 'rgba(139, 92, 246, 0.14)';
