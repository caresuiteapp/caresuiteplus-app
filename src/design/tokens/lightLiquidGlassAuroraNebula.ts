/**
 * CareSuite+ — Light Liquid Glass Aurora Nebula (Canvas-Layer + Glas-Tokens).
 */

import { popupShellHeaderGradientLight } from './popupShellTokens';

export const llganBaseColors = {
  iceWhite: '#F7FAFF',
  softPearl: '#EEF6FF',
  mistBlue: '#EAF4FF',
  powderBlue: '#DFF1FF',
  pearlLilac: '#F3EEFF',
} as const;

export const llganNebulaCloudColors = {
  softCyan: '#8FEAFF',
  powderBlue: '#B7D8FF',
  softLavender: '#CAB8FF',
  pearlViolet: '#E8DFFF',
  roseLavender: '#F3DDFB',
} as const;

export const llganAuroraWispColors = {
  cyan: 'rgba(143, 234, 255, 0.38)',
  lavender: 'rgba(202, 184, 255, 0.34)',
  rose: 'rgba(243, 221, 251, 0.28)',
} as const;

export const llganStarDustColors = {
  core: 'rgba(255,255,255,0.75)',
  halo: 'rgba(185,215,255,0.55)',
} as const;

export const llganPearlescentColors = {
  white: 'rgba(255,255,255,0.20)',
  cyanPearl: 'rgba(210,235,255,0.18)',
  lavenderPearl: 'rgba(230,220,255,0.16)',
} as const;

/** Light-mode modal header — purple → pink → violet (shared popup shell). */
export const llganModalHeaderGradient = popupShellHeaderGradientLight;

export function resolveLlganModalHeaderGradient(): readonly [string, ...string[]] {
  return llganModalHeaderGradient;
}

/** Intensity presets — dashboard: default|strong; forms/tables: subtle|default. */
export type LightSpaceIntensity = 'subtle' | 'default' | 'strong';

export type LlganViewContext =
  | 'dashboard'
  | 'settings'
  | 'form'
  | 'table'
  | 'sidebar'
  | 'login';

export type LlganViewGlassValues = {
  dashboardPanelAlpha: number;
  dashboardCardAlpha: number;
  settingsCardAlpha: number;
  settingsButtonAlpha: number;
  sidebarAlpha: number;
  modalAlpha: number;
  tableAlpha: number;
  centerVeilAlpha: number;
  nebulaOpacity: number;
  wispOpacity: number;
  starOpacity: number;
  glassBlur: number;
  glassSaturate: number;
};

export const llganViewGlassByIntensity: Record<LightSpaceIntensity, LlganViewGlassValues> = {
  subtle: {
    dashboardPanelAlpha: 0.38,
    dashboardCardAlpha: 0.46,
    settingsCardAlpha: 0.56,
    settingsButtonAlpha: 0.58,
    sidebarAlpha: 0.52,
    modalAlpha: 0.72,
    tableAlpha: 0.72,
    centerVeilAlpha: 0.1,
    nebulaOpacity: 0.9,
    wispOpacity: 0.72,
    starOpacity: 0.36,
    glassBlur: 26,
    glassSaturate: 1.35,
  },
  default: {
    dashboardPanelAlpha: 0.44,
    dashboardCardAlpha: 0.52,
    settingsCardAlpha: 0.62,
    settingsButtonAlpha: 0.64,
    sidebarAlpha: 0.6,
    modalAlpha: 0.78,
    tableAlpha: 0.8,
    centerVeilAlpha: 0.05,
    nebulaOpacity: 1,
    wispOpacity: 0.88,
    starOpacity: 0.58,
    glassBlur: 28,
    glassSaturate: 1.38,
  },
  strong: {
    dashboardPanelAlpha: 0.5,
    dashboardCardAlpha: 0.58,
    settingsCardAlpha: 0.7,
    settingsButtonAlpha: 0.72,
    sidebarAlpha: 0.68,
    modalAlpha: 0.86,
    tableAlpha: 0.88,
    centerVeilAlpha: 0.03,
    nebulaOpacity: 1.06,
    wispOpacity: 0.96,
    starOpacity: 0.46,
    glassBlur: 32,
    glassSaturate: 1.45,
  },
} as const;

