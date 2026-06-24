import type { AssignmentStatus } from './assignmentStatus';
import type { CanonicalAssignmentStatus } from './assignmentWorkflow';

/** Anzeige-Status für Tagesmonitor (deutsch, inkl. Anfrage-/Problemzustände) */
export type DayMonitorDisplayStatus =
  | 'geplant'
  | 'unterwegs'
  | 'angekommen'
  | 'gestartet'
  | 'pausiert'
  | 'beendet'
  | 'doku_fehlt'
  | 'signatur_fehlt'
  | 'abgeschlossen'
  | 'kritisch'
  | 'abgesagt'
  | 'verschoben'
  | 'nicht_angetroffen';

export const DAY_MONITOR_STATUS_COLORS: Record<DayMonitorDisplayStatus, string> = {
  geplant: '#94a3b8',
  unterwegs: '#3b82f6',
  angekommen: '#06b6d4',
  gestartet: '#22c55e',
  pausiert: '#eab308',
  beendet: '#64748b',
  doku_fehlt: '#f97316',
  signatur_fehlt: '#fb923c',
  abgeschlossen: '#10b981',
  kritisch: '#ef4444',
  abgesagt: '#71717a',
  verschoben: '#a855f7',
  nicht_angetroffen: '#78716c',
};

export type LiveOperationEventType =
  | 'assignment_created'
  | 'assignment_assigned'
  | 'assignment_updated'
  | 'assignment_cancel_requested'
  | 'assignment_reschedule_requested'
  | 'employee_on_the_way'
  | 'employee_arrived'
  | 'assignment_started'
  | 'assignment_paused'
  | 'assignment_resumed'
  | 'assignment_finished'
  | 'documentation_added'
  | 'signature_added'
  | 'assignment_completed'
  | 'problem_reported'
  | 'emergency_reported'
  | 'no_show_reported'
  | 'correction_requested'
  | 'correction_completed'
  | 'billing_ready';

export type LiveEventSource = 'employee_portal' | 'administration' | 'client_portal' | 'system' | 'automation';

export type LiveOperationEvent = {
  id: string;
  tenantId: string;
  assignmentId: string;
  actorUserId: string | null;
  actorRole: string | null;
  oldStatus: AssignmentStatus | CanonicalAssignmentStatus | null;
  newStatus: AssignmentStatus | CanonicalAssignmentStatus | null;
  eventType: LiveOperationEventType;
  eventTime: string;
  source: LiveEventSource;
  metadata: Record<string, string>;
  ipAddress?: string | null;
  deviceId?: string | null;
  locationNote?: string | null;
};

export type MonitorAuditEvent = {
  id: string;
  tenantId: string;
  assignmentId: string;
  clientId: string | null;
  documentId: string | null;
  action: string;
  actorUserId: string | null;
  actorRole: string | null;
  beforeState: Record<string, string> | null;
  afterState: Record<string, string> | null;
  source: LiveEventSource;
  reason: string | null;
  createdAt: string;
};

export type NotificationChannel = 'in_app' | 'push' | 'email' | 'sms' | 'whatsapp';

export type NotificationPriority = 'normal' | 'high' | 'critical';

export type MonitorNotification = {
  id: string;
  tenantId: string;
  assignmentId: string | null;
  recipientType: 'admin' | 'employee' | 'client';
  recipientId: string | null;
  channel: NotificationChannel;
  priority: NotificationPriority;
  eventType: LiveOperationEventType | string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
};

export type NotificationPreference = {
  id: string;
  tenantId: string;
  userId: string;
  channel: NotificationChannel;
  eventType: string;
  enabled: boolean;
};

export type NotificationDelivery = {
  id: string;
  notificationId: string;
  channel: NotificationChannel;
  status: 'pending' | 'sent' | 'failed' | 'skipped';
  attemptedAt: string | null;
  errorMessage: string | null;
};

export type ManagementTaskType =
  | 'cancel_review'
  | 'reschedule_review'
  | 'missing_documentation'
  | 'missing_signature'
  | 'problem_review'
  | 'emergency_review'
  | 'correction_review'
  | 'correction_requested'
  | 'billing_release'
  | 'billing_blocker'
  | 'service_proof_review'
  | 'review_service_record'
  | 'review_exception'
  | 'client_cancel_request'
  | 'client_reschedule_request'
  | 'problem_report'
  | 'emergency_follow_up'
  | 'no_show_follow_up'
  | 'employee_late'
  | 'complaint'
  | 'missing_contract'
  | 'missing_consent'
  | 'budget_warning'
  | 'audit_review'
  | 'master_data_review';

export type ManagementTaskStatus =
  | 'open'
  | 'in_progress'
  | 'waiting_for_employee'
  | 'waiting_for_client'
  | 'resolved'
  | 'archived';

export type ManagementTaskPriority = NotificationPriority;

export type ManagementTask = {
  id: string;
  tenantId: string;
  assignmentId: string;
  taskType: ManagementTaskType;
  status: ManagementTaskStatus;
  title: string;
  description: string;
  priority: ManagementTaskPriority;
  clientId: string | null;
  employeeId: string | null;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  dueAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  metadata?: Record<string, string>;
};

export type ProblemReportType =
  | 'no_show'
  | 'access_denied'
  | 'health_issue'
  | 'fall'
  | 'aggressive_behavior'
  | 'not_feasible'
  | 'emergency'
  | 'callback_required';

export type ProblemReport = {
  id: string;
  tenantId: string;
  assignmentId: string;
  employeeId: string;
  reportType: ProblemReportType;
  description: string;
  createdAt: string;
};

export type EmergencyReport = {
  id: string;
  tenantId: string;
  assignmentId: string;
  employeeId: string;
  description: string;
  protocolPrepared: boolean;
  createdAt: string;
};

export type CorrectionRequest = {
  id: string;
  tenantId: string;
  assignmentId: string;
  requestedBy: string;
  reason: string;
  status: 'open' | 'completed';
  createdAt: string;
  completedAt: string | null;
};

export type DayMonitorAssignmentRow = {
  assignmentId: string;
  tenantId: string;
  title: string;
  employeeId: string | null;
  clientId: string;
  status: AssignmentStatus;
  canonicalStatus: CanonicalAssignmentStatus;
  displayStatus: DayMonitorDisplayStatus;
  statusColor: string;
  plannedStartAt: string;
  plannedEndAt: string;
  actualStartAt: string | null;
  actualEndAt: string | null;
  delayMinutes: number | null;
  overrunMinutes: number | null;
  docStatus: 'ok' | 'missing' | 'na';
  signatureStatus: 'ok' | 'missing' | 'na';
  problemStatus: 'none' | 'reported' | 'emergency';
  cancelRequest: boolean;
  rescheduleRequest: boolean;
};

export type LiveMonitorActorContext = {
  userId: string | null;
  roleKey: string | null;
  employeeId?: string | null;
  clientId?: string | null;
  source?: LiveEventSource;
  ipAddress?: string | null;
  deviceId?: string | null;
  locationNote?: string | null;
};
