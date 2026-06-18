/**
 * CareSuite+ — Dark "liquid glass" effect & motion tokens.
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

/** Liquid-glass surface layers (dark). Translucent base + sheen + inner border. */
export const glassFx = {
  /** Base translucent fills (use as LinearGradient pair). */
  surface: ['rgba(31,36,64,0.28)', 'rgba(18,22,43,0.18)'] as [string, string],
  surfaceElevated: ['rgba(42,40,82,0.34)', 'rgba(23,26,52,0.22)'] as [string, string],
  /** Bright top sheen overlay (top → fade). */
  sheen: ['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.04)', 'transparent'] as [
    string,
    string,
    string,
  ],
  /** 1px inner light border. */
  innerBorder: 'rgba(255,255,255,0.10)',
  border: 'rgba(148,130,255,0.22)',
  borderStrong: 'rgba(168,150,255,0.40)',
  hairline: 'rgba(255,255,255,0.06)',
} as const;

/** Deep-space aurora palette behind the dark shell. */
export const auroraFx = {
  base: ['#0B1020', '#0E1330', '#0B1020'] as [string, string, string],
  /** Drifting neon orbs: color + relative placement + size (% of container). */
  orbs: [
    { color: '#8B5CF6', top: '-12%', left: '-8%', size: 520, opacity: 0.42, delay: 0 },
    { color: '#EC4899', top: '38%', left: '64%', size: 460, opacity: 0.34, delay: 1600 },
    { color: '#06B6D4', top: '68%', left: '6%', size: 480, opacity: 0.30, delay: 3200 },
    { color: '#38BDF8', top: '4%', left: '52%', size: 380, opacity: 0.26, delay: 800 },
  ] as const,
  /** Gradient-mesh overlay tint (subtle violet → transparent → cyan). */
  mesh: ['rgba(139,92,246,0.10)', 'transparent', 'rgba(6,182,212,0.08)'] as [
    string,
    string,
    string,
  ],
  /** Faint vignette to keep edges grounded. */
  vignette: 'rgba(5,7,18,0.55)',
} as const;

/** Per-module accent colors used for the dashboard "folder/module" card covers. */
export const moduleAccentFx: Record<string, string> = {
  office: '#06B6D4',
  pflege: '#14B8A6',
  assist: '#EC4899',
  beratung: '#34D399',
  stationaer: '#6366F1',
  akademie: '#F59E0B',
  insight: '#38BDF8',
  qm: '#8B5CF6',
};

/** Rotating accent palette for cards without a fixed module accent. */
export const accentCycle = ['#8B5CF6', '#EC4899', '#06B6D4', '#34D399', '#F59E0B', '#6366F1'];

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