export const llganCssVars = {
  panelAlpha: '--llgan-panel-alpha',
  cardAlpha: '--llgan-card-alpha',
  sidebarAlpha: '--llgan-sidebar-alpha',
  modalAlpha: '--llgan-modal-alpha',
  centerVeilAlpha: '--llgan-center-veil-alpha',
  nebulaOpacity: '--llgan-nebula-opacity',
  wispOpacity: '--llgan-wisp-opacity',
  starOpacity: '--llgan-star-opacity',
  glassBlur: '--llgan-glass-blur',
  glassSaturate: '--llgan-glass-saturate',
} as const;

export type LlganIntensityValues = {
  panelAlpha: number;
  cardAlpha: number;
  sidebarAlpha: number;
  modalAlpha: number;
  centerVeilAlpha: number;
  nebulaOpacity: number;
  wispOpacity: number;
  starOpacity: number;
  glassBlur: number;
  glassSaturate: number;
};

export const llganIntensityPresets: Record<LightSpaceIntensity, LlganIntensityValues> = {
  subtle: {
    panelAlpha: 0.38,
    cardAlpha: 0.46,
    sidebarAlpha: 0.5,
    modalAlpha: 0.72,
    centerVeilAlpha: 0.1,
    nebulaOpacity: 0.88,
    wispOpacity: 0.7,
    starOpacity: 0.35,
    glassBlur: 26,
    glassSaturate: 1.35,
  },
  default: {
    panelAlpha: 0.44,
    cardAlpha: 0.52,
    sidebarAlpha: 0.57,
    modalAlpha: 0.76,
    centerVeilAlpha: 0.06,
    nebulaOpacity: 0.98,
    wispOpacity: 0.82,
    starOpacity: 0.4,
    glassBlur: 30,
    glassSaturate: 1.42,
  },
  strong: {
    panelAlpha: 0.5,
    cardAlpha: 0.58,
    sidebarAlpha: 0.64,
    modalAlpha: 0.8,
    centerVeilAlpha: 0.04,
    nebulaOpacity: 1.08,
    wispOpacity: 0.92,
    starOpacity: 0.44,
    glassBlur: 34,
    glassSaturate: 1.5,
  },
} as const;

export function resolveLlganViewGlass(
  view: LlganViewContext,
  intensity: LightSpaceIntensity = 'default',
) {
  const v = llganViewGlassByIntensity[intensity];
  const cardAlpha =
    view === 'dashboard'
      ? v.dashboardCardAlpha
      : view === 'login'
        ? Math.min(0.90, v.settingsCardAlpha + 0.22)
        : view === 'settings'
          ? v.settingsCardAlpha
          : view === 'table'
            ? v.tableAlpha
            : view === 'form'
              ? v.modalAlpha
              : v.settingsCardAlpha;
  const panelAlpha = view === 'dashboard' ? v.dashboardPanelAlpha : v.dashboardPanelAlpha + 0.04;
  const buttonAlpha = v.settingsButtonAlpha;
  const blur =
    view === 'settings' || view === 'form' || view === 'table'
      ? Math.max(v.glassBlur, 24)
      : v.glassBlur;

  return {
    panel: rgbaWhite(panelAlpha),
    card: rgbaWhite(cardAlpha),
    button: rgbaWhite(buttonAlpha),
    sidebar: rgbaWhite(v.sidebarAlpha),
    chip: rgbaWhite(Math.max(0.34, panelAlpha - 0.08)),
    modal: rgbaWhite(v.modalAlpha),
    input: rgbaWhite(Math.max(0.36, panelAlpha - 0.06)),
    table: rgbaWhite(v.tableAlpha),
    borderWhite: 'rgba(255,255,255,0.60)',
    borderAccent: 'rgba(110,160,255,0.18)',
    borderButton: 'rgba(120,160,255,0.20)',
    blurDesktop: blur,
    blurMobile: Math.max(20, blur - 8),
    blurButton: 20,
    saturate: v.glassSaturate,
    saturateButton: 1.25,
    shadow: '0 16px 48px rgba(70,110,170,0.16)',
    shadowInset: 'inset 0 1px 0 rgba(255,255,255,0.70)',
    centerVeilAlpha: v.centerVeilAlpha,
    nebulaOpacity: v.nebulaOpacity,
    wispOpacity: v.wispOpacity,
    starOpacity: v.starOpacity,
  };
}

