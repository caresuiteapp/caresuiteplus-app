/**
 * CareSuite+ — Premium gradient definitions (WP 021).
 * Zentrale Verläufe für Karten, Buttons, Sheen und Hintergründe.
 */
export const gradients = {
  card: {
    default: ['#1E2330', '#171B22'] as const,
    elevated: ['#252A35', '#1E2330'] as const,
  },
  primary: ['#FF9500', '#FFB020'] as const,
  sheen: {
    subtle: ['rgba(255,255,255,0.14)', 'rgba(255,255,255,0.04)', 'transparent'] as const,
    strong: ['rgba(255,255,255,0.22)', 'rgba(255,255,255,0.06)', 'transparent'] as const,
  },
  glass: {
    panel: ['rgba(23,27,34,0.72)', 'rgba(16,24,39,0.58)'] as const,
    overlay: ['rgba(8,13,26,0.55)', 'rgba(5,7,17,0.82)'] as const,
  },
  ambient: {
    orange: ['rgba(255,149,0,0.18)', 'transparent'] as const,
    cyan: ['rgba(98,243,255,0.12)', 'transparent'] as const,
  },
  /** Dark Premium list hero — 01_DESIGN_BIBLE */
  hero: {
    list: ['#1A2030', '#12182A', '#0D1220'] as const,
  },
} as const;
