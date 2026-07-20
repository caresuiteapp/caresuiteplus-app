/**
 * CareSuite HealthOS — canonical system-wide Liquid Glass language.
 *
 * Only three brand colours are permitted. Every additional value below is an
 * alpha/brightness derivative of one of these colours. Semantic success,
 * warning and danger colours remain reserved for data states only.
 */
export const SYSTEM_LIQUID_COLORS = {
  navy: '#061126',
  electricBlue: '#1478FF',
  white: '#F8FBFF',
} as const;

export const systemLiquidGlass = {
  page: '#061126',
  pageDeep: '#030A18',
  pageElevated: '#0A1934',
  panel: 'rgba(10, 25, 52, 0.68)',
  panelStrong: 'rgba(10, 25, 52, 0.84)',
  card: 'rgba(15, 35, 68, 0.62)',
  cardHover: 'rgba(20, 120, 255, 0.13)',
  input: 'rgba(248, 251, 255, 0.065)',
  inputFocus: 'rgba(20, 120, 255, 0.12)',
  chip: 'rgba(248, 251, 255, 0.055)',
  chipActive: 'rgba(20, 120, 255, 0.22)',
  table: 'rgba(8, 22, 47, 0.72)',
  rowAlt: 'rgba(248, 251, 255, 0.025)',
  rowHover: 'rgba(20, 120, 255, 0.08)',
  rowSelected: 'rgba(20, 120, 255, 0.16)',
  border: 'rgba(248, 251, 255, 0.13)',
  borderStrong: 'rgba(248, 251, 255, 0.22)',
  borderActive: 'rgba(20, 120, 255, 0.72)',
  innerBorder: 'rgba(248, 251, 255, 0.075)',
  text: {
    primary: '#F8FBFF',
    secondary: 'rgba(248, 251, 255, 0.74)',
    muted: 'rgba(248, 251, 255, 0.52)',
    disabled: 'rgba(248, 251, 255, 0.34)',
    onAccent: '#F8FBFF',
  },
  glow: {
    soft: 'rgba(20, 120, 255, 0.22)',
    medium: 'rgba(20, 120, 255, 0.36)',
    strong: 'rgba(20, 120, 255, 0.54)',
  },
  shadow: '0 18px 48px rgba(3,10,24,0.44)',
  shadowSoft: '0 10px 28px rgba(3,10,24,0.32)',
  shadowInset: 'inset 0 1px 0 rgba(248,251,255,0.08)',
  blur: {
    mobile: 18,
    desktop: 28,
    modal: 36,
  },
  saturate: 1.28,
} as const;

export const SYSTEM_LIQUID_GRADIENT = ['#030A18', '#061126', '#0A1934'] as const;
export const SYSTEM_BLUE_GRADIENT = ['#0B5FE5', '#1478FF', '#4A9AFF'] as const;

export type SystemLiquidGlass = typeof systemLiquidGlass;
