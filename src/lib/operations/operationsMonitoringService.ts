import type { RoleKey, ServiceResult } from '@/types';
import type {
  BackupStatusRecord,
  CreateIncidentFromErrorInput,
  IncidentTicket,
  LogSystemErrorInput,
  MaintenanceWindow,
  OperationsAuditEvent,
  OperationsMonitoringAreaKey,
  OperationsMonitoringAreaSummary,
  OperationsMonitoringDashboard,
  OperationsReleaseNote,
  RestoreTestRecord,
  SystemErrorCategory,
  SystemErrorLog,
  SystemHealthCheck,
  UpdateIncidentStatusInput,
} from '@/types/modules/operationsMonitoring';
import {
  INCIDENT_OPEN_STATUSES,
  OPERATIONS_MONITORING_AREA_LABELS,
  PREPARED_OPERATIONS_AREAS,
} from '@/types/modules/operationsMonitoring';
import { createInternalTask } from '@/lib/tasks/internalTaskService';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { sanitizeLogMessage, sanitizeLogMetadata } from './logSanitizer';
import {
  assertOperationsProductionSafety,
  assertOperationsTenantScope,
  buildOperationsMonitoringAccessContext,
  canManageOperationsMonitoring,
  canViewOperationsMonitoring,
} from './operationsMonitoringAccess';
import {
  OPERATIONS_AVAILABILITY_DISCLAIMER,
  OPERATIONS_MONITORING_ROUTE,
  isOperationsMonitoringLiveReady,
} from './operationsModuleConfig';
import {
  OPERATIONS_MONITORING_STORE,
  filterOperationsByTenant,
  nextErrorLogId,
  nextIncidentId,
  nextIncidentNumber,
  nextOperationsAuditId,
  seedPreparedOperationsMonitoring,
} from './operationsMonitoringStore';

export {
  resetOperationsMonitoringStore,
  seedPreparedOperationsMonitoring,
} from './operationsMonitoringStore';
export {
  isOperationsMonitoringLiveReady,
  OPERATIONS_MONITORING_PREPARED_MESSAGE,
  OPERATIONS_AVAILABILITY_DISCLAIMER,
  OPERATIONS_MONITORING_ROUTE,
} from './operationsModuleConfig';

const AREA_ROUTES: Record<OperationsMonitoringAreaKey, string> = {
  system_status: OPERATIONS_MONITORING_ROUTE,
  error_logs: OPERATIONS_MONITORING_ROUTE,
  sync_errors: OPERATIONS_MONITORING_ROUTE,
  edge_function_errors: OPERATIONS_MONITORING_ROUTE,
  connect_errors: OPERATIONS_MONITORING_ROUTE,
  backup_status: OPERATIONS_MONITORING_ROUTE,
  restore_tests: OPERATIONS_MONITORING_ROUTE,
  incident_tickets: OPERATIONS_MONITORING_ROUTE,
  maintenance_windows: OPERATIONS_MONITORING_ROUTE,
  release_notes: OPERATIONS_MONITORING_ROUTE,
};

function nowIso(): string {
  return new Date().toISOString();
}

function audit(input: Omit<OperationsAuditEvent, 'id' | 'createdAt' | 'updatedAt'>): OperationsAuditEvent {
  const now = nowIso();
  const event: OperationsAuditEvent = {
    id: nextOperationsAuditId(),
    createdAt: now,
    updatedAt: now,
    ...input,
  };
  OPERATIONS_MONITORING_STORE.auditEvents.push(event);
  return event;
}

function assertViewAccess<T>(
  tenantId: string,
  roleKey?: RoleKey | null,
  userId?: string | null,
): ServiceResult<T> | null {
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const ctx = buildOperationsMonitoringAccessContext({ tenantId, roleKey: roleKey ?? null, userId });
  const view = canViewOperationsMonitoring(ctx);
  if (!view.allowed) return { ok: false, error: view.reason ?? 'Zugriff verweigert.' };

  const production = assertOperationsProductionSafety(ctx);
  if (!production.allowed) return { ok: false, error: production.reason };

  return null;
}

