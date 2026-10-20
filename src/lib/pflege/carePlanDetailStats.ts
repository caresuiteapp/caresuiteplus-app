import type { CarePlanDetail } from '@/types/modules/pflege';
import { legacyColorsFromPalette, type ColorMode } from '@/design/tokens/themeBridge';

export type CarePlanDetailKpi = {
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

export function buildCarePlanDetailKpis(plan: CarePlanDetail, mode: ColorMode = 'dark'): CarePlanDetailKpi[]  {
  const colors = legacyColorsFromPalette(mode);
  const validityKpi: CarePlanDetailKpi = plan.validUntil
    ? (() => {
        const until = new Date(plan.validUntil!);
        const daysLeft = daysBetween(new Date(), until);
        return {
          id: 'validity',
          label: 'Gültigkeit',
          value: String(daysLeft),
          subValue: daysLeft === 1 ? 'Tag verbleibend' : 'Tage verbleibend',
          icon: '📅',
          accentColor: daysLeft <= 14 ? colors.orange : colors.cyan,
        };
      })()
    : {
        id: 'validity',
        label: 'Gültigkeit',
        value: 'Offen',
        subValue: 'Unbefristet',
        icon: '📅',
        accentColor: colors.cyan,
      };

  return [
    {
      id: 'tasks',
      label: 'Maßnahmen',
      value: String(plan.tasks.length),
      subValue: plan.tasks.length === 1 ? 'Aufgabe' : 'Aufgaben',
      icon: '✅',
      accentColor: colors.success,
    },
    {
      id: 'due-vitals',
      label: 'Fällige Vitalwerte',
      value: String(plan.dueVitalsCount),
      subValue: plan.dueVitalsCount > 0 ? 'Messung(en)' : 'Keine fällig',
      icon: '🩺',
      accentColor: plan.dueVitalsCount > 0 ? colors.orange : colors.textMuted,
    },
    validityKpi,
    {
      id: 'care-level',
      label: 'Pflegegrad',
      value: plan.careLevel ?? '—',
      icon: '🏥',
      accentColor: colors.violet,
    },
  ];
}
