import type { ResidentListItem } from '@/types/modules/stationaer';
import { isNewAdmission, isResidentActive } from './residentUtils';

export type ResidentListKpi = {
  id: string;
  label: string;
  value: number;
  subValue?: string;
  icon: string;
  accentColor: string;
};

export function buildResidentListKpis(items: ResidentListItem[]): ResidentListKpi[] {
  const active = items.filter((item) => item.status === 'aktiv').length;
  const newAdmissions = items.filter((item) => isNewAdmission(item.admissionDate)).length;
  const inProgress = items.filter((item) => item.status === 'in_bearbeitung').length;

  return [
    {
      id: 'residents-kpi-active',
      label: 'Aktiv',
      value: active,
      subValue: `${items.filter((item) => isResidentActive(item.status)).length} in Betreuung`,
      icon: '🏠',
      accentColor: '#4ADE80',
    },
    {
      id: 'residents-kpi-new',
      label: 'Neuaufnahmen',
      value: newAdmissions,
      subValue: 'Letzte 30 Tage',
      icon: '✨',
      accentColor: '#A78BFA',
    },
    {
      id: 'residents-kpi-handover',
      label: 'Übergabe',
      value: inProgress,
      subValue: inProgress > 0 ? 'In Bearbeitung' : 'Alles erledigt',
      icon: '📋',
      accentColor: '#FF9500',
    },
  ];
}
