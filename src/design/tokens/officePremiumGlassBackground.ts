/**
 * CareSuite+ Office — Premium Glassmorphism Background (Pearl / Ice / Lavendel / Blush / Silber).
 * Helle, ruhige Atmosphäre ohne dunkle Space-Optik.
 */

export const opgbBaseColors = {
  pearlWhite: '#F9FBFF',
  iceBlue: '#E8F2FF',
  lavender: '#EDE8FF',
  blush: '#F8EEF2',
  silverGray: '#E4E8EE',
  mistPearl: '#F5F7FA',
} as const;

export const opgbBaseGradient = [
  opgbBaseColors.pearlWhite,
  opgbBaseColors.iceBlue,
  opgbBaseColors.blush,
  opgbBaseColors.lavender,
  opgbBaseColors.silverGray,
] as const;

export type OpgbNebulaCloud = {
  id: string;
  bx: number;
  by: number;
  radiusX: number;
  radiusY: number;
  inner: string;
  mid: string;
  outer: string;
  baseOpacity: number;
  driftX: number;
  driftY: number;
  speed: number;
  phase: number;
  layerDepth: number;
  breathe: number;
};

export type OpgbAuroraWisp = {
  id: string;
  bx: number;
  by: number;
  length: number;
  thickness: number;
  angle: number;
  color: string;
  driftX: number;
  driftY: number;
  speed: number;
  phase: number;
  layerDepth: number;
};

export type OpgbStarDust = {
  nx: number;
  ny: number;
  radius: number;
  baseOpacity: number;
  twinkleSpeed: number;
  glowRadius: number;
  layerDepth: number;
  phase: number;
};

export type OpgbDiffuseGlow = {
  id: string;
  bx: number;
  by: number;
  radius: number;
  inner: string;
  outer: string;
  pulseSpeed: number;
  phase: number;
  layerDepth: number;
};

export type OpgbBokehDust = {
  id: string;
  bx: number;
  by: number;
  radius: number;
  color: string;
  driftX: number;
  driftY: number;
  speed: number;
  phase: number;
  layerDepth: number;
  baseOpacity: number;
};

/** Canvas intensity — sichtbar, aber ruhig und lesbar. */
export const opgbCanvasIntensity = {
  nebulaOpacity: 1.02,
  wispOpacity: 0.72,
  starOpacity: 0.58,
  glowOpacity: 0.62,
  bokehOpacity: 0.32,
  centerVeilAlpha: 0.02,
} as const;

/** Weiche Aurora-Clouds — Pearl, Eisblau, Lavendel, Blush, Silber. */
export const opgbNebulaClouds: readonly OpgbNebulaCloud[] = [
  {
    id: 'op-cloud-tl-ice',
    bx: 0.05,
    by: 0.06,
    radiusX: 0.5,
    radiusY: 0.44,
    inner: 'rgba(220,235,255,0.78)',
    mid: 'rgba(198,220,248,0.38)',
    outer: 'rgba(228,232,238,0.08)',
    baseOpacity: 0.96,
    driftX: 95,
    driftY: 72,
    speed: 0.022,
    phase: 0,
    layerDepth: 0.5,
    breathe: 0.035,
  },
  {
    id: 'op-cloud-tr-lavender',
    bx: 0.95,
    by: 0.08,
    radiusX: 0.46,
    radiusY: 0.42,
    inner: 'rgba(230,218,255,0.74)',
    mid: 'rgba(210,198,248,0.34)',
    outer: 'rgba(248,238,242,0.08)',
    baseOpacity: 0.92,
    driftX: 88,
    driftY: 68,
    speed: 0.019,
    phase: 1.4,
    layerDepth: 0.55,
    breathe: 0.03,
  },
  {
    id: 'op-cloud-bl-blush',
    bx: 0.07,
    by: 0.92,
    radiusX: 0.44,
    radiusY: 0.4,
    inner: 'rgba(252,228,236,0.68)',
    mid: 'rgba(240,215,228,0.30)',
    outer: 'rgba(237,232,255,0.06)',
    baseOpacity: 0.88,
    driftX: 82,
    driftY: 74,
    speed: 0.018,
    phase: 2.8,
    layerDepth: 0.52,
    breathe: 0.028,
  },
  {
    id: 'op-cloud-br-silver',
    bx: 0.93,
    by: 0.9,
    radiusX: 0.42,
    radiusY: 0.38,
    inner: 'rgba(228,232,238,0.48)',
    mid: 'rgba(245,247,250,0.20)',
    outer: 'rgba(249,251,255,0.03)',
    baseOpacity: 0.76,
    driftX: 78,
    driftY: 70,
    speed: 0.017,
    phase: 4.2,
    layerDepth: 0.58,
    breathe: 0.026,
  },
  {
    id: 'op-cloud-mid-pearl',
    bx: 0.48,
    by: 0.38,
    radiusX: 0.32,
    radiusY: 0.26,
    inner: 'rgba(249,251,255,0.38)',
    mid: 'rgba(232,242,255,0.14)',
    outer: 'transparent',
    baseOpacity: 0.62,
    driftX: 62,
    driftY: 48,
    speed: 0.02,
    phase: 1.9,
    layerDepth: 0.68,
    breathe: 0.022,
  },
  {
    id: 'op-cloud-mid-lavender',
    bx: 0.62,
    by: 0.58,
    radiusX: 0.28,
    radiusY: 0.24,
    inner: 'rgba(237,232,255,0.32)',
    mid: 'rgba(248,238,242,0.12)',
    outer: 'transparent',
    baseOpacity: 0.56,
    driftX: 58,
    driftY: 44,
    speed: 0.018,
    phase: 3.6,
    layerDepth: 0.72,
    breathe: 0.02,
  },
] as const;

