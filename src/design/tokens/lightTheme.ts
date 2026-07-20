/** Legacy names backed by the canonical dark Liquid Glass palette. */
import { SYSTEM_LIQUID_COLORS, systemLiquidGlass } from './systemLiquidGlass';
/** HTML document + RN root fallback before hydrated backgrounds paint. */
export const careSuiteDocumentRootBg = systemLiquidGlass.pageDeep;

/** System-wide body ink — pure black. */
export const CARESUITE_INK = systemLiquidGlass.text.primary;

/** Light modal/popup scrim — never pure black. */
export const careSuiteModalScrim = 'rgba(3, 10, 24, 0.62)';
export const careSuiteModalScrimStrong = 'rgba(3, 10, 24, 0.78)';

export const careLightColors = {
  page: systemLiquidGlass.page,
  surface: systemLiquidGlass.card,
  navy: SYSTEM_LIQUID_COLORS.navy,
  text: CARESUITE_INK,
  muted: CARESUITE_INK,
  orange: SYSTEM_LIQUID_COLORS.electricBlue,
  gold: SYSTEM_LIQUID_COLORS.electricBlue,
  cyan: SYSTEM_LIQUID_COLORS.electricBlue,
  green: '#22C55E',
  violet: SYSTEM_LIQUID_COLORS.electricBlue,
  danger: '#FF5D6C',
  warning: '#FFBF47',
  border: systemLiquidGlass.border,
  borderStrong: systemLiquidGlass.borderStrong,
} as const;

export type CareLightColors = typeof careLightColors;
