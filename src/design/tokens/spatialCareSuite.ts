/**
 * CareSuite HealthOS V34 — one spatial product language for every module and portal.
 *
 * The reference combines a deep navy/violet stage with calm pearl-lilac work
 * surfaces. Cyan is a light effect, never the identity of every module.
 */
export const spatialCareColors = {
  night: '#17182D',
  nightDeep: '#0D1022',
  nightRaised: '#252742',
  violetMist: '#777493',
  pearl: '#F7F2F8',
  pearlDeep: '#E9E2F0',
  white: '#FFFFFF',
  ink: '#17182D',
  inkMuted: '#66657A',
  cyanLight: '#69E8FF',
  cyanDeep: '#19A7C8',
  warmLight: '#FFE5D6',
} as const;

export const spatialModuleAccents = {
  office: '#FF9B52',
  assist: '#55DDF6',
  pflege: '#48C98A',
  beratung: '#9B7CF6',
  stationaer: '#F26C78',
  akademie: '#E9C84C',
  qm: '#45B9A8',
  insight: '#6C91F2',
} as const;

export const spatialCare = {
  page: spatialCareColors.night,
  pageDeep: spatialCareColors.nightDeep,
  navigation: 'rgba(24, 25, 47, 0.88)',
  navigationStrong: 'rgba(15, 17, 35, 0.96)',
  stage: 'rgba(247, 242, 248, 0.93)',
  stageStrong: 'rgba(255, 255, 255, 0.97)',
  panel: 'rgba(255, 255, 255, 0.72)',
  panelMuted: 'rgba(233, 226, 240, 0.82)',
  input: 'rgba(255, 255, 255, 0.74)',
  border: 'rgba(255, 255, 255, 0.20)',
  borderDark: 'rgba(23, 24, 45, 0.12)',
  borderGlow: 'rgba(105, 232, 255, 0.46)',
  textOnNight: '#FFFFFF',
  textOnNightMuted: 'rgba(255,255,255,0.68)',
  textOnPearl: spatialCareColors.ink,
  textOnPearlMuted: spatialCareColors.inkMuted,
  shadow: '0 28px 80px rgba(5, 7, 22, 0.34)',
  shadowSoft: '0 14px 40px rgba(16, 17, 37, 0.16)',
  glow: '0 0 34px rgba(105, 232, 255, 0.22)',
  blur: { navigation: 28, stage: 30, modal: 40 },
  radius: { shell: 34, stage: 28, card: 22, control: 16, capsule: 999 },
} as const;

export const spatialCareGradients = {
  background: ['#111326', '#24243D', '#555166'] as const,
  nightGlass: ['rgba(44,47,78,0.94)', 'rgba(19,21,42,0.97)'] as const,
  pearl: ['rgba(255,255,255,0.98)', 'rgba(232,224,240,0.96)'] as const,
  cyanEdge: ['rgba(105,232,255,0.92)', 'rgba(105,232,255,0.08)'] as const,
} as const;

export type SpatialModuleAccent = keyof typeof spatialModuleAccents;
