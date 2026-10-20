/** Interne Aufgaben & Tickets (Prompt 69) — erweitert management_tasks aus Prompt 65 */

export type InternalTaskType =
  | 'general'
  | 'callback'
  | 'scheduling'
  | 'assignment_change'
  | 'missing_doc_signature'
  | 'correction'
  | 'billing_blocker'
  | 'complaint'
  | 'emergency_followup'
  | 'client_request'
  | 'employee_request'
  | 'sick_leave'
  | 'vacation_prepared'
  | 'material'
  | 'contract_doc_missing'
  | 'privacy_request'
  | 'connect_api_error'
  | 'system_error';

export type InternalTaskStatus =
  | 'open'
  | 'assigned'
  | 'in_progress'
  | 'waiting_for_employee'
  | 'waiting_for_client'
  | 'waiting_for_external'
  | 'waiting_for_management'
  | 'resolved'
  | 'rejected'
  | 'archived'
  | 'escalated';

export type InternalTaskPriority = 'low' | 'normal' | 'high' | 'critical';

export type InternalTaskSource =
  | 'manual'
  | 'auto_trigger'
  | 'client_message'
  | 'employee_message'
  | 'system'
  | 'management_task_bridge';

export type LinkedEntityType =
  | 'assignment'
  | 'client'
  | 'employee'
  | 'invoice'
  | 'document'
  | 'message'
  | 'privacy_request'
  | 'connect_job'
  | 'none';

export type InternalTask = {
  id: string;
  tenantId: string;
  taskType: InternalTaskType;
  status: InternalTaskStatus;
  priority: InternalTaskPriority;
  title: string;
  description: string;
  assignedToUserId: string | null;
  assignedToEmployeeId: string | null;
  createdByUserId: string | null;
  dueAt: string | null;
  resolvedAt: string | null;
  archivedAt: string | null;
  escalatedAt: string | null;
  linkedEntityType: LinkedEntityType;
  linkedEntityId: string | null;
  source: InternalTaskSource;
  /** Intern — nie für Klient:innen sichtbar */
  isInternalOnly: boolean;
  /** Mitarbeitende sehen nur eigene/zugewiesene */
  employeeVisible: boolean;
  managementTaskId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TaskCommentVisibility = 'internal' | 'employee' | 'management';

export type TaskComment = {
  id: string;
  tenantId: string;
  taskId: string;
  authorUserId: string | null;
  authorRoleKey: string | null;
  body: string;
  visibility: TaskCommentVisibility;
  isInternalOnly: boolean;
  employeeVisible: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AttachmentSensitivityLevel = 'public' | 'internal' | 'health_data' | 'billing';

export type TaskAttachment = {
  id: string;
  tenantId: string;
  taskId: string;
  fileName: string;
  mimeType: string;
  sensitivityLevel: AttachmentSensitivityLevel;
  uploadedByUserId: string | null;
  createdAt: string;
};

export type TeamChannelKey =
  | 'internal_admin'
  | 'billing'
  | 'dispatch'
  | 'qm'
  | 'support'
  | 'employee_questions'
  | 'management'
  | 'system_messages';

export type TeamThread = {
  id: string;
  tenantId: string;
  channelKey: TeamChannelKey;
  title: string;
  linkedTaskId: string | null;
  isArchived: boolean;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TeamThreadComment = {
  id: string;
  tenantId: string;
  threadId: string;
  authorUserId: string | null;
  authorDisplayName: string;
  body: string;
  mentions: string[];
  isInternalOnly: boolean;
  createdAt: string;
  updatedAt: string;
};

export type TeamThreadReadStatus = {
  id: string;
  tenantId: string;
  threadId: string;
  userId: string;
  lastReadAt: string;
};

export type InternalTaskViewKey =
  | 'my_tasks'
  | 'team'
  | 'critical'
  | 'overdue'
  | 'billing'
  | 'qm'
  | 'planning'
  | 'employees'
  | 'client_requests'
  | 'system_errors'
  | 'archive';

export type AutoTaskTriggerType =
  | 'cancel_request'
  | 'reschedule_request'
  | 'problem_report'
  | 'emergency_report'
  | 'missing_documentation'
  | 'missing_signature'
  | 'service_record_review'
  | 'invoice_blocked'
  | 'budget_exceeded'
  | 'connect_error'
  | 'privacy_request'
  | 'system_error';

export const INTERNAL_TASK_TYPE_LABELS: Record<InternalTaskType, string> = {
  general: 'Allgemein',
  callback: 'Rückruf',
  scheduling: 'Terminplanung',
  assignment_change: 'Einsatzänderung',
  missing_doc_signature: 'Doku / Unterschrift fehlt',
  correction: 'Korrektur',
  billing_blocker: 'Abrechnungsblocker',
  complaint: 'Beschwerde',
  emergency_followup: 'Notfall-Nachverfolgung',
  client_request: 'Klient:innenanfrage',
  employee_request: 'Mitarbeiteranfrage',
  sick_leave: 'Krankmeldung',
  vacation_prepared: 'Urlaub vorbereitet',
  material: 'Material',
  contract_doc_missing: 'Vertrag / Dokument fehlt',
  privacy_request: 'Datenschutzanfrage',
  connect_api_error: 'Connect / API-Fehler',
  system_error: 'Systemfehler',
};

export const TEAM_CHANNEL_LABELS: Record<TeamChannelKey, string> = {
  internal_admin: 'Interne Verwaltung',
  billing: 'Abrechnung',
  dispatch: 'Disposition',
  qm: 'Qualitätsmanagement',
  support: 'Support',
  employee_questions: 'Mitarbeiterfragen',
  management: 'Management',
  system_messages: 'Systemmeldungen',
};
