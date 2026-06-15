import type { CounselingListItem } from '@/types/modules/beratung';
import {
  isAppointmentUpcoming,
  isCaseClosedThisMonth,
  isCaseOpen,
} from './counselingCases';

export type CaseListKpi = {
  id: string;
  label: string;
  value: number;
  subValue?: string;
  icon: string;
  accentColor: string;
};

export function buildCaseListKpis(items: CounselingListItem[]): CaseListKpi[] {
  const open = items.filter((item) => isCaseOpen(item.status)).length;
  const active = items.filter((item) => item.status === 'aktiv').length;
  const upcoming = items.filter((item) => isAppointmentUpcoming(item.nextAppointmentAt)).length;
  const closedMonth = items.filter((item) =>
    isCaseClosedThisMonth(item.status === 'abgeschlossen' ? item.updatedAt : null),
  ).length;

  return [
    {
      id: 'cases-kpi-open',
      label: 'Offen',
      value: open,
      subValue: `${items.length} gesamt`,
      icon: '📋',
      accentColor: '#FF9500',
    },
    {
      id: 'cases-kpi-active',
      label: 'Aktiv',
      value: active,
      subValue: active > 0 ? 'In Bearbeitung' : 'Keine aktiv',
      icon: '💬',
      accentColor: '#4ADE80',
    },
    {
      id: 'cases-kpi-appointments',
      label: 'Termine',
      value: upcoming,
      subValue: `${closedMonth} abgeschlossen (Monat)`,
      icon: '📅',
      accentColor: '#62F3FF',
    },
  ];
}
