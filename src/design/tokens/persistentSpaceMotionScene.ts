/**
 * Light paper neumorphic scene for GlobalPersistentSpaceMotionBackground (G.1).
 * Geometry and motion amplitudes match assets/images/backgrounds/light-abstract-paper-background.svg.
 */

import { BACKGROUND_LOOP_MS } from '@/lib/background/backgroundTime';

export const PSM_LOOP_MS = BACKGROUND_LOOP_MS;
export const PSM_VIEWBOX_W = 5120;
export const PSM_VIEWBOX_H = 2880;

export type PsmMotion = {
  id: string;
  ampX: number;
  ampY: number;
  /** Layer phase offset (radians) — staggered like SVG SMIL begin offsets */
  phase: number;
};

export type PsmPaperDisc = PsmMotion & {
  bx: number;
  by: number;
  baseRadius: number;
  shadow: 'lg' | 'md' | 'button' | 'buttonStrong';
  kind: 'corner' | 'medium' | 'button' | 'accent';
  fill?: string;
  opacity?: number;
};

export type PsmPaperBand = PsmMotion & {
  d: string;
  opacity: number;
};

export type PsmPaperRing = PsmMotion & {
  bx: number;
  by: number;
  radius: number;
  strokeWidth: number;
};

export type PsmPaperCurve = PsmMotion & {
  d: string;
  strokeWidth: number;
  dots: { bx: number; by: number; r: number }[];
};

/** Legacy circle type — maps paper discs for motion tests */
export type PsmCircle = {
  id: string;
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
  cornerDiscs: PsmPaperDisc[];
  mediumDiscs: PsmPaperDisc[];
  buttonDots: PsmPaperDisc[];
  bands: PsmPaperBand[];
  rings: PsmPaperRing[];
  curves: PsmPaperCurve[];
  /** Legacy slices for tests */
  largeCircles: PsmCircle[];
  mediumCircles: PsmCircle[];
  smallParticles: PsmCircle[];
  lines: PsmLine[];
  nebulas: PsmNebula[];
};

export const PSM_LARGE_COUNT = 4;
export const PSM_MEDIUM_COUNT = 5;
export const PSM_SMALL_COUNT = 13;
export const PSM_BAND_COUNT = 5;
export const PSM_RING_COUNT = 4;
export const PSM_CURVE_COUNT = 3;
export const PSM_LINE_COUNT = PSM_BAND_COUNT + PSM_CURVE_COUNT;
export const PSM_NEBULA_COUNT = 0;

function normX(x: number): number {
  return x / PSM_VIEWBOX_W;
}

function normY(y: number): number {
  return y / PSM_VIEWBOX_H;
}

function normR(r: number): number {
  return r / PSM_VIEWBOX_W;
}

function phaseFromBegin(beginSec: number): number {
  return ((beginSec % 120) / 120) * Math.PI * 2;
}

function motion(id: string, ampX: number, ampY: number, beginSec: number): PsmMotion {
  return { id, ampX, ampY, phase: phaseFromBegin(beginSec) };
}

const CORNER_DISCS: PsmPaperDisc[] = [
  {
    ...motion('corner-0', 199.66, -160.69, -16.24),
    bx: normX(-420),
    by: normY(-380),
    baseRadius: normR(1180),
    shadow: 'lg',
    kind: 'corner',
    fill: '#FFFFFF',
    opacity: 0.98,
  },
  {
    ...motion('corner-1', 81.38, -242.97, -11.8),
    bx: normX(-520),
    by: normY(3300),
    baseRadius: normR(1320),
    shadow: 'lg',
    kind: 'corner',
    fill: '#FFFFFF',
    opacity: 0.98,
  },
  {
    ...motion('corner-2', -62.56, -248.42, -7.36),
    bx: normX(5600),
    by: normY(3400),
    baseRadius: normR(1420),
    shadow: 'lg',
    kind: 'corner',
    fill: '#FFFFFF',
    opacity: 0.98,
  },
  {
    ...motion('corner-3', -186.67, -175.36, -2.92),
    bx: normX(5400),
    by: normY(-220),
    baseRadius: normR(760),
    shadow: 'md',
    kind: 'corner',
    fill: '#FFFFFF',
    opacity: 0.98,
  },
];

