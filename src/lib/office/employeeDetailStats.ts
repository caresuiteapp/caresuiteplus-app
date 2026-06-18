import type { EmployeeDetail } from '@/types/modules/employeeDetail';
import { legacyColorsFromPalette, type ColorMode } from '@/design/tokens/themeBridge';
import {
  resolveEmployeeDepartmentLabel,
  resolveEmployeeRoleLabel,
} from './employeeCatalogLabels';

export type EmployeeDetailKpi = {
  id: string;
  label: string;
  value: string;
  subValue?: string;
  icon?: string;
  accentColor?: string;
};

function daysBetween(from: Date, to: Date): number {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / 86_400_000));
}

function contactChannelCount(employee: EmployeeDetail): number {
  let count = 0;
  if (employee.email?.trim()) count += 1;
  if (employee.phone?.trim()) count += 1;
  return count;
}

export function buildEmployeeDetailSubtitle(employee: EmployeeDetail, mode: ColorMode = 'dark'): string  {
  const colors = legacyColorsFromPalette(mode);
  if (employee.notes) return employee.notes;
  if (employee.status === 'entwurf') return 'Onboarding noch nicht abgeschlossen.';
  if (employee.status === 'gesperrt') return 'Zugang vorübergehend gesperrt — HR kontaktieren.';
  if (employee.jobTitle?.trim() && employee.department?.trim()) {
    return `${resolveEmployeeRoleLabel(employee.jobTitle)} · ${resolveEmployeeDepartmentLabel(employee.department)}`;
  }
  if (employee.jobTitle?.trim()) return resolveEmployeeRoleLabel(employee.jobTitle);
  if (employee.department?.trim()) return resolveEmployeeDepartmentLabel(employee.department);
  return 'Mitarbeitenden-Stammdaten';
}

export function buildEmployeeDetailKpis(employee: EmployeeDetail, mode: ColorMode = 'dark'): EmployeeDetailKpi[]  {
  const colors = legacyColorsFromPalette(mode);
  const tenureKpi: EmployeeDetailKpi = employee.startDate
    ? (() => {
        const startAt = new Date(employee.startDate!);
        const days = daysBetween(startAt, new Date());
        return {
          id: 'tenure',
          label: 'Betriebszugehörigkeit',
          value: String(days),
          subValue: days === 1 ? 'Tag' : 'Tage',
          icon: '📅',
          accentColor: colors.cyan,
        };
      })()
    : {
        id: 'tenure',
        label: 'Eintritt',
        value: '—',
        subValue: 'Noch nicht hinterlegt',
        icon: '📅',
        accentColor: colors.textMuted,
      };

  const channels = contactChannelCount(employee);

  return [
    tenureKpi,
    {
      id: 'department',
      label: 'Abteilung',
      value: resolveEmployeeDepartmentLabel(employee.department),
      icon: '🏢',
      accentColor: colors.orange,
    },
    {
      id: 'contact',
      label: 'Kontakt',
      value: String(channels),
      subValue: channels === 1 ? 'Kanal' : 'Kanäle',
      icon: '📞',
      accentColor: channels >= 2 ? colors.success : channels === 1 ? colors.orange : colors.textMuted,
    },
    {
      id: 'updated',
      label: 'Aktualisiert',
      value: String(daysBetween(new Date(employee.updatedAt), new Date())),
      subValue: 'Tage her',
      icon: '🔄',
      accentColor: colors.violet,
    },
  ];
}