export function resolveLlganCanvasIntensity(
  context: LlganViewContext = 'dashboard',
): Pick<LlganViewGlassValues, 'centerVeilAlpha' | 'nebulaOpacity' | 'wispOpacity' | 'starOpacity'> {
  const intensity: LightSpaceIntensity =
    context === 'login' ? 'strong' : context === 'dashboard' ? 'default' : 'default';
  const v = llganViewGlassByIntensity[intensity];
  return {
    centerVeilAlpha: v.centerVeilAlpha,
    nebulaOpacity: v.nebulaOpacity,
    wispOpacity: v.wispOpacity,
    starOpacity: v.starOpacity,
  };
}

function rgbaWhite(alpha: number): string {
  return `rgba(255,255,255,${alpha.toFixed(2)})`;
}

export function resolveLlganGlassSurface(intensity: LightSpaceIntensity = 'default') {
  const v = llganIntensityPresets[intensity];
  return {
    panel: rgbaWhite(v.panelAlpha),
    card: rgbaWhite(v.cardAlpha),
    sidebar: rgbaWhite(v.sidebarAlpha),
    chip: rgbaWhite(Math.max(0.32, v.panelAlpha - 0.06)),
    modal: rgbaWhite(v.modalAlpha),
    input: rgbaWhite(Math.max(0.32, v.panelAlpha - 0.06)),
    borderWhite: 'rgba(255,255,255,0.58)',
    borderAccent: 'rgba(130,170,255,0.18)',
    blurDesktop: v.glassBlur,
    blurMobile: Math.max(20, v.glassBlur - 8),
    saturate: v.glassSaturate,
    shadow: '0 20px 60px rgba(80,120,180,0.14)',
    shadowInset: 'inset 0 1px 0 rgba(255,255,255,0.65)',
  };
}

/** CSS custom properties for web shell roots. */
export function getLlganCssVars(intensity: LightSpaceIntensity = 'default'): Record<string, string> {
  const v = llganIntensityPresets[intensity];
  return {
    [llganCssVars.panelAlpha]: String(v.panelAlpha),
    [llganCssVars.cardAlpha]: String(v.cardAlpha),
    [llganCssVars.sidebarAlpha]: String(v.sidebarAlpha),
    [llganCssVars.modalAlpha]: String(v.modalAlpha),
    [llganCssVars.centerVeilAlpha]: String(v.centerVeilAlpha),
    [llganCssVars.nebulaOpacity]: String(v.nebulaOpacity),
    [llganCssVars.wispOpacity]: String(v.wispOpacity),
    [llganCssVars.starOpacity]: String(v.starOpacity),
    [llganCssVars.glassBlur]: `${v.glassBlur}px`,
    [llganCssVars.glassSaturate]: String(v.glassSaturate),
  };
}

/** Per-module KPI card glow — light liquid glass dashboard columns. */
export const llganModuleCardGlow: Record<string, string> = {
  office: 'rgba(255,145,0,0.10)',
  assist: 'rgba(80,220,255,0.10)',
  pflege: 'rgba(40,200,110,0.10)',
  stationaer: 'rgba(255,80,90,0.10)',
  beratung: 'rgba(145,95,255,0.10)',
  akademie: 'rgba(255,220,40,0.10)',
};

export function resolveLlganModuleCardGlow(moduleKey?: string): string | undefined {
  if (!moduleKey) return undefined;
  return llganModuleCardGlow[moduleKey];
}

/** Default Milchglas surface tokens (intensity: default). */
export const llganGlassSurface = resolveLlganGlassSurface('default');

