import type { LivingAreaListItem } from '@/types/modules/stationaer';
import { legacyColorsFromPalette, type ColorMode } from '@/design/tokens/themeBridge';

export type LivingAreasListKpi = {
  id: string;
  label: string;
  value: string;
  subValue?: string;
  icon?: string;
  accentColor?: string;
};

export function buildLivingAreasListKpis(items: LivingAreaListItem[], mode: ColorMode = 'dark'): LivingAreasListKpi[]  {
  const colors = legacyColorsFromPalette(mode);
  const totalCapacity = items.reduce((sum, item) => sum + item.capacity, 0);
  const totalOccupied = items.reduce((sum, item) => sum + item.occupiedBeds, 0);
  const totalFree = items.reduce((sum, item) => sum + item.freeBeds, 0);
  const occupancyPercent =
    totalCapacity > 0 ? Math.round((totalOccupied / totalCapacity) * 100) : 0;

  return [
    {
      id: 'areas-count',
      label: 'Bereiche',
      value: String(items.length),
      subValue: `${items.filter((i) => i.status === 'aktiv').length} aktiv`,
      icon: '🏢',
      accentColor: colors.violet,
    },
    {
      id: 'beds-occupied',
      label: 'Belegt',
      value: String(totalOccupied),
      subValue: `${occupancyPercent} % Belegung`,
      icon: '🛏️',
      accentColor: colors.amber,
    },
    {
      id: 'beds-free',
      label: 'Frei',
      value: String(totalFree),
      subValue: `${totalCapacity} Kapazität`,
      icon: '✨',
      accentColor: colors.cyan,
    },
  ];
}
