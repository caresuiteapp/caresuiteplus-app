import { portalPremium } from '@/design/tokens/portalPremium';

export const PLATFORM_COLORS = {
  bg: portalPremium.backdrop,
  sidebar: portalPremium.backdropStrong,
  panel: portalPremium.surfaceRaised,
  panelSoft: portalPremium.surfaceSoft,
  border: portalPremium.borderSoft,
  borderStrong: portalPremium.borderStrong,
  text: portalPremium.text.primary,
  muted: portalPremium.text.secondary,
  sidebarText: portalPremium.text.onStrong,
  sidebarMuted: portalPremium.text.onStrongMuted,
  accent: portalPremium.accent.blue,
  accentSoft: 'rgba(5,108,232,0.24)',
  warning: '#F59E0B',
  danger: '#EF4444',
  success: '#16A34A',
} as const;
