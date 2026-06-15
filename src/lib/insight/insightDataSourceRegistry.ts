/**
 * InsightCenter data source registry — maps module KPI feeds to future warehouse tables.
 */
export type InsightDataSourceEntry = {
  moduleKey: string;
  label: string;
  warehouseTable?: string;
  liveReady: boolean;
};

export const INSIGHT_DATA_SOURCE_REGISTRY: InsightDataSourceEntry[] = [
  { moduleKey: 'office', label: 'Office KPIs', warehouseTable: 'office_kpi_daily', liveReady: false },
  { moduleKey: 'assist', label: 'Assist Einsätze', warehouseTable: 'assist_kpi_daily', liveReady: false },
  { moduleKey: 'pflege', label: 'Pflege Vitalwerte', liveReady: false },
  { moduleKey: 'stationaer', label: 'Stationär Belegung', liveReady: false },
  { moduleKey: 'reporting', label: 'Business Reporting', warehouseTable: 'reporting_reports', liveReady: false },
  { moduleKey: 'qm', label: 'QM Compliance', liveReady: false },
];

export function countInsightDataSourcesReady(): number {
  return INSIGHT_DATA_SOURCE_REGISTRY.filter((s) => s.liveReady).length;
}

export function getInsightDataSourcesForModule(moduleKey: string): InsightDataSourceEntry[] {
  return INSIGHT_DATA_SOURCE_REGISTRY.filter((s) => s.moduleKey === moduleKey);
}
