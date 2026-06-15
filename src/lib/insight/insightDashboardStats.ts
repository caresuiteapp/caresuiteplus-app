import { legacyColorsFromPalette, type ColorMode } from '@/design/tokens/themeBridge';
import type { InsightDashboardStats } from '@/types/modules/insight';

export type InsightListKpi = {
  id: string;
  label: string;
  value: string;
  subValue?: string;
  icon?: string;
  accentColor?: string;
};

export function buildInsightDashboardKpis(stats: InsightDashboardStats, mode: ColorMode = 'dark'): InsightListKpi[]  {
  const colors = legacyColorsFromPalette(mode);
  return [
    {
      id: 'dashboards',
      label: 'Dashboards',
      value: String(stats.configuredDashboards),
      subValue: 'Konfiguriert',
      icon: '📊',
      accentColor: '#2563EB',
    },
    {
      id: 'reports',
      label: 'Gespeicherte Reports',
      value: String(stats.savedReports),
      subValue: 'Noch nicht aktiv',
      icon: '📈',
      accentColor: colors.cyan,
    },
    {
      id: 'exports',
      label: 'Geplante Exporte',
      value: String(stats.scheduledExports),
      subValue: 'In Vorbereitung',
      icon: '📤',
      accentColor: colors.violet,
    },
    {
      id: 'sources',
      label: 'Datenquellen',
      value: String(stats.dataSourcesReady),
      subValue: 'Warehouse folgt',
      icon: '🔗',
      accentColor: colors.warning,
    },
  ];
}
