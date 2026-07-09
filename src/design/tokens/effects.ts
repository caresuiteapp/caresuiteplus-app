import { careSuiteModalScrim, careSuiteModalScrimStrong } from '@/design/tokens/lightTheme';

export const careEffects = {
  glass: {
    blur: { light: 8, medium: 16, heavy: 24 },
    opacity: { panel: 0.72, overlay: 0.55, rim: 0.14, modal: 0.92 },
    border: 'rgba(7,18,42,0.10)',
    background: 'rgba(255,255,255,0.78)',
    /** Modal shell — light milchglas; no dark navy panels. */
    modalBackground: 'rgba(248, 250, 252, 0.94)',
    modalBackgroundLight: 'rgba(248, 250, 252, 0.94)',
    modalBorder: 'rgba(15, 23, 42, 0.12)',
    modalBorderLight: 'rgba(15, 23, 42, 0.12)',
    overlayDark: careSuiteModalScrimStrong,
    overlayLight: careSuiteModalScrim,
  },
  sheen: {
    height: 1,
    rimHeight: 2,
    opacity: { subtle: 0.12, default: 0.18, strong: 0.28 },
    color: 'rgba(255,255,255,0.55)',
  },
  elevation: {
    card: {
      shadowColor: '#07122A',
      shadowOpacity: 0.12,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
      elevation: 8,
    },
    floating: {
      shadowColor: '#07122A',
      shadowOpacity: 0.18,
      shadowRadius: 28,
      shadowOffset: { width: 0, height: 18 },
      elevation: 18,
    },
    brandGlow: {
      shadowColor: '#FF7A1A',
      shadowOpacity: 0.32,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 10,
    },
  },
  border: {
    soft: 'rgba(7,18,42,0.08)',
    strong: 'rgba(7,18,42,0.14)',
    brand: 'rgba(255,122,26,0.34)',
  },
} as const;