const MEDIUM_DISCS: PsmPaperDisc[] = [
  {
    ...motion('medium-0', -85.18, -38.64, -119.17),
    bx: normX(4300),
    by: normY(620),
    baseRadius: normR(280),
    shadow: 'md',
    kind: 'medium',
    fill: '#FFFFFF',
    opacity: 0.98,
  },
  {
    ...motion('medium-1', -92.52, 13.42, -114.73),
    bx: normX(760),
    by: normY(520),
    baseRadius: normR(220),
    shadow: 'md',
    kind: 'medium',
    fill: '#FFFFFF',
    opacity: 0.98,
  },
  {
    ...motion('medium-2', -70.62, 61.19, -110.29),
    bx: normX(4480),
    by: normY(2280),
    baseRadius: normR(340),
    shadow: 'md',
    kind: 'medium',
    fill: '#FFFFFF',
    opacity: 0.98,
  },
  {
    ...motion('medium-3', -26.43, 89.58, -105.85),
    bx: normX(620),
    by: normY(2360),
    baseRadius: normR(260),
    shadow: 'md',
    kind: 'medium',
    fill: '#FFFFFF',
    opacity: 0.98,
  },
  {
    ...motion('medium-4', 26.07, 89.64, -101.41),
    bx: normX(3820),
    by: normY(2480),
    baseRadius: normR(200),
    shadow: 'md',
    kind: 'medium',
    fill: '#FFFFFF',
    opacity: 0.98,
  },
];

const BANDS: PsmPaperBand[] = [
  {
    ...motion('band-0', 87.05, -44.14, -50.23),
    d: 'M -588.1 2809.3 C 902.8 1929.4 2557.2 1163.2 5241.1 307.6 L 5148.1 90.7 C 2550.2 1130.6 895.8 1896.8 -681.1 2592.4 Z',
    opacity: 0.98,
  },
  {
    ...motion('band-1', 87.52, -43.46, -45.79),
    d: 'M -565.3 2975.5 C 1101.9 2123.3 2858.1 1361.4 5676.0 503.0 L 5605.3 324.5 C 2852.8 1336.7 1096.6 2098.6 -636.0 2797.0 Z',
    opacity: 0.95,
  },
  {
    ...motion('band-2', 86.71, -45.35, -41.35),
    d: 'M -253.0 3195.6 C 1401.9 2320.6 3258.1 1558.5 5667.7 841.9 L 5613.0 704.4 C 3254.0 1539.4 1397.8 2301.5 -307.7 3058.1 Z',
    opacity: 0.92,
  },
  {
    ...motion('band-3', 92.96, -30.21, -36.91),
    d: 'M 29.6 3036.5 C 1643.0 2181.6 3597.0 1414.6 5656.7 589.9 L 5610.4 483.5 C 3593.6 1398.4 1639.5 2165.4 -16.7 2930.1 Z',
    opacity: 0.9,
  },
  {
    ...motion('band-4', 92.84, -29.91, -32.47),
    d: 'M 357.5 3110.6 C 1882.2 2397.3 3937.8 1633.8 5654.3 947.1 L 5622.5 869.4 C 3935.4 1622.7 1879.9 2386.2 325.7 3032.9 Z',
    opacity: 0.88,
  },
];

const RINGS: PsmPaperRing[] = [
  {
    ...motion('ring-0', -37.59, 17.93, -60.56),
    bx: normX(1120),
    by: normY(1680),
    radius: normR(110),
    strokeWidth: 3.5,
  },
  {
    ...motion('ring-1', -21.96, 35.36, -56.11),
    bx: normX(3960),
    by: normY(1520),
    radius: normR(92),
    strokeWidth: 3.5,
  },
  {
    ...motion('ring-2', 0.59, 41.6, -51.67),
    bx: normX(680),
    by: normY(980),
    radius: normR(74),
    strokeWidth: 3.5,
  },
  {
    ...motion('ring-3', 22.93, 34.7, -47.23),
    bx: normX(4440),
    by: normY(620),
    radius: normR(66),
    strokeWidth: 3.5,
  },
];