function assertManageAccess<T>(
  tenantId: string,
  roleKey?: RoleKey | null,
  userId?: string | null,
): ServiceResult<T> | null {
  const viewBlock = assertViewAccess<T>(tenantId, roleKey, userId);
  if (viewBlock) return viewBlock;

  const ctx = buildOperationsMonitoringAccessContext({ tenantId, roleKey: roleKey ?? null, userId });
  if (!canManageOperationsMonitoring(ctx)) {
    return { ok: false, error: 'Keine Berechtigung für Betrieb & Monitoring-Verwaltung.' };
  }
  return null;
}

function worstHealthStatus(checks: SystemHealthCheck[]): SystemHealthCheck['status'] {
  const order: SystemHealthCheck['status'][] = [
    'unhealthy',
    'degraded',
    'unknown',
    'prepared',
    'healthy',
  ];
  for (const status of order) {
    if (checks.some((c) => c.status === status)) return status;
  }
  return 'unknown';
}

function summarizeArea(
  areaKey: OperationsMonitoringAreaKey,
  tenantId: string,
): OperationsMonitoringAreaSummary {
  const preparedOnly = PREPARED_OPERATIONS_AREAS.includes(areaKey);
  let openCount = 0;
  let statusLabel = 'bereit';

  switch (areaKey) {
    case 'system_status':
      openCount = filterOperationsByTenant(OPERATIONS_MONITORING_STORE.healthChecks, tenantId).filter(
        (h) => h.status !== 'healthy',
      ).length;
      statusLabel = 'letzter Check';
      break;
    case 'error_logs':
      openCount = filterOperationsByTenant(OPERATIONS_MONITORING_STORE.errorLogs, tenantId).filter(
        (e) => !e.acknowledgedAt,
      ).length;
      statusLabel = 'offen';
      break;
    case 'sync_errors':
      openCount = listErrorsByCategory(tenantId, 'sync').filter((e) => !e.acknowledgedAt).length;
      statusLabel = 'Sync';
      break;
    case 'edge_function_errors':
      openCount = listErrorsByCategory(tenantId, 'edge_function').filter((e) => !e.acknowledgedAt).length;
      statusLabel = 'Edge';
      break;
    case 'connect_errors':
      openCount = listErrorsByCategory(tenantId, 'connect').filter((e) => !e.acknowledgedAt).length;
      statusLabel = 'Connect';
      break;
    case 'backup_status':
      openCount = filterOperationsByTenant(OPERATIONS_MONITORING_STORE.backupRecords, tenantId).filter(
        (b) => b.status !== 'not_configured' && !b.preparedOnly,
      ).length;
      statusLabel = 'preparedOnly';
      break;
    case 'restore_tests':
      openCount = filterOperationsByTenant(OPERATIONS_MONITORING_STORE.restoreTests, tenantId).filter(
        (r) => r.status === 'passed',
      ).length;
      statusLabel = 'preparedOnly';
      break;
    case 'incident_tickets':
      openCount = listOpenIncidents(tenantId).length;
      statusLabel = 'Incidents';
      break;
    case 'maintenance_windows':
      openCount = filterOperationsByTenant(
        OPERATIONS_MONITORING_STORE.maintenanceWindows,
        tenantId,
      ).filter((m) => m.status === 'prepared' || m.status === 'scheduled').length;
      statusLabel = 'preparedOnly';
      break;
    case 'release_notes':
      openCount = filterOperationsByTenant(OPERATIONS_MONITORING_STORE.releaseNotes, tenantId).length;
      statusLabel = 'Notizen';
      break;
    default:
      break;
  }

  return {
    areaKey,
    label: OPERATIONS_MONITORING_AREA_LABELS[areaKey],
    route: AREA_ROUTES[areaKey],
    preparedOnly,
    openCount,
    statusLabel,
  };
}

