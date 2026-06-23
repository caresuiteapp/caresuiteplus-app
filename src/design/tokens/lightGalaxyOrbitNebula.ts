/**
 * CareSuite+ — Light Galaxy Orbit Nebula background tokens.
 * Monochrome grey/silver space with deep red energy accents.
 * Each layer (A–J) owns independent motion vectors — no shared scene pan.
 */

export const lgoonBaseColors = {
  smokeTop: '#A8AEB6',
  silverMid: '#B8BEC6',
  pearlLower: '#C4CAD2',
  ashDepth: '#9CA2AC',
  horizonFade: '#B0B6BE',
} as const;

export const lgoonBaseGradient = [
  lgoonBaseColors.smokeTop,
  lgoonBaseColors.silverMid,
  lgoonBaseColors.pearlLower,
  lgoonBaseColors.horizonFade,
  lgoonBaseColors.ashDepth,
] as const;

export const lgoonRedAccent = {
  core: 'rgba(168,32,38,0.92)',
  glow: 'rgba(148,28,34,0.55)',
  soft: 'rgba(130,24,30,0.28)',
  marker: 'rgba(190,36,42,0.88)',
  crack: 'rgba(175,30,36,0.78)',
} as const;

export type LgoonCanvasIntensity = {
  nebulaFogOpacity: number;
  streakOpacity: number;
  starOpacity: number;
  orbitOpacity: number;
  particleOpacity: number;
  planetOpacity: number;
  redPulseOpacity: number;
  centerVeilAlpha: number;
};

export const lgoonCanvasIntensity: LgoonCanvasIntensity = {
  nebulaFogOpacity: 1.08,
  streakOpacity: 0.92,
  starOpacity: 0.58,
  orbitOpacity: 0.38,
  particleOpacity: 0.52,
  planetOpacity: 1,
  redPulseOpacity: 0.82,
  centerVeilAlpha: 0.032,
};

export type LgoonNebulaBlob = {
  id: string;
  bx: number;
  by: number;
  radiusX: number;
  radiusY: number;
  inner: string;
  mid: string;
  outer: string;
  baseOpacity: number;
  /** Lissajous freq X */
  freqX: number;
  /** Lissajous freq Y */
  freqY: number;
  ampX: number;
  ampY: number;
  phase: number;
  breathe: number;
  /** Organic flow bias (px/s) */
  flowVx: number;
  flowVy: number;
};

export type LgoonDeepStreak = {
  id: string;
  bx: number;
  by: number;
  length: number;
  thickness: number;
  angle: number;
  color: string;
  freqA: number;
  freqB: number;
  ampX: number;
  ampY: number;
  phase: number;
  flowAngle: number;
  flowSpeed: number;
};

export type LgoonPlanet = {
  id: string;
  cx: number;
  cy: number;
  radius: number;
  floatAmpX: number;
  floatAmpY: number;
  floatFreqX: number;
  floatFreqY: number;
  phase: number;
  redEnergy: number;
  craterDensity: number;
  lightShiftSpeed: number;
};

export type LgoonSmallBody = {
  id: string;
  cx: number;
  cy: number;
  radius: number;
  freqX: number;
  freqY: number;
  ampX: number;
  ampY: number;
  phase: number;
  opacity: number;
};

export type LgoonRedEnergyPoint = {
  id: string;
  cx: number;
  cy: number;
  radius: number;
  pulseSpeed: number;
  phase: number;
  orbitRadius: number;
  orbitSpeed: number;
  kind: 'surface' | 'orbital' | 'drift';
};

export type LgoonOrbitArc = {
  id: string;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  rotation: number;
  speed: number;
  stroke: string;
  lineWidth: number;
  opacity: number;
  dash?: number[];
};

export type LgoonStarSeed = {
  nx: number;
  ny: number;
  radius: number;
  baseOpacity: number;
  twinkleSpeed: number;
  glowRadius: number;
  phase: number;
  driftX: number;
  driftY: number;
  driftSpeed: number;
};

