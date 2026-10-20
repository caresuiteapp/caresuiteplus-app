/** Pure popup tokens — one canonical Liquid Glass language in every context. */
import { SYSTEM_BLUE_GRADIENT, systemLiquidGlass } from './systemLiquidGlass';

export const popupShellHeaderGradientLight = SYSTEM_BLUE_GRADIENT;
export const popupShellHeaderGradientDark = SYSTEM_BLUE_GRADIENT;

export type PopupShellColorMode = 'light' | 'dark';

const canonicalPopupColors = {
  headerTitle: systemLiquidGlass.text.primary,
  closeButton: {
    background: systemLiquidGlass.chip,
    border: systemLiquidGlass.borderStrong,
    icon: systemLiquidGlass.text.primary,
  },
  tab: {
    inactiveBackground: systemLiquidGlass.chip,
    inactiveText: systemLiquidGlass.text.secondary,
    inactiveBorder: systemLiquidGlass.border,
    activeBackground: systemLiquidGlass.chipActive,
    activeBorder: systemLiquidGlass.borderActive,
    activeText: systemLiquidGlass.text.primary,
  },
  body: {
    background: systemLiquidGlass.panelStrong,
    backgroundAlt: systemLiquidGlass.panel,
  },
  backdrop: 'rgba(3,10,24,0.72)',
  footerBorder: systemLiquidGlass.innerBorder,
  subtitleBar: {
    background: systemLiquidGlass.chip,
    border: systemLiquidGlass.border,
    text: systemLiquidGlass.text.secondary,
  },
} as const;

export const popupShellColors = {
  light: canonicalPopupColors,
  dark: canonicalPopupColors,
} as const;

export const popupShellLayout = {
  borderRadius: 22,
  maxWidthDefault: 760,
  minWidthDefault: 320,
  maxHeightRatioDefault: 0.92,
  closeButtonSize: 40,
  shadowWebLight: systemLiquidGlass.shadow,
  shadowWebDark: systemLiquidGlass.shadow,
  headerGlowWebLight: '0 12px 36px rgba(20,120,255,0.26)',
  headerGlowWebDark: '0 12px 36px rgba(20,120,255,0.26)',
} as const;

export function resolvePopupShellHeaderGradient(
  _mode: PopupShellColorMode = 'dark',
): readonly [string, ...string[]] {
  return popupShellHeaderGradientDark;
}

export function resolvePopupShellColors(_mode: PopupShellColorMode = 'dark') {
  return canonicalPopupColors;
}
