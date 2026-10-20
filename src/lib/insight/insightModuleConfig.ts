/**
 * InsightCenter live readiness — honest preparedOnly until analytics warehouse ships.
 */
export function isInsightLiveReady(): boolean {
  return false;
}

export function isInsightExtensionLiveReady(): boolean {
  return false;
}

export const INSIGHT_PREPARED_MESSAGE =
  'InsightCenter ist als Modul-Scaffold vorbereitet. Mandanten-KPIs, Datenquellen und geplante Exporte sind noch nicht angebunden — keine Live-Analytics.';

/** Migration 0035 muss remote angewendet werden bevor Live-Flip möglich ist. */
export const INSIGHT_LIVE_WIRING_MIGRATION = '0035_insight_center_prepared.sql';

export function isInsightLiveWiringPrepared(): boolean {
  return true;
}

export type InsightLiveFlipBlocker = {
  id: string;
  label: string;
  resolved: boolean;
};

/** Honest checklist — all items must be resolved before isInsightLiveReady() can flip true. */
export function getInsightLiveFlipBlockers(): InsightLiveFlipBlocker[] {
  return [
    {
      id: 'migration-0035',
      label: `Remote-Migration ${INSIGHT_LIVE_WIRING_MIGRATION} angewendet`,
      resolved: false,
    },
    {
      id: 'warehouse-etl',
      label: 'Analytics-Warehouse + ETL-Pipeline aktiv',
      resolved: false,
    },
    {
      id: 'data-sources-sync',
      label: 'Modul-Datenquellen synchronisiert (Registry liveReady)',
      resolved: false,
    },
    {
      id: 'service-mode-supabase',
      label: 'insightDashboardService nutzt Supabase-Queries statt Demo-Daten',
      resolved: false,
    },
  ];
}

export function countInsightLiveFlipBlockersRemaining(): number {
  return getInsightLiveFlipBlockers().filter((b) => !b.resolved).length;
}
