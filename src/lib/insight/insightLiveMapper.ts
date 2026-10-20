import type {
  InsightDataSourceItem,
  InsightExportItem,
  InsightSnapshotItem,
} from '@/types/modules/insight';

export type InsightSnapshotLiveRow = {
  id: string;
  tenant_id: string;
  title: string;
  module_label: string;
  description?: string | null;
  kpi_count?: number | null;
  period_label?: string | null;
  status?: string | null;
  updated_at: string;
};

export type InsightExportLiveRow = {
  id: string;
  tenant_id: string;
  title: string;
  format?: string | null;
  schedule_label?: string | null;
  status?: string | null;
  description?: string | null;
  recipient_label?: string | null;
  columns_label?: string | null;
  last_run_label?: string | null;
  updated_at: string;
};

export type InsightDataSourceLiveRow = {
  id: string;
  tenant_id: string;
  module_key: string;
  label: string;
  connection_status?: string | null;
  last_sync_at?: string | null;
  created_at: string;
};

export function mapInsightSnapshotRow(row: InsightSnapshotLiveRow): InsightSnapshotItem {
  return {
    id: String(row.id),
    title: String(row.title),
    moduleLabel: String(row.module_label),
    updatedAt: String(row.updated_at),
  };
}

export function mapInsightExportRow(row: InsightExportLiveRow): InsightExportItem {
  const formatRaw = String(row.format ?? 'csv').toLowerCase();
  const format = (['csv', 'pdf', 'xlsx'].includes(formatRaw) ? formatRaw : 'csv') as InsightExportItem['format'];
  const statusRaw = String(row.status ?? 'planned').toLowerCase();
  const status = (statusRaw === 'paused' ? 'paused' : 'planned') as InsightExportItem['status'];
  return {
    id: String(row.id),
    title: String(row.title),
    format,
    scheduleLabel: String(row.schedule_label ?? '—'),
    status,
    updatedAt: String(row.updated_at),
  };
}

export function mapInsightDataSourceRow(row: InsightDataSourceLiveRow): InsightDataSourceItem {
  const statusRaw = String(row.connection_status ?? 'prepared').toLowerCase();
  const connectionStatus = (
    ['prepared', 'connected', 'error'].includes(statusRaw) ? statusRaw : 'prepared'
  ) as InsightDataSourceItem['connectionStatus'];
  return {
    id: String(row.id),
    moduleKey: String(row.module_key),
    label: String(row.label),
    connectionStatus,
    lastSyncAt: row.last_sync_at ?? null,
  };
}

export function schemaMissingInsightFields(row: InsightSnapshotLiveRow): string[] {
  const missing: string[] = [];
  if (row.kpi_count === undefined) missing.push('kpi_count');
  if (row.period_label === undefined) missing.push('period_label');
  return missing;
}
