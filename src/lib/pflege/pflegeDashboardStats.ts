import type { PflegeDashboardStats } from '@/types/modules/pflege';
import { legacyColorsFromPalette, type ColorMode } from '@/design/tokens/themeBridge';
import { buildPflegeWorkspaceKpis } from '@/lib/pflege/pflegeDashboardWorkspace';

export type PflegeDashboardKpi = {
  id: string;
  label: string;
  value: string;
  subValue?: string;
  icon?: string;
  accentColor?: string;
  route?: string;
};

/** Maps workspace stats to 12 ambulatory-care KPI cards. */
export function buildPflegeDashboardKpis(
  stats: PflegeDashboardStats,
  mode: ColorMode = 'dark',
): PflegeDashboardKpi[] {
  const colors = legacyColorsFromPalette(mode);
  return buildPflegeWorkspaceKpis(stats).map((kpi) => ({
    id: kpi.id,
    label: kpi.label,
    value: String(kpi.value),
    subValue: kpi.subValue,
    icon: kpi.icon,
    accentColor: kpi.accentColor ?? colors.success,
    route: kpi.route,
  }));
}
