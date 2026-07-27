import type { TextStyle, ViewStyle } from 'react-native';

export const liquidColors = {
  navy950: '#06152B',
  navy900: '#071B35',
  navy800: '#0A2342',
  navy700: '#0D315E',
  blue600: '#0067E6',
  blue500: '#1478FF',
  blue400: '#3D91FF',
  blue300: '#8BC1FF',
  blue200: '#8BC1FF',
  blue500Alpha16: 'rgba(20,120,255,0.16)',
  blue300Alpha32: 'rgba(139,193,255,0.32)',
  white: '#FFFFFF',
  white88: 'rgba(255,255,255,0.88)',
  white72: 'rgba(255,255,255,0.72)',
  white64: 'rgba(255,255,255,0.64)',
  white56: 'rgba(255,255,255,0.56)',
  white32: 'rgba(255,255,255,0.32)',
  white22: 'rgba(255,255,255,0.22)',
  white18: 'rgba(255,255,255,0.18)',
  white12: 'rgba(255,255,255,0.12)',
  white08: 'rgba(255,255,255,0.08)',
  black24: 'rgba(0,0,0,0.24)',
  danger: '#FF5B6E',
  warning: '#FFC857',
  success: '#4DDBA8',
} as const;

export const liquidSpace = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 24,
  6: 32,
  7: 48,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const liquidRadius = {
  control: 10,
  small: 14,
  card: 20,
  panel: 28,
  pill: 999,
  md: 14,
  lg: 20,
} as const;

export const liquidType = {
  displayDesktop: 40,
  displayMobile: 30,
  titleDesktop: 28,
  titleMobile: 24,
  section: 20,
  body: 16,
  meta: 14,
  control: 16,
  kicker: 12,
} as const;

export const liquidMotion = {
  micro: 120,
  standard: 190,
  spatial: 300,
} as const;

export const liquidBreakpoints = {
  phoneMax: 600,
  tabletPortraitMin: 700,
  tabletPortraitMax: 899,
  tabletLandscapeMin: 900,
  compactWebMin: 1100,
  compactWebMax: 1279,
  desktopMin: 1280,
} as const;

export const liquidLayers = {
  base: 0,
  content: 10,
  dock: 30,
  overlay: 60,
  critical: 100,
} as const;

export const liquidShadows = {
  panel: {
    shadowColor: liquidColors.blue500,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.16,
    shadowRadius: 36,
    elevation: 12,
  } satisfies ViewStyle,
  focus: {
    shadowColor: liquidColors.blue500,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.42,
    shadowRadius: 14,
    elevation: 8,
  } satisfies ViewStyle,
} as const;

export const liquidTypography = {
  display: {
    color: liquidColors.white,
    fontSize: liquidType.displayDesktop,
    lineHeight: 46,
    fontWeight: '800',
    letterSpacing: -1.1,
  } satisfies TextStyle,
  title: {
    color: liquidColors.white,
    fontSize: liquidType.titleDesktop,
    lineHeight: 34,
    fontWeight: '800',
    letterSpacing: -0.45,
  } satisfies TextStyle,
  section: {
    color: liquidColors.white,
    fontSize: liquidType.section,
    lineHeight: 26,
    fontWeight: '700',
  } satisfies TextStyle,
  body: {
    color: liquidColors.white88,
    fontSize: liquidType.body,
    lineHeight: 24,
    fontWeight: '400',
  } satisfies TextStyle,
  meta: {
    color: liquidColors.white72,
    fontSize: liquidType.meta,
    lineHeight: 20,
    fontWeight: '500',
  } satisfies TextStyle,
  kicker: {
    color: liquidColors.blue200,
    fontSize: liquidType.kicker,
    lineHeight: 16,
    fontWeight: '800',
    letterSpacing: 1.2,
  } satisfies TextStyle,
} as const;

export const liquidGrid = {
  desktop: { columns: 12, gutter: 24, maxWidth: 1920 },
  tabletLandscape: { columns: 12, gutter: 20 },
  tabletPortrait: { columns: 8, gutter: 16 },
  phone: { columns: 4, gutter: 16 },
} as const;

export type LiquidSemanticTone = 'neutral' | 'live' | 'warning' | 'danger' | 'success';

export function toneColor(tone: LiquidSemanticTone): string {
  if (tone === 'live') return liquidColors.blue400;
  if (tone === 'warning') return liquidColors.warning;
  if (tone === 'danger') return liquidColors.danger;
  if (tone === 'success') return liquidColors.success;
  return liquidColors.white72;
}
