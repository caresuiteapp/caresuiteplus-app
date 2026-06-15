import type { CourseDetail } from '@/types/modules/akademie';
import { legacyColorsFromPalette, type ColorMode } from '@/design/tokens/themeBridge';

export type CourseDetailKpi = {
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

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} Min.`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest > 0 ? `${hours}h ${rest}m` : `${hours}h`;
}

export function buildCourseDetailKpis(course: CourseDetail, mode: ColorMode = 'dark'): CourseDetailKpi[]  {
  const colors = legacyColorsFromPalette(mode);
  const startKpi: CourseDetailKpi = course.startsAt
    ? (() => {
        const startAt = new Date(course.startsAt!);
        const daysUntil = daysBetween(new Date(), startAt);
        return {
          id: 'start',
          label: 'Start in',
          value: String(daysUntil),
          subValue: daysUntil === 0 ? 'Heute' : daysUntil === 1 ? 'Tag' : 'Tage',
          icon: '📅',
          accentColor: daysUntil <= 7 ? colors.orange : colors.cyan,
        };
      })()
    : {
        id: 'start',
        label: 'Start',
        value: '—',
        subValue: 'Noch nicht geplant',
        icon: '📅',
        accentColor: colors.textMuted,
      };

  return [
    {
      id: 'duration',
      label: 'Dauer',
      value: formatDuration(course.durationMinutes),
      icon: '⏱️',
      accentColor: colors.violet,
    },
    {
      id: 'enrollments',
      label: 'Teilnehmer',
      value: String(course.enrollmentCount),
      subValue: course.enrollmentCount === 1 ? 'Einschreibung' : 'Einschreibungen',
      icon: '👥',
      accentColor: colors.cyan,
    },
    {
      id: 'completion',
      label: 'Abschlussquote',
      value: `${course.completionRatePercent} %`,
      icon: '🎓',
      accentColor:
        course.completionRatePercent >= 80
          ? colors.success
          : course.completionRatePercent >= 50
            ? colors.orange
            : colors.textMuted,
    },
    startKpi,
  ];
}
