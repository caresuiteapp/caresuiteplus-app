import type { PflegeDashboardStats } from '@/types/modules/pflege';
import { legacyColorsFromPalette, type ColorMode } from '@/design/tokens/themeBridge';

export type PflegeDashboardKpi = {
  id: string;
  label: string;
  value: string;
  subValue?: string;
  icon?: string;
  accentColor?: string;
};

export function buildPflegeDashboardKpis(stats: PflegeDashboardStats, mode: ColorMode = 'dark'): PflegeDashboardKpi[]  {
  const colors = legacyColorsFromPalette(mode);
  const openReports = Math.max(0, stats.totalPlans - stats.activePlansCount);
  return [
    {
      id: 'active-plans',
      label: 'Aktive Pflegepläne',
      value: String(stats.activePlansCount),
      subValue: `${stats.totalPlans} gesamt`,
      icon: '📋',
      accentColor: colors.success,
    },
    {
      id: 'due-vitals',
      label: 'Fällige Vitalwerte',
      value: String(stats.dueVitalsCount),
      subValue: stats.dueVitalsCount > 0 ? 'Messung(en) offen' : 'Keine fällig',
      icon: '❤️',
      accentColor: stats.dueVitalsCount > 0 ? colors.orange : colors.textMuted,
    },
    {
      id: 'open-reports',
      label: 'Offene Berichte',
      value: String(openReports),
      subValue: openReports > 0 ? 'Entwürfe / in Bearbeitung' : 'Keine offen',
      icon: '📄',
      accentColor: openReports > 0 ? colors.cyan : colors.textMuted,
    },
    {
      id: 'alerts',
      label: 'Hinweise / Risiken',
      value: String(stats.alertsCount),
      subValue: stats.alertsCount > 0 ? 'Prüfung empfohlen' : 'Keine Hinweise',
      icon: '⚠️',
      accentColor: stats.alertsCount > 0 ? colors.danger : colors.textMuted,
    },
  ];
}
