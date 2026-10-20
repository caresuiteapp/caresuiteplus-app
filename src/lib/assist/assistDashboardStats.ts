import type { AssistDashboardStats } from '@/types/modules/assist';
import { buildAssistWorkspaceKpis } from '@/lib/assist/assistDashboardWorkspace';

export type AssistDashboardKpi = {
  id: string;
  label: string;
  value: string;
  subValue?: string;
  icon?: string;
  accentColor?: string;
  variant?: 'glass' | 'light';
  /** Route path — navigation handled by screen, not this module. */
  navigationTarget?: string;
};

/** Maps workspace KPIs to legacy Assist dashboard KPI shape. */
export function buildAssistDashboardKpis(stats: AssistDashboardStats): AssistDashboardKpi[] {
  return buildAssistWorkspaceKpis(stats).map((kpi) => ({
    id: kpi.id,
    label: kpi.label,
    value: String(kpi.value),
    subValue: kpi.subValue,
    icon: kpi.icon,
    accentColor: kpi.accentColor,
    variant: 'light' as const,
    navigationTarget: kpi.route,
  }));
}
