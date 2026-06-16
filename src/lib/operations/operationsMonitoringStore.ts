import type {
  BackupStatusRecord,
  IncidentTicket,
  MaintenanceWindow,
  OperationsAuditEvent,
  OperationsReleaseNote,
  RestoreTestRecord,
  SystemErrorLog,
  SystemHealthCheck,
} from '@/types/modules/operationsMonitoring';
import {
  OPERATIONS_AVAILABILITY_DISCLAIMER,
} from './operationsModuleConfig';

type OperationsMonitoringStore = {
  healthChecks: SystemHealthCheck[];
  errorLogs: SystemErrorLog[];
  incidents: IncidentTicket[];
  backupRecords: BackupStatusRecord[];
  restoreTests: RestoreTestRecord[];
  maintenanceWindows: MaintenanceWindow[];
  releaseNotes: OperationsReleaseNote[];
  auditEvents: OperationsAuditEvent[];
  incidentSeq: Map<string, number>;
};

export const OPERATIONS_MONITORING_STORE: OperationsMonitoringStore = {
  healthChecks: [],
  errorLogs: [],
  incidents: [],
  backupRecords: [],
  restoreTests: [],
  maintenanceWindows: [],
  releaseNotes: [],
  auditEvents: [],
  incidentSeq: new Map(),
};

let healthId = 0;
let errorId = 0;
let incidentId = 0;
let backupId = 0;
let restoreId = 0;
let maintenanceId = 0;
let releaseId = 0;
let auditId = 0;

function nowIso(): string {
  return new Date().toISOString();
}

export function nextHealthCheckId(): string {
  healthId += 1;
  return `ops-health-${healthId}`;
}

export function nextErrorLogId(): string {
  errorId += 1;
  return `ops-error-${errorId}`;
}

export function nextIncidentId(): string {
  incidentId += 1;
  return `ops-incident-${incidentId}`;
}

export function nextBackupRecordId(): string {
  backupId += 1;
  return `ops-backup-${backupId}`;
}

export function nextRestoreTestId(): string {
  restoreId += 1;
  return `ops-restore-${restoreId}`;
}

export function nextMaintenanceWindowId(): string {
  maintenanceId += 1;
  return `ops-maint-${maintenanceId}`;
}

export function nextReleaseNoteId(): string {
  releaseId += 1;
  return `ops-release-${releaseId}`;
}

export function nextOperationsAuditId(): string {
  auditId += 1;
  return `ops-audit-${auditId}`;
}

export function nextIncidentNumber(tenantId: string): string {
  const n = (OPERATIONS_MONITORING_STORE.incidentSeq.get(tenantId) ?? 0) + 1;
  OPERATIONS_MONITORING_STORE.incidentSeq.set(tenantId, n);
  return `INC-${new Date().getFullYear()}-${String(n).padStart(4, '0')}`;
}

export function filterOperationsByTenant<T extends { tenantId: string }>(
  rows: T[],
  tenantId: string,
): T[] {
  return rows.filter((row) => row.tenantId === tenantId);
}

export function seedPreparedOperationsMonitoring(tenantId: string): void {
  const existing = OPERATIONS_MONITORING_STORE.healthChecks.some((h) => h.tenantId === tenantId);
  if (existing) return;

  const now = nowIso();

  OPERATIONS_MONITORING_STORE.healthChecks.push(
    {
      id: nextHealthCheckId(),
      tenantId,
      component: 'app_api',
      status: 'degraded',
      lastCheckedAt: now,
      message: 'Letzter Check — Demo/In-Memory, kein externer Monitor.',
      preparedOnly: true,
      availabilityNote: OPERATIONS_AVAILABILITY_DISCLAIMER,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: nextHealthCheckId(),
      tenantId,
      component: 'supabase_db',
      status: 'prepared',
      lastCheckedAt: now,
      message: 'Datenbank-Health-Checks über vorbereitete Migration — noch nicht live.',
      preparedOnly: true,
      availabilityNote: OPERATIONS_AVAILABILITY_DISCLAIMER,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: nextHealthCheckId(),
      tenantId,
      component: 'edge_functions',
      status: 'prepared',
      lastCheckedAt: now,
      message: 'Edge-Function-Monitoring vorbereitet.',
      preparedOnly: true,
      availabilityNote: OPERATIONS_AVAILABILITY_DISCLAIMER,
      createdAt: now,
      updatedAt: now,
    },
  );

  for (const scope of ['database', 'storage', 'edge_functions'] as const) {
    OPERATIONS_MONITORING_STORE.backupRecords.push({
      id: nextBackupRecordId(),
      tenantId,
      scope,
      status: 'not_configured',
      lastBackupAt: null,
      retentionDays: null,
      preparedOnly: true,
      message: 'Backup-Pipeline nicht aktiv — Schema vorbereitet.',
      createdAt: now,
      updatedAt: now,
    });
  }

  OPERATIONS_MONITORING_STORE.restoreTests.push(
    {
      id: nextRestoreTestId(),
      tenantId,
      scope: 'database',
      status: 'prepared',
      testedAt: null,
      preparedOnly: true,
      message: 'Restore-Test-Protokoll vorbereitet — kein produktiver Testlauf.',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: nextRestoreTestId(),
      tenantId,
      scope: 'full',
      status: 'not_run',
      testedAt: null,
      preparedOnly: true,
      message: 'Vollständiger Wiederherstellungstest noch nicht durchgeführt.',
      createdAt: now,
      updatedAt: now,
    },
  );

  OPERATIONS_MONITORING_STORE.maintenanceWindows.push({
    id: nextMaintenanceWindowId(),
    tenantId,
    title: 'Geplantes Wartungsfenster (Beispiel)',
    description: 'Schema für Wartungsfenster vorbereitet — noch nicht produktiv geplant.',
    scheduledStart: '2026-07-01T22:00:00.000Z',
    scheduledEnd: '2026-07-02T01:00:00.000Z',
    status: 'prepared',
    preparedOnly: true,
    createdAt: now,
    updatedAt: now,
  });

  OPERATIONS_MONITORING_STORE.releaseNotes.push({
    id: nextReleaseNoteId(),
    tenantId,
    version: '1.0.0-pilot',
    title: 'Pilot-Release CareSuite+',
    body: 'Betrieb & Monitoring Modul vorbereitet. Backup und Wiederherstellung folgen.',
    publishedAt: now,
    preparedOnly: false,
    createdAt: now,
    updatedAt: now,
  });
}

export function resetOperationsMonitoringStore(): void {
  OPERATIONS_MONITORING_STORE.healthChecks.length = 0;
  OPERATIONS_MONITORING_STORE.errorLogs.length = 0;
  OPERATIONS_MONITORING_STORE.incidents.length = 0;
  OPERATIONS_MONITORING_STORE.backupRecords.length = 0;
  OPERATIONS_MONITORING_STORE.restoreTests.length = 0;
  OPERATIONS_MONITORING_STORE.maintenanceWindows.length = 0;
  OPERATIONS_MONITORING_STORE.releaseNotes.length = 0;
  OPERATIONS_MONITORING_STORE.auditEvents.length = 0;
  OPERATIONS_MONITORING_STORE.incidentSeq.clear();
  healthId = 0;
  errorId = 0;
  incidentId = 0;
  backupId = 0;
  restoreId = 0;
  maintenanceId = 0;
  releaseId = 0;
  auditId = 0;
}
