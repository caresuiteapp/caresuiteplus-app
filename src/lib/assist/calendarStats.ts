import { legacyColorsFromPalette, type ColorMode } from '@/design/tokens/themeBridge';
import type { CalendarDayGroup } from '@/lib/assist/calendarService';

export type CalendarListKpi = {
  id: string;
  label: string;
  value: string;
  subValue?: string;
  icon?: string;
  accentColor?: string;
};

export function buildAssistCalendarKpis(groups: CalendarDayGroup[], mode: ColorMode = 'dark'): CalendarListKpi[]  {
  const colors = legacyColorsFromPalette(mode);
  const assignmentCount = groups.reduce((sum, group) => sum + group.assignments.length, 0);
  const dayCount = groups.length;

  return [
    {
      id: 'assignments',
      label: 'Einsätze',
      value: String(assignmentCount),
      subValue: `${dayCount} Tage`,
      icon: '📋',
      accentColor: colors.amber,
    },
    {
      id: 'days',
      label: 'Tage',
      value: String(dayCount),
      subValue: 'Mit Einsätzen',
      icon: '📅',
      accentColor: colors.violet,
    },
    {
      id: 'avg',
      label: 'Ø pro Tag',
      value: dayCount > 0 ? String(Math.round(assignmentCount / dayCount)) : '—',
      subValue: 'Wochenübersicht',
      icon: '📊',
      accentColor: colors.cyan,
    },
  ];
}
