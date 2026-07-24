import { spatialCareColors } from '@/design/tokens/spatialCareSuite';
import { systemLiquidGlass } from '@/design/tokens/systemLiquidGlass';

export const PLATFORM_COLORS = {
  bg: systemLiquidGlass.page,
  sidebar: systemLiquidGlass.panelStrong,
  panel: systemLiquidGlass.panel,
  panelSoft: systemLiquidGlass.card,
  border: systemLiquidGlass.border,
  borderStrong: systemLiquidGlass.borderStrong,
  text: systemLiquidGlass.text.primary,
  muted: systemLiquidGlass.text.secondary,
  accent: spatialCareColors.cyanLight,
  accentSoft: systemLiquidGlass.chipActive,
  warning: '#F59E0B',
  danger: '#EF4444',
  success: '#16A34A',
} as const;
