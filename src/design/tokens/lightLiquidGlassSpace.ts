/**
 * CareSuite+ — Light Liquid Glass Space Aurora (Hintergrund + Glasflächen).
 */

import { llganGlassSurface } from '@/design/tokens/lightLiquidGlassAuroraNebula';

export const llgsBaseColors = {
  iceWhite: '#F7FAFF',
  softPearl: '#EEF6FF',
  mistBlue: '#EAF4FF',
  powderBlue: '#DFF1FF',
  pearlLilac: '#F3EEFF',
  paleLavender: '#E8F0FF',
} as const;

export const llgsAuroraColors = {
  softCyan: '#8FEAFF',
  powderBlue: '#B7D8FF',
  softLavender: '#CAB8FF',
  pearlViolet: '#E8DFFF',
  roseLavender: '#F3DDFB',
} as const;

export const llgsTypography = {
  primary: '#0F1B33',
  secondary: '#52617A',
} as const;

/** Milchglas — synchron mit Aurora-Nebula-Glas-Tokens (llganGlassSurface). */
export const llgsGlassSurface = {
  panel: llganGlassSurface.panel,
  card: llganGlassSurface.card,
  sidebar: llganGlassSurface.sidebar,
  chip: llganGlassSurface.chip,
  modal: llganGlassSurface.modal,
  borderWhite: llganGlassSurface.borderWhite,
  borderAccent: llganGlassSurface.borderAccent,
  blurDesktop: llganGlassSurface.blurDesktop,
  blurMobile: llganGlassSurface.blurMobile,
  saturate: llganGlassSurface.saturate,
  shadow: llganGlassSurface.shadow,
  shadowInset: llganGlassSurface.shadowInset,
} as const;

export const llgsBaseGradient = [
  llgsBaseColors.iceWhite,
  llgsBaseColors.softPearl,
  llgsBaseColors.mistBlue,
  llgsBaseColors.pearlLilac,
  llgsBaseColors.paleLavender,
  llgsBaseColors.iceWhite,
] as const;

/** Canvas-Nebula-Wolken — langsame Drift, große Amplitude (sichtbar in ~8 s). */
export type LlgsCanvasCloud = {
  id: string;
  /** Basis-Position 0–1 */
  bx: number;
  by: number;
  /** Radius relativ zu min(w,h) */
  radius: number;
  inner: string;
  mid: string;
  phase: number;
  /** Bogen/s — 2π/90 ≈ 0.07 → ~90 s Loop */
  speed: number;
  driftX: number;
  driftY: number;
  breathe: number;
};

export const llgsCanvasClouds: readonly LlgsCanvasCloud[] = [
  {
    id: 'tl-cyan',
    bx: 0.08,
    by: 0.1,
    radius: 0.48,
    inner: 'rgba(143,234,255,0.92)',
    mid: 'rgba(183,216,255,0.48)',
    phase: 0,
    speed: 0.068,
    driftX: 260,
    driftY: 190,
    breathe: 0.08,
  },
  {
    id: 'tr-lavender',
    bx: 0.92,
    by: 0.12,
    radius: 0.44,
    inner: 'rgba(202,184,255,0.88)',
    mid: 'rgba(243,221,251,0.42)',
    phase: 1.8,
    speed: 0.058,
    driftX: 240,
    driftY: 170,
    breathe: 0.07,
  },
  {
    id: 'bl-ice',
    bx: 0.1,
    by: 0.88,
    radius: 0.42,
    inner: 'rgba(183,216,255,0.82)',
    mid: 'rgba(223,241,255,0.40)',
    phase: 3.1,
    speed: 0.052,
    driftX: 220,
    driftY: 170,
    breathe: 0.06,
  },
  {
    id: 'br-rose',
    bx: 0.9,
    by: 0.85,
    radius: 0.4,
    inner: 'rgba(243,221,251,0.80)',
    mid: 'rgba(232,223,255,0.38)',
    phase: 4.5,
    speed: 0.048,
    driftX: 230,
    driftY: 160,
    breathe: 0.07,
  },
  {
    id: 'mid-wisp',
    bx: 0.52,
    by: 0.38,
    radius: 0.36,
    inner: 'rgba(168,230,255,0.42)',
    mid: 'rgba(232,223,255,0.20)',
    phase: 2.2,
    speed: 0.05,
    driftX: 140,
    driftY: 100,
    breathe: 0.05,
  },
  {
    id: 'mid-lilac',
    bx: 0.48,
    by: 0.62,
    radius: 0.34,
    inner: 'rgba(202,184,255,0.38)',
    mid: 'rgba(243,221,251,0.18)',
    phase: 5.8,
    speed: 0.033,
    driftX: 120,
    driftY: 90,
    breathe: 0.05,
  },
] as const;

export const llgsStarField = [
  [0.07, 0.11, 0.55], [0.14, 0.24, 0.42], [0.21, 0.07, 0.6], [0.3, 0.16, 0.48],
  [0.41, 0.05, 0.52], [0.51, 0.13, 0.44], [0.6, 0.21, 0.5], [0.71, 0.09, 0.46],
  [0.83, 0.15, 0.4], [0.91, 0.25, 0.54], [0.87, 0.37, 0.45], [0.75, 0.31, 0.38],
  [0.05, 0.41, 0.5], [0.13, 0.51, 0.41], [0.23, 0.61, 0.53], [0.33, 0.47, 0.39],
  [0.43, 0.71, 0.48], [0.53, 0.81, 0.43], [0.63, 0.67, 0.55], [0.73, 0.77, 0.37],
  [0.85, 0.57, 0.51], [0.93, 0.71, 0.42], [0.89, 0.87, 0.47], [0.77, 0.91, 0.4],
  [0.09, 0.77, 0.52], [0.17, 0.87, 0.44], [0.27, 0.81, 0.38], [0.37, 0.91, 0.5],
  [0.47, 0.37, 0.45], [0.57, 0.43, 0.56], [0.67, 0.51, 0.36], [0.11, 0.33, 0.48],
  [0.22, 0.19, 0.58], [0.68, 0.28, 0.52], [0.38, 0.58, 0.48], [0.58, 0.68, 0.44],
  [0.78, 0.48, 0.5], [0.18, 0.68, 0.46], [0.88, 0.58, 0.42], [0.48, 0.22, 0.54],
] as const;
