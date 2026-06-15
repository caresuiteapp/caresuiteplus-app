import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import type {
  InsightExportDetail,
  InsightExportItem,
  InsightSnapshotDetail,
  InsightSnapshotItem,
  InsightDataSourceItem,
  InsightDataSourceDetail,
} from '@/types/modules/insight';
import { INSIGHT_DATA_SOURCE_REGISTRY } from '@/lib/insight/insightDataSourceRegistry';

const BASE = '2026-06-10T08:00:00.000Z';

/** Demo-only scaffold snapshots — preparedOnly, kein Warehouse. */
export const demoInsightSnapshots: InsightSnapshotDetail[] = [
  {
    id: 'snap-office-001',
    tenantId: DEMO_TENANT_ID,
    title: 'Office Mandanten-KPIs',
    moduleLabel: 'Office',
    description:
      'Aggregierte Kennzahlen zu Klient:innen, Mitarbeitenden und Terminen — Scaffold ohne Live-Warehouse.',
    kpiCount: 6,
    periodLabel: 'KW 24 · 2026',
    status: 'prepared',
    updatedAt: BASE,
  },
  {
    id: 'snap-assist-001',
    tenantId: DEMO_TENANT_ID,
    title: 'Assist Einsatzübersicht',
    moduleLabel: 'Assist',
    description:
      'Wöchentliche Einsatzabdeckung und Durchführungsquote — Demo-Snapshot ohne Analytics-Pipeline.',
    kpiCount: 4,
    periodLabel: 'Letzte 7 Tage',
    status: 'prepared',
    updatedAt: '2026-06-09T14:30:00.000Z',
  },
  {
    id: 'snap-reporting-001',
    tenantId: DEMO_TENANT_ID,
    title: 'PDL Monatsreport',
    moduleLabel: 'Reporting',
    description:
      'Monatliche PDL-Kennzahlen aus Business Reporting — verknüpft mit vorhandenen Report-Listen.',
    kpiCount: 8,
    periodLabel: 'Mai 2026',
    status: 'prepared',
    updatedAt: '2026-06-01T09:00:00.000Z',
  },
];

export const demoInsightExports: InsightExportDetail[] = [
  {
    id: 'export-csv-weekly',
    tenantId: DEMO_TENANT_ID,
    title: 'Wöchentlicher KPI-Export',
    format: 'csv',
    scheduleLabel: 'Montags 06:00',
    status: 'planned',
    updatedAt: BASE,
    description:
      'CSV-Export der Mandanten-KPIs aus Office, Assist und Reporting — Scheduler noch nicht angebunden.',
    recipientLabel: 'pdl@demo-mandant.de',
    columnsLabel: '12 KPI-Spalten · Office + Assist',
    lastRunLabel: 'Noch nicht ausgeführt (preparedOnly)',
  },
  {
    id: 'export-pdf-monthly',
    tenantId: DEMO_TENANT_ID,
    title: 'Monats-PDF Mandant',
    format: 'pdf',
    scheduleLabel: '1. des Monats',
    status: 'planned',
    updatedAt: '2026-06-01T08:00:00.000Z',
    description:
      'Monatliches PDF mit PDL-Kennzahlen und Snapshot-Übersicht — kein Live-Render-Pipeline.',
    recipientLabel: 'geschaeftsfuehrung@demo-mandant.de',
    columnsLabel: 'PDF-Layout · 8 Seiten max.',
    lastRunLabel: 'Noch nicht ausgeführt (preparedOnly)',
  },
];

export function getDemoInsightSnapshots(): InsightSnapshotItem[] {
  return demoInsightSnapshots.map(({ id, title, moduleLabel, updatedAt }) => ({
    id,
    title,
    moduleLabel,
    updatedAt,
  }));
}

export function getDemoInsightSnapshotDetail(id: string): InsightSnapshotDetail | null {
  return demoInsightSnapshots.find((item) => item.id === id) ?? null;
}

export function getDemoInsightExports(): InsightExportItem[] {
  return [...demoInsightExports];
}

export function getDemoInsightExportDetail(id: string): InsightExportDetail | null {
  return demoInsightExports.find((item) => item.id === id) ?? null;
}

const demoInsightDataSources: InsightDataSourceDetail[] = INSIGHT_DATA_SOURCE_REGISTRY.map(
  (entry, index) => ({
    id: `ds-${entry.moduleKey}`,
    tenantId: DEMO_TENANT_ID,
    moduleKey: entry.moduleKey,
    label: entry.label,
    connectionStatus: 'prepared' as const,
    lastSyncAt: null,
    warehouseTable: entry.warehouseTable ?? null,
    description: `KPI-Feed für ${entry.label} — Warehouse-ETL noch nicht aktiv.`,
    kpiFeedCount: 3 + index,
    nextActionHint: entry.liveReady ? 'Sync aktiv' : 'Migration 0035+ anwenden, dann ETL starten',
  }),
);

export function getDemoInsightDataSources(): InsightDataSourceItem[] {
  return demoInsightDataSources.map(({ id, moduleKey, label, connectionStatus, lastSyncAt }) => ({
    id,
    moduleKey,
    label,
    connectionStatus,
    lastSyncAt,
  }));
}

export function getDemoInsightDataSourceDetail(id: string): InsightDataSourceDetail | null {
  return demoInsightDataSources.find((item) => item.id === id) ?? null;
}
