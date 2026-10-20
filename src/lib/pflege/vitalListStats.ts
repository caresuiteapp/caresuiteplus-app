import type { VitalReadingListItem } from '@/types/modules/pflege';

export type VitalListKpi = {
  id: string;
  label: string;
  value: number;
  subValue?: string;
  icon: string;
  accentColor: string;
};

function isToday(iso: string): boolean {
  const date = new Date(iso);
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

export function buildVitalListKpis(items: VitalReadingListItem[]): VitalListKpi[] {
  const due = items.filter((r) => r.isDue).length;
  const alerts = items.filter((r) => r.isAlert).length;
  const today = items.filter((r) => isToday(r.measuredAt)).length;

  return [
    {
      id: 'vitals-kpi-due',
      label: 'Fällig',
      value: due,
      subValue: due > 0 ? 'Messung überfällig' : 'Keine fällig',
      icon: '⏰',
      accentColor: '#FF9500',
    },
    {
      id: 'vitals-kpi-alerts',
      label: 'Auffällig',
      value: alerts,
      subValue: alerts > 0 ? 'Werte prüfen' : 'Keine Auffälligkeiten',
      icon: '⚠️',
      accentColor: '#FF4D6A',
    },
    {
      id: 'vitals-kpi-today',
      label: 'Heute',
      value: today,
      subValue: `${items.length} gesamt`,
      icon: '❤️',
      accentColor: '#4ADE80',
    },
  ];
}
