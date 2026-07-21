/**
 * CareSuite HealthOS — canonical system-wide spatial Liquid Glass language.
 *
 * Only three brand colours are permitted. Every additional value below is an
 * alpha/brightness derivative of one of these colours. Semantic success,
 * warning and danger colours remain reserved for data states only.
 */
export const SYSTEM_LIQUID_COLORS = {
  navy: '#17182D',
  electricBlue: '#69E8FF',
  white: '#FFFFFF',
} as const;

export const systemLiquidGlass = {
  page: '#17182D',
  pageDeep: '#0D1022',
  pageElevated: '#252742',
  panel: 'rgba(39, 40, 70, 0.76)',
  panelStrong: 'rgba(45, 46, 78, 0.92)',
  card: 'rgba(53, 54, 88, 0.76)',
  cardHover: 'rgba(105, 232, 255, 0.10)',
  input: 'rgba(255, 255, 255, 0.075)',
  inputFocus: 'rgba(105, 232, 255, 0.12)',
  chip: 'rgba(255, 255, 255, 0.075)',
  chipActive: 'rgba(105, 232, 255, 0.16)',
  table: 'rgba(39, 40, 70, 0.82)',
  rowAlt: 'rgba(255, 255, 255, 0.025)',
  rowHover: 'rgba(105, 232, 255, 0.07)',
  rowSelected: 'rgba(105, 232, 255, 0.13)',
  border: 'rgba(255, 255, 255, 0.13)',
  borderStrong: 'rgba(255, 255, 255, 0.22)',
  borderActive: 'rgba(105, 232, 255, 0.74)',
  innerBorder: 'rgba(255, 255, 255, 0.18)',
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
  shadow: '0 24px 64px rgba(5,7,22,0.34)',
  shadowSoft: '0 12px 34px rgba(5,7,22,0.24)',
  shadowInset: 'inset 0 1px 0 rgba(255,255,255,0.18)',
  blur: {
    mobile: 18,
    desktop: 28,
    modal: 36,
  },
  saturate: 1.28,
} as const;

export const SYSTEM_LIQUID_GRADIENT = ['#17182D', '#252742', '#403D5A'] as const;
export const SYSTEM_BLUE_GRADIENT = ['#7770B8', '#55DDF6', '#B9A7D8'] as const;

export type SystemLiquidGlass = typeof systemLiquidGlass;
