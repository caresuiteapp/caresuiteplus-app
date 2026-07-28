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
  page: '#031127',
  pageDeep: '#010817',
  pageElevated: '#061B35',
  panel: 'rgba(6, 27, 53, 0.76)',
  panelStrong: 'rgba(3, 17, 39, 0.94)',
  card: 'rgba(10, 42, 82, 0.74)',
  cardHover: 'rgba(22, 131, 255, 0.16)',
  input: 'rgba(255, 255, 255, 0.085)',
  inputFocus: 'rgba(22, 131, 255, 0.16)',
  chip: 'rgba(255, 255, 255, 0.085)',
  chipActive: 'rgba(22, 131, 255, 0.19)',
  table: 'rgba(3, 17, 39, 0.90)',
  rowAlt: 'rgba(255, 255, 255, 0.025)',
  rowHover: 'rgba(22, 131, 255, 0.08)',
  rowSelected: 'rgba(22, 131, 255, 0.16)',
  border: 'rgba(255, 255, 255, 0.12)',
  borderStrong: 'rgba(112, 181, 255, 0.32)',
  borderActive: 'rgba(53, 151, 255, 0.92)',
  innerBorder: 'rgba(255, 255, 255, 0.16)',
  text: {
    primary: '#F8F6FF',
    secondary: 'rgba(248, 246, 255, 0.76)',
    muted: 'rgba(248, 246, 255, 0.56)',
    disabled: 'rgba(248, 246, 255, 0.34)',
    onAccent: '#FFFFFF',
  },
  glow: {
    soft: 'rgba(22, 131, 255, 0.18)',
    medium: 'rgba(22, 131, 255, 0.30)',
    strong: 'rgba(53, 151, 255, 0.48)',
  },
  shadow: '0 30px 90px rgba(0,7,22,0.54)',
  shadowSoft: '0 18px 48px rgba(0,7,22,0.38)',
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
