import type { CarePlanListItem } from '@/types/modules/pflege';

export type CarePlanListKpi = {
  id: string;
  label: string;
  value: number;
  subValue?: string;
  icon: string;
  accentColor: string;
};

export function buildCarePlanListKpis(items: CarePlanListItem[]): CarePlanListKpi[] {
  const active = items.filter((p) => p.status === 'aktiv').length;
  const inProgress = items.filter((p) => p.status === 'in_bearbeitung').length;
  const alerts = items.reduce((sum, p) => sum + p.alertCount, 0);
  const drafts = items.filter((p) => p.status === 'entwurf').length;

  return [
    {
      id: 'careplans-kpi-active',
      label: 'Aktiv',
      value: active,
      subValue: `${items.length} gesamt`,
      icon: '💚',
      accentColor: '#4ADE80',
    },
    {
      id: 'careplans-kpi-review',
      label: 'In Prüfung',
      value: inProgress,
      subValue: alerts > 0 ? `${alerts} Hinweise` : 'Keine Hinweise',
      icon: '📋',
      accentColor: '#FF9500',
    },
    {
      id: 'careplans-kpi-drafts',
      label: 'Entwürfe',
      value: drafts,
      subValue: drafts > 0 ? 'Planung offen' : 'Keine Entwürfe',
      icon: '✏️',
      accentColor: '#FFD166',
    },
  ];
}
