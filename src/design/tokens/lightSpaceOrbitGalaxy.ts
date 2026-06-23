/**
 * CareSuite+ — Light Space Orbit Galaxy background tokens.
 * Monochrome grey/silver space with deep red energy accents (no module rainbow).
 */

export const lsogBaseColors = {
  smokeTop: '#B4BAC4',
  silverMid: '#C4CAD2',
  pearlLower: '#D0D4DA',
  ashDepth: '#9EA4AE',
  horizonFade: '#C8CCD4',
} as const;

export const lsogBaseGradient = [
  lsogBaseColors.smokeTop,
  lsogBaseColors.silverMid,
  lsogBaseColors.pearlLower,
  lsogBaseColors.horizonFade,
  lsogBaseColors.ashDepth,
] as const;

export const lsogRedAccent = {
  core: 'rgba(168,32,38,0.92)',
  glow: 'rgba(148,28,34,0.55)',
  soft: 'rgba(130,24,30,0.28)',
  marker: 'rgba(190,36,42,0.88)',
  crack: 'rgba(175,30,36,0.78)',
} as const;

export type LsogCanvasIntensity = {
  nebulaFogOpacity: number;
  streakOpacity: number;
  starOpacity: number;
  orbitOpacity: number;
  particleOpacity: number;
  planetOpacity: number;
  redPulseOpacity: number;
  centerVeilAlpha: number;
};

export const lsogCanvasIntensity: LsogCanvasIntensity = {
  nebulaFogOpacity: 1.08,
  streakOpacity: 0.92,
  starOpacity: 0.58,
  orbitOpacity: 0.38,
  particleOpacity: 0.52,
  planetOpacity: 1,
  redPulseOpacity: 0.82,
  centerVeilAlpha: 0.032,
};

