export const careEffects = {
  glass: {
    blur: { light: 8, medium: 16, heavy: 24 },
    opacity: { panel: 0.72, overlay: 0.55, rim: 0.14, modal: 0.92 },
    border: 'rgba(255,255,255,0.10)',
    background: 'rgba(23,27,34,0.65)',
    /** Modal shell — nearly opaque dark navy; blur hints at glass without showing page content. */
    modalBackground: 'rgba(11, 14, 22, 0.92)',
    modalBackgroundLight: 'rgba(248, 250, 252, 0.94)',
    modalBorder: 'rgba(255,255,255,0.14)',
    modalBorderLight: 'rgba(15, 23, 42, 0.12)',
    overlayDark: 'rgba(4, 8, 24, 0.78)',
    overlayLight: 'rgba(7, 18, 42, 0.55)',
  },
  sheen: {
    height: 1,
    rimHeight: 2,
    opacity: { subtle: 0.12, default: 0.18, strong: 0.28 },
    color: 'rgba(255,255,255,0.12)',
  },
  elevation: {
    card: {
      shadowColor: '#000',
      shadowOpacity: 0.28,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
      elevation: 8,
    },
    floating: {
      shadowColor: '#000',
      shadowOpacity: 0.42,
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
    soft: 'rgba(255,255,255,0.08)',
    strong: 'rgba(255,255,255,0.14)',
    brand: 'rgba(255,122,26,0.34)',
  },
} as const;
