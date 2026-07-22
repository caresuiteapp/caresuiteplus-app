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
  pearl: '#DDD7E8',
  pearlDeep: '#AFA7C4',
  white: '#FFFFFF',
  ink: '#F8F6FF',
  inkMuted: '#B8B4CA',
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
  stage: 'rgba(31, 32, 58, 0.88)',
  stageStrong: 'rgba(43, 44, 76, 0.94)',
  panel: 'rgba(53, 54, 88, 0.72)',
  panelMuted: 'rgba(95, 91, 126, 0.42)',
  input: 'rgba(255, 255, 255, 0.075)',
  border: 'rgba(255, 255, 255, 0.16)',
  borderDark: 'rgba(255, 255, 255, 0.11)',
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
  pearl: ['rgba(66,65,101,0.96)', 'rgba(35,36,65,0.98)'] as const,
  cyanEdge: ['rgba(105,232,255,0.92)', 'rgba(105,232,255,0.08)'] as const,
} as const;

export type SpatialModuleAccent = keyof typeof spatialModuleAccents;
