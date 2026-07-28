/**
 * CareSuite+ — Aurora gradient definitions (WP 021).
 * Zentrale Verläufe für Karten, Buttons, Sheen und Hintergründe.
 */
import { AURORA_BUTTON_PRIMARY, AURORA_HERO_GRADIENT } from './careSuiteAurora';
import { liquidColors } from '@/liquid-command/foundation/tokens';

export const gradients = {
  card: {
    default: ['rgba(6,27,53,0.92)', 'rgba(3,17,39,0.96)'] as const,
    elevated: ['rgba(10,42,82,0.90)', 'rgba(6,27,53,0.96)'] as const,
  },
  primary: AURORA_BUTTON_PRIMARY,
  sheen: {
    subtle: ['rgba(255,255,255,0.55)', 'rgba(255,255,255,0.18)', 'transparent'] as const,
    strong: ['rgba(255,255,255,0.72)', 'rgba(255,255,255,0.28)', 'transparent'] as const,
  },
  glass: {
    panel: ['rgba(6,27,53,0.90)', 'rgba(3,17,39,0.96)'] as const,
    overlay: ['rgba(1,8,23,0.56)', 'rgba(1,8,23,0.88)'] as const,
  },
  ambient: {
    violet: [liquidColors.blue500Alpha16, 'transparent'] as const,
    pink: [liquidColors.blue500Alpha16, 'transparent'] as const,
    cyan: [liquidColors.blue500Alpha16, 'transparent'] as const,
    orange: [liquidColors.blue500Alpha16, 'transparent'] as const,
  },
  /** Aurora list/detail hero — vivid violet→pink→cyan */
  hero: {
    list: AURORA_HERO_GRADIENT,
    aurora: AURORA_HERO_GRADIENT,
  },
} as const;