/** Feine Aurora-Wisps — kaum sichtbar, nur Tiefe. */
export const opgbAuroraWisps: readonly OpgbAuroraWisp[] = [
  {
    id: 'op-wisp-tl',
    bx: 0.14,
    by: 0.16,
    length: 0.38,
    thickness: 0.032,
    angle: 0.22,
    color: 'rgba(210,228,248,0.22)',
    driftX: 72,
    driftY: 40,
    speed: 0.012,
    phase: 0.5,
    layerDepth: 0.45,
  },
  {
    id: 'op-wisp-tr',
    bx: 0.86,
    by: 0.18,
    length: 0.36,
    thickness: 0.028,
    angle: 2.65,
    color: 'rgba(220,214,248,0.20)',
    driftX: 68,
    driftY: 38,
    speed: 0.011,
    phase: 2.1,
    layerDepth: 0.48,
  },
  {
    id: 'op-wisp-br',
    bx: 0.82,
    by: 0.82,
    length: 0.34,
    thickness: 0.026,
    angle: 3.85,
    color: 'rgba(240,228,236,0.18)',
    driftX: 64,
    driftY: 36,
    speed: 0.01,
    phase: 4.4,
    layerDepth: 0.5,
  },
] as const;

/** Diffuse Glow-Layer — milchige Lichtwolken. */
export const opgbDiffuseGlows: readonly OpgbDiffuseGlow[] = [
  {
    id: 'op-glow-center',
    bx: 0.5,
    by: 0.42,
    radius: 0.55,
    inner: 'rgba(249,251,255,0.14)',
    outer: 'rgba(232,242,255,0.02)',
    pulseSpeed: 0.008,
    phase: 0,
    layerDepth: 0.35,
  },
  {
    id: 'op-glow-left',
    bx: 0.18,
    by: 0.55,
    radius: 0.38,
    inner: 'rgba(210,228,248,0.10)',
    outer: 'transparent',
    pulseSpeed: 0.007,
    phase: 2.2,
    layerDepth: 0.4,
  },
  {
    id: 'op-glow-right',
    bx: 0.82,
    by: 0.48,
    radius: 0.36,
    inner: 'rgba(237,232,255,0.09)',
    outer: 'transparent',
    pulseSpeed: 0.006,
    phase: 4.1,
    layerDepth: 0.42,
  },
] as const;

/** Sehr dezente Bokeh-/Dust-Elemente. */
export const opgbBokehDust: readonly OpgbBokehDust[] = [
  {
    id: 'op-bokeh-1',
    bx: 0.22,
    by: 0.28,
    radius: 0.12,
    color: 'rgba(249,251,255,0.35)',
    driftX: 28,
    driftY: 22,
    speed: 0.009,
    phase: 0.8,
    layerDepth: 0.78,
    baseOpacity: 0.18,
  },
  {
    id: 'op-bokeh-2',
    bx: 0.72,
    by: 0.35,
    radius: 0.1,
    color: 'rgba(237,232,255,0.30)',
    driftX: 24,
    driftY: 20,
    speed: 0.008,
    phase: 2.5,
    layerDepth: 0.8,
    baseOpacity: 0.16,
  },
  {
    id: 'op-bokeh-3',
    bx: 0.55,
    by: 0.72,
    radius: 0.14,
    color: 'rgba(248,238,242,0.28)',
    driftX: 26,
    driftY: 18,
    speed: 0.007,
    phase: 4.0,
    layerDepth: 0.82,
    baseOpacity: 0.14,
  },
  {
    id: 'op-bokeh-4',
    bx: 0.38,
    by: 0.62,
    radius: 0.08,
    color: 'rgba(228,232,238,0.32)',
    driftX: 20,
    driftY: 16,
    speed: 0.006,
    phase: 5.2,
    layerDepth: 0.85,
    baseOpacity: 0.12,
  },
] as const;