export function listErrorsByCategory(tenantId: string, category: SystemErrorCategory): SystemErrorLog[] {
  return filterOperationsByTenant(OPERATIONS_MONITORING_STORE.errorLogs, tenantId).filter(
    (row) => row.category === category,
  );
}

export function listOpenIncidents(tenantId: string): IncidentTicket[] {
  return filterOperationsByTenant(OPERATIONS_MONITORING_STORE.incidents, tenantId).filter((row) =>
    INCIDENT_OPEN_STATUSES.includes(row.status),
  );
}

export function getOperationsAuditTrail(tenantId: string): OperationsAuditEvent[] {
  return filterOperationsByTenant(OPERATIONS_MONITORING_STORE.auditEvents, tenantId);
}

export function buildOperationsMonitoringDashboard(tenantId: string): OperationsMonitoringDashboard {
  seedPreparedOperationsMonitoring(tenantId);
  const healthChecks = filterOperationsByTenant(OPERATIONS_MONITORING_STORE.healthChecks, tenantId);
  const errors = filterOperationsByTenant(OPERATIONS_MONITORING_STORE.errorLogs, tenantId);
  const areas = (Object.keys(OPERATIONS_MONITORING_AREA_LABELS) as OperationsMonitoringAreaKey[]).map(
    (areaKey) => summarizeArea(areaKey, tenantId),
  );

  return {
    tenantId,
    overallStatus: worstHealthStatus(healthChecks),
    availabilityDisclaimer: OPERATIONS_AVAILABILITY_DISCLAIMER,
    openIncidents: listOpenIncidents(tenantId).length,
    openErrors: errors.filter((e) => !e.acknowledgedAt).length,
    preparedAreasCount: areas.filter((a) => a.preparedOnly).length,
    lastHealthCheckAt: healthChecks[0]?.lastCheckedAt ?? null,
    areas,
  };
}

export async function fetchOperationsMonitoringDashboard(
  tenantId: string,
  roleKey?: RoleKey | null,
  userId?: string | null,
): Promise<ServiceResult<OperationsMonitoringDashboard>> {
  const block = assertViewAccess<OperationsMonitoringDashboard>(tenantId, roleKey, userId);
  if (block) return block;
  return { ok: true, data: buildOperationsMonitoringDashboard(tenantId) };
}

export function logSystemError(
  input: LogSystemErrorInput,
  roleKey?: RoleKey | null,
  actorUserId?: string | null,
): ServiceResult<SystemErrorLog> {
  const block = assertManageAccess<SystemErrorLog>(input.tenantId, roleKey, actorUserId);
  if (block) return block;

  const now = nowIso();
  const record: SystemErrorLog = {
    id: nextErrorLogId(),
    tenantId: input.tenantId,
    source: sanitizeLogMessage(input.source),
    category: input.category,
    severity: input.severity,
    message: sanitizeLogMessage(input.message),
    errorCode: input.errorCode ?? null,
    correlationId: input.correlationId ?? null,
    metadata: sanitizeLogMetadata(input.metadata),
    acknowledgedAt: null,
    incidentTicketId: null,
    createdAt: now,
    updatedAt: now,
  };

  OPERATIONS_MONITORING_STORE.errorLogs.push(record);
  audit({
    tenantId: input.tenantId,
    action: 'error_logged',
    entityType: 'system_error_log',
    entityId: record.id,
    actorUserId: actorUserId ?? null,
    actorRoleKey: roleKey ?? null,
    details: `Fehler protokolliert (${record.category}): ${record.message.slice(0, 120)}`,
    metadata: { severity: record.severity, source: record.source },
  });

  return { ok: true, data: record };
}