const CURVES: PsmPaperCurve[] = [
  {
    ...motion('curve-0', 102.12, 23.07, -50.97),
    d: 'M 2809.4 96.0 C 3620.0 420.0 4040.0 260.0 5050.6 604.0',
    strokeWidth: 2.5,
    dots: [
      { bx: normX(3180), by: normY(180), r: normR(10) },
      { bx: normX(4040), by: normY(260), r: normR(10) },
      { bx: normX(4680), by: normY(520), r: normR(10) },
    ],
  },
  {
    ...motion('curve-1', 98.61, -35.15, -46.53),
    d: 'M 59.5 2600.2 C 920.0 2140.0 1280.0 2360.0 2040.5 1939.8',
    strokeWidth: 2.5,
    dots: [
      { bx: normX(420), by: normY(2480), r: normR(10) },
      { bx: normX(1280), by: normY(2360), r: normR(10) },
      { bx: normX(1680), by: normY(2060), r: normR(10) },
    ],
  },
  {
    ...motion('curve-2', 103.15, -18.05, -42.08),
    d: 'M 3143.3 2530.2 C 3920.0 2280.0 4280.0 2520.0 5096.7 2269.8',
    strokeWidth: 2.5,
    dots: [
      { bx: normX(3520), by: normY(2480), r: normR(10) },
      { bx: normX(4280), by: normY(2520), r: normR(10) },
    ],
  },
];

const BUTTON_DOT_SPECS: Array<{
  id: string;
  begin: number;
  ampX: number;
  ampY: number;
  bx: number;
  by: number;
  r: number;
}> = [
  { id: 'dot-0', begin: -93, ampX: -20.31, ampY: 55.8, bx: 980, by: 420, r: 36.7 },
  { id: 'dot-1', begin: -88.56, ampX: 13, ampY: 57.91, bx: 1240, by: 760, r: 23.8 },
  { id: 'dot-2', begin: -84.12, ampX: 42.18, ampY: 41.73, bx: 4040, by: 540, r: 30.2 },
  { id: 'dot-3', begin: -79.68, ampX: 58, ampY: 12.37, bx: 4380, by: 980, r: 19.4 },
  { id: 'dot-4', begin: -75.23, ampX: 55.49, ampY: -20.87, bx: 520, by: 1880, r: 28.1 },
  { id: 'dot-5', begin: -70.79, ampX: 35.44, ampY: -47.5, bx: 860, by: 2520, r: 21.6 },
  { id: 'dot-6', begin: -66.35, ampX: 4.21, ampY: -59.09, bx: 4680, by: 1760, r: 25.9 },
  { id: 'dot-7', begin: -61.91, ampX: -28.32, ampY: -52, bx: 4120, by: 2620, r: 32.4 },
  { id: 'dot-8', begin: -57.47, ampX: -51.89, ampY: -28.49, bx: 1560, by: 320, r: 17.3 },
  { id: 'dot-9', begin: -53.02, ampX: -59.04, ampY: 4.01, bx: 2860, by: 2480, r: 19.4 },
  { id: 'dot-10', begin: -7.85, ampX: 43.73, ampY: -14.37, bx: 3180, by: 380, r: 21.6 },
  { id: 'dot-11', begin: -3.4, ampX: 29.05, ampY: -35.68, bx: 980, by: 1280, r: 15.1 },
  { id: 'dot-12', begin: -118.96, ampX: 5.21, ampY: -45.7, bx: 4580, by: 1380, r: 17.3 },
];

const BUTTON_DOTS: PsmPaperDisc[] = BUTTON_DOT_SPECS.map((spec) => ({
  ...motion(spec.id, spec.ampX, spec.ampY, spec.begin),
  bx: normX(spec.bx),
  by: normY(spec.by),
  baseRadius: normR(spec.r),
  shadow: 'buttonStrong',
  kind: 'button',
  fill: '#F6F6F6',
  opacity: 1,
}));

function paperDiscToLegacyCircle(disc: PsmPaperDisc, depth: number): PsmCircle {
  return {
    id: disc.id,
    bx: disc.bx,
    by: disc.by,
    baseRadius: disc.baseRadius,
    ampX: disc.ampX,
    ampY: disc.ampY,
    speedX: 1,
    speedY: 1,
    scaleSpeed: 1,
    scaleAmp: 0,
    opacitySpeed: 1,
    opacityAmp: 0,
    baseOpacity: disc.opacity ?? 0.95,
    baseScale: 1,
    phase: disc.phase,
    color: '#FFFFFF',
    depth,
  };
}

