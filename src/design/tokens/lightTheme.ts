/** Legacy names backed by the canonical light Liquid Glass palette. */
import { SYSTEM_LIQUID_COLORS, systemLiquidGlass } from './systemLiquidGlass';
/** HTML document + RN root fallback before hydrated backgrounds paint. */
export const careSuiteDocumentRootBg = systemLiquidGlass.pageDeep;

/** System-wide body ink. */
export const CARESUITE_INK = systemLiquidGlass.text.primary;

/** Light modal/popup scrim — readable without turning the application black. */
export const careSuiteModalScrim = 'rgba(16, 35, 63, 0.28)';
export const careSuiteModalScrimStrong = 'rgba(16, 35, 63, 0.42)';

export const careLightColors = {
  page: systemLiquidGlass.page,
  surface: systemLiquidGlass.card,
  navy: SYSTEM_LIQUID_COLORS.navy,
  text: CARESUITE_INK,
  muted: CARESUITE_INK,
  orange: '#FF9B52',
  gold: '#E9C84C',
  cyan: '#55DDF6',
  green: '#22C55E',
  violet: '#9B7CF6',
  danger: '#FF5D6C',
  warning: '#FFBF47',
  border: systemLiquidGlass.border,
  borderStrong: systemLiquidGlass.borderStrong,
} as const;

export type CareLightColors = typeof careLightColors;
