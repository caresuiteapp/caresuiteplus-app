import { SYSTEM_LIQUID_COLORS, systemLiquidGlass } from '@/design/tokens/systemLiquidGlass';

export const PLATFORM_COLORS = {
  bg: systemLiquidGlass.page,
  sidebar: systemLiquidGlass.panelStrong,
  panel: systemLiquidGlass.card,
  panelSoft: systemLiquidGlass.panel,
  border: systemLiquidGlass.border,
  borderStrong: systemLiquidGlass.borderStrong,
  text: systemLiquidGlass.text.primary,
  muted: systemLiquidGlass.text.muted,
  accent: SYSTEM_LIQUID_COLORS.electricBlue,
  accentSoft: systemLiquidGlass.chipActive,
  warning: '#F59E0B',
  danger: '#EF4444',
  success: '#16A34A',
} as const;
