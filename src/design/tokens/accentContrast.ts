import { withAlpha } from './motion';

/** Light glass pill backing for colored icons/labels on orbital surfaces. */
export const ACCENT_DARK_SOFT_BASE = 'rgba(255, 255, 255, 0.42)';
export const ACCENT_DARK_SOFT_ACTIVE = 'rgba(255, 255, 255, 0.52)';
export const ACCENT_DARK_SOLID = '#000000';

export const ACCENT_ICON_FRAME_GRADIENT = [
  'rgba(255,255,255,0.58)',
  'rgba(248,250,252,0.48)',
  'rgba(255,255,255,0.40)',
] as const;

/** Frosted glass circle for module rail icons — pure white glass, no dark backing. */
export const RAIL_ICON_GLASS_LIGHT = {
  surface: 'rgba(255,255,255,0.30)',
  surfaceActive: 'rgba(255,255,255,0.38)',
  border: 'rgba(255,255,255,0.68)',
  borderActive: 'rgba(255,255,255,0.78)',
  blurPx: 20,
} as const;

export const RAIL_ICON_GLASS_DARK = {
  surface: 'rgba(255,255,255,0.38)',
  surfaceActive: 'rgba(255,255,255,0.45)',
  sheen: 'rgba(255,255,255,0.35)',
  sheenActive: 'rgba(255,255,255,0.42)',
  border: 'rgba(255,255,255,0.58)',
  blurPx: 14,
} as const;

export type AccentChipStyle = {
  backgroundColor: string;
  color: string;
  borderColor: string;
};

function parseHexColor(hex: string): { r: number; g: number; b: number } | null {
  const normalized = hex.replace('#', '').trim();
  if (normalized.length === 3) {
    return {
      r: parseInt(normalized[0] + normalized[0], 16),
      g: parseInt(normalized[1] + normalized[1], 16),
      b: parseInt(normalized[2] + normalized[2], 16),
    };
  }
  if (normalized.length === 6) {
    return {
      r: parseInt(normalized.slice(0, 2), 16),
      g: parseInt(normalized.slice(2, 4), 16),
      b: parseInt(normalized.slice(4, 6), 16),
    };
  }
  return null;
}

/** Relative luminance (0–1) — used to pick readable text/button pairings. */
export function relativeAccentLuminance(color: string): number {
  const rgb = parseHexColor(color);
  if (!rgb) return 0.4;
  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((channel) => {
    const s = channel / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function isLightAccentColor(color: string): boolean {
  return relativeAccentLuminance(color) > 0.55;
}

export function accentDarkSoftBackdrop(active = false): string {
  return active ? ACCENT_DARK_SOFT_ACTIVE : ACCENT_DARK_SOFT_BASE;
}

export function accentDarkSoftBorder(accent: string, active = false): string {
  return withAlpha(accent, active ? 0.55 : 0.38);
}

/** Colored label/text on a dark soft chip — readable on white orbital backgrounds. */
export function resolveAccentTextChipStyle(accent: string, active = false): AccentChipStyle {
  return {
    backgroundColor: accentDarkSoftBackdrop(active),
    color: accent,
    borderColor: accentDarkSoftBorder(accent, active),
  };
}

/** Primary button on light surfaces — dark soft pill for light accents (e.g. Akademie yellow). */
export function resolveLightPrimaryButtonStyle(accent: string): AccentChipStyle {
  if (isLightAccentColor(accent)) {
    return resolveAccentTextChipStyle(accent);
  }
  return {
    backgroundColor: accent,
    color: APP_SURFACE_TEXT,
    borderColor: withAlpha(accent, 0.9),
  };
}

/** Colored text directly on light bg — fall back to dark text for low-contrast accents. */
export function resolveLightColoredTextColor(accent: string, fallback = '#000000'): string {
  return isLightAccentColor(accent) ? ACCENT_DARK_SOLID : accent;
}

/** Primary dark text for interactive controls (links, tabs, outline buttons) on light surfaces. */
export const LIGHT_SURFACE_INTERACTIVE_TEXT = '#000000';
export const APP_SURFACE_TEXT = '#000000';
/** White ink reserved for copy directly on aurora / gradient hero backgrounds. */
export const AURORA_SURFACE_TEXT = '#FFFFFF';

export function isOnAuroraSurface(options: {
  onGradientHero?: boolean;
  onAuroraBackground?: boolean;
}): boolean {
  return Boolean(options.onGradientHero || options.onAuroraBackground);
}

/**
 * Text color for interactive controls — black on app surfaces, white on aurora backgrounds.
 */
export function resolveInteractiveTextColor(options: {
  isLight: boolean;
  onGradientHero?: boolean;
  onAuroraBackground?: boolean;
  accentOnDark?: string;
  lightText?: string;
}): string {
  if (isOnAuroraSurface(options)) {
    return options.accentOnDark ?? AURORA_SURFACE_TEXT;
  }
  return options.lightText ?? APP_SURFACE_TEXT;
}
