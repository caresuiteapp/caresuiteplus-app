import { legacyColorsFromPalette, type ColorMode } from '@/design/tokens/themeBridge';
import type { InsightDataSourceItem } from '@/types/modules/insight';

export type InsightDataSourceListKpi = {
  id: string;
  label: string;
  value: string;
  subValue?: string;
  icon?: string;
  accentColor?: string;
};

export function buildInsightDataSourceListKpis(items: InsightDataSourceItem[], mode: ColorMode = 'dark'): InsightDataSourceListKpi[]  {
  const colors = legacyColorsFromPalette(mode);
  const prepared = items.filter((i) => i.connectionStatus === 'prepared').length;
  const connected = items.filter((i) => i.connectionStatus === 'connected').length;

  return [
    {
      id: 'total',
      label: 'Quellen',
      value: String(items.length),
      subValue: `${connected} verbunden`,
      icon: '🔌',
      accentColor: '#2563EB',
    },
    {
      id: 'prepared',
      label: 'Vorbereitet',
      value: String(prepared),
      subValue: 'ETL ausstehend',
      icon: '⏳',
      accentColor: colors.orange,
    },
    {
      id: 'modules',
      label: 'Module',
      value: String(new Set(items.map((i) => i.moduleKey)).size),
      subValue: 'KPI-Feeds',
      icon: '📦',
      accentColor: colors.cyan,
    },
  ];
}

export function buildInsightDataSourceDetailKpis(source: {
  kpiFeedCount: number;
  connectionStatus: string;
  warehouseTable: string | null;
}, mode: ColorMode = 'dark'): InsightDataSourceListKpi[]  {
  const colors = legacyColorsFromPalette(mode);
  return [
    {
      id: 'feeds',
      label: 'KPI-Feeds',
      value: String(source.kpiFeedCount),
      icon: '📊',
      accentColor: '#2563EB',
    },
    {
      id: 'status',
      label: 'Status',
      value: source.connectionStatus,
      icon: '🔌',
      accentColor: colors.orange,
    },
    {
      id: 'warehouse',
      label: 'Warehouse',
      value: source.warehouseTable ?? '—',
      icon: '🗄️',
      accentColor: colors.cyan,
    },
  ];
}
