import type { BeratungDashboardStats } from '@/types/modules/beratung';
import { legacyColorsFromPalette, type ColorMode } from '@/design/tokens/themeBridge';

export type BeratungDashboardKpi = {
  id: string;
  label: string;
  value: string;
  subValue?: string;
  icon?: string;
  accentColor?: string;
};

export function buildBeratungDashboardKpis(stats: BeratungDashboardStats, mode: ColorMode = 'dark'): BeratungDashboardKpi[]  {
  const colors = legacyColorsFromPalette(mode);
  return [
    {
      id: 'open-cases',
      label: 'Offen',
      value: String(stats.openCount),
      subValue: `${stats.activeCount} aktiv`,
      icon: '📋',
      accentColor: colors.cyan,
    },
    {
      id: 'appointments',
      label: 'Termine',
      value: String(stats.upcomingAppointmentsCount),
      subValue: 'Anstehend',
      icon: '📅',
      accentColor: colors.violet,
    },
    {
      id: 'closed',
      label: 'Abgeschlossen',
      value: String(stats.closedThisMonthCount),
      subValue: 'Diesen Monat',
      icon: '✅',
      accentColor: colors.amber,
    },
  ];
}
