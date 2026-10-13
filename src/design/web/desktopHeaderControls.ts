/** Shared surface for the desktop header's text size, status and app controls. */
export const desktopHeaderControl = {
  minHeight: 46,
  borderRadius: 15,
  borderWidth: 1,
  borderColor: 'rgba(139,211,255,0.36)',
  backgroundColor: 'rgba(8,29,59,0.72)',
} as const;

export const desktopHeaderControlColors = {
  text: '#F3FCFF',
  accent: '#8FE4FF',
  muted: '#BCD4EC',
} as const;
