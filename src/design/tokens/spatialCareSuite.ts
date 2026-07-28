/**
 * CareSuite HealthOS V34 — one spatial product language for every module and portal.
 *
 * The reference combines a deep navy/violet stage with calm pearl-lilac work
 * surfaces. Cyan is a light effect, never the identity of every module.
 */
export const spatialCareColors = {
  night: '#031127',
  nightDeep: '#010817',
  nightRaised: '#061B35',
  violetMist: '#0A2A52',
  pearl: '#FFFFFF',
  pearlDeep: '#9ACBFF',
  white: '#FFFFFF',
  ink: '#F8F6FF',
  inkMuted: '#B8B4CA',
  cyanLight: '#3597FF',
  cyanDeep: '#056CE8',
  warmLight: '#FFE5D6',
} as const;

export const spatialModuleAccents = {
  office: '#1683FF',
  assist: '#3597FF',
  pflege: '#70B5FF',
  beratung: '#3597FF',
  stationaer: '#9ACBFF',
  akademie: '#FFFFFF',
  qm: '#70B5FF',
  insight: '#3597FF',
} as const;

export const spatialCare = {
  page: spatialCareColors.night,
  pageDeep: spatialCareColors.nightDeep,
  navigation: 'rgba(3, 17, 39, 0.90)',
  navigationStrong: 'rgba(1, 8, 23, 0.97)',
  stage: 'rgba(6, 27, 53, 0.88)',
  stageStrong: 'rgba(3, 17, 39, 0.95)',
  panel: 'rgba(10, 42, 82, 0.72)',
  panelMuted: 'rgba(6, 27, 53, 0.62)',
  input: 'rgba(255, 255, 255, 0.075)',
  border: 'rgba(255, 255, 255, 0.16)',
  borderDark: 'rgba(255, 255, 255, 0.11)',
  borderGlow: 'rgba(53, 151, 255, 0.46)',
  textOnNight: '#FFFFFF',
  textOnNightMuted: 'rgba(255,255,255,0.68)',
  textOnPearl: spatialCareColors.ink,
  textOnPearlMuted: spatialCareColors.inkMuted,
  shadow: '0 28px 80px rgba(5, 7, 22, 0.34)',
  shadowSoft: '0 14px 40px rgba(16, 17, 37, 0.16)',
  glow: '0 0 34px rgba(22, 131, 255, 0.22)',
  blur: { navigation: 28, stage: 30, modal: 40 },
  radius: { shell: 34, stage: 28, card: 22, control: 16, capsule: 999 },
} as const;

export const spatialCareGradients = {
  background: ['#010817', '#031127', '#0A2A52'] as const,
  nightGlass: ['rgba(6,27,53,0.94)', 'rgba(1,8,23,0.98)'] as const,
  pearl: ['rgba(10,42,82,0.96)', 'rgba(3,17,39,0.98)'] as const,
  cyanEdge: ['rgba(53,151,255,0.92)', 'rgba(22,131,255,0.08)'] as const,
} as const;

export type SpatialModuleAccent = keyof typeof spatialModuleAccents;
