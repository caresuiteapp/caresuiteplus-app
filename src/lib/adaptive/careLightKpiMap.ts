import type { CareLightKpiItem } from '@/components/layout/CareLightModuleDashboard';

type KpiSource = {
  id: string;
  label: string;
  value: string;
  subValue?: string;
  icon?: string;
  accentColor?: string;
};

export function mapToCareLightKpis(kpis: KpiSource[]): CareLightKpiItem[] {
  return kpis.map((kpi) => ({
    id: kpi.id,
    label: kpi.label,
    value: kpi.value,
    subValue: kpi.subValue,
    icon: kpi.icon,
    accentColor: kpi.accentColor,
  }));
}
