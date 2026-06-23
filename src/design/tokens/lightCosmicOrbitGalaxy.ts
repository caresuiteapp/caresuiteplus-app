/**
 * CareSuite+ — Light Cosmic Orbit Galaxy background tokens.
 * Nine visual layers: base gradient, galaxy clouds, orbit rings, star dust,
 * particles, aurora wisps, light paths, comet streaks, vignette.
 */

import type { MainModuleKey } from '@/types/navigation/platform';
import { moduleColor } from '@/design/tokens/modules';

export const lcogBaseColors = {
  deepSky: '#DCE8FF',
  cosmicBlue: '#D4E4FF',
  nebulaLilac: '#E4DCFF',
  softPearl: '#EEF4FF',
  horizonGlow: '#E8F0FF',
} as const;

export const lcogBaseGradient = [
  lcogBaseColors.deepSky,
  lcogBaseColors.cosmicBlue,
  lcogBaseColors.nebulaLilac,
  lcogBaseColors.softPearl,
  lcogBaseColors.horizonGlow,
] as const;

export type LcogCanvasIntensity = {
  nebulaOpacity: number;
  wispOpacity: number;
  starOpacity: number;
  orbitOpacity: number;
  particleOpacity: number;
  pathOpacity: number;
  centerVeilAlpha: number;
};

export const lcogCanvasIntensity: LcogCanvasIntensity = {
  nebulaOpacity: 1.12,
  wispOpacity: 0.94,
  starOpacity: 0.62,
  orbitOpacity: 0.48,
  particleOpacity: 0.55,
  pathOpacity: 0.42,
  centerVeilAlpha: 0.04,
};

