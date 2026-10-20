import type { EnrollmentDetail } from '@/types/modules/akademie';
import { legacyColorsFromPalette, type ColorMode } from '@/design/tokens/themeBridge';

export type EnrollmentDetailKpi = {
  id: string;
  label: string;
  value: string;
  subValue?: string;
  icon?: string;
  accentColor?: string;
};

export function buildEnrollmentDetailKpis(enrollment: EnrollmentDetail, mode: ColorMode = 'dark'): EnrollmentDetailKpi[]  {
  const colors = legacyColorsFromPalette(mode);
  return [
    {
      id: 'progress',
      label: 'Fortschritt',
      value: `${enrollment.progressPercent} %`,
      subValue: enrollment.status,
      icon: '📈',
      accentColor: '#FFD166',
    },
    {
      id: 'lessons',
      label: 'Lektionen',
      value: String(enrollment.lessonCount),
      subValue: enrollment.instructorName,
      icon: '📚',
      accentColor: colors.cyan,
    },
    {
      id: 'course',
      label: 'Kurs',
      value: enrollment.courseTitle.split(' ').slice(0, 2).join(' '),
      subValue: enrollment.courseTitle,
      icon: '🎓',
      accentColor: colors.violet,
    },
  ];
}
