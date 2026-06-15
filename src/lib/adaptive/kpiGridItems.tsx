import { PremiumKpiCard } from '@/components/ui';
import type { KpiGridItem } from '@/components/adaptive/AdaptiveKpiGrid';

export type DashboardKpiLike = {
  id: string;
  label: string;
  value: string;
  subValue?: string;
  icon?: string;
  accentColor?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  pulse?: boolean;
};

export function dashboardKpisToGridItems(kpis: DashboardKpiLike[]): KpiGridItem[] {
  return kpis.map((kpi) => ({
    id: kpi.id,
    node: (
      <PremiumKpiCard
        label={kpi.label}
        value={kpi.value}
        subValue={kpi.subValue}
        icon={kpi.icon}
        accentColor={kpi.accentColor}
        trend={kpi.trend}
        trendValue={kpi.trendValue}
        pulse={kpi.pulse}
      />
    ),
  }));
}
