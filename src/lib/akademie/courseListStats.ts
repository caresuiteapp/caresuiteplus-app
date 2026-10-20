import type { CourseListItem } from '@/types/modules/akademie';
import { isCourseUpcoming } from './courseUtils';

export type CourseListKpi = {
  id: string;
  label: string;
  value: number;
  subValue?: string;
  icon: string;
  accentColor: string;
};

export function buildCourseListKpis(items: CourseListItem[]): CourseListKpi[] {
  const active = items.filter((item) => item.status === 'aktiv').length;
  const mandatory = items.filter((item) => item.isMandatory).length;
  const upcoming = items.filter((item) => isCourseUpcoming(item.startsAt)).length;
  const totalEnrollments = items.reduce((sum, item) => sum + item.enrollmentCount, 0);

  return [
    {
      id: 'courses-kpi-active',
      label: 'Aktiv',
      value: active,
      subValue: `${items.length} gesamt`,
      icon: '📚',
      accentColor: '#4ADE80',
    },
    {
      id: 'courses-kpi-mandatory',
      label: 'Pflicht',
      value: mandatory,
      subValue: mandatory > 0 ? 'Schulungspflicht' : 'Keine Pflichtkurse',
      icon: '⚠️',
      accentColor: '#FFD166',
    },
    {
      id: 'courses-kpi-upcoming',
      label: 'Termine',
      value: upcoming,
      subValue: `${totalEnrollments} Einschreibungen`,
      icon: '📅',
      accentColor: '#62F3FF',
    },
  ];
}
