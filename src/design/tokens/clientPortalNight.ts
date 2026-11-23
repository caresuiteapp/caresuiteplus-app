/** Approved client portal palette, shared by native and web. */
export const clientPortalNight = {
  backdrop: '#17374D', backdropStrong: '#102238',
  surface: 'rgba(235,246,255,0.095)', surfaceRaised: 'rgba(235,246,255,0.115)',
  surfaceSoft: '#203E54', surfaceMuted: '#244A61', surfaceStrong: '#BCEEFF', surfaceStrongDeep: '#A4DFF4',
  header: '#1D384F', rail: '#152B40', control: '#173247', dialog: '#20394F',
  border: 'rgba(213,235,252,0.24)', borderSoft: 'rgba(213,235,252,0.18)',
  borderStrong: 'rgba(188,238,255,0.55)', innerBorder: 'rgba(213,235,252,0.12)',
  text: { primary: '#F5F9FF', secondary: '#D9E9F5', muted: '#C6DFED', onStrong: '#102B40', onStrongMuted: '#284B60' },
  accent: { blue: '#BCEEFF', blueDark: '#BCEEFF', violet: '#DDD3FF', teal: '#B3F0DF', pink: '#FFD4E7', amber: '#FFE5B8', success: '#B3F0DF', danger: '#FFE1E9' },
  radius: { shell: 24, panel: 22, card: 17, control: 12 },
  shadow: { panel: 'none', card: 'none', floating: '0 24px 64px rgba(0,12,30,0.35)' },
} as const;

export const clientPortalNightGlass = {
  panel: clientPortalNight.surface, card: clientPortalNight.surface, sidebar: clientPortalNight.rail,
  elevated: clientPortalNight.dialog, modal: clientPortalNight.dialog, input: clientPortalNight.control,
  chip: clientPortalNight.control, chipActive: clientPortalNight.surfaceMuted, table: clientPortalNight.surface,
  rowHover: 'rgba(188,238,255,0.09)', rowAlt: 'rgba(188,238,255,0.035)',
  rowSelected: clientPortalNight.surfaceMuted, header: clientPortalNight.surfaceSoft,
  listItem: 'rgba(188,238,255,0.035)', border: clientPortalNight.borderSoft,
  borderAccent: clientPortalNight.borderStrong, borderStrong: clientPortalNight.border,
  innerBorder: clientPortalNight.innerBorder, blur: { light: 0, medium: 0, heavy: 0 },
  text: clientPortalNight.text, shadow: 'none', shadowInset: 'none', saturate: 100,
} as const;
