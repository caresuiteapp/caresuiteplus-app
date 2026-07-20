import { careSuiteModalScrim, careSuiteModalScrimStrong } from '@/design/tokens/lightTheme';
import { SYSTEM_LIQUID_COLORS, systemLiquidGlass } from '@/design/tokens/systemLiquidGlass';

export const careEffects = {
  glass: {
    blur: { light: 8, medium: 16, heavy: 24 },
    opacity: { panel: 0.72, overlay: 0.55, rim: 0.14, modal: 0.92 },
    border: systemLiquidGlass.border,
    background: systemLiquidGlass.card,
    modalBackground: systemLiquidGlass.panelStrong,
    modalBackgroundLight: systemLiquidGlass.panelStrong,
    modalBorder: systemLiquidGlass.borderStrong,
    modalBorderLight: systemLiquidGlass.borderStrong,
    overlayDark: careSuiteModalScrimStrong,
    overlayLight: careSuiteModalScrim,
  },
  sheen: {
    height: 1,
    rimHeight: 2,
    opacity: { subtle: 0.12, default: 0.18, strong: 0.28 },
    color: 'rgba(248,251,255,0.16)',
  },
  elevation: {
    card: {
      shadowColor: systemLiquidGlass.pageDeep,
      shadowOpacity: 0.12,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
      elevation: 8,
    },
    floating: {
      shadowColor: systemLiquidGlass.pageDeep,
      shadowOpacity: 0.18,
      shadowRadius: 28,
      shadowOffset: { width: 0, height: 18 },
      elevation: 18,
    },
    brandGlow: {
      shadowColor: SYSTEM_LIQUID_COLORS.electricBlue,
      shadowOpacity: 0.32,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 10,
    },
  },
  border: {
    soft: systemLiquidGlass.border,
    strong: systemLiquidGlass.borderStrong,
    brand: systemLiquidGlass.borderActive,
  },
} as const;
