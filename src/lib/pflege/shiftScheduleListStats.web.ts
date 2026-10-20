import type { ShiftScheduleListItem } from './shiftScheduleDemo';
import {woundUuid} from './woundCareDomain';
import { legacyColorsFromPalette, type ColorMode } from '@/design/tokens/themeBridge';

export type ShiftScheduleListKpi = {
  id: string;
  label: string;
  value: string;
  subValue?: string;
  icon?: string;
  accentColor?: string;
};

/** Web/Desktop counts of the supplied list only. Explicit saved plan confirmation is neither actual
 * work nor clinical completion. Missing employee FKs stay unknown; names are historical snapshots. */
export function buildShiftScheduleListKpis(items: ShiftScheduleListItem[], mode: ColorMode = 'dark'): ShiftScheduleListKpi[]  {
  const colors = legacyColorsFromPalette(mode);
  const confirmed = items.filter((item) => item.status === 'bestaetigt').length;
  const employeeIds = new Set<string>();
  let unresolvedAssignments = 0;
  for (const item of items) {
    if (woundUuid(item.employeeId)) employeeIds.add(item.employeeId.toLowerCase());
    else unresolvedAssignments++;
  }
  const locations = new Set(items.map((item) => item.location)).size;

  return [
    {
      id: 'total',
      label: 'Schichten',
      value: String(items.length),
      subValue: 'Im gelieferten Lesestand',
      icon: '📅',
      accentColor: colors.violet,
    },
    {
      id: 'active',
      label: 'Bestätigt',
      value: String(confirmed),
      subValue: `${employeeIds.size} zugeordnete Mitarbeitende`,
      icon: '✅',
      accentColor: colors.success,
    },
    {
      id: 'unresolved_assignments',
      label: 'Zuordnung ungeklärt',
      value: String(unresolvedAssignments),
      subValue: unresolvedAssignments === 1 ? 'Eine Schichtzuordnung' : 'Schichtzuordnungen',
      icon: '👤',
      accentColor: colors.orange,
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
