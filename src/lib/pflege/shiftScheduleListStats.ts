import type { ShiftScheduleListItem } from './shiftScheduleDemo';
import { legacyColorsFromPalette, type ColorMode } from '@/design/tokens/themeBridge';

export type ShiftScheduleListKpi = {
  id: string;
  label: string;
  value: string;
  subValue?: string;
  icon?: string;
  accentColor?: string;
};

export function buildShiftScheduleListKpis(items: ShiftScheduleListItem[], mode: ColorMode = 'dark'): ShiftScheduleListKpi[]  {
  const colors = legacyColorsFromPalette(mode);
  const active = items.filter((item) => item.status === 'aktiv').length;
  const employees = new Set(items.map((item) => item.employeeName)).size;
  const locations = new Set(items.map((item) => item.location)).size;

  return [
    {
      id: 'total',
      label: 'Schichten',
      value: String(items.length),
      subValue: items.length === 1 ? 'Eintrag' : 'Einträge',
      icon: '📅',
      accentColor: colors.violet,
    },
    {
      id: 'active',
      label: 'Bestätigt',
      value: String(active),
      subValue: `${employees} Mitarbeitende`,
      icon: '✅',
      accentColor: colors.success,
    },
    {
      id: 'locations',
      label: 'Einsatzbereiche',
      value: String(locations),
      subValue: 'Ambulant / Zentrale',
      icon: '📍',
      accentColor: colors.cyan,
    },
  ];
}