/** Layer B — Far nebula blobs with distinct Lissajous + flow vectors. */
export const lgoonFarNebulaBlobs: readonly LgoonNebulaBlob[] = [
  {
    id: 'blob-tl-silver',
    bx: 0.04,
    by: 0.06,
    radiusX: 0.56,
    radiusY: 0.5,
    inner: 'rgba(210,214,220,0.72)',
    mid: 'rgba(175,180,188,0.38)',
    outer: 'rgba(140,146,156,0.06)',
    baseOpacity: 0.96,
    freqX: 0.11,
    freqY: 0.087,
    ampX: 340,
    ampY: 260,
    phase: 0,
    breathe: 0.1,
    flowVx: 4.2,
    flowVy: 2.8,
  },
  {
    id: 'blob-mid-smoke',
    bx: 0.4,
    by: 0.24,
    radiusX: 0.42,
    radiusY: 0.36,
    inner: 'rgba(195,200,208,0.58)',
    mid: 'rgba(155,160,170,0.28)',
    outer: 'rgba(120,126,136,0.04)',
    baseOpacity: 0.82,
    freqX: 0.095,
    freqY: 0.118,
    ampX: 280,
    ampY: 210,
    phase: 1.8,
    breathe: 0.08,
    flowVx: -3.1,
    flowVy: 5.4,
  },
  {
    id: 'blob-br-pearl',
    bx: 0.9,
    by: 0.86,
    radiusX: 0.48,
    radiusY: 0.44,
    inner: 'rgba(205,210,216,0.64)',
    mid: 'rgba(168,174,182,0.32)',
    outer: 'rgba(130,136,144,0.05)',
    baseOpacity: 0.88,
    freqX: 0.088,
    freqY: 0.102,
    ampX: 300,
    ampY: 220,
    phase: 3.4,
    breathe: 0.09,
    flowVx: -2.6,
    flowVy: -4.8,
  },
  {
    id: 'blob-center-wisp',
    bx: 0.64,
    by: 0.4,
    radiusX: 0.26,
    radiusY: 0.22,
    inner: 'rgba(188,194,202,0.42)',
    mid: 'rgba(150,156,164,0.18)',
    outer: 'transparent',
    baseOpacity: 0.62,
    freqX: 0.102,
    freqY: 0.076,
    ampX: 190,
    ampY: 150,
    phase: 5.2,
    breathe: 0.07,
    flowVx: 5.8,
    flowVy: -2.2,
  },
] as const;

/** Layer C — Deep streaks with flow-field drift (different phase from B). */
export const lgoonDeepStreaks: readonly LgoonDeepStreak[] = [
  {
    id: 'streak-diagonal-main',
    bx: 0.1,
    by: 0.12,
    length: 0.72,
    thickness: 0.055,
    angle: 0.42,
    color: 'rgba(88,92,100,0.48)',
    freqA: 0.078,
    freqB: 0.062,
    ampX: 220,
    ampY: 170,
    phase: 0.6,
    flowAngle: 0.55,
    flowSpeed: 3.2,
  },
  {
    id: 'streak-upper-band',
    bx: 0.24,
    by: 0.08,
    length: 0.55,
    thickness: 0.042,
    angle: 0.28,
    color: 'rgba(72,76,84,0.42)',
    freqA: 0.072,
    freqB: 0.091,
    ampX: 185,
    ampY: 135,
    phase: 2.3,
    flowAngle: -0.35,
    flowSpeed: 2.8,
  },
  {
    id: 'streak-lower-stream',
    bx: 0.14,
    by: 0.64,
    length: 0.48,
    thickness: 0.038,
    angle: 0.55,
    color: 'rgba(96,100,108,0.38)',
    freqA: 0.068,
    freqB: 0.084,
    ampX: 175,
    ampY: 125,
    phase: 4.1,
    flowAngle: 1.1,
    flowSpeed: -2.4,
  },
  {
    id: 'streak-trail-r',
    bx: 0.8,
    by: 0.2,
    length: 0.38,
    thickness: 0.034,
    angle: -0.35,
    color: 'rgba(80,84,92,0.36)',
    freqA: 0.074,
    freqB: 0.058,
    ampX: 155,
    ampY: 115,
    phase: 3.7,
    flowAngle: 2.4,
    flowSpeed: 3.6,
  },
] as const;