export function createIncidentFromError(
  input: CreateIncidentFromErrorInput,
  roleKey?: RoleKey | null,
  actorUserId?: string | null,
): ServiceResult<IncidentTicket> {
  const block = assertManageAccess<IncidentTicket>(input.tenantId, roleKey, actorUserId);
  if (block) return block;

  const ctx = buildOperationsMonitoringAccessContext({
    tenantId: input.tenantId,
    roleKey: roleKey ?? null,
    userId: actorUserId,
  });

  const errorLog = filterOperationsByTenant(OPERATIONS_MONITORING_STORE.errorLogs, input.tenantId).find(
    (row) => row.id === input.errorLogId,
  );
  if (!errorLog) return { ok: false, error: 'Fehlerlog nicht gefunden.' };

  const scopeBlock = assertOperationsTenantScope(ctx, errorLog.tenantId);
  if (scopeBlock) return { ok: false, error: scopeBlock.reason };

  const now = nowIso();
  const severity = input.severity ?? errorLog.severity;
  const title = input.title?.trim() || `Incident: ${errorLog.source}`;

  const internalTask = createInternalTask({
    tenantId: input.tenantId,
    taskType: 'system_error',
    priority: severity === 'critical' ? 'critical' : severity === 'error' ? 'high' : 'normal',
    title,
    description: `${errorLog.message}${errorLog.correlationId ? ` (Korrelation: ${errorLog.correlationId})` : ''}`,
    source: 'system',
    linkedEntityType: 'none',
  });

  const incident: IncidentTicket = {
    id: nextIncidentId(),
    tenantId: input.tenantId,
    ticketNumber: nextIncidentNumber(input.tenantId),
    title,
    description: errorLog.message,
    status: 'detected',
    severity,
    sourceErrorLogId: errorLog.id,
    internalTaskId: internalTask.id,
    detectedAt: now,
    triagedAt: null,
    resolvedAt: null,
    postmortemRequired: severity === 'critical',
    createdAt: now,
    updatedAt: now,
  };

  errorLog.incidentTicketId = incident.id;
  errorLog.updatedAt = now;
  OPERATIONS_MONITORING_STORE.incidents.push(incident);

  audit({
    tenantId: input.tenantId,
    action: 'incident_created',
    entityType: 'incident_ticket',
    entityId: incident.id,
    actorUserId: actorUserId ?? null,
    actorRoleKey: roleKey ?? null,
    details: `Incident ${incident.ticketNumber} aus Fehlerlog erstellt — interne Aufgabe ${internalTask.id}`,
    metadata: {
      internalTaskId: internalTask.id,
      errorLogId: errorLog.id,
    },
  });

  return { ok: true, data: incident };
}

export function updateIncidentStatus(
  input: UpdateIncidentStatusInput,
  roleKey?: RoleKey | null,
  actorUserId?: string | null,
): ServiceResult<IncidentTicket> {
  const block = assertManageAccess<IncidentTicket>(input.tenantId, roleKey, actorUserId);
  if (block) return block;

  const incident = filterOperationsByTenant(OPERATIONS_MONITORING_STORE.incidents, input.tenantId).find(
    (row) => row.id === input.incidentId,
  );
  if (!incident) return { ok: false, error: 'Incident nicht gefunden.' };

  const now = nowIso();
  const previous = incident.status;
  incident.status = input.status;
  incident.updatedAt = now;

  if (input.status === 'triaged' && !incident.triagedAt) {
    incident.triagedAt = now;
  }
  if ((input.status === 'resolved' || input.status === 'archived') && !incident.resolvedAt) {
    incident.resolvedAt = now;
  }
  if (input.status === 'postmortem_required') {
    incident.postmortemRequired = true;
  }

  audit({
    tenantId: input.tenantId,
    action: 'incident_status_changed',
    entityType: 'incident_ticket',
    entityId: incident.id,
    actorUserId: actorUserId ?? null,
    actorRoleKey: roleKey ?? null,
    details: `Incident ${incident.ticketNumber}: ${previous} → ${input.status}`,
    metadata: { previousStatus: previous, newStatus: input.status },
  });

  return { ok: true, data: incident };
}

