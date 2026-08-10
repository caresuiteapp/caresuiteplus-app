import type { TextStyle, ViewStyle } from 'react-native';
import { applyWebFontScaleToTextStyle } from '@/design/web/webFontSize';

/**
 * Classic Liquid palette retained exclusively for the client and employee portals.
 * Internal product routes must use `liquidColors`, the system-wide ORBIT contract.
 */
export const liquidClassicColors = {
  navy950: '#010817',
  navy900: '#031127',
  navy800: '#061B35',
  navy700: '#0A2A52',
  blue600: '#056CE8',
  blue500: '#1683FF',
  blue400: '#3597FF',
  blue300: '#70B5FF',
  blue200: '#9ACBFF',
  blue500Alpha16: 'rgba(22,131,255,0.16)',
  blue300Alpha32: 'rgba(112,181,255,0.32)',
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

/**
 * ORBIT light semantic contract for every authenticated internal route.
 * Legacy property names remain stable so thousands of existing consumers switch
 * coherently without page-level overrides.
 */
export const liquidColors = {
  navy950: '#F6FAFF',
  navy900: '#F8FBFF',
  navy800: '#FFFFFF',
  navy700: '#EDF5FF',
  blue600: '#056CE8',
  blue500: '#1683FF',
  blue400: '#1478E8',
  blue300: '#2563EB',
  blue200: '#1D4ED8',
  blue500Alpha16: 'rgba(22,131,255,0.16)',
  blue300Alpha32: 'rgba(37,99,235,0.32)',
  white: '#0B1220',
  white88: 'rgba(11,18,32,0.88)',
  white72: 'rgba(30,41,59,0.72)',
  white64: 'rgba(51,65,85,0.64)',
  white56: 'rgba(71,85,105,0.72)',
  white32: 'rgba(100,116,139,0.52)',
  white22: 'rgba(15,23,42,0.22)',
  white18: 'rgba(15,23,42,0.18)',
  white12: 'rgba(15,23,42,0.12)',
  white08: 'rgba(15,23,42,0.08)',
  black24: 'rgba(15,23,42,0.14)',
  onAccent: '#FFFFFF',
  danger: '#D92D46',
  warning: '#A86600',
  success: '#0F9F6E',
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
  control: 9,
  small: 11,
  card: 15,
  panel: 18,
  pill: 999,
  md: 14,
  lg: 20,
} as const;

export const liquidType = {
  displayDesktop: 34,
  displayMobile: 30,
  titleDesktop: 25,
  titleMobile: 24,
  section: 18,
  body: 14,
  meta: 12,
  control: 14,
  kicker: 11,
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
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 8,
  } satisfies ViewStyle,
  focus: {
    shadowColor: liquidColors.blue500,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.42,
    shadowRadius: 14,
    elevation: 8,
  } satisfies ViewStyle,
} as const;

export const liquidClassicShadows = {
  panel: {
    shadowColor: liquidClassicColors.blue500,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 8,
  } satisfies ViewStyle,
  focus: {
    shadowColor: liquidClassicColors.blue500,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.42,
    shadowRadius: 14,
    elevation: 8,
  } satisfies ViewStyle,
} as const;

export const liquidTypography = {
  display: applyWebFontScaleToTextStyle({
    color: liquidColors.white,
    fontSize: liquidType.displayDesktop,
    lineHeight: 40,
    fontWeight: '800',
    letterSpacing: -1.1,
  } satisfies TextStyle),
  title: applyWebFontScaleToTextStyle({
    color: liquidColors.white,
    fontSize: liquidType.titleDesktop,
    lineHeight: 30,
    fontWeight: '800',
    letterSpacing: -0.45,
  } satisfies TextStyle),
  section: applyWebFontScaleToTextStyle({
    color: liquidColors.white,
    fontSize: liquidType.section,
    lineHeight: 23,
    fontWeight: '700',
  } satisfies TextStyle),
  body: applyWebFontScaleToTextStyle({
    color: liquidColors.white88,
    fontSize: liquidType.body,
    lineHeight: 21,
    fontWeight: '400',
  } satisfies TextStyle),
  meta: applyWebFontScaleToTextStyle({
    color: liquidColors.white72,
    fontSize: liquidType.meta,
    lineHeight: 17,
    fontWeight: '500',
  } satisfies TextStyle),
  kicker: applyWebFontScaleToTextStyle({
    color: liquidColors.blue200,
    fontSize: liquidType.kicker,
    lineHeight: 16,
    fontWeight: '800',
    letterSpacing: 1.2,
  } satisfies TextStyle),
} as const;

export const liquidClassicTypography = {
  display: applyWebFontScaleToTextStyle({
    color: liquidClassicColors.white,
    fontSize: liquidType.displayDesktop,
    lineHeight: 40,
    fontWeight: '800',
    letterSpacing: -1.1,
  } satisfies TextStyle),
  title: applyWebFontScaleToTextStyle({
    color: liquidClassicColors.white,
    fontSize: liquidType.titleDesktop,
    lineHeight: 30,
    fontWeight: '800',
    letterSpacing: -0.45,
  } satisfies TextStyle),
  section: applyWebFontScaleToTextStyle({
    color: liquidClassicColors.white,
    fontSize: liquidType.section,
    lineHeight: 23,
    fontWeight: '700',
  } satisfies TextStyle),
  body: applyWebFontScaleToTextStyle({
    color: liquidClassicColors.white88,
    fontSize: liquidType.body,
    lineHeight: 21,
    fontWeight: '400',
  } satisfies TextStyle),
  meta: applyWebFontScaleToTextStyle({
    color: liquidClassicColors.white72,
    fontSize: liquidType.meta,
    lineHeight: 17,
    fontWeight: '500',
  } satisfies TextStyle),
  kicker: applyWebFontScaleToTextStyle({
    color: liquidClassicColors.blue200,
    fontSize: liquidType.kicker,
    lineHeight: 16,
    fontWeight: '800',
    letterSpacing: 1.2,
  } satisfies TextStyle),
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
