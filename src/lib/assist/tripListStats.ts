import type { TripLogListItem } from '@/types/modules/assist';

export type TripListKpi = {
  id: string;
  label: string;
  value: number;
  subValue?: string;
  icon: string;
  accentColor: string;
};

function isToday(iso: string): boolean {
  const date = new Date(iso);
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

export function buildTripListKpis(items: TripLogListItem[]): TripListKpi[] {
  const active = items.filter(
    (item) => item.status === 'in_bearbeitung' || item.endedAt === null,
  ).length;
  const completed = items.filter((item) => item.status === 'abgeschlossen').length;
  const today = items.filter((item) => isToday(item.startedAt)).length;
  const totalKm = items.reduce((sum, item) => sum + (item.distanceKm ?? 0), 0);

  return [
    {
      id: 'trips-kpi-active',
      label: 'Unterwegs',
      value: active,
      subValue: active > 0 ? 'Live-Fahrten' : 'Keine aktiv',
      icon: '🚗',
      accentColor: '#FF9500',
    },
    {
      id: 'trips-kpi-today',
      label: 'Heute',
      value: today,
      subValue: `${items.length} gesamt`,
      icon: '📅',
      accentColor: '#4ADE80',
    },
    {
      id: 'trips-kpi-distance',
      label: 'Kilometer',
      value: Math.round(totalKm * 10) / 10,
      subValue: `${completed} abgeschlossen`,
      icon: '🛣️',
      accentColor: '#62F3FF',
    },
  ];
}
