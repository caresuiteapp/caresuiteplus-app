/**
 * InsightCenter live wiring prep — table/column registry for future Supabase wiring.
 * isInsightLiveReady() bleibt false bis Warehouse + ETL aktiv.
 */

export const INSIGHT_SNAPSHOTS_TABLE = 'insight_snapshots';
export const INSIGHT_EXPORTS_TABLE = 'insight_scheduled_exports';
export const INSIGHT_DATA_SOURCES_TABLE = 'insight_data_sources';

export const INSIGHT_SNAPSHOT_SELECT_COLUMNS =
  'id, tenant_id, title, module_label, description, kpi_count, period_label, status, updated_at';

export const INSIGHT_EXPORT_SELECT_COLUMNS =
  'id, tenant_id, title, format, schedule_label, status, description, recipient_label, columns_label, last_run_label, updated_at';

export const INSIGHT_DATA_SOURCE_SELECT_COLUMNS =
  'id, tenant_id, module_key, label, connection_status, last_sync_at, created_at';

export const INSIGHT_LIVE_REQUIRED_MIGRATION = '0035_insight_center_prepared.sql';