export type LsogNebulaFog = {
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

export type LsogDeepStreak = {
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

export type LsogPlanet = {
  id: string;
  cx: number;
  cy: number;
  radius: number;
  layerDepth: number;
  floatX: number;
  floatY: number;
  floatSpeed: number;
  phase: number;
  /** 0–1 — larger = more red crack energy */
  redEnergy: number;
  craterDensity: number;
};

export type LsogSmallBody = {
  id: string;
  cx: number;
  cy: number;
  radius: number;
  layerDepth: number;
  driftX: number;
  driftY: number;
  speed: number;
  phase: number;
  opacity: number;
};

export type LsogRedEnergyPoint = {
  id: string;
  cx: number;
  cy: number;
  radius: number;
  pulseSpeed: number;
  phase: number;
  layerDepth: number;
  kind: 'orbital' | 'surface' | 'drift';
};

export type LsogOrbitArc = {
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

export type LsogStarSeed = {
  nx: number;
  ny: number;
  radius: number;
  baseOpacity: number;
  twinkleSpeed: number;
  glowRadius: number;
  layerDepth: number;
  phase: number;
};

/** L2 — Soft grey/silver nebula fog, diagonal TL→BR flow. */
export const lsogNebulaFog: readonly LsogNebulaFog[] = [
  {
    id: 'fog-tl-silver',
    bx: 0.02,
    by: 0.04,
    radiusX: 0.58,
    radiusY: 0.52,
    inner: 'rgba(210,214,220,0.72)',
    mid: 'rgba(175,180,188,0.38)',
    outer: 'rgba(140,146,156,0.06)',
    baseOpacity: 0.96,
    driftX: 320,
    driftY: 240,
    speed: 0.11,
    phase: 0,
    layerDepth: 0.42,
    breathe: 0.1,
  },
  {
    id: 'fog-mid-smoke',
    bx: 0.38,
    by: 0.22,
    radiusX: 0.44,
    radiusY: 0.38,
    inner: 'rgba(195,200,208,0.58)',
    mid: 'rgba(155,160,170,0.28)',
    outer: 'rgba(120,126,136,0.04)',
    baseOpacity: 0.82,
    driftX: 260,
    driftY: 190,
    speed: 0.095,
    phase: 1.8,
    layerDepth: 0.48,
    breathe: 0.08,
  },
  {
    id: 'fog-br-pearl',
    bx: 0.92,
    by: 0.88,
    radiusX: 0.5,
    radiusY: 0.46,
    inner: 'rgba(205,210,216,0.64)',
    mid: 'rgba(168,174,182,0.32)',
    outer: 'rgba(130,136,144,0.05)',
    baseOpacity: 0.88,
    driftX: 280,
    driftY: 210,
    speed: 0.088,
    phase: 3.4,
    layerDepth: 0.5,
    breathe: 0.09,
  },
  {
    id: 'fog-center-wisp',
    bx: 0.62,
    by: 0.38,
    radiusX: 0.28,
    radiusY: 0.24,
    inner: 'rgba(188,194,202,0.42)',
    mid: 'rgba(150,156,164,0.18)',
    outer: 'transparent',
    baseOpacity: 0.62,
    driftX: 180,
    driftY: 140,
    speed: 0.102,
    phase: 5.2,
    layerDepth: 0.55,
    breathe: 0.07,
  },
] as const;

/** L3 — Darker charcoal streaks for galaxy structure. */
export const lsogDeepStreaks: readonly LsogDeepStreak[] = [
  {
    id: 'streak-diagonal-main',
    bx: 0.08,
    by: 0.1,
    length: 0.72,
    thickness: 0.055,
    angle: 0.42,
    color: 'rgba(88,92,100,0.48)',
    driftX: 200,
    driftY: 150,
    speed: 0.078,
    phase: 0.6,
    layerDepth: 0.58,
  },
  {
    id: 'streak-upper-band',
    bx: 0.22,
    by: 0.06,
    length: 0.55,
    thickness: 0.042,
    angle: 0.28,
    color: 'rgba(72,76,84,0.42)',
    driftX: 170,
    driftY: 120,
    speed: 0.072,
    phase: 2.3,
    layerDepth: 0.62,
  },
  {
    id: 'streak-lower-stream',
    bx: 0.12,
    by: 0.62,
    length: 0.48,
    thickness: 0.038,
    angle: 0.55,
    color: 'rgba(96,100,108,0.38)',
    driftX: 160,
    driftY: 110,
    speed: 0.068,
    phase: 4.1,
    layerDepth: 0.6,
  },
  {
    id: 'streak-trail-r',
    bx: 0.78,
    by: 0.18,
    length: 0.38,
    thickness: 0.034,
    angle: -0.35,
    color: 'rgba(80,84,92,0.36)',
    driftX: 140,
    driftY: 100,
    speed: 0.074,
    phase: 3.7,
    layerDepth: 0.64,
  },
] as const;

/** L4 — Large planets with red energy (lower-left primary, mid-right secondary). */
export const lsogPlanets: readonly LsogPlanet[] = [
  {
    id: 'planet-primary-ll',
    cx: 0.14,
    cy: 0.74,
    radius: 0.11,
    layerDepth: 0.78,
    floatX: 22,
    floatY: 18,
    floatSpeed: 0.082,
    phase: 0.4,
    redEnergy: 0.92,
    craterDensity: 0.55,
  },
  {
    id: 'planet-secondary-mr',
    cx: 0.74,
    cy: 0.42,
    radius: 0.075,
    layerDepth: 0.72,
    floatX: 18,
    floatY: 14,
    floatSpeed: 0.076,
    phase: 2.1,
    redEnergy: 0.68,
    craterDensity: 0.48,
  },
] as const;

/** L5 — Small moons and distant bodies. */
export const lsogSmallBodies: readonly LsogSmallBody[] = [
  { id: 'moon-a', cx: 0.52, cy: 0.14, radius: 0.022, layerDepth: 0.55, driftX: 28, driftY: 20, speed: 0.09, phase: 0.8, opacity: 0.72 },
  { id: 'moon-b', cx: 0.88, cy: 0.28, radius: 0.018, layerDepth: 0.5, driftX: 24, driftY: 18, speed: 0.084, phase: 2.4, opacity: 0.62 },
  { id: 'moon-c', cx: 0.32, cy: 0.48, radius: 0.014, layerDepth: 0.45, driftX: 20, driftY: 16, speed: 0.078, phase: 4.2, opacity: 0.55 },
  { id: 'moon-d', cx: 0.62, cy: 0.68, radius: 0.012, layerDepth: 0.42, driftX: 18, driftY: 14, speed: 0.072, phase: 1.6, opacity: 0.48 },
  { id: 'moon-e', cx: 0.42, cy: 0.22, radius: 0.01, layerDepth: 0.38, driftX: 16, driftY: 12, speed: 0.07, phase: 3.8, opacity: 0.42 },
  { id: 'moon-f', cx: 0.08, cy: 0.38, radius: 0.009, layerDepth: 0.35, driftX: 14, driftY: 10, speed: 0.066, phase: 5.4, opacity: 0.38 },
] as const;

/** L7 — Red orbital markers and energy pulses. */
export const lsogRedEnergyPoints: readonly LsogRedEnergyPoint[] = [
  { id: 'red-surface-primary', cx: 0.11, cy: 0.71, radius: 4.2, pulseSpeed: 1.65, phase: 0, layerDepth: 0.82, kind: 'surface' },
  { id: 'red-orbit-a', cx: 0.28, cy: 0.58, radius: 3.2, pulseSpeed: 1.42, phase: 1.2, layerDepth: 0.7, kind: 'orbital' },
  { id: 'red-orbit-b', cx: 0.58, cy: 0.32, radius: 2.8, pulseSpeed: 1.55, phase: 2.8, layerDepth: 0.65, kind: 'orbital' },
  { id: 'red-drift-c', cx: 0.82, cy: 0.52, radius: 2.4, pulseSpeed: 1.38, phase: 4.1, layerDepth: 0.6, kind: 'drift' },
  { id: 'red-orbit-d', cx: 0.46, cy: 0.78, radius: 2.6, pulseSpeed: 1.48, phase: 0.9, layerDepth: 0.58, kind: 'orbital' },
  { id: 'red-surface-secondary', cx: 0.72, cy: 0.4, radius: 3, pulseSpeed: 1.52, phase: 3.5, layerDepth: 0.75, kind: 'surface' },
] as const;

/** L8 — Very subtle orbit arcs. */
export const lsogOrbitArcs: readonly LsogOrbitArc[] = [
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

export const lsogStarDust: readonly LsogStarSeed[] = [
  { nx: 0.06, ny: 0.09, radius: 0.9, baseOpacity: 0.44, twinkleSpeed: 0.92, glowRadius: 4.5, layerDepth: 0.88, phase: 0.3 },
  { nx: 0.13, ny: 0.18, radius: 0.75, baseOpacity: 0.38, twinkleSpeed: 0.78, glowRadius: 3.8, layerDepth: 0.9, phase: 1.4 },
  { nx: 0.19, ny: 0.05, radius: 1, baseOpacity: 0.48, twinkleSpeed: 0.88, glowRadius: 5, layerDepth: 0.86, phase: 2.6 },
  { nx: 0.35, ny: 0.04, radius: 0.85, baseOpacity: 0.4, twinkleSpeed: 0.72, glowRadius: 4, layerDepth: 0.92, phase: 0.9 },
  { nx: 0.55, ny: 0.08, radius: 0.8, baseOpacity: 0.42, twinkleSpeed: 0.8, glowRadius: 3.9, layerDepth: 0.89, phase: 3.1 },
  { nx: 0.72, ny: 0.12, radius: 0.95, baseOpacity: 0.46, twinkleSpeed: 0.86, glowRadius: 4.6, layerDepth: 0.87, phase: 4.3 },
  { nx: 0.9, ny: 0.16, radius: 0.7, baseOpacity: 0.36, twinkleSpeed: 0.7, glowRadius: 3.4, layerDepth: 0.94, phase: 1.8 },
  { nx: 0.04, ny: 0.35, radius: 0.88, baseOpacity: 0.42, twinkleSpeed: 0.84, glowRadius: 4.2, layerDepth: 0.9, phase: 2.9 },
  { nx: 0.22, ny: 0.52, radius: 0.78, baseOpacity: 0.38, twinkleSpeed: 0.74, glowRadius: 3.6, layerDepth: 0.91, phase: 0.5 },
  { nx: 0.48, ny: 0.62, radius: 0.92, baseOpacity: 0.44, twinkleSpeed: 0.82, glowRadius: 4.4, layerDepth: 0.88, phase: 3.7 },
  { nx: 0.66, ny: 0.58, radius: 0.82, baseOpacity: 0.4, twinkleSpeed: 0.76, glowRadius: 3.8, layerDepth: 0.92, phase: 5.1 },
  { nx: 0.84, ny: 0.48, radius: 0.86, baseOpacity: 0.42, twinkleSpeed: 0.8, glowRadius: 4, layerDepth: 0.9, phase: 1.2 },
  { nx: 0.92, ny: 0.62, radius: 0.72, baseOpacity: 0.34, twinkleSpeed: 0.68, glowRadius: 3.2, layerDepth: 0.95, phase: 4.6 },
  { nx: 0.08, ny: 0.72, radius: 0.9, baseOpacity: 0.42, twinkleSpeed: 0.86, glowRadius: 4.3, layerDepth: 0.89, phase: 2.2 },
  { nx: 0.28, ny: 0.86, radius: 0.76, baseOpacity: 0.36, twinkleSpeed: 0.72, glowRadius: 3.5, layerDepth: 0.93, phase: 0.7 },
  { nx: 0.52, ny: 0.34, radius: 0.84, baseOpacity: 0.4, twinkleSpeed: 0.78, glowRadius: 4, layerDepth: 0.91, phase: 3.9 },
  { nx: 0.58, ny: 0.44, radius: 1.05, baseOpacity: 0.5, twinkleSpeed: 0.94, glowRadius: 5.2, layerDepth: 0.86, phase: 1.6 },
  { nx: 0.7, ny: 0.82, radius: 0.8, baseOpacity: 0.38, twinkleSpeed: 0.74, glowRadius: 3.7, layerDepth: 0.92, phase: 4.9 },
  { nx: 0.38, ny: 0.88, radius: 0.82, baseOpacity: 0.38, twinkleSpeed: 0.76, glowRadius: 3.8, layerDepth: 0.93, phase: 5.5 },
  { nx: 0.78, ny: 0.06, radius: 0.74, baseOpacity: 0.36, twinkleSpeed: 0.7, glowRadius: 3.4, layerDepth: 0.94, phase: 2.4 },
] as const;

export const LSOG_LAYER_IDS = [
  'base-atmosphere',
  'nebula-fog',
  'deep-nebula-streaks',
  'planets-foreground',
  'small-celestial-bodies',
  'star-dust',
  'red-energy-accents',
  'orbit-arcs',
  'ui-readability-veil',
] as const;

export type LsogLayerId = (typeof LSOG_LAYER_IDS)[number];
