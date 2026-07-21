/**
 * CareSuite HealthOS — canonical system-wide light Liquid Glass language.
 *
 * Only three brand colours are permitted. Every additional value below is an
 * alpha/brightness derivative of one of these colours. Semantic success,
 * warning and danger colours remain reserved for data states only.
 */
export const SYSTEM_LIQUID_COLORS = {
  navy: '#10233F',
  electricBlue: '#1478FF',
  white: '#FFFFFF',
} as const;

export const systemLiquidGlass = {
  page: '#F7FAFF',
  pageDeep: '#EEF4FB',
  pageElevated: '#FFFFFF',
  panel: 'rgba(255, 255, 255, 0.74)',
  panelStrong: 'rgba(255, 255, 255, 0.92)',
  card: 'rgba(255, 255, 255, 0.82)',
  cardHover: 'rgba(20, 120, 255, 0.08)',
  input: 'rgba(247, 250, 255, 0.88)',
  inputFocus: 'rgba(20, 120, 255, 0.08)',
  chip: 'rgba(255, 255, 255, 0.68)',
  chipActive: 'rgba(20, 120, 255, 0.14)',
  table: 'rgba(255, 255, 255, 0.84)',
  rowAlt: 'rgba(16, 35, 63, 0.025)',
  rowHover: 'rgba(20, 120, 255, 0.055)',
  rowSelected: 'rgba(20, 120, 255, 0.11)',
  border: 'rgba(16, 35, 63, 0.12)',
  borderStrong: 'rgba(16, 35, 63, 0.20)',
  borderActive: 'rgba(20, 120, 255, 0.72)',
  innerBorder: 'rgba(255, 255, 255, 0.72)',
  text: {
    primary: '#10233F',
    secondary: 'rgba(16, 35, 63, 0.74)',
    muted: 'rgba(16, 35, 63, 0.56)',
    disabled: 'rgba(16, 35, 63, 0.36)',
    onAccent: '#FFFFFF',
  },
  glow: {
    soft: 'rgba(20, 120, 255, 0.22)',
    medium: 'rgba(20, 120, 255, 0.36)',
    strong: 'rgba(20, 120, 255, 0.54)',
  },
  shadow: '0 18px 48px rgba(16,35,63,0.14)',
  shadowSoft: '0 10px 28px rgba(16,35,63,0.10)',
  shadowInset: 'inset 0 1px 0 rgba(255,255,255,0.78)',
  blur: {
    mobile: 18,
    desktop: 28,
    modal: 36,
  },
  saturate: 1.28,
} as const;

export const SYSTEM_LIQUID_GRADIENT = ['#F7FAFF', '#EEF4FB', '#FFFFFF'] as const;
export const SYSTEM_BLUE_GRADIENT = ['#0B5FE5', '#1478FF', '#4A9AFF'] as const;

export type SystemLiquidGlass = typeof systemLiquidGlass;
