/** Betrieb, Backup, Monitoring & Incident Management — Mehr → System → Betrieb & Monitoring */

import type { RoleKey } from '../core/auth';
import type { TenantScopedEntity } from '../core/base';

/** 10 Bereiche im Modul-Hub */
export type OperationsMonitoringAreaKey =
  | 'system_status'
  | 'error_logs'
  | 'sync_errors'
  | 'edge_function_errors'
  | 'connect_errors'
  | 'backup_status'
  | 'restore_tests'
  | 'incident_tickets'
  | 'maintenance_windows'
  | 'release_notes';

export type SystemHealthStatus =
  | 'healthy'
  | 'degraded'
  | 'unhealthy'
  | 'unknown'
  | 'prepared';

export type SystemErrorCategory =
  | 'general'
  | 'sync'
  | 'edge_function'
  | 'connect'
  | 'auth'
  | 'database';

export type SystemErrorSeverity = 'info' | 'warning' | 'error' | 'critical';

export type IncidentTicketStatus =
  | 'detected'
  | 'triaged'
  | 'in_progress'
  | 'mitigated'
  | 'resolved'
  | 'postmortem_required'
  | 'archived';

export type BackupOperationalStatus =
  | 'not_configured'
  | 'prepared'
  | 'unknown';

export type RestoreTestStatus = 'prepared' | 'not_run' | 'passed' | 'failed';

export type MaintenanceWindowStatus = 'scheduled' | 'active' | 'completed' | 'cancelled' | 'prepared';

export type OperationsAuditAction =
  | 'health_check_recorded'
  | 'error_logged'
  | 'incident_created'
  | 'incident_status_changed'
  | 'backup_status_viewed'
  | 'restore_test_viewed'
  | 'maintenance_window_viewed'
  | 'release_note_viewed';

export type SystemHealthCheck = TenantScopedEntity & {
  component: string;
  status: SystemHealthStatus;
  lastCheckedAt: string;
  message: string;
  preparedOnly: boolean;
  /** Kein 24/7-Versprechen — nur letzter bekannter Check */
  availabilityNote: string;
};

export type SystemErrorLog = TenantScopedEntity & {
  source: string;
  category: SystemErrorCategory;
  severity: SystemErrorSeverity;
  message: string;
  errorCode: string | null;
  correlationId: string | null;
  metadata: Record<string, string>;
  acknowledgedAt: string | null;
  incidentTicketId: string | null;
};

export type IncidentTicket = TenantScopedEntity & {
  ticketNumber: string;
  title: string;
  description: string;
  status: IncidentTicketStatus;
  severity: SystemErrorSeverity;
  sourceErrorLogId: string | null;
  internalTaskId: string | null;
  detectedAt: string;
  triagedAt: string | null;
  resolvedAt: string | null;
  postmortemRequired: boolean;
};

export type BackupStatusRecord = TenantScopedEntity & {
  scope: 'database' | 'storage' | 'edge_functions' | 'full';
  status: BackupOperationalStatus;
  lastBackupAt: string | null;
  retentionDays: number | null;
  preparedOnly: boolean;
  message: string;
};

export type RestoreTestRecord = TenantScopedEntity & {
  scope: 'database' | 'storage' | 'full';
  status: RestoreTestStatus;
  testedAt: string | null;
  preparedOnly: boolean;
  message: string;
};

export type MaintenanceWindow = TenantScopedEntity & {
  title: string;
  description: string;
  scheduledStart: string;
  scheduledEnd: string;
  status: MaintenanceWindowStatus;
  preparedOnly: boolean;
};

export type OperationsReleaseNote = TenantScopedEntity & {
  version: string;
  title: string;
  body: string;
  publishedAt: string;
  preparedOnly: boolean;
};

export type OperationsAuditEvent = TenantScopedEntity & {
  action: OperationsAuditAction;
  entityType: string;
  entityId: string | null;
  actorUserId: string | null;
  actorRoleKey: RoleKey | null;
  details: string;
  metadata: Record<string, string>;
};

export type OperationsMonitoringAreaSummary = {
  areaKey: OperationsMonitoringAreaKey;
  label: string;
  route: string;
  preparedOnly: boolean;
  openCount: number;
  statusLabel: string;
};

export type OperationsMonitoringDashboard = {
  tenantId: string;
  overallStatus: SystemHealthStatus;
  availabilityDisclaimer: string;
  openIncidents: number;
  openErrors: number;
  preparedAreasCount: number;
  lastHealthCheckAt: string | null;
  areas: OperationsMonitoringAreaSummary[];
};

export type LogSystemErrorInput = {
  tenantId: string;
  source: string;
  category: SystemErrorCategory;
  severity: SystemErrorSeverity;
  message: string;
  errorCode?: string | null;
  correlationId?: string | null;
  metadata?: Record<string, string>;
};

export type CreateIncidentFromErrorInput = {
  tenantId: string;
  errorLogId: string;
  title?: string;
  severity?: SystemErrorSeverity;
};

export type UpdateIncidentStatusInput = {
  tenantId: string;
  incidentId: string;
  status: IncidentTicketStatus;
};

export const OPERATIONS_MONITORING_AREA_LABELS: Record<OperationsMonitoringAreaKey, string> = {
  system_status: 'Systemstatus',
  error_logs: 'Fehlerlogs',
  sync_errors: 'Sync-Fehler',
  edge_function_errors: 'Edge Function Fehler',
  connect_errors: 'Connect-Fehler',
  backup_status: 'Backupstatus',
  restore_tests: 'Wiederherstellung',
  incident_tickets: 'Incident Tickets',
  maintenance_windows: 'Wartungsfenster',
  release_notes: 'Release Notes',
};

export const PREPARED_OPERATIONS_AREAS: OperationsMonitoringAreaKey[] = [
  'backup_status',
  'restore_tests',
  'maintenance_windows',
];

export const INCIDENT_OPEN_STATUSES: IncidentTicketStatus[] = [
  'detected',
  'triaged',
  'in_progress',
  'mitigated',
  'postmortem_required',
];
