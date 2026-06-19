/**
 * Aurora-glass surface tokens for desktop web (PlatformShell + GlobalAnimatedBackground).
 * Page roots stay transparent; panels/cards/modals use these rgba + border values.
 */
export const glass = {
  page: 'transparent',
  panel: 'rgba(23,27,34,0.65)',
  card: 'rgba(23,27,34,0.72)',
  elevated: 'rgba(30,35,48,0.82)',
  modal: 'rgba(16,24,39,0.88)',
  input: 'rgba(26,32,42,0.75)',
  listItem: 'rgba(255,255,255,0.04)',
  border: 'rgba(255,255,255,0.10)',
  borderStrong: 'rgba(255,255,255,0.14)',
  innerBorder: 'rgba(255,255,255,0.06)',
  blur: {
    light: 8,
    medium: 16,
    heavy: 24,
  },
} as const;

export type GlassTokens = typeof glass;
