/** Pure popup shell tokens — safe to import in tests without React Native. */

export const popupShellHeaderGradientLight = ['#8a70f5', '#e85da2', '#b598f7'] as const;

export const popupShellHeaderGradientDark = ['#6B4EAA', '#C44BA8', '#8B7FA8'] as const;

export type PopupShellColorMode = 'light' | 'dark';

export const popupShellColors = {
  light: {
    headerTitle: '#FFFFFF',
    closeButton: {
      background: 'rgba(255, 255, 255, 0.22)',
      border: 'rgba(255, 255, 255, 0.35)',
      icon: '#FFFFFF',
    },
    tab: {
      inactiveBackground: '#F3F4F6',
      inactiveText: '#000000',
      inactiveBorder: '#E5E7EB',
      activeBackground: 'rgba(255, 255, 255, 0.92)',
      activeBorder: '#8B5CF6',
      activeText: '#8B5CF6',
    },
    body: {
      background: '#FFFFFF',
      backgroundAlt: '#FAFBFC',
    },
    backdrop: 'rgba(15, 27, 51, 0.16)',
    footerBorder: 'rgba(110, 160, 255, 0.16)',
    subtitleBar: {
      background: 'rgba(255, 255, 255, 0.42)',
      border: 'rgba(110, 160, 255, 0.14)',
      text: 'rgba(55, 65, 81, 0.92)',
    },
  },
  dark: {
    headerTitle: '#FFFFFF',
    closeButton: {
      background: 'rgba(255, 255, 255, 0.22)',
      border: 'rgba(255, 255, 255, 0.35)',
      icon: '#FFFFFF',
    },
    tab: {
      inactiveBackground: '#F3F4F6',
      inactiveText: '#000000',
      inactiveBorder: '#E5E7EB',
      activeBackground: 'rgba(255, 255, 255, 0.92)',
      activeBorder: '#8B5CF6',
      activeText: '#8B5CF6',
    },
    body: {
      background: '#FFFFFF',
      backgroundAlt: '#FAFBFC',
    },
    backdrop: 'rgba(15, 27, 51, 0.16)',
    footerBorder: 'rgba(110, 160, 255, 0.16)',
    subtitleBar: {
      background: 'rgba(255, 255, 255, 0.42)',
      border: 'rgba(110, 160, 255, 0.14)',
      text: 'rgba(55, 65, 81, 0.92)',
    },
  },
} as const;

export const popupShellLayout = {
  borderRadius: 22,
  maxWidthDefault: 560,
  minWidthDefault: 320,
  maxHeightRatioDefault: 0.92,
  closeButtonSize: 36,
  shadowWebLight:
    '0 24px 64px rgba(70, 110, 170, 0.18), 0 8px 24px rgba(138, 112, 245, 0.12)',
  shadowWebDark:
    '0 24px 64px rgba(70, 110, 170, 0.18), 0 8px 24px rgba(138, 112, 245, 0.12)',
  headerGlowWebLight: '0 0 20px rgba(232, 93, 162, 0.22), 0 0 8px rgba(138, 112, 245, 0.18)',
  headerGlowWebDark: '0 0 20px rgba(196, 75, 168, 0.28), 0 0 8px rgba(107, 78, 170, 0.22)',
} as const;

export function resolvePopupShellHeaderGradient(
  mode: PopupShellColorMode = 'light',
): readonly [string, ...string[]] {
  return mode === 'light' ? popupShellHeaderGradientLight : popupShellHeaderGradientDark;
}

export function resolvePopupShellColors(mode: PopupShellColorMode = 'light') {
  return popupShellColors[mode];
}