function buildLegacyLines(): PsmLine[] {
  const bandLines: PsmLine[] = BANDS.map((band, i) => ({
    id: `band-line-${i}`,
    bx: 0.5,
    by: 0.5,
    length: 0.2,
    thickness: 2,
    angle: 0,
    ampX: band.ampX,
    ampY: band.ampY,
    speedX: 1,
    speedY: 1,
    rotSpeed: 1,
    rotAmp: 0,
    lengthSpeed: 1,
    lengthAmp: 0,
    opacitySpeed: 1,
    opacityAmp: 0,
    baseOpacity: band.opacity,
    phase: band.phase,
    color: '#FFFFFF',
  }));
  const curveLines: PsmLine[] = CURVES.map((curve, i) => ({
    id: `curve-line-${i}`,
    bx: 0.5,
    by: 0.5,
    length: 0.15,
    thickness: curve.strokeWidth,
    angle: 0,
    ampX: curve.ampX,
    ampY: curve.ampY,
    speedX: 1,
    speedY: 1,
    rotSpeed: 1,
    rotAmp: 0,
    lengthSpeed: 1,
    lengthAmp: 0,
    opacitySpeed: 1,
    opacityAmp: 0,
    baseOpacity: 0.85,
    phase: curve.phase,
    color: '#FFFFFF',
  }));
  return [...bandLines, ...curveLines];
}

export const PSM_SCENE: PsmScene = {
  cornerDiscs: CORNER_DISCS,
  mediumDiscs: MEDIUM_DISCS,
  buttonDots: BUTTON_DOTS,
  bands: BANDS,
  rings: RINGS,
  curves: CURVES,
  largeCircles: CORNER_DISCS.map((d, i) => paperDiscToLegacyCircle(d, 0.25 + i * 0.05)),
  mediumCircles: MEDIUM_DISCS.map((d, i) => paperDiscToLegacyCircle(d, 0.5 + i * 0.04)),
  smallParticles: BUTTON_DOTS.map((d, i) => paperDiscToLegacyCircle(d, 0.75 + i * 0.015)),
  lines: buildLegacyLines(),
  nebulas: [],
};

export function clampOpacity(value: number, min = 0.18, max = 0.55): number {
  return Math.max(min, Math.min(max, value));
}

/** Seamless motion offset for one 240s loop (matches SVG peak at loop midpoint). */
export function psmMotionOffset(motion: PsmMotion, phase: number): { dx: number; dy: number } {
  const p = phase + motion.phase;
  return {
    dx: motion.ampX * Math.sin(p),
    dy: motion.ampY * Math.sin(p),
  };
}

export function psmCircleAt(
  circle: PsmCircle,
  w: number,
  h: number,
  phase: number,
): { x: number; y: number; scale: number; opacity: number } {
  const offset = psmMotionOffset(circle, phase);
  const x = circle.bx * w + offset.dx;
  const y = circle.by * h + offset.dy;
  return {
    x,
    y,
    scale: circle.baseScale,
    opacity: clampOpacity(circle.baseOpacity, 0.85, 1),
  };
}

export function psmLineAt(
  line: PsmLine,
  w: number,
  h: number,
  phase: number,
): { x: number; y: number; angle: number; length: number; opacity: number } {
  const offset = psmMotionOffset(line, phase);
  return {
    x: line.bx * w + offset.dx,
    y: line.by * h + offset.dy,
    angle: line.angle,
    length: line.length * Math.min(w, h),
    opacity: clampOpacity(line.baseOpacity, 0.75, 1),
  };
}

export function psmNebulaAt(
  nebula: PsmNebula,
  w: number,
  h: number,
  phase: number,
): { x: number; y: number } {
  const offset = psmMotionOffset(nebula, phase);
  return {
    x: nebula.bx * w + offset.dx,
    y: nebula.by * h + offset.dy,
  };
}

export function psmCircleAtElapsed(
  circle: PsmCircle,
  w: number,
  h: number,
  elapsedMs: number,
): ReturnType<typeof psmCircleAt> {
  const phase = ((elapsedMs % PSM_LOOP_MS) / PSM_LOOP_MS) * Math.PI * 2;
  return psmCircleAt(circle, w, h, phase);
}
