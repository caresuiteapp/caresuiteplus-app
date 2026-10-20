import { legacyColorsFromPalette, type ColorMode } from '@/design/tokens/themeBridge';
import type { InsightExportItem, InsightSnapshotItem } from '@/types/modules/insight';
import type { InsightListKpi } from './insightDashboardStats';

export function buildInsightSnapshotListKpis(items: InsightSnapshotItem[], mode: ColorMode = 'dark'): InsightListKpi[]  {
  const colors = legacyColorsFromPalette(mode);
  const modules = new Set(items.map((item) => item.moduleLabel));

  return [
    {
      id: 'total',
      label: 'Snapshots',
      value: String(items.length),
      subValue: 'Gespeichert',
      icon: '📊',
      accentColor: '#2563EB',
    },
    {
      id: 'modules',
      label: 'Module',
      value: String(modules.size),
      subValue: 'Quellen',
      icon: '🧩',
      accentColor: colors.cyan,
    },
    {
      id: 'recent',
      label: 'Aktualisiert',
      value: items.length > 0 ? 'Demo' : '—',
      subValue: 'preparedOnly',
      icon: '🕐',
      accentColor: colors.violet,
    },
  ];
}

export function buildInsightExportListKpis(items: InsightExportItem[], mode: ColorMode = 'dark'): InsightListKpi[]  {
  const colors = legacyColorsFromPalette(mode);
  const planned = items.filter((item) => item.status === 'planned').length;

  return [
    {
      id: 'total',
      label: 'Exporte',
      value: String(items.length),
      subValue: `${planned} geplant`,
      icon: '📤',
      accentColor: colors.violet,
    },
    {
      id: 'csv',
      label: 'CSV',
      value: String(items.filter((item) => item.format === 'csv').length),
      subValue: 'Formate',
      icon: '📄',
      accentColor: colors.cyan,
    },
    {
      id: 'pdf',
      label: 'PDF',
      value: String(items.filter((item) => item.format === 'pdf').length),
      subValue: 'Formate',
      icon: '📑',
      accentColor: colors.warning,
    },
  ];
}

export function buildInsightExportDetailKpis(exportItem: InsightExportItem, mode: ColorMode = 'dark'): InsightListKpi[]  {
  const colors = legacyColorsFromPalette(mode);
  return [
    {
      id: 'format',
      label: 'Format',
      value: exportItem.format.toUpperCase(),
      subValue: exportItem.scheduleLabel,
      icon: '📄',
      accentColor: colors.violet,
    },
    {
      id: 'status',
      label: 'Status',
      value: exportItem.status === 'planned' ? 'Geplant' : 'Pausiert',
      subValue: 'Scheduler',
      icon: '🕐',
      accentColor: colors.cyan,
    },
    {
      id: 'run',
      label: 'Letzter Lauf',
      value: '—',
      subValue: 'preparedOnly',
      icon: '🔒',
      accentColor: colors.textMuted,
    },
  ];
}

export function buildInsightSnapshotDetailKpis(kpiCount: number,
  periodLabel: string, mode: ColorMode = 'dark'): InsightListKpi[]  {
  const colors = legacyColorsFromPalette(mode);
  return [
    {
      id: 'kpis',
      label: 'KPIs',
      value: String(kpiCount),
      subValue: 'Im Snapshot',
      icon: '📈',
      accentColor: '#2563EB',
    },
    {
      id: 'period',
      label: 'Zeitraum',
      value: periodLabel,
      subValue: 'Aggregiert',
      icon: '📅',
      accentColor: colors.cyan,
    },
    {
      id: 'status',
      label: 'Status',
      value: 'Demo',
      subValue: 'preparedOnly',
      icon: '🔒',
      accentColor: colors.textMuted,
    },
  ];
}
