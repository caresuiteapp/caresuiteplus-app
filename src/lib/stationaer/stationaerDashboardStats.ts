import type { StationaerDashboardStats } from '@/types/modules/stationaer';
import { legacyColorsFromPalette, type ColorMode } from '@/design/tokens/themeBridge';

export type StationaerDashboardKpi = {
  id: string;
  label: string;
  value: string;
  subValue?: string;
  icon?: string;
  accentColor?: string;
};

export function buildStationaerDashboardKpis(stats: StationaerDashboardStats, mode: ColorMode = 'dark'): StationaerDashboardKpi[]  {
  const colors = legacyColorsFromPalette(mode);
  return [
    {
      id: 'residents-total',
      label: 'Bewohner:innen',
      value: String(stats.totalResidents),
      subValue: `${stats.activeCount} aktiv`,
      icon: '🏠',
      accentColor: colors.violet,
    },
    {
      id: 'occupancy',
      label: 'Belegung',
      value: `${stats.occupancyPercent} %`,
      subValue: stats.newAdmissionsCount > 0 ? `${stats.newAdmissionsCount} Neuaufnahmen` : 'Keine Neuaufnahmen',
      icon: '🛏️',
      accentColor: colors.amber,
    },
    {
      id: 'handover',
      label: 'Übergabe',
      value: String(stats.handoverPendingCount),
      subValue: stats.handoverPendingCount > 0 ? 'Ausstehend' : 'Alles erledigt',
      icon: '📋',
      accentColor: colors.cyan,
    },
  ];
}
