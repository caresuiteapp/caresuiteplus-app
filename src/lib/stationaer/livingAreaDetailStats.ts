import type { LivingAreaDetail } from '@/types/modules/stationaer';
import { legacyColorsFromPalette, type ColorMode } from '@/design/tokens/themeBridge';

export type LivingAreaDetailKpi = {
  id: string;
  label: string;
  value: string;
  subValue?: string;
  icon?: string;
  accentColor?: string;
};

export function buildLivingAreaDetailKpis(area: LivingAreaDetail, mode: ColorMode = 'dark'): LivingAreaDetailKpi[]  {
  const colors = legacyColorsFromPalette(mode);
  const occupancyPercent =
    area.capacity > 0 ? Math.round((area.occupiedBeds / area.capacity) * 100) : 0;

  return [
    {
      id: 'occupancy',
      label: 'Belegung',
      value: `${area.occupiedBeds}/${area.capacity}`,
      subValue: `${occupancyPercent} %`,
      icon: '🛏️',
      accentColor: colors.violet,
    },
    {
      id: 'free',
      label: 'Frei',
      value: String(area.freeBeds),
      subValue: area.freeBeds > 0 ? 'Aufnahme möglich' : 'Voll',
      icon: '✨',
      accentColor: colors.cyan,
    },
    {
      id: 'residents',
      label: 'Bewohner:innen',
      value: String(area.residentNames.length),
      subValue: area.wing ?? '—',
      icon: '🏠',
      accentColor: colors.amber,
    },
  ];
}
