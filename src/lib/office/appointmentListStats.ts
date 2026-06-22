import type { AppointmentListItem } from '@/types/modules/appointmentList';

export type AppointmentListKpi = {
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
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

function isUpcoming(iso: string): boolean {
  return new Date(iso) > new Date();
}

export function buildAppointmentListKpis(items: AppointmentListItem[]): AppointmentListKpi[] {
  const today = items.filter((a) => isToday(a.startsAt));
  const upcoming = items.filter((a) => isUpcoming(a.startsAt) && a.status !== 'abgeschlossen');
  const drafts = items.filter((a) => a.status === 'entwurf').length;

  return [
    {
      id: 'appointments-kpi-today',
      label: 'Heute',
      value: today.length,
      subValue: today.length > 0 ? 'Termine heute' : 'Keine heute',
      icon: '📅',
      accentColor: '#62F3FF',
    },
    {
      id: 'appointments-kpi-upcoming',
      label: 'Anstehend',
      value: upcoming.length,
      subValue: `${items.length} gesamt`,
      icon: '🕐',
      accentColor: '#A78BFA',
    },
    {
      id: 'appointments-kpi-drafts',
      label: 'Entwürfe',
      value: drafts,
      subValue: drafts > 0 ? 'Noch planen' : 'Keine Entwürfe',
      icon: '✏️',
      accentColor: '#FFD166',
    },
  ];
}
