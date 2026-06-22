import { Pressable } from 'react-native';
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
  navigationTarget?: string;
};

export function dashboardKpisToGridItems(
  kpis: DashboardKpiLike[],
  onKpiPress?: (navigationTarget: string) => void,
): KpiGridItem[] {
  return kpis.map((kpi) => {
    const card = (
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
    );

    return {
      id: kpi.id,
      node:
        kpi.navigationTarget && onKpiPress ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => onKpiPress(kpi.navigationTarget!)}
          >
            {card}
          </Pressable>
        ) : (
          card
        ),
    };
  });
}
