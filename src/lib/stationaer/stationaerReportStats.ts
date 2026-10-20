import { legacyColorsFromPalette, type ColorMode } from '@/design/tokens/themeBridge';
import type { StationaerReportStats } from '@/types/modules/stationaer';

export type StationaerReportsKpi = {
  id: string;
  label: string;
  value: string;
  subValue?: string;
  icon?: string;
  accentColor?: string;
};

export function buildStationaerReportsKpis(stats: StationaerReportStats, mode: ColorMode = 'dark'): StationaerReportsKpi[]  {
  const colors = legacyColorsFromPalette(mode);
  return [
    {
      id: 'occupancy',
      label: 'Belegung',
      value: `${stats.occupancyPercent} %`,
      subValue: `${stats.activeResidents} aktiv`,
      icon: '🛏️',
      accentColor: colors.violet,
    },
    {
      id: 'handovers',
      label: 'Übergaben',
      value: String(stats.handoversThisWeek),
      subValue: 'Diese Woche',
      icon: '📝',
      accentColor: colors.amber,
    },
    {
      id: 'risks',
      label: 'Offene Risiken',
      value: String(stats.openRisks),
      subValue: 'Dokumentation',
      icon: '⚠️',
      accentColor: colors.danger,
    },
    {
      id: 'admissions',
      label: 'Neuaufnahmen',
      value: String(stats.newAdmissionsMonth),
      subValue: 'Dieser Monat',
      icon: '✨',
      accentColor: colors.cyan,
    },
  ];
}
