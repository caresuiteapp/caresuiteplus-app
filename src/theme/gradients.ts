/**
 * CareSuite+ — Aurora gradient definitions (WP 021).
 * Zentrale Verläufe für Karten, Buttons, Sheen und Hintergründe.
 */
import { AURORA_BUTTON_PRIMARY, AURORA_HERO_GRADIENT } from './careSuiteAurora';
import { careLightColors } from '@/design/tokens/lightTheme';

export const gradients = {
  card: {
    default: [careLightColors.surface, careLightColors.page] as const,
    elevated: [careLightColors.page, careLightColors.surface] as const,
  },
  primary: AURORA_BUTTON_PRIMARY,
  sheen: {
    subtle: ['rgba(255,255,255,0.55)', 'rgba(255,255,255,0.18)', 'transparent'] as const,
    strong: ['rgba(255,255,255,0.72)', 'rgba(255,255,255,0.28)', 'transparent'] as const,
  },
  glass: {
    panel: ['rgba(255,255,255,0.82)', 'rgba(248,250,252,0.72)'] as const,
    overlay: ['rgba(7,18,42,0.16)', 'rgba(7,18,42,0.28)'] as const,
  },
  ambient: {
    violet: ['rgba(139,92,246,0.18)', 'transparent'] as const,
    pink: ['rgba(236,72,153,0.16)', 'transparent'] as const,
    cyan: ['rgba(6,182,212,0.14)', 'transparent'] as const,
    orange: ['rgba(249,115,22,0.18)', 'transparent'] as const,
  },
  /** Aurora list/detail hero — vivid violet→pink→cyan */
  hero: {
    list: AURORA_HERO_GRADIENT,
    aurora: AURORA_HERO_GRADIENT,
  },
} as const;
