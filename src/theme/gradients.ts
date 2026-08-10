/**
 * CareSuite+ — Aurora gradient definitions (WP 021).
 * Zentrale Verläufe für Karten, Buttons, Sheen und Hintergründe.
 */
import { AURORA_BUTTON_PRIMARY, AURORA_HERO_GRADIENT } from './careSuiteAurora';
import { liquidColors } from '@/liquid-command/foundation/tokens';

export const gradients = {
  card: {
    default: ['rgba(255,255,255,0.96)', 'rgba(238,247,255,0.96)'] as const,
    elevated: ['#FFFFFF', '#E4F2FF'] as const,
  },
  primary: AURORA_BUTTON_PRIMARY,
  sheen: {
    subtle: ['rgba(255,255,255,0.55)', 'rgba(255,255,255,0.18)', 'transparent'] as const,
    strong: ['rgba(255,255,255,0.72)', 'rgba(255,255,255,0.28)', 'transparent'] as const,
  },
  glass: {
    panel: ['rgba(255,255,255,0.94)', 'rgba(234,244,255,0.97)'] as const,
    overlay: ['rgba(247,251,255,0.94)', 'rgba(220,238,255,0.98)'] as const,
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
