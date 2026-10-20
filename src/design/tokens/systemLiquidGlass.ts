/**
 * CareSuite HealthOS — canonical system-wide spatial Liquid Glass language.
 *
 * Only three brand colours are permitted. Every additional value below is an
 * alpha/brightness derivative of one of these colours. Semantic success,
 * warning and danger colours remain reserved for data states only.
 */
export const SYSTEM_LIQUID_COLORS = {
  navy: '#031127',
  electricBlue: '#1683FF',
  white: '#FFFFFF',
} as const;

export const systemLiquidGlass = {
  page: '#FFFFFF',
  pageDeep: '#F5FAFF',
  pageElevated: '#FFFFFF',
  panel: 'rgba(255, 255, 255, 0.88)',
  panelStrong: 'rgba(255, 255, 255, 0.96)',
  card: 'rgba(255, 255, 255, 0.92)',
  cardHover: 'rgba(22, 131, 255, 0.08)',
  input: 'rgba(255, 255, 255, 0.94)',
  inputFocus: 'rgba(22, 131, 255, 0.10)',
  chip: 'rgba(255, 255, 255, 0.88)',
  chipActive: 'rgba(22, 131, 255, 0.12)',
  table: 'rgba(255, 255, 255, 0.94)',
  rowAlt: 'rgba(22, 131, 255, 0.025)',
  rowHover: 'rgba(22, 131, 255, 0.06)',
  rowSelected: 'rgba(22, 131, 255, 0.11)',
  border: 'rgba(20, 64, 112, 0.12)',
  borderStrong: 'rgba(22, 131, 255, 0.28)',
  borderActive: 'rgba(53, 151, 255, 0.92)',
  innerBorder: 'rgba(255, 255, 255, 0.78)',
  text: {
    primary: '#000000',
    secondary: '#000000',
    muted: '#000000',
    disabled: 'rgba(0, 0, 0, 0.38)',
    onAccent: '#FFFFFF',
  },
  glow: {
    soft: 'rgba(22, 131, 255, 0.18)',
    medium: 'rgba(22, 131, 255, 0.30)',
    strong: 'rgba(53, 151, 255, 0.48)',
  },
  shadow: '0 24px 70px rgba(37,78,128,0.15)',
  shadowSoft: '0 14px 38px rgba(37,78,128,0.11)',
  shadowInset: 'inset 0 1px 0 rgba(255,255,255,0.18)',
  blur: {
    mobile: 18,
    desktop: 28,
    modal: 36,
  },
  saturate: 1.28,
} as const;

export const SYSTEM_LIQUID_GRADIENT = ['#010817', '#031127', '#0A2A52'] as const;
export const SYSTEM_BLUE_GRADIENT = ['#056CE8', '#1683FF', '#3597FF'] as const;

export type SystemLiquidGlass = typeof systemLiquidGlass;
