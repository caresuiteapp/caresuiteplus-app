/**
 * CareSuite HealthOS V34 — one spatial product language for every module and portal.
 *
 * The reference combines a deep navy/violet stage with calm pearl-lilac work
 * surfaces. Cyan is a light effect, never the identity of every module.
 */
export const spatialCareColors = {
  night: '#071225',
  nightDeep: '#030A17',
  nightRaised: '#0B1B35',
  violetMist: '#12345B',
  pearl: '#FFFFFF',
  pearlDeep: '#B9F5FF',
  white: '#FFFFFF',
  ink: '#F8F6FF',
  inkMuted: '#B8B4CA',
  cyanLight: '#69E8FF',
  cyanDeep: '#19A7C8',
  warmLight: '#FFE5D6',
} as const;

export const spatialModuleAccents = {
  office: '#69E8FF',
  assist: '#55DDF6',
  pflege: '#A6F3FF',
  beratung: '#69E8FF',
  stationaer: '#D5FAFF',
  akademie: '#FFFFFF',
  qm: '#8DEEFF',
  insight: '#69E8FF',
} as const;

export const spatialCare = {
  page: spatialCareColors.night,
  pageDeep: spatialCareColors.nightDeep,
  navigation: 'rgba(7, 18, 37, 0.88)',
  navigationStrong: 'rgba(3, 10, 23, 0.96)',
  stage: 'rgba(10, 27, 52, 0.88)',
  stageStrong: 'rgba(12, 34, 62, 0.94)',
  panel: 'rgba(15, 39, 71, 0.76)',
  panelMuted: 'rgba(18, 52, 91, 0.46)',
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
  background: ['#030A17', '#071225', '#12345B'] as const,
  nightGlass: ['rgba(15,39,71,0.94)', 'rgba(3,10,23,0.98)'] as const,
  pearl: ['rgba(18,52,91,0.96)', 'rgba(7,18,37,0.98)'] as const,
  cyanEdge: ['rgba(105,232,255,0.92)', 'rgba(105,232,255,0.08)'] as const,
} as const;

export type SpatialModuleAccent = keyof typeof spatialModuleAccents;