/** Sternenhimmel — silbrig, sehr dezent. */
export const opgbStarDust: readonly OpgbStarDust[] = [
  { nx: 0.08, ny: 0.12, radius: 0.7, baseOpacity: 0.32, twinkleSpeed: 0.06, glowRadius: 3.2, layerDepth: 0.88, phase: 0.2 },
  { nx: 0.18, ny: 0.22, radius: 0.5, baseOpacity: 0.24, twinkleSpeed: 0.05, glowRadius: 2.4, layerDepth: 0.9, phase: 1.1 },
  { nx: 0.28, ny: 0.08, radius: 0.6, baseOpacity: 0.28, twinkleSpeed: 0.055, glowRadius: 2.8, layerDepth: 0.86, phase: 2.4 },
  { nx: 0.42, ny: 0.15, radius: 0.45, baseOpacity: 0.22, twinkleSpeed: 0.048, glowRadius: 2.2, layerDepth: 0.92, phase: 0.9 },
  { nx: 0.55, ny: 0.06, radius: 0.55, baseOpacity: 0.26, twinkleSpeed: 0.052, glowRadius: 2.6, layerDepth: 0.88, phase: 3.1 },
  { nx: 0.68, ny: 0.18, radius: 0.5, baseOpacity: 0.24, twinkleSpeed: 0.05, glowRadius: 2.4, layerDepth: 0.9, phase: 1.8 },
  { nx: 0.82, ny: 0.1, radius: 0.65, baseOpacity: 0.3, twinkleSpeed: 0.058, glowRadius: 3, layerDepth: 0.87, phase: 4.2 },
  { nx: 0.92, ny: 0.24, radius: 0.48, baseOpacity: 0.22, twinkleSpeed: 0.046, glowRadius: 2.3, layerDepth: 0.91, phase: 2.7 },
  { nx: 0.12, ny: 0.42, radius: 0.52, baseOpacity: 0.25, twinkleSpeed: 0.051, glowRadius: 2.5, layerDepth: 0.89, phase: 5.0 },
  { nx: 0.25, ny: 0.55, radius: 0.44, baseOpacity: 0.2, twinkleSpeed: 0.044, glowRadius: 2.1, layerDepth: 0.93, phase: 0.6 },
  { nx: 0.38, ny: 0.48, radius: 0.58, baseOpacity: 0.27, twinkleSpeed: 0.053, glowRadius: 2.7, layerDepth: 0.88, phase: 3.5 },
  { nx: 0.52, ny: 0.52, radius: 0.42, baseOpacity: 0.19, twinkleSpeed: 0.042, glowRadius: 2, layerDepth: 0.94, phase: 1.4 },
  { nx: 0.65, ny: 0.45, radius: 0.5, baseOpacity: 0.23, twinkleSpeed: 0.049, glowRadius: 2.4, layerDepth: 0.9, phase: 4.8 },
  { nx: 0.78, ny: 0.58, radius: 0.46, baseOpacity: 0.21, twinkleSpeed: 0.047, glowRadius: 2.2, layerDepth: 0.92, phase: 2.2 },
  { nx: 0.88, ny: 0.42, radius: 0.54, baseOpacity: 0.26, twinkleSpeed: 0.054, glowRadius: 2.6, layerDepth: 0.89, phase: 0.3 },
  { nx: 0.06, ny: 0.72, radius: 0.48, baseOpacity: 0.22, twinkleSpeed: 0.045, glowRadius: 2.3, layerDepth: 0.91, phase: 3.8 },
  { nx: 0.22, ny: 0.85, radius: 0.56, baseOpacity: 0.25, twinkleSpeed: 0.05, glowRadius: 2.5, layerDepth: 0.88, phase: 1.6 },
  { nx: 0.48, ny: 0.78, radius: 0.43, baseOpacity: 0.2, twinkleSpeed: 0.043, glowRadius: 2.1, layerDepth: 0.93, phase: 5.4 },
  { nx: 0.72, ny: 0.82, radius: 0.5, baseOpacity: 0.24, twinkleSpeed: 0.048, glowRadius: 2.4, layerDepth: 0.9, phase: 2.9 },
  { nx: 0.94, ny: 0.68, radius: 0.47, baseOpacity: 0.21, twinkleSpeed: 0.046, glowRadius: 2.2, layerDepth: 0.92, phase: 4.5 },
  { nx: 0.35, ny: 0.32, radius: 0.4, baseOpacity: 0.18, twinkleSpeed: 0.04, glowRadius: 1.9, layerDepth: 0.95, phase: 0.8 },
  { nx: 0.58, ny: 0.28, radius: 0.38, baseOpacity: 0.17, twinkleSpeed: 0.038, glowRadius: 1.8, layerDepth: 0.96, phase: 3.2 },
  { nx: 0.15, ny: 0.65, radius: 0.41, baseOpacity: 0.19, twinkleSpeed: 0.041, glowRadius: 2, layerDepth: 0.94, phase: 2.0 },
  { nx: 0.85, ny: 0.75, radius: 0.39, baseOpacity: 0.18, twinkleSpeed: 0.039, glowRadius: 1.9, layerDepth: 0.95, phase: 1.2 },
] as const;
