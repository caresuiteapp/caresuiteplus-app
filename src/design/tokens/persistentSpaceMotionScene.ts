/**
 * Deterministic scene config for GlobalPersistentSpaceMotionBackground (G.1).
 * Generated once at module load — never per render or per frame.
 */

import { BACKGROUND_LOOP_MS } from '@/lib/background/backgroundTime';

export const PSM_LOOP_MS = BACKGROUND_LOOP_MS;

export type PsmCircle = {
  id: string;
  /** Normalized 0..1 viewport position */
  bx: number;
  by: number;
  baseRadius: number;
  ampX: number;
  ampY: number;
  speedX: number;
  speedY: number;
  scaleSpeed: number;
  scaleAmp: number;
  opacitySpeed: number;
  opacityAmp: number;
  baseOpacity: number;
  baseScale: number;
  phase: number;
  color: string;
  depth: number;
};

export type PsmLine = {
  id: string;
  bx: number;
  by: number;
  length: number;
  thickness: number;
  angle: number;
  ampX: number;
  ampY: number;
  speedX: number;
  speedY: number;
  rotSpeed: number;
  rotAmp: number;
  lengthSpeed: number;
  lengthAmp: number;
  opacitySpeed: number;
  opacityAmp: number;
  baseOpacity: number;
  phase: number;
  color: string;
};

export type PsmNebula = {
  id: string;
  bx: number;
  by: number;
  radiusX: number;
  radiusY: number;
  speedX: number;
  speedY: number;
  ampX: number;
  ampY: number;
  phase: number;
  inner: string;
  mid: string;
  outer: string;
  baseOpacity: number;
};

export type PsmScene = {
  largeCircles: PsmCircle[];
  mediumCircles: PsmCircle[];
  smallParticles: PsmCircle[];
  lines: PsmLine[];
  nebulas: PsmNebula[];
};

export const PSM_LARGE_COUNT = 6;
export const PSM_MEDIUM_COUNT = 10;
export const PSM_SMALL_COUNT = 24;
export const PSM_LINE_COUNT = 12;
export const PSM_NEBULA_COUNT = 2;

const LIGHT_COLORS = [
  'rgba(200,206,214,0.42)',
  'rgba(188,194,202,0.38)',
  'rgba(176,182,190,0.36)',
  'rgba(210,216,224,0.40)',
  'rgba(194,200,208,0.35)',
  'rgba(168,174,182,0.32)',
];

const LINE_COLORS = [
  'rgba(180,186,194,0.22)',
  'rgba(196,202,210,0.18)',
  'rgba(170,176,184,0.20)',
];

function hashSeed(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i += 1) {
    h = (h * 31 + key.charCodeAt(i)) | 0;
  }
  return Math.abs(h) || 1;
}

function seededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function buildLargeCircles(): PsmCircle[] {
  const speeds = [1, 1, 2, 1, 2, 2];
  return Array.from({ length: PSM_LARGE_COUNT }, (_, i) => {
    const rand = seededRandom(hashSeed(`psm-large-${i}`));
    const phase = rand() * Math.PI * 2;
    const baseOpacity = 0.22 + rand() * 0.18;
    const opacityAmp = Math.min(0.12, 0.55 - baseOpacity);
    return {
      id: `large-${i}`,
      bx: 0.08 + rand() * 0.84,
      by: 0.06 + rand() * 0.88,
      baseRadius: 0.12 + rand() * 0.14,
      ampX: 28 + rand() * 48,
      ampY: 24 + rand() * 42,
      speedX: speeds[i],
      speedY: speeds[(i + 2) % speeds.length],
      scaleSpeed: 1 + (i % 2),
      scaleAmp: 0.04 + rand() * 0.06,
      opacitySpeed: 1,
      opacityAmp,
      baseOpacity,
      baseScale: 0.92 + rand() * 0.08,
      phase,
      color: LIGHT_COLORS[i % LIGHT_COLORS.length],
      depth: 0.3 + rand() * 0.2,
    };
  });
}