/** Layer D — Primary planet (lower-left). */
export const lgoonMainPlanet: LgoonPlanet = {
  id: 'planet-primary-ll',
  cx: 0.14,
  cy: 0.74,
  radius: 0.11,
  floatAmpX: 28,
  floatAmpY: 22,
  floatFreqX: 0.062,
  floatFreqY: 0.048,
  phase: 0.4,
  redEnergy: 0.92,
  craterDensity: 0.55,
  lightShiftSpeed: 0.045,
};

/** Layer E — Secondary planets. */
export const lgoonSecondaryPlanets: readonly LgoonPlanet[] = [
  {
    id: 'planet-secondary-mr',
    cx: 0.74,
    cy: 0.42,
    radius: 0.075,
    floatAmpX: 24,
    floatAmpY: 18,
    floatFreqX: 0.055,
    floatFreqY: 0.071,
    phase: 2.1,
    redEnergy: 0.68,
    craterDensity: 0.48,
    lightShiftSpeed: 0.038,
  },
  {
    id: 'planet-tertiary-tr',
    cx: 0.58,
    cy: 0.18,
    radius: 0.042,
    floatAmpX: 16,
    floatAmpY: 12,
    floatFreqX: 0.068,
    floatFreqY: 0.052,
    phase: 4.6,
    redEnergy: 0.35,
    craterDensity: 0.42,
    lightShiftSpeed: 0.052,
  },
] as const;

/** Layer F — Small celestial bodies. */
export const lgoonSmallBodies: readonly LgoonSmallBody[] = [
  { id: 'moon-a', cx: 0.52, cy: 0.14, radius: 0.022, freqX: 0.09, freqY: 0.074, ampX: 32, ampY: 24, phase: 0.8, opacity: 0.72 },
  { id: 'moon-b', cx: 0.88, cy: 0.28, radius: 0.018, freqX: 0.084, freqY: 0.102, ampX: 28, ampY: 20, phase: 2.4, opacity: 0.62 },
  { id: 'moon-c', cx: 0.32, cy: 0.48, radius: 0.014, freqX: 0.078, freqY: 0.096, ampX: 24, ampY: 18, phase: 4.2, opacity: 0.55 },
  { id: 'moon-d', cx: 0.62, cy: 0.68, radius: 0.012, freqX: 0.072, freqY: 0.088, ampX: 22, ampY: 16, phase: 1.6, opacity: 0.48 },
  { id: 'moon-e', cx: 0.42, cy: 0.22, radius: 0.01, freqX: 0.07, freqY: 0.082, ampX: 18, ampY: 14, phase: 3.8, opacity: 0.42 },
  { id: 'moon-f', cx: 0.08, cy: 0.38, radius: 0.009, freqX: 0.066, freqY: 0.078, ampX: 16, ampY: 12, phase: 5.4, opacity: 0.38 },
] as const;

