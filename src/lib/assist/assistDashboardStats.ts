import type { AssistDashboardStats } from '@/types/modules/assist';
import { legacyColorsFromPalette, type ColorMode } from '@/design/tokens/themeBridge';

export type AssistDashboardKpi = {
  id: string;
  label: string;
  value: string;
  subValue?: string;
  icon?: string;
  accentColor?: string;
};

export function buildAssistDashboardKpis(stats: AssistDashboardStats, mode: ColorMode = 'dark'): AssistDashboardKpi[]  {
  const colors = legacyColorsFromPalette(mode);
  return [
    {
      id: 'today',
      label: 'Heute',
      value: String(stats.todayCount),
      subValue: `${stats.completedTodayCount} abgeschlossen`,
      icon: '📅',
      accentColor: colors.amber,
    },
    {
      id: 'active',
      label: 'Aktiv',
      value: String(stats.activeCount),
      subValue: `${stats.inProgressCount} in Arbeit`,
      icon: '▶️',
      accentColor: colors.success,
    },
    {
      id: 'upcoming',
      label: 'Geplant',
      value: String(stats.upcomingCount),
      subValue: `${stats.totalAssignments} gesamt`,
      icon: '📋',
      accentColor: colors.violet,
    },
  ];
}