function buildMediumCircles(): PsmCircle[] {
  const speeds = [2, 3, 2, 4, 3, 2, 4, 3, 2, 3];
  return Array.from({ length: PSM_MEDIUM_COUNT }, (_, i) => {
    const rand = seededRandom(hashSeed(`psm-medium-${i}`));
    const phase = rand() * Math.PI * 2;
    const baseOpacity = 0.2 + rand() * 0.2;
    const opacityAmp = Math.min(0.14, 0.55 - baseOpacity);
    return {
      id: `medium-${i}`,
      bx: 0.05 + rand() * 0.9,
      by: 0.05 + rand() * 0.9,
      baseRadius: 0.04 + rand() * 0.06,
      ampX: 18 + rand() * 36,
      ampY: 16 + rand() * 32,
      speedX: speeds[i],
      speedY: speeds[(i + 3) % speeds.length],
      scaleSpeed: 2 + (i % 3),
      scaleAmp: 0.05 + rand() * 0.08,
      opacitySpeed: 2,
      opacityAmp,
      baseOpacity,
      baseScale: 0.88 + rand() * 0.12,
      phase,
      color: LIGHT_COLORS[(i + 2) % LIGHT_COLORS.length],
      depth: 0.5 + rand() * 0.25,
    };
  });
}

function buildSmallParticles(): PsmCircle[] {
  const speeds = [3, 4, 5, 6, 4, 5, 3, 6, 4, 5, 3, 4, 6, 5, 4, 3, 6, 5, 4, 3, 5, 6, 4, 3];
  return Array.from({ length: PSM_SMALL_COUNT }, (_, i) => {
    const rand = seededRandom(hashSeed(`psm-small-${i}`));
    const phase = rand() * Math.PI * 2;
    const baseOpacity = 0.18 + rand() * 0.22;
    const opacityAmp = Math.min(0.1, 0.5 - baseOpacity);
    return {
      id: `small-${i}`,
      bx: rand(),
      by: rand(),
      baseRadius: 0.008 + rand() * 0.018,
      ampX: 10 + rand() * 28,
      ampY: 8 + rand() * 24,
      speedX: speeds[i],
      speedY: speeds[(i + 5) % speeds.length],
      scaleSpeed: 3 + (i % 4),
      scaleAmp: 0.03 + rand() * 0.05,
      opacitySpeed: 3 + (i % 3),
      opacityAmp,
      baseOpacity,
      baseScale: 0.85 + rand() * 0.15,
      phase,
      color: LIGHT_COLORS[i % LIGHT_COLORS.length],
      depth: 0.7 + rand() * 0.25,
    };
  });
}

function buildLines(): PsmLine[] {
  return Array.from({ length: PSM_LINE_COUNT }, (_, i) => {
    const rand = seededRandom(hashSeed(`psm-line-${i}`));
    const phase = rand() * Math.PI * 2;
    const baseOpacity = 0.14 + rand() * 0.12;
    const opacityAmp = Math.min(0.08, 0.4 - baseOpacity);
    return {
      id: `line-${i}`,
      bx: rand(),
      by: rand(),
      length: 0.08 + rand() * 0.22,
      thickness: 0.8 + rand() * 1.2,
      angle: rand() * Math.PI * 2,
      ampX: 20 + rand() * 40,
      ampY: 18 + rand() * 36,
      speedX: 1 + (i % 3),
      speedY: 2 + (i % 4),
      rotSpeed: 1 + (i % 2),
      rotAmp: 0.12 + rand() * 0.2,
      lengthSpeed: 2,
      lengthAmp: 0.02 + rand() * 0.04,
      opacitySpeed: 2,
      opacityAmp,
      baseOpacity,
      phase,
      color: LINE_COLORS[i % LINE_COLORS.length],
    };
  });
}

function buildNebulas(): PsmNebula[] {
  return Array.from({ length: PSM_NEBULA_COUNT }, (_, i) => {
    const rand = seededRandom(hashSeed(`psm-nebula-${i}`));
    return {
      id: `nebula-${i}`,
      bx: 0.2 + rand() * 0.6,
      by: 0.15 + rand() * 0.7,
      radiusX: 0.35 + rand() * 0.25,
      radiusY: 0.28 + rand() * 0.22,
      speedX: 1,
      speedY: 1,
      ampX: 40 + rand() * 60,
      ampY: 32 + rand() * 48,
      phase: rand() * Math.PI * 2,
      inner: 'rgba(248,250,252,0.55)',
      mid: 'rgba(230,234,240,0.28)',
      outer: 'rgba(220,226,234,0.08)',
      baseOpacity: 0.35 + rand() * 0.15,
    };
  });
}

