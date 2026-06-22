import type { EmployeeListItem } from '@/types/modules/employeeList';

export type EmployeeListKpi = {
  id: string;
  label: string;
  value: number;
  subValue?: string;
  icon: string;
  accentColor: string;
};

export function buildEmployeeListKpis(items: EmployeeListItem[]): EmployeeListKpi[] {
  const active = items.filter((e) => e.status === 'aktiv').length;
  const onboarding = items.filter((e) => e.status === 'in_bearbeitung').length;
  const drafts = items.filter((e) => e.status === 'entwurf').length;
  const locked = items.filter((e) => e.status === 'gesperrt').length;

  return [
    {
      id: 'employees-kpi-total',
      label: 'Gesamt',
      value: items.length,
      subValue: `${active} aktiv`,
      icon: '👤',
      accentColor: '#62F3FF',
    },
    {
      id: 'employees-kpi-onboarding',
      label: 'Onboarding',
      value: onboarding,
      subValue: onboarding > 0 ? 'Stammdaten prüfen' : 'Keine offenen',
      icon: '📋',
      accentColor: '#FF9500',
    },
    {
      id: 'employees-kpi-drafts',
      label: 'Entwürfe',
      value: drafts,
      subValue: locked > 0 ? `${locked} gesperrt` : undefined,
      icon: '✏️',
      accentColor: '#FFD166',
    },
  ];
}
