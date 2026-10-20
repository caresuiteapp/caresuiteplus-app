import type { CounselingCaseDetail } from '@/types/modules/beratung';
import { legacyColorsFromPalette, type ColorMode } from '@/design/tokens/themeBridge';

export type CaseDetailKpi = {
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

export function buildCaseDetailKpis(counselingCase: CounselingCaseDetail, mode: ColorMode = 'dark'): CaseDetailKpi[]  {
  const colors = legacyColorsFromPalette(mode);
  const openedAt = new Date(counselingCase.openedAt);
  const daysOpen = daysBetween(openedAt, new Date());

  const appointmentKpi: CaseDetailKpi = counselingCase.nextAppointmentAt
    ? (() => {
        const nextAt = new Date(counselingCase.nextAppointmentAt!);
        const daysUntil = daysBetween(new Date(), nextAt);
        return {
          id: 'next-appointment',
          label: 'Nächster Termin',
          value: String(daysUntil),
          subValue: daysUntil === 0 ? 'Heute' : daysUntil === 1 ? 'Tag' : 'Tage',
          icon: '📅',
          accentColor: daysUntil <= 3 ? colors.orange : colors.cyan,
        };
      })()
    : {
        id: 'next-appointment',
        label: 'Nächster Termin',
        value: '—',
        subValue: 'Kein Termin geplant',
        icon: '📅',
        accentColor: colors.textMuted,
      };

  return [
    {
      id: 'days-open',
      label: 'Offen seit',
      value: String(daysOpen),
      subValue: daysOpen === 1 ? 'Tag' : 'Tage',
      icon: '📋',
      accentColor: colors.cyan,
    },
    appointmentKpi,
    {
      id: 'category',
      label: 'Kategorie',
      value: counselingCase.category,
      icon: '🏷️',
      accentColor: colors.violet,
    },
  ];
}
