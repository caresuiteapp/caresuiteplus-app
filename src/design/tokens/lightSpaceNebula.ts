/**
 * CareSuite+ — Helle Space-/Nebula-/Aurora-Tokens für Liquid-Glass-Hintergründe.
 * Ruhig, edel, enterprise-tauglich; Akzente primär an den Rändern.
 */
export const lightSpaceNebulaColors = {
  iceWhite: '#F7FAFF',
  softWhite: '#EEF4FF',
  frostBlue: '#EAF6FF',
  powderBlue: '#DFF1FF',
  mistCyan: '#DCEBFF',
  pearl: '#F3EEFF',
  paleLavender: '#E8F0FF',
  coolMist: '#DDE6F6',
  accentBlue: '#7C9DFF',
  accentCyan: '#63D3FF',
  accentLavender: '#B69CFF',
  accentAqua: '#A8E6FF',
} as const;

export type LightSpaceNebulaOrb = {
  color: string;
  top?: string;
  left?: string;
  right?: string;
  bottom?: string;
  size: number;
  opacity: number;
  /** Stagger start (ms). */
  delay: number;
  /** Drift direction multiplier. */
  phase: 1 | -1;
};

/** Langsame Drift-Loops: 36–72 s — siehe lightSpaceNebulaMotion. */
export const lightSpaceNebulaFx = {
  base: [
    lightSpaceNebulaColors.iceWhite,
    lightSpaceNebulaColors.softWhite,
    lightSpaceNebulaColors.paleLavender,
    lightSpaceNebulaColors.iceWhite,
  ] as const,
  mesh: [
    'rgba(124,157,255,0.09)',
    'transparent',
    'rgba(99,211,255,0.07)',
    'transparent',
    'rgba(182,156,255,0.07)',
  ] as const,
  /** Nebula-Wolken — bevorzugt in Ecken/Rändern, nicht in der Mitte. */
  orbs: [
    {
      color: lightSpaceNebulaColors.accentBlue,
      top: '-18%',
      left: '-14%',
      size: 520,
      opacity: 0.24,
      delay: 0,
      phase: 1,
    },
    {
      color: lightSpaceNebulaColors.accentCyan,
      bottom: '-12%',
      left: '-8%',
      size: 460,
      opacity: 0.21,
      delay: 6000,
      phase: -1,
    },
    {
      color: lightSpaceNebulaColors.accentLavender,
      top: '-10%',
      right: '-12%',
      size: 440,
      opacity: 0.2,
      delay: 12000,
      phase: 1,
    },
    {
      color: lightSpaceNebulaColors.accentAqua,
      bottom: '6%',
      right: '-10%',
      size: 400,
      opacity: 0.18,
      delay: 18000,
      phase: -1,
    },
    {
      color: lightSpaceNebulaColors.powderBlue,
      top: '42%',
      left: '-16%',
      size: 360,
      opacity: 0.16,
      delay: 9000,
      phase: 1,
    },
    {
      color: lightSpaceNebulaColors.pearl,
      top: '48%',
      right: '-14%',
      size: 340,
      opacity: 0.14,
      delay: 15000,
      phase: -1,
    },
  ] satisfies readonly LightSpaceNebulaOrb[],
  /** Zentrale Arbeitsfläche — ruhiger, heller, lesbar (Nebula darf leicht durchscheinen). */
  centerCalm: 'rgba(247,250,255,0.52)',
  centerCalmEdge: 'rgba(247,250,255,0.0)',
  edgeGlow: 'rgba(168,230,255,0.14)',
  starColor: 'rgba(124,157,255,0.72)',
  starColorSoft: 'rgba(99,211,255,0.48)',
} as const;

export const lightSpaceNebulaMotion = {
  /** Haupt-Nebula-Drift (ms). */
  driftMin: 36000,
  driftMax: 72000,
  breatheMin: 28000,
  breatheMax: 54000,
  starTwinkleMin: 4000,
  starTwinkleMax: 9000,
  parallaxShift: 14,
} as const;

/** Deterministische Stern-Seed-Positionen (0–1 normalisiert). */
export const lightSpaceNebulaStarField = [
  [0.08, 0.12, 0.45], [0.15, 0.28, 0.35], [0.22, 0.08, 0.55], [0.31, 0.18, 0.4],
  [0.42, 0.06, 0.5], [0.52, 0.14, 0.38], [0.61, 0.22, 0.48], [0.72, 0.1, 0.42],
  [0.84, 0.16, 0.36], [0.92, 0.26, 0.52], [0.88, 0.38, 0.44], [0.76, 0.32, 0.33],
  [0.06, 0.42, 0.47], [0.14, 0.52, 0.39], [0.24, 0.62, 0.51], [0.34, 0.48, 0.37],
  [0.44, 0.72, 0.46], [0.54, 0.82, 0.41], [0.64, 0.68, 0.53], [0.74, 0.78, 0.35],
  [0.86, 0.58, 0.49], [0.94, 0.72, 0.4], [0.9, 0.88, 0.45], [0.78, 0.92, 0.38],
  [0.1, 0.78, 0.5], [0.18, 0.88, 0.42], [0.28, 0.82, 0.36], [0.38, 0.92, 0.48],
  [0.48, 0.38, 0.43], [0.58, 0.44, 0.55], [0.68, 0.52, 0.34], [0.12, 0.34, 0.46],
  [0.32, 0.28, 0.4], [0.52, 0.58, 0.52], [0.62, 0.38, 0.37], [0.82, 0.44, 0.48],
  [0.04, 0.58, 0.41], [0.96, 0.48, 0.44], [0.5, 0.08, 0.39], [0.5, 0.94, 0.51],
  [0.2, 0.46, 0.47], [0.8, 0.64, 0.36], [0.36, 0.74, 0.5], [0.66, 0.86, 0.42],
  [0.46, 0.24, 0.38], [0.56, 0.66, 0.54], [0.26, 0.92, 0.4], [0.7, 0.24, 0.46],
] as const;
