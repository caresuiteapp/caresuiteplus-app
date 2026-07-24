/**
 * CareSuite HealthOS — canonical system-wide spatial Liquid Glass language.
 *
 * Only three brand colours are permitted. Every additional value below is an
 * alpha/brightness derivative of one of these colours. Semantic success,
 * warning and danger colours remain reserved for data states only.
 */
export const SYSTEM_LIQUID_COLORS = {
  navy: '#071225',
  electricBlue: '#69E8FF',
  white: '#FFFFFF',
} as const;

export const systemLiquidGlass = {
  page: '#071225',
  pageDeep: '#030A17',
  pageElevated: '#0B1B35',
  panel: 'rgba(12, 30, 57, 0.76)',
  panelStrong: 'rgba(10, 27, 52, 0.92)',
  card: 'rgba(15, 39, 71, 0.82)',
  cardHover: 'rgba(105, 232, 255, 0.14)',
  input: 'rgba(255, 255, 255, 0.085)',
  inputFocus: 'rgba(105, 232, 255, 0.15)',
  chip: 'rgba(255, 255, 255, 0.085)',
  chipActive: 'rgba(105, 232, 255, 0.19)',
  table: 'rgba(8, 24, 48, 0.90)',
  rowAlt: 'rgba(255, 255, 255, 0.025)',
  rowHover: 'rgba(105, 232, 255, 0.07)',
  rowSelected: 'rgba(105, 232, 255, 0.13)',
  border: 'rgba(105, 232, 255, 0.18)',
  borderStrong: 'rgba(105, 232, 255, 0.34)',
  borderActive: 'rgba(105, 232, 255, 0.88)',
  innerBorder: 'rgba(255, 255, 255, 0.16)',
  text: {
    primary: '#F8F6FF',
    secondary: 'rgba(248, 246, 255, 0.76)',
    muted: 'rgba(248, 246, 255, 0.56)',
    disabled: 'rgba(248, 246, 255, 0.34)',
    onAccent: '#17182D',
  },
  glow: {
    soft: 'rgba(105, 232, 255, 0.18)',
    medium: 'rgba(105, 232, 255, 0.30)',
    strong: 'rgba(105, 232, 255, 0.48)',
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

export const SYSTEM_LIQUID_GRADIENT = ['#071225', '#0B1B35', '#12345B'] as const;
export const SYSTEM_BLUE_GRADIENT = ['#0B1B35', '#69E8FF', '#FFFFFF'] as const;

export type SystemLiquidGlass = typeof systemLiquidGlass;