/** Layer G — Red energy points (local pulse, independent orbit). */
export const lgoonRedEnergyPoints: readonly LgoonRedEnergyPoint[] = [
  { id: 'red-surface-primary', cx: 0.11, cy: 0.71, radius: 4.2, pulseSpeed: 1.65, phase: 0, orbitRadius: 0, orbitSpeed: 0, kind: 'surface' },
  { id: 'red-orbit-a', cx: 0.28, cy: 0.58, radius: 3.2, pulseSpeed: 1.42, phase: 1.2, orbitRadius: 22, orbitSpeed: 0.12, kind: 'orbital' },
  { id: 'red-orbit-b', cx: 0.58, cy: 0.32, radius: 2.8, pulseSpeed: 1.55, phase: 2.8, orbitRadius: 18, orbitSpeed: -0.14, kind: 'orbital' },
  { id: 'red-drift-c', cx: 0.82, cy: 0.52, radius: 2.4, pulseSpeed: 1.38, phase: 4.1, orbitRadius: 14, orbitSpeed: 0.08, kind: 'drift' },
  { id: 'red-orbit-d', cx: 0.46, cy: 0.78, radius: 2.6, pulseSpeed: 1.48, phase: 0.9, orbitRadius: 16, orbitSpeed: 0.1, kind: 'orbital' },
  { id: 'red-surface-secondary', cx: 0.72, cy: 0.4, radius: 3, pulseSpeed: 1.52, phase: 3.5, orbitRadius: 0, orbitSpeed: 0, kind: 'surface' },
] as const;

/** Layer I — Orbit arcs. */
export const lgoonOrbitArcs: readonly LgoonOrbitArc[] = [
  {
    id: 'arc-outer',
    cx: 0.48,
    cy: 0.46,
    rx: 0.58,
    ry: 0.34,
    rotation: 0.35,
    speed: 0.018,
    stroke: 'rgba(130,136,144,0.18)',
    lineWidth: 0.9,
    opacity: 0.42,
    dash: [5, 16],
  },
  {
    id: 'arc-mid',
    cx: 0.5,
    cy: 0.5,
    rx: 0.38,
    ry: 0.22,
    rotation: -0.15,
    speed: -0.022,
    stroke: 'rgba(110,116,124,0.16)',
    lineWidth: 0.75,
    opacity: 0.36,
    dash: [4, 12],
  },
  {
    id: 'arc-planet-ll',
    cx: 0.14,
    cy: 0.74,
    rx: 0.18,
    ry: 0.1,
    rotation: 0.6,
    speed: 0.014,
    stroke: 'rgba(148,28,34,0.14)',
    lineWidth: 0.6,
    opacity: 0.32,
    dash: [3, 9],
  },
] as const;

