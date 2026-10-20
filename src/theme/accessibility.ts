/**
 * Barrierefreiheits-Tokens — WCAG 2.5.5 / iOS HIG (44pt) und Material (48dp).
 */
export const accessibility = {
  /** Mindestgröße für tappbare Flächen (pt/dp) */
  minTouchSize: 44,
  /** Empfohlene Primär-Action-Höhe */
  recommendedTouchSize: 48,
  /** Max. Font-Scale-Faktor für Layout-Stabilität */
  maxFontScale: 1.5,
} as const;

export type FontScaleTier = 'normal' | 'large' | 'extraLarge';

export function getFontScaleTier(fontScale: number): FontScaleTier {
  if (fontScale >= 1.5) return 'extraLarge';
  if (fontScale >= 1.2) return 'large';
  return 'normal';
}

/** Skaliert Schriftgröße mit optionalem Cap — verhindert Layout-Brüche bei sehr großen Systemfonts. */
export function scaleFontSize(
  baseSize: number,
  fontScale: number,
  maxScale: number = accessibility.maxFontScale,
): number {
  const capped = Math.min(fontScale, maxScale);
  return Math.round(baseSize * capped);
}

/** Erzwingt Mindest-Touch-Höhe für interaktive Elemente. */
export function minTouchHeight(requestedHeight: number): number {
  return Math.max(requestedHeight, accessibility.minTouchSize);
}

/** Button-Höhen mit Barrierefreiheits-Minimum (sm: 44, md: 48). */
export const buttonHeights = {
  sm: minTouchHeight(40),
  md: minTouchHeight(48),
} as const;
