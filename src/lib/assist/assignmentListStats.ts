import type { AssignmentListItem } from '@/types/modules/assist';
import { isAssignmentToday, isAssignmentUpcoming } from '@/data/demo/assistAssignments';

export type AssignmentListKpi = {
  id: string;
  label: string;
  value: number;
  subValue?: string;
  icon: string;
  accentColor: string;
};

export function buildAssignmentListKpis(items: AssignmentListItem[]): AssignmentListKpi[] {
  const today = items.filter((item) => isAssignmentToday(item.scheduledStart)).length;
  const active = items.filter(
    (item) => item.status === 'aktiv' || item.status === 'in_bearbeitung',
  ).length;
  const upcoming = items.filter((item) => isAssignmentUpcoming(item.scheduledStart)).length;
  const errors = items.filter((item) => item.status === 'fehlerhaft').length;

  return [
    {
      id: 'assignments-kpi-today',
      label: 'Heute',
      value: today,
      subValue: today > 0 ? 'Einsätze heute' : 'Keine heute',
      icon: '📅',
      accentColor: '#FF9500',
    },
    {
      id: 'assignments-kpi-active',
      label: 'Aktiv',
      value: active,
      subValue: `${items.length} gesamt`,
      icon: '🚀',
      accentColor: '#4ADE80',
    },
    {
      id: 'assignments-kpi-upcoming',
      label: 'Anstehend',
      value: upcoming,
      subValue: errors > 0 ? `${errors} fehlerhaft` : 'Planung',
      icon: '🗓️',
      accentColor: '#62F3FF',
    },
  ];
}