export const PSM_SCENE: PsmScene = {
  largeCircles: buildLargeCircles(),
  mediumCircles: buildMediumCircles(),
  smallParticles: buildSmallParticles(),
  lines: buildLines(),
  nebulas: buildNebulas(),
};

export function clampOpacity(value: number, min = 0.18, max = 0.55): number {
  return Math.max(min, Math.min(max, value));
}

/** Motion position for a circle at given phase (radians, 0..2π). */
export function psmCircleAt(
  circle: PsmCircle,
  w: number,
  h: number,
  phase: number,
): { x: number; y: number; scale: number; opacity: number } {
  const x =
    circle.bx * w +
    Math.sin(phase * circle.speedX + circle.phase) * circle.ampX +
    Math.cos(phase * circle.speedY * 0.7 + circle.phase * 1.1) * circle.ampX * 0.25;
  const y =
    circle.by * h +
    Math.cos(phase * circle.speedY + circle.phase) * circle.ampY +
    Math.sin(phase * circle.speedX * 0.65 + circle.phase * 0.9) * circle.ampY * 0.22;
  const scale =
    circle.baseScale + Math.sin(phase * circle.scaleSpeed + circle.phase) * circle.scaleAmp;
  const opacity = clampOpacity(
    circle.baseOpacity + Math.sin(phase * circle.opacitySpeed + circle.phase) * circle.opacityAmp,
  );
  return { x, y, scale, opacity };
}

/** Motion state for a line at given phase. */
export function psmLineAt(
  line: PsmLine,
  w: number,
  h: number,
  phase: number,
): { x: number; y: number; angle: number; length: number; opacity: number } {
  const x =
    line.bx * w +
    Math.sin(phase * line.speedX + line.phase) * line.ampX +
    Math.cos(phase * line.speedY + line.phase * 0.8) * line.ampX * 0.3;
  const y =
    line.by * h +
    Math.cos(phase * line.speedY + line.phase) * line.ampY +
    Math.sin(phase * line.speedX * 0.75 + line.phase) * line.ampY * 0.28;
  const angle = line.angle + Math.sin(phase * line.rotSpeed + line.phase) * line.rotAmp;
  const length =
    line.length * Math.min(w, h) *
    (1 + Math.sin(phase * line.lengthSpeed + line.phase) * line.lengthAmp);
  const opacity = clampOpacity(
    line.baseOpacity + Math.sin(phase * line.opacitySpeed + line.phase) * line.opacityAmp,
    0.12,
    0.4,
  );
  return { x, y, angle, length, opacity };
}

/** Nebula center at given phase. */
export function psmNebulaAt(
  nebula: PsmNebula,
  w: number,
  h: number,
  phase: number,
): { x: number; y: number } {
  const x =
    nebula.bx * w +
    Math.sin(phase * nebula.speedX + nebula.phase) * nebula.ampX +
    Math.cos(phase * nebula.speedY * 1.2 + nebula.phase) * nebula.ampX * 0.35;
  const y =
    nebula.by * h +
    Math.cos(phase * nebula.speedY + nebula.phase) * nebula.ampY +
    Math.sin(phase * nebula.speedX * 0.9 + nebula.phase * 1.1) * nebula.ampY * 0.32;
  return { x, y };
}

/** Verify loop seamlessness: positions at phase 0 and 2π should match. */
export function psmCircleAtElapsed(
  circle: PsmCircle,
  w: number,
  h: number,
  elapsedMs: number,
): ReturnType<typeof psmCircleAt> {
  const phase = ((elapsedMs % PSM_LOOP_MS) / PSM_LOOP_MS) * Math.PI * 2;
  return psmCircleAt(circle, w, h, phase);
}
