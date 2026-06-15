import type { ResidentDetail } from '@/types/modules/stationaer';
import { legacyColorsFromPalette, type ColorMode } from '@/design/tokens/themeBridge';

export type ResidentDetailKpi = {
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

export function buildResidentDetailKpis(resident: ResidentDetail, mode: ColorMode = 'dark'): ResidentDetailKpi[]  {
  const colors = legacyColorsFromPalette(mode);
  const admissionAt = new Date(resident.admissionDate);
  const daysStay = daysBetween(admissionAt, new Date());

  return [
    {
      id: 'stay-days',
      label: 'Aufenthalt',
      value: String(daysStay),
      subValue: daysStay === 1 ? 'Tag' : 'Tage',
      icon: '🏠',
      accentColor: colors.violet,
    },
    {
      id: 'room',
      label: 'Zimmer',
      value: resident.roomName,
      subValue: resident.wing ?? '—',
      icon: '🛏️',
      accentColor: colors.cyan,
    },
    {
      id: 'care-level',
      label: 'Pflegegrad',
      value: resident.careLevel ?? '—',
      icon: '🩺',
      accentColor: colors.orange,
    },
  ];
}