export function listBackupStatusRecords(
  tenantId: string,
  roleKey?: RoleKey | null,
): ServiceResult<BackupStatusRecord[]> {
  const block = assertViewAccess<BackupStatusRecord[]>(tenantId, roleKey);
  if (block) return block;

  seedPreparedOperationsMonitoring(tenantId);
  const records = filterOperationsByTenant(OPERATIONS_MONITORING_STORE.backupRecords, tenantId);

  audit({
    tenantId,
    action: 'backup_status_viewed',
    entityType: 'backup_status_record',
    entityId: null,
    actorUserId: null,
    actorRoleKey: roleKey ?? null,
    details: 'Backupstatus abgerufen — keine aktive Backup-Pipeline.',
    metadata: { preparedOnly: 'true', activeBackups: 'false' },
  });

  return { ok: true, data: records };
}

export function listRestoreTestRecords(
  tenantId: string,
  roleKey?: RoleKey | null,
): ServiceResult<RestoreTestRecord[]> {
  const block = assertViewAccess<RestoreTestRecord[]>(tenantId, roleKey);
  if (block) return block;

  seedPreparedOperationsMonitoring(tenantId);
  return {
    ok: true,
    data: filterOperationsByTenant(OPERATIONS_MONITORING_STORE.restoreTests, tenantId),
  };
}

export function listMaintenanceWindows(
  tenantId: string,
  roleKey?: RoleKey | null,
): ServiceResult<MaintenanceWindow[]> {
  const block = assertViewAccess<MaintenanceWindow[]>(tenantId, roleKey);
  if (block) return block;

  seedPreparedOperationsMonitoring(tenantId);
  return {
    ok: true,
    data: filterOperationsByTenant(OPERATIONS_MONITORING_STORE.maintenanceWindows, tenantId),
  };
}

export function listReleaseNotes(
  tenantId: string,
  roleKey?: RoleKey | null,
): ServiceResult<OperationsReleaseNote[]> {
  const block = assertViewAccess<OperationsReleaseNote[]>(tenantId, roleKey);
  if (block) return block;

  seedPreparedOperationsMonitoring(tenantId);
  return {
    ok: true,
    data: filterOperationsByTenant(OPERATIONS_MONITORING_STORE.releaseNotes, tenantId),
  };
}

export function listSystemHealthChecks(
  tenantId: string,
  roleKey?: RoleKey | null,
): ServiceResult<SystemHealthCheck[]> {
  const block = assertViewAccess<SystemHealthCheck[]>(tenantId, roleKey);
  if (block) return block;

  seedPreparedOperationsMonitoring(tenantId);
  return {
    ok: true,
    data: filterOperationsByTenant(OPERATIONS_MONITORING_STORE.healthChecks, tenantId),
  };
}

export function listSystemErrorLogs(
  tenantId: string,
  roleKey?: RoleKey | null,
  category?: SystemErrorCategory,
): ServiceResult<SystemErrorLog[]> {
  const block = assertViewAccess<SystemErrorLog[]>(tenantId, roleKey);
  if (block) return block;

  let rows = filterOperationsByTenant(OPERATIONS_MONITORING_STORE.errorLogs, tenantId);
  if (category) rows = rows.filter((row) => row.category === category);
  return { ok: true, data: rows };
}

export function listIncidentTickets(
  tenantId: string,
  roleKey?: RoleKey | null,
): ServiceResult<IncidentTicket[]> {
  const block = assertViewAccess<IncidentTicket[]>(tenantId, roleKey);
  if (block) return block;

  return {
    ok: true,
    data: filterOperationsByTenant(OPERATIONS_MONITORING_STORE.incidents, tenantId),
  };
}
