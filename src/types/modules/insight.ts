export type InsightDashboardStats = {
  configuredDashboards: number;
  savedReports: number;
  scheduledExports: number;
  dataSourcesReady: number;
};

export type InsightSnapshotItem = {
  id: string;
  title: string;
  moduleLabel: string;
  updatedAt: string;
};

export type InsightSnapshotDetail = InsightSnapshotItem & {
  tenantId: string;
  description: string;
  kpiCount: number;
  periodLabel: string;
  status: 'prepared' | 'active';
};

export type InsightExportItem = {
  id: string;
  title: string;
  format: 'csv' | 'pdf' | 'xlsx';
  scheduleLabel: string;
  status: 'planned' | 'paused';
  updatedAt: string;
};

export type InsightExportDetail = InsightExportItem & {
  tenantId: string;
  description: string;
  recipientLabel: string;
  columnsLabel: string;
  lastRunLabel: string;
};

export type InsightDataSourceItem = {
  id: string;
  moduleKey: string;
  label: string;
  connectionStatus: 'prepared' | 'connected' | 'error';
  lastSyncAt: string | null;
};

export type InsightDataSourceDetail = InsightDataSourceItem & {
  tenantId: string;
  warehouseTable: string | null;
  description: string;
  kpiFeedCount: number;
  nextActionHint: string;
};