export type LlganNebulaCloud = {
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

export type LlganAuroraWisp = {
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

export type LlganStarDust = {
  nx: number;
  ny: number;
  radius: number;
  baseOpacity: number;
  twinkleSpeed: number;
  glowRadius: number;
  layerDepth: number;
  phase: number;
};

export type LlganPearlescentGlow = {
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

/** 6 Nebula Clouds — Ecken + Mitte dezent. */
export const llganNebulaClouds: readonly LlganNebulaCloud[] = [
  {
    id: 'cloud-tl-cyan',
    bx: 0.06,
    by: 0.08,
    radiusX: 0.52,
    radiusY: 0.46,
    inner: 'rgba(143,234,255,0.72)',
    mid: 'rgba(183,216,255,0.34)',
    outer: 'rgba(223,241,255,0.06)',
    baseOpacity: 0.96,
    driftX: 200,
    driftY: 150,
    speed: 0.062,
    phase: 0,
    layerDepth: 0.55,
    breathe: 0.06,
  },
  {
    id: 'cloud-tr-lavender',
    bx: 0.94,
    by: 0.1,
    radiusX: 0.48,
    radiusY: 0.44,
    inner: 'rgba(202,184,255,0.68)',
    mid: 'rgba(232,223,255,0.30)',
    outer: 'rgba(243,221,251,0.05)',
    baseOpacity: 0.92,
    driftX: 190,
    driftY: 140,
    speed: 0.054,
    phase: 1.6,
    layerDepth: 0.6,
    breathe: 0.05,
  },
  {
    id: 'cloud-bl-ice',
    bx: 0.08,
    by: 0.9,
    radiusX: 0.46,
    radiusY: 0.42,
    inner: 'rgba(183,216,255,0.62)',
    mid: 'rgba(223,241,255,0.28)',
    outer: 'rgba(234,244,255,0.05)',
    baseOpacity: 0.9,
    driftX: 180,
    driftY: 160,
    speed: 0.048,
    phase: 3.2,
    layerDepth: 0.58,
    breathe: 0.05,
  },
  {
    id: 'cloud-br-pearl',
    bx: 0.92,
    by: 0.88,
    radiusX: 0.44,
    radiusY: 0.4,
    inner: 'rgba(243,221,251,0.58)',
    mid: 'rgba(232,223,255,0.26)',
    outer: 'rgba(255,255,255,0.04)',
    baseOpacity: 0.88,
    driftX: 170,
    driftY: 150,
    speed: 0.044,
    phase: 4.8,
    layerDepth: 0.62,
    breathe: 0.05,
  },
  {
    id: 'cloud-mid-cyan',
    bx: 0.22,
    by: 0.35,
    radiusX: 0.28,
    radiusY: 0.24,
    inner: 'rgba(168,230,255,0.28)',
    mid: 'rgba(183,216,255,0.12)',
    outer: 'transparent',
    baseOpacity: 0.58,
    driftX: 130,
    driftY: 100,
    speed: 0.056,
    phase: 2.1,
    layerDepth: 0.72,
    breathe: 0.04,
  },
  {
    id: 'cloud-mid-lilac',
    bx: 0.78,
    by: 0.55,
    radiusX: 0.26,
    radiusY: 0.22,
    inner: 'rgba(202,184,255,0.26)',
    mid: 'rgba(243,221,251,0.10)',
    outer: 'transparent',
    baseOpacity: 0.54,
    driftX: 120,
    driftY: 95,
    speed: 0.05,
    phase: 5.4,
    layerDepth: 0.75,
    breathe: 0.04,
  },
] as const;

/** Aurora Wisps — feine gekrümmte Lichtschleier (keine breiten Diagonalbänder). */
export const llganAuroraWisps: readonly LlganAuroraWisp[] = [
  {
    id: 'wisp-tl',
    bx: 0.12,
    by: 0.14,
    length: 0.42,
    thickness: 0.045,
    angle: 0.28,
    color: llganAuroraWispColors.cyan,
    driftX: 140,
    driftY: 75,
    speed: 0.028,
    phase: 0.5,
    layerDepth: 0.78,
  },
  {
    id: 'wisp-tr',
    bx: 0.88,
    by: 0.16,
    length: 0.38,
    thickness: 0.04,
    angle: -0.35,
    color: llganAuroraWispColors.lavender,
    driftX: 130,
    driftY: 70,
    speed: 0.024,
    phase: 2.3,
    layerDepth: 0.8,
  },
  {
    id: 'wisp-br',
    bx: 0.86,
    by: 0.78,
    length: 0.36,
    thickness: 0.038,
    angle: -0.48,
    color: llganAuroraWispColors.rose,
    driftX: 120,
    driftY: 65,
    speed: 0.022,
    phase: 5.1,
    layerDepth: 0.85,
  },
  {
    id: 'wisp-feather-tl',
    bx: 0.2,
    by: 0.08,
    length: 0.28,
    thickness: 0.028,
    angle: 0.62,
    color: 'rgba(143, 234, 255, 0.22)',
    driftX: 90,
    driftY: 50,
    speed: 0.02,
    phase: 1.2,
    layerDepth: 0.9,
  },
  {
    id: 'wisp-feather-tr',
    bx: 0.78,
    by: 0.1,
    length: 0.26,
    thickness: 0.026,
    angle: -0.55,
    color: 'rgba(202, 184, 255, 0.20)',
    driftX: 85,
    driftY: 48,
    speed: 0.019,
    phase: 3.4,
    layerDepth: 0.92,
  },
  {
    id: 'wisp-feather-br',
    bx: 0.9,
    by: 0.68,
    length: 0.24,
    thickness: 0.024,
    angle: -0.22,
    color: 'rgba(243, 221, 251, 0.18)',
    driftX: 80,
    driftY: 45,
    speed: 0.018,
    phase: 4.6,
    layerDepth: 0.94,
  },
] as const;

/** Star Dust — deterministische Seed-Liste. */
export const llganStarDust: readonly LlganStarDust[] = [
  { nx: 0.07, ny: 0.11, radius: 0.9, baseOpacity: 0.42, twinkleSpeed: 0.7, glowRadius: 4, layerDepth: 0.92, phase: 0.2 },
  { nx: 0.14, ny: 0.24, radius: 0.75, baseOpacity: 0.35, twinkleSpeed: 0.62, glowRadius: 3.5, layerDepth: 0.94, phase: 1.1 },
  { nx: 0.21, ny: 0.07, radius: 1.0, baseOpacity: 0.48, twinkleSpeed: 0.75, glowRadius: 5, layerDepth: 0.9, phase: 2.4 },
  { nx: 0.41, ny: 0.05, radius: 0.85, baseOpacity: 0.38, twinkleSpeed: 0.58, glowRadius: 4, layerDepth: 0.96, phase: 0.8 },
  { nx: 0.6, ny: 0.21, radius: 0.8, baseOpacity: 0.4, twinkleSpeed: 0.65, glowRadius: 3.8, layerDepth: 0.93, phase: 3.2 },
  { nx: 0.83, ny: 0.15, radius: 0.95, baseOpacity: 0.44, twinkleSpeed: 0.68, glowRadius: 4.5, layerDepth: 0.91, phase: 4.5 },
  { nx: 0.91, ny: 0.25, radius: 0.7, baseOpacity: 0.36, twinkleSpeed: 0.6, glowRadius: 3.2, layerDepth: 0.97, phase: 1.9 },
  { nx: 0.05, ny: 0.41, radius: 0.88, baseOpacity: 0.41, twinkleSpeed: 0.72, glowRadius: 4.2, layerDepth: 0.92, phase: 2.8 },
  { nx: 0.23, ny: 0.61, radius: 0.78, baseOpacity: 0.37, twinkleSpeed: 0.55, glowRadius: 3.6, layerDepth: 0.95, phase: 0.4 },
  { nx: 0.43, ny: 0.71, radius: 0.92, baseOpacity: 0.43, twinkleSpeed: 0.66, glowRadius: 4.8, layerDepth: 0.9, phase: 3.6 },
  { nx: 0.63, ny: 0.67, radius: 0.82, baseOpacity: 0.39, twinkleSpeed: 0.63, glowRadius: 3.9, layerDepth: 0.94, phase: 5.2 },
  { nx: 0.85, ny: 0.57, radius: 0.86, baseOpacity: 0.4, twinkleSpeed: 0.69, glowRadius: 4.1, layerDepth: 0.91, phase: 1.4 },
  { nx: 0.93, ny: 0.71, radius: 0.72, baseOpacity: 0.34, twinkleSpeed: 0.57, glowRadius: 3.4, layerDepth: 0.98, phase: 4.1 },
  { nx: 0.09, ny: 0.77, radius: 0.9, baseOpacity: 0.42, twinkleSpeed: 0.71, glowRadius: 4.4, layerDepth: 0.92, phase: 2.2 },
  { nx: 0.27, ny: 0.81, radius: 0.76, baseOpacity: 0.35, twinkleSpeed: 0.59, glowRadius: 3.5, layerDepth: 0.96, phase: 0.6 },
  { nx: 0.47, ny: 0.37, radius: 0.84, baseOpacity: 0.38, twinkleSpeed: 0.64, glowRadius: 4, layerDepth: 0.93, phase: 3.9 },
  { nx: 0.57, ny: 0.43, radius: 0.98, baseOpacity: 0.46, twinkleSpeed: 0.73, glowRadius: 5.2, layerDepth: 0.89, phase: 1.7 },
  { nx: 0.68, ny: 0.51, radius: 0.74, baseOpacity: 0.33, twinkleSpeed: 0.56, glowRadius: 3.3, layerDepth: 0.97, phase: 4.8 },
  { nx: 0.78, ny: 0.91, radius: 0.88, baseOpacity: 0.4, twinkleSpeed: 0.67, glowRadius: 4.3, layerDepth: 0.92, phase: 2.6 },
  { nx: 0.38, ny: 0.91, radius: 0.8, baseOpacity: 0.36, twinkleSpeed: 0.61, glowRadius: 3.7, layerDepth: 0.95, phase: 5.5 },
  { nx: 0.22, ny: 0.19, radius: 0.7, baseOpacity: 0.32, twinkleSpeed: 0.54, glowRadius: 3.2, layerDepth: 0.98, phase: 0.9 },
  { nx: 0.72, ny: 0.09, radius: 0.86, baseOpacity: 0.41, twinkleSpeed: 0.7, glowRadius: 4.2, layerDepth: 0.91, phase: 3.1 },
  { nx: 0.52, ny: 0.08, radius: 0.78, baseOpacity: 0.37, twinkleSpeed: 0.6, glowRadius: 3.8, layerDepth: 0.94, phase: 4.3 },
  { nx: 0.12, ny: 0.33, radius: 0.82, baseOpacity: 0.39, twinkleSpeed: 0.65, glowRadius: 4, layerDepth: 0.93, phase: 1.2 },
] as const;

/** Pearlescent Glow — sanfte Perlmutt-Highlights. */
export const llganPearlescentGlows: readonly LlganPearlescentGlow[] = [
  {
    id: 'pearl-tl',
    bx: 0.18,
    by: 0.22,
    radius: 0.28,
    inner: llganPearlescentColors.cyanPearl,
    outer: 'transparent',
    pulseSpeed: 0.018,
    phase: 0,
    layerDepth: 0.7,
  },
  {
    id: 'pearl-tr',
    bx: 0.82,
    by: 0.24,
    radius: 0.26,
    inner: llganPearlescentColors.lavenderPearl,
    outer: 'transparent',
    pulseSpeed: 0.016,
    phase: 2.1,
    layerDepth: 0.72,
  },
  {
    id: 'pearl-bl',
    bx: 0.2,
    by: 0.78,
    radius: 0.24,
    inner: llganPearlescentColors.white,
    outer: 'transparent',
    pulseSpeed: 0.015,
    phase: 3.5,
    layerDepth: 0.74,
  },
  {
    id: 'pearl-br',
    bx: 0.8,
    by: 0.76,
    radius: 0.22,
    inner: llganPearlescentColors.lavenderPearl,
    outer: 'transparent',
    pulseSpeed: 0.017,
    phase: 5.2,
    layerDepth: 0.76,
  },
] as const;

export const llganBaseGradient = [
  llganBaseColors.iceWhite,
  llganBaseColors.softPearl,
  llganBaseColors.mistBlue,
  llganBaseColors.powderBlue,
  llganBaseColors.pearlLilac,
  llganBaseColors.iceWhite,
] as const;
