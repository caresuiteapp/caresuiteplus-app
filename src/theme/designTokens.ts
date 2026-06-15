/**
 * CareSuite+ — Extended design tokens (WP 022–024).
 * Glass, Sheen und Elevation v2 für Premium-Oberflächen.
 */
import { elevation as elevationV1 } from './elevation';

export const glass = {
  blur: {
    light: 8,
    medium: 16,
    heavy: 24,
  },
  opacity: {
    panel: 0.72,
    overlay: 0.55,
    rim: 0.14,
  },
  border: 'rgba(255,255,255,0.10)',
  background: 'rgba(23,27,34,0.65)',
} as const;

export const sheen = {
  height: 1,
  rimHeight: 2,
  opacity: {
    subtle: 0.12,
    default: 0.18,
    strong: 0.28,
  },
  color: 'rgba(255,255,255,0.12)',
  gradientStart: { x: 0, y: 0 },
  gradientEnd: { x: 0.4, y: 1 },
} as const;

/** Elevation v2 — erweitert v1 um floating, glass und glow-Varianten. */
export const elevationV2 = {
  ...elevationV1,
  floating: {
    shadowColor: '#000',
    shadowOpacity: 0.42,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 18 },
    elevation: 18,
  },
  glass: {
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  cyanGlow: {
    shadowColor: '#62F3FF',
    shadowOpacity: 0.28,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  inset: {
    shadowColor: '#000',
    shadowOpacity: 0.55,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
} as const;

export const designTokens = {
  glass,
  sheen,
  elevationV2,
  hero: {
    gradient: ['#1A2030', '#12182A', '#0D1220'] as const,
    gradientStart: { x: 0, y: 0 } as const,
    gradientEnd: { x: 1, y: 1 } as const,
    eyebrowLetterSpacing: 1,
    iconBadgeSize: 48,
  },
  table: {
    rowMinHeight: 52,
    headerBackground: 'rgba(255,255,255,0.04)',
    rowAltBackground: 'rgba(255,255,255,0.02)',
    selectedBackground: 'rgba(255,149,0,0.10)',
  },
} as const;