/** Layer H — Star dust seeds. */
export const lgoonStarDust: readonly LgoonStarSeed[] = [
  { nx: 0.06, ny: 0.09, radius: 0.9, baseOpacity: 0.44, twinkleSpeed: 0.92, glowRadius: 4.5, phase: 0.3, driftX: 14, driftY: 10, driftSpeed: 0.05 },
  { nx: 0.13, ny: 0.18, radius: 0.75, baseOpacity: 0.38, twinkleSpeed: 0.78, glowRadius: 3.8, phase: 1.4, driftX: 18, driftY: 12, driftSpeed: 0.062 },
  { nx: 0.19, ny: 0.05, radius: 1, baseOpacity: 0.48, twinkleSpeed: 0.88, glowRadius: 5, phase: 2.6, driftX: 12, driftY: 16, driftSpeed: 0.048 },
  { nx: 0.35, ny: 0.04, radius: 0.85, baseOpacity: 0.4, twinkleSpeed: 0.72, glowRadius: 4, phase: 0.9, driftX: 20, driftY: 8, driftSpeed: 0.055 },
  { nx: 0.55, ny: 0.08, radius: 0.8, baseOpacity: 0.42, twinkleSpeed: 0.8, glowRadius: 3.9, phase: 3.1, driftX: 16, driftY: 14, driftSpeed: 0.058 },
  { nx: 0.72, ny: 0.12, radius: 0.95, baseOpacity: 0.46, twinkleSpeed: 0.86, glowRadius: 4.6, phase: 4.3, driftX: 22, driftY: 11, driftSpeed: 0.051 },
  { nx: 0.9, ny: 0.16, radius: 0.7, baseOpacity: 0.36, twinkleSpeed: 0.7, glowRadius: 3.4, phase: 1.8, driftX: 10, driftY: 18, driftSpeed: 0.064 },
  { nx: 0.04, ny: 0.35, radius: 0.88, baseOpacity: 0.42, twinkleSpeed: 0.84, glowRadius: 4.2, phase: 2.9, driftX: 15, driftY: 13, driftSpeed: 0.053 },
  { nx: 0.22, ny: 0.52, radius: 0.78, baseOpacity: 0.38, twinkleSpeed: 0.74, glowRadius: 3.6, phase: 0.5, driftX: 19, driftY: 9, driftSpeed: 0.059 },
  { nx: 0.48, ny: 0.62, radius: 0.92, baseOpacity: 0.44, twinkleSpeed: 0.82, glowRadius: 4.4, phase: 3.7, driftX: 13, driftY: 17, driftSpeed: 0.046 },
  { nx: 0.66, ny: 0.58, radius: 0.82, baseOpacity: 0.4, twinkleSpeed: 0.76, glowRadius: 3.8, phase: 5.1, driftX: 21, driftY: 10, driftSpeed: 0.061 },
  { nx: 0.84, ny: 0.48, radius: 0.86, baseOpacity: 0.42, twinkleSpeed: 0.8, glowRadius: 4, phase: 1.2, driftX: 17, driftY: 15, driftSpeed: 0.052 },
  { nx: 0.92, ny: 0.62, radius: 0.72, baseOpacity: 0.34, twinkleSpeed: 0.68, glowRadius: 3.2, phase: 4.6, driftX: 11, driftY: 19, driftSpeed: 0.067 },
  { nx: 0.08, ny: 0.72, radius: 0.9, baseOpacity: 0.42, twinkleSpeed: 0.86, glowRadius: 4.3, phase: 2.2, driftX: 23, driftY: 8, driftSpeed: 0.049 },
  { nx: 0.28, ny: 0.86, radius: 0.76, baseOpacity: 0.36, twinkleSpeed: 0.72, glowRadius: 3.5, phase: 0.7, driftX: 14, driftY: 16, driftSpeed: 0.056 },
  { nx: 0.52, ny: 0.34, radius: 0.84, baseOpacity: 0.4, twinkleSpeed: 0.78, glowRadius: 4, phase: 3.9, driftX: 18, driftY: 12, driftSpeed: 0.054 },
  { nx: 0.58, ny: 0.44, radius: 1.05, baseOpacity: 0.5, twinkleSpeed: 0.94, glowRadius: 5.2, phase: 1.6, driftX: 16, driftY: 14, driftSpeed: 0.047 },
  { nx: 0.7, ny: 0.82, radius: 0.8, baseOpacity: 0.38, twinkleSpeed: 0.74, glowRadius: 3.7, phase: 4.9, driftX: 20, driftY: 9, driftSpeed: 0.063 },
  { nx: 0.38, ny: 0.88, radius: 0.82, baseOpacity: 0.38, twinkleSpeed: 0.76, glowRadius: 3.8, phase: 5.5, driftX: 12, driftY: 20, driftSpeed: 0.057 },
  { nx: 0.78, ny: 0.06, radius: 0.74, baseOpacity: 0.36, twinkleSpeed: 0.7, glowRadius: 3.4, phase: 2.4, driftX: 24, driftY: 7, driftSpeed: 0.065 },
] as const;

/** Ten mandatory layer IDs (A–J). */
export const LGON_LAYER_IDS = [
  'layer-a-base-atmosphere',
  'layer-b-far-nebula',
  'layer-c-deep-nebula',
  'layer-d-main-planet',
  'layer-e-secondary-planets',
  'layer-f-small-bodies',
  'layer-g-red-energy',
  'layer-h-star-dust',
  'layer-i-orbit-arcs',
  'layer-j-readability-veil',
] as const;

export type LgonLayerId = (typeof LGON_LAYER_IDS)[number];
