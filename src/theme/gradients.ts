/**
 * CareSuite+ — Aurora gradient definitions (WP 021).
 * Zentrale Verläufe für Karten, Buttons, Sheen und Hintergründe.
 */
import { AURORA_BUTTON_PRIMARY, AURORA_HERO_GRADIENT, careSuiteAuroraTheme } from './careSuiteAurora';

export const gradients = {
  card: {
    default: ['rgba(15,23,42,0.72)', 'rgba(7,10,31,0.85)'] as const,
    elevated: ['rgba(30,35,48,0.82)', 'rgba(15,23,42,0.72)'] as const,
  },
  primary: AURORA_BUTTON_PRIMARY,
  sheen: {
    subtle: ['rgba(255,255,255,0.14)', 'rgba(255,255,255,0.04)', 'transparent'] as const,
    strong: ['rgba(255,255,255,0.22)', 'rgba(255,255,255,0.06)', 'transparent'] as const,
  },
  glass: {
    panel: [careSuiteAuroraTheme.glass.backgroundStrong, careSuiteAuroraTheme.glass.background] as const,
    overlay: ['rgba(8,13,26,0.55)', 'rgba(5,7,17,0.82)'] as const,
  },
  ambient: {
    violet: [careSuiteAuroraTheme.glow.violet, 'transparent'] as const,
    pink: [careSuiteAuroraTheme.glow.pink, 'transparent'] as const,
    cyan: [careSuiteAuroraTheme.glow.cyan, 'transparent'] as const,
    orange: ['rgba(249,115,22,0.18)', 'transparent'] as const,
  },
  /** Aurora list/detail hero — vivid violet→pink→cyan */
  hero: {
    list: AURORA_HERO_GRADIENT,
    aurora: careSuiteAuroraTheme.gradients.heroAurora,
  },
} as const;
