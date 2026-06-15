import type { AkademieDashboardStats } from '@/types/modules/akademie';
import { legacyColorsFromPalette, type ColorMode } from '@/design/tokens/themeBridge';

export type AkademieDashboardKpi = {
  id: string;
  label: string;
  value: string;
  subValue?: string;
  icon?: string;
  accentColor?: string;
};

export function buildAkademieDashboardKpis(stats: AkademieDashboardStats, mode: ColorMode = 'dark'): AkademieDashboardKpi[]  {
  const colors = legacyColorsFromPalette(mode);
  return [
    {
      id: 'active-courses',
      label: 'Aktive Kurse',
      value: String(stats.activeCoursesCount),
      subValue: `${stats.totalCourses} gesamt`,
      icon: '🎓',
      accentColor: '#FFD166',
    },
    {
      id: 'mandatory',
      label: 'Pflicht',
      value: String(stats.mandatoryCount),
      subValue: 'Pflichtschulungen',
      icon: '⚠️',
      accentColor: colors.warning,
    },
    {
      id: 'enrollments',
      label: 'Teilnahmen',
      value: String(stats.totalEnrollments),
      subValue: `${stats.upcomingStartsCount} anstehend`,
      icon: '👥',
      accentColor: colors.cyan,
    },
  ];
}
