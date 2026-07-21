/**
 * CareSuite+ — light liquid-glass effect & motion tokens.
 *
 * Centralises the values used by the epic dark web experience: neon glow
 * shadows, aurora orbs, glass surface layers and the timing primitives shared
 * by the reusable effect components under `src/components/ui/effects`.
 *
 * These are visual-only tokens. Light mode keeps its soft neumorphism look and
 * does not consume these values.
 */
import type { ViewStyle } from 'react-native';

/** Shared motion timings (ms) + spring config for hover / float / entrance. */
export const fxMotion = {
  fast: 180,
  base: 320,
  slow: 520,
  float: 3200,
  drift: 14000,
  shimmer: 1400,
  spring: { damping: 16, stiffness: 220, mass: 0.9 },
  hoverSpring: { damping: 20, stiffness: 260, mass: 0.8 },
} as const;

/** Liquid-glass surface layers. Translucent base + sheen + inner border. */
export const glassFx = {
  /** Base translucent fills (use as LinearGradient pair). */
  surface: ['rgba(255,255,255,0.82)', 'rgba(238,244,251,0.72)'] as [string, string],
  surfaceElevated: ['rgba(255,255,255,0.94)', 'rgba(247,250,255,0.86)'] as [string, string],
  /** Bright top sheen overlay (top → fade). */
  sheen: ['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.04)', 'transparent'] as [
    string,
    string,
    string,
  ],
  /** 1px inner light border. */
  innerBorder: 'rgba(255,255,255,0.72)',
  border: 'rgba(16,35,63,0.12)',
  borderStrong: 'rgba(20,120,255,0.72)',
  hairline: 'rgba(16,35,63,0.08)',
} as const;

/** Light atmospheric palette retained for legacy animated components. */
export const auroraFx = {
  base: ['#F7FAFF', '#EEF4FB', '#FFFFFF'] as [string, string, string],
  /** Drifting neon orbs: color + relative placement + size (% of container). */
  orbs: [
    { color: '#1478FF', top: '-12%', left: '-8%', size: 520, opacity: 0.36, delay: 0 },
    { color: '#1478FF', top: '38%', left: '64%', size: 460, opacity: 0.24, delay: 1600 },
    { color: '#4A9AFF', top: '68%', left: '6%', size: 480, opacity: 0.22, delay: 3200 },
    { color: '#1478FF', top: '4%', left: '52%', size: 380, opacity: 0.20, delay: 800 },
  ] as const,
  /** Gradient-mesh overlay tint (subtle violet → transparent → cyan). */
  mesh: ['rgba(20,120,255,0.12)', 'transparent', 'rgba(74,154,255,0.08)'] as [
    string,
    string,
    string,
  ],
  /** Faint vignette to keep edges grounded. */
  vignette: 'rgba(16,35,63,0.08)',
} as const;

/** Per-module accent colors used for the dashboard "folder/module" card covers. */
export const moduleAccentFx: Record<string, string> = {
  office: '#1478FF',
  pflege: '#1478FF',
  assist: '#1478FF',
  beratung: '#1478FF',
  stationaer: '#1478FF',
  akademie: '#1478FF',
  insight: '#1478FF',
  qm: '#1478FF',
};

/** Rotating accent palette for cards without a fixed module accent. */
export const accentCycle = ['#1478FF', '#4A9AFF', '#1478FF', '#4A9AFF'];

/** Build a soft outer neon glow shadow from an accent color. */
export function neonGlow(
  color: string,
  opacity = 0.45,
  radius = 22,
  offsetY = 10,
): ViewStyle {
  return {
    shadowColor: color,
    shadowOpacity: opacity,
    shadowRadius: radius,
    shadowOffset: { width: 0, height: offsetY },
    elevation: Math.round(radius / 2),
  };
}

/** Translucent cover-gradient pair derived from an accent color. */
export function accentCover(accent: string): [string, string] {
  return [withAlpha(accent, 0.55), withAlpha(accent, 0.12)];
}

/** Faint ambient tint pair (accent → transparent) for card backdrops. */
export function accentAmbient(accent: string): [string, string] {
  return [withAlpha(accent, 0.22), 'transparent'];
}

/**
 * Apply an alpha channel to a #RRGGBB or rgb()/rgba() color string.
 * Falls back to the original color when it cannot be parsed.
 */
export function withAlpha(color: string, alpha: number): string {
  const a = Math.max(0, Math.min(1, alpha));
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    const full =
      hex.length === 3
        ? hex
            .split('')
            .map((c) => c + c)
            .join('')
        : hex;
    if (full.length >= 6) {
      const r = parseInt(full.slice(0, 2), 16);
      const g = parseInt(full.slice(2, 4), 16);
      const b = parseInt(full.slice(4, 6), 16);
      if (![r, g, b].some(Number.isNaN)) {
        return `rgba(${r}, ${g}, ${b}, ${a})`;
      }
    }
  }
  const rgbMatch = color.match(/rgba?\(([^)]+)\)/);
  if (rgbMatch) {
    const parts = rgbMatch[1].split(',').map((p) => p.trim());
    const [r, g, b] = parts;
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }
  return color;
}