export type LcogGalaxyCloud = {
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

export type LcogOrbitRing = {
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

export type LcogAuroraWisp = {
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

export type LcogLightPath = {
  id: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  color: string;
  width: number;
  speed: number;
  phase: number;
};

export type LcogStarSeed = {
  nx: number;
  ny: number;
  radius: number;
  baseOpacity: number;
  twinkleSpeed: number;
  glowRadius: number;
  layerDepth: number;
  phase: number;
};

/** Galaxy nebula clouds — stronger saturation, visible drift within ~10 s. */
export const lcogGalaxyClouds: readonly LcogGalaxyCloud[] = [
  {
    id: 'galaxy-tl-cyan',
    bx: 0.04,
    by: 0.06,
    radiusX: 0.56,
    radiusY: 0.5,
    inner: 'rgba(80,200,255,0.82)',
    mid: 'rgba(120,190,255,0.42)',
    outer: 'rgba(180,220,255,0.08)',
    baseOpacity: 1,
    driftX: 280,
    driftY: 210,
    speed: 0.085,
    phase: 0,
    layerDepth: 0.5,
    breathe: 0.09,
  },
  {
    id: 'galaxy-tr-violet',
    bx: 0.96,
    by: 0.08,
    radiusX: 0.52,
    radiusY: 0.46,
    inner: 'rgba(160,120,255,0.78)',
    mid: 'rgba(190,160,255,0.38)',
    outer: 'rgba(220,200,255,0.07)',
    baseOpacity: 0.96,
    driftX: 260,
    driftY: 190,
    speed: 0.078,
    phase: 1.4,
    layerDepth: 0.55,
    breathe: 0.08,
  },
  {
    id: 'galaxy-bl-blue',
    bx: 0.06,
    by: 0.92,
    radiusX: 0.48,
    radiusY: 0.44,
    inner: 'rgba(100,170,255,0.72)',
    mid: 'rgba(150,200,255,0.34)',
    outer: 'rgba(200,230,255,0.06)',
    baseOpacity: 0.92,
    driftX: 240,
    driftY: 180,
    speed: 0.072,
    phase: 3,
    layerDepth: 0.52,
    breathe: 0.07,
  },
  {
    id: 'galaxy-br-rose',
    bx: 0.94,
    by: 0.9,
    radiusX: 0.46,
    radiusY: 0.42,
    inner: 'rgba(220,160,255,0.68)',
    mid: 'rgba(240,200,255,0.32)',
    outer: 'rgba(255,230,255,0.05)',
    baseOpacity: 0.9,
    driftX: 230,
    driftY: 170,
    speed: 0.068,
    phase: 4.6,
    layerDepth: 0.58,
    breathe: 0.07,
  },
  {
    id: 'galaxy-mid-accent',
    bx: 0.18,
    by: 0.32,
    radiusX: 0.32,
    radiusY: 0.28,
    inner: 'rgba(120,210,255,0.36)',
    mid: 'rgba(160,190,255,0.16)',
    outer: 'transparent',
    baseOpacity: 0.62,
    driftX: 160,
    driftY: 120,
    speed: 0.08,
    phase: 2.2,
    layerDepth: 0.68,
    breathe: 0.06,
  },
  {
    id: 'galaxy-mid-lilac',
    bx: 0.82,
    by: 0.58,
    radiusX: 0.3,
    radiusY: 0.26,
    inner: 'rgba(180,140,255,0.34)',
    mid: 'rgba(210,180,255,0.14)',
    outer: 'transparent',
    baseOpacity: 0.58,
    driftX: 150,
    driftY: 110,
    speed: 0.074,
    phase: 5.1,
    layerDepth: 0.7,
    breathe: 0.05,
  },
] as const;

/** Orbital rings — slow rotation visible within ~10 s. */
export const lcogOrbitRings: readonly LcogOrbitRing[] = [
  {
    id: 'orbit-outer',
    cx: 0.5,
    cy: 0.46,
    rx: 0.62,
    ry: 0.38,
    rotation: 0.4,
    speed: 0.012,
    stroke: 'rgba(100,180,255,0.22)',
    lineWidth: 1.2,
    opacity: 0.55,
    dash: [6, 14],
  },
  {
    id: 'orbit-mid',
    cx: 0.48,
    cy: 0.5,
    rx: 0.44,
    ry: 0.28,
    rotation: -0.2,
    speed: -0.018,
    stroke: 'rgba(160,130,255,0.20)',
    lineWidth: 1,
    opacity: 0.48,
    dash: [4, 10],
  },
  {
    id: 'orbit-inner',
    cx: 0.52,
    cy: 0.44,
    rx: 0.28,
    ry: 0.18,
    rotation: 0.8,
    speed: 0.024,
    stroke: 'rgba(80,220,255,0.18)',
    lineWidth: 0.8,
    opacity: 0.42,
  },
  {
    id: 'orbit-tl',
    cx: 0.12,
    cy: 0.14,
    rx: 0.22,
    ry: 0.14,
    rotation: 0,
    speed: 0.016,
    stroke: 'rgba(130,170,255,0.16)',
    lineWidth: 0.7,
    opacity: 0.38,
    dash: [3, 8],
  },
  {
    id: 'orbit-br',
    cx: 0.88,
    cy: 0.86,
    rx: 0.2,
    ry: 0.13,
    rotation: 1.2,
    speed: -0.014,
    stroke: 'rgba(190,150,255,0.16)',
    lineWidth: 0.7,
    opacity: 0.36,
    dash: [3, 8],
  },
] as const;

export const lcogAuroraWisps: readonly LcogAuroraWisp[] = [
  {
    id: 'wisp-tl',
    bx: 0.1,
    by: 0.12,
    length: 0.46,
    thickness: 0.048,
    angle: 0.32,
    color: 'rgba(80,220,255,0.42)',
    driftX: 160,
    driftY: 90,
    speed: 0.038,
    phase: 0.4,
    layerDepth: 0.76,
  },
  {
    id: 'wisp-tr',
    bx: 0.9,
    by: 0.14,
    length: 0.42,
    thickness: 0.044,
    angle: -0.38,
    color: 'rgba(160,120,255,0.38)',
    driftX: 150,
    driftY: 85,
    speed: 0.034,
    phase: 2.1,
    layerDepth: 0.78,
  },
  {
    id: 'wisp-br',
    bx: 0.88,
    by: 0.8,
    length: 0.4,
    thickness: 0.04,
    angle: -0.5,
    color: 'rgba(220,180,255,0.32)',
    driftX: 140,
    driftY: 78,
    speed: 0.032,
    phase: 4.8,
    layerDepth: 0.82,
  },
  {
    id: 'wisp-feather-l',
    bx: 0.16,
    by: 0.06,
    length: 0.3,
    thickness: 0.03,
    angle: 0.65,
    color: 'rgba(100,210,255,0.26)',
    driftX: 100,
    driftY: 55,
    speed: 0.028,
    phase: 1.3,
    layerDepth: 0.88,
  },
  {
    id: 'wisp-feather-r',
    bx: 0.84,
    by: 0.08,
    length: 0.28,
    thickness: 0.028,
    angle: -0.58,
    color: 'rgba(180,140,255,0.24)',
    driftX: 95,
    driftY: 52,
    speed: 0.026,
    phase: 3.5,
    layerDepth: 0.9,
  },
] as const;

export const lcogLightPaths: readonly LcogLightPath[] = [
  {
    id: 'path-orbit-a',
    x0: 0.08,
    y0: 0.22,
    x1: 0.42,
    y1: 0.08,
    color: 'rgba(80,200,255,0.28)',
    width: 1.4,
    speed: 0.05,
    phase: 0,
  },
  {
    id: 'path-orbit-b',
    x0: 0.92,
    y0: 0.28,
    x1: 0.58,
    y1: 0.1,
    color: 'rgba(150,110,255,0.26)',
    width: 1.2,
    speed: 0.046,
    phase: 2.4,
  },
  {
    id: 'path-orbit-c',
    x0: 0.1,
    y0: 0.78,
    x1: 0.38,
    y1: 0.92,
    color: 'rgba(100,180,255,0.24)',
    width: 1.1,
    speed: 0.044,
    phase: 4.1,
  },
  {
    id: 'path-orbit-d',
    x0: 0.9,
    y0: 0.72,
    x1: 0.62,
    y1: 0.9,
    color: 'rgba(200,160,255,0.22)',
    width: 1,
    speed: 0.042,
    phase: 5.6,
  },
] as const;

export const lcogStarDust: readonly LcogStarSeed[] = [
  { nx: 0.07, ny: 0.11, radius: 1, baseOpacity: 0.48, twinkleSpeed: 0.85, glowRadius: 5, layerDepth: 0.9, phase: 0.2 },
  { nx: 0.14, ny: 0.24, radius: 0.8, baseOpacity: 0.4, twinkleSpeed: 0.75, glowRadius: 4, layerDepth: 0.92, phase: 1.1 },
  { nx: 0.21, ny: 0.07, radius: 1.1, baseOpacity: 0.52, twinkleSpeed: 0.9, glowRadius: 5.5, layerDepth: 0.88, phase: 2.4 },
  { nx: 0.41, ny: 0.05, radius: 0.9, baseOpacity: 0.42, twinkleSpeed: 0.7, glowRadius: 4.2, layerDepth: 0.94, phase: 0.8 },
  { nx: 0.6, ny: 0.21, radius: 0.85, baseOpacity: 0.44, twinkleSpeed: 0.78, glowRadius: 4, layerDepth: 0.91, phase: 3.2 },
  { nx: 0.83, ny: 0.15, radius: 1, baseOpacity: 0.5, twinkleSpeed: 0.82, glowRadius: 4.8, layerDepth: 0.89, phase: 4.5 },
  { nx: 0.91, ny: 0.25, radius: 0.75, baseOpacity: 0.38, twinkleSpeed: 0.72, glowRadius: 3.5, layerDepth: 0.96, phase: 1.9 },
  { nx: 0.05, ny: 0.41, radius: 0.92, baseOpacity: 0.46, twinkleSpeed: 0.88, glowRadius: 4.5, layerDepth: 0.9, phase: 2.8 },
  { nx: 0.23, ny: 0.61, radius: 0.82, baseOpacity: 0.4, twinkleSpeed: 0.68, glowRadius: 3.8, layerDepth: 0.93, phase: 0.4 },
  { nx: 0.43, ny: 0.71, radius: 0.96, baseOpacity: 0.48, twinkleSpeed: 0.8, glowRadius: 5, layerDepth: 0.88, phase: 3.6 },
  { nx: 0.63, ny: 0.67, radius: 0.86, baseOpacity: 0.42, twinkleSpeed: 0.76, glowRadius: 4.2, layerDepth: 0.92, phase: 5.2 },
  { nx: 0.85, ny: 0.57, radius: 0.9, baseOpacity: 0.44, twinkleSpeed: 0.84, glowRadius: 4.4, layerDepth: 0.9, phase: 1.4 },
  { nx: 0.93, ny: 0.71, radius: 0.78, baseOpacity: 0.36, twinkleSpeed: 0.66, glowRadius: 3.6, layerDepth: 0.97, phase: 4.1 },
  { nx: 0.09, ny: 0.77, radius: 0.94, baseOpacity: 0.46, twinkleSpeed: 0.86, glowRadius: 4.6, layerDepth: 0.9, phase: 2.2 },
  { nx: 0.27, ny: 0.81, radius: 0.8, baseOpacity: 0.38, twinkleSpeed: 0.74, glowRadius: 3.7, layerDepth: 0.95, phase: 0.6 },
  { nx: 0.47, ny: 0.37, radius: 0.88, baseOpacity: 0.42, twinkleSpeed: 0.78, glowRadius: 4.2, layerDepth: 0.91, phase: 3.9 },
  { nx: 0.57, ny: 0.43, radius: 1.05, baseOpacity: 0.52, twinkleSpeed: 0.92, glowRadius: 5.4, layerDepth: 0.87, phase: 1.7 },
  { nx: 0.68, ny: 0.51, radius: 0.78, baseOpacity: 0.36, twinkleSpeed: 0.68, glowRadius: 3.4, layerDepth: 0.96, phase: 4.8 },
  { nx: 0.78, ny: 0.91, radius: 0.92, baseOpacity: 0.44, twinkleSpeed: 0.82, glowRadius: 4.5, layerDepth: 0.9, phase: 2.6 },
  { nx: 0.38, ny: 0.91, radius: 0.84, baseOpacity: 0.4, twinkleSpeed: 0.74, glowRadius: 3.9, layerDepth: 0.94, phase: 5.5 },
] as const;

/** Subtle module accent tints for nebula/orbit layers (light mode). */
export function resolveLcogModuleAccentRgba(mainModule: MainModuleKey, alpha = 0.14): string {
  const hex = moduleColor(
    mainModule === 'zentrale' || mainModule === 'admin' ? 'insight' : mainModule,
    'light',
  );
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export const LCOG_LAYER_IDS = [
  'base-gradient',
  'galaxy-clouds',
  'orbit-rings',
  'star-dust',
  'particles',
  'aurora-wisps',
  'light-paths',
  'comet-streaks',
  'vignette',
] as const;

export type LcogLayerId = (typeof LCOG_LAYER_IDS)[number];
