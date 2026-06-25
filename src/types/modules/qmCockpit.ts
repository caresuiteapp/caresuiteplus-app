import type {
  ManagementTask,
  ManagementTaskPriority,
  ManagementTaskStatus,
  ManagementTaskType,
} from './liveMonitor';

/** Neun Cockpit-Bereiche (Prompt 65) */
export type QmCockpitAreaKey =
  | 'heute_kritisch'
  | 'doku_fehlt'
  | 'signatur_fehlt'
  | 'pruefung_offen'
  | 'korrektur_angefordert'
  | 'abrechnungsbereit'
  | 'abrechnungsblocker'
  | 'dokumente'
  | 'qualitaet';

export const QM_COCKPIT_AREA_LABELS: Record<QmCockpitAreaKey, string> = {
  heute_kritisch: 'Heute kritisch',
  doku_fehlt: 'Doku fehlt',
  signatur_fehlt: 'Signatur fehlt',
  pruefung_offen: 'Prüfung offen',
  korrektur_angefordert: 'Korrektur angefordert',
  abrechnungsbereit: 'Abrechnungsbereit',
  abrechnungsblocker: 'Abrechnungsblocker',
  dokumente: 'Dokumente',
  qualitaet: 'Qualität',
};

export type QmCockpitRelatedEntityType =
  | 'assignment'
  | 'service_record'
  | 'documentation'
  | 'signature'
  | 'billable_item'
  | 'document'
  | 'client'
  | 'employee'
  | 'correction_request';

export type QmCockpitItem = {
  id: string;
  area: QmCockpitAreaKey;
  taskId: string | null;
  title: string;
  description: string;
  priority: ManagementTaskPriority;
  status: ManagementTaskStatus;
  clientId: string | null;
  employeeId: string | null;
  assignmentId: string | null;
  relatedEntityType: QmCockpitRelatedEntityType | null;
  relatedEntityId: string | null;
  dueAt: string | null;
  updatedAt: string;
  metadata?: Record<string, string>;
};

export type QmCockpitAreaSnapshot = {
  area: QmCockpitAreaKey;
  label: string;
  openCount: number;
  criticalCount: number;
  items: QmCockpitItem[];
};

export type QmCockpitSnapshot = {
  tenantId: string;
  generatedAt: string;
  totalOpen: number;
  totalCritical: number;
  areas: QmCockpitAreaSnapshot[];
};

export type QmCockpitListFilter = {
  area?: QmCockpitAreaKey;
  status?: ManagementTaskStatus;
  priority?: ManagementTaskPriority;
  assignmentId?: string;
  clientId?: string;
  employeeId?: string;
  search?: string;
  assignedTo?: string;
};

export type CorrectionAffectedArea =
  | 'documentation'
  | 'times'
  | 'task_status'
  | 'signature_exception'
  | 'service_proof'
  | 'billing_data';

export const CORRECTION_AFFECTED_AREA_LABELS: Record<CorrectionAffectedArea, string> = {
  documentation: 'Dokumentation',
  times: 'Zeiten',
  task_status: 'Aufgabenstatus',
  signature_exception: 'Signatur-Ausnahme',
  service_proof: 'Leistungsnachweis',
  billing_data: 'Abrechnungsdaten',
};

export type QmCorrectionRequestStatus = 'open' | 'in_progress' | 'waiting_for_employee' | 'resolved' | 'rejected';

export type QmCorrectionRequest = {
  id: string;
  tenantId: string;
  assignmentId: string;
  serviceRecordId: string | null;
  requestedBy: string;
  assignedToEmployeeId: string;
  affectedArea: CorrectionAffectedArea;
  reason: string;
  requiredResponse: string;
  dueAt: string | null;
  status: QmCorrectionRequestStatus;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
  documentVersion: number;
  correctedFromDocumentId: string | null;
};

export type QmReviewDecision = 'approved' | 'rejected' | 'correction_requested';

export type QmServiceRecordReview = {
  id: string;
  tenantId: string;
  serviceRecordId: string;
  assignmentId: string;
  reviewerId: string;
  decision: QmReviewDecision;
  internalNote: string;
  reviewedAt: string;
  billingReady: boolean;
};

export type QmCockpitAuditEvent = {
  id: string;
  tenantId: string;
  action: string;
  entityType: string;
  entityId: string;
  assignmentId: string | null;
  actorId: string | null;
  summary: string;
  metadata?: Record<string, string>;
  createdAt: string;
};

/** Zuordnung Aufgabentyp → Cockpit-Bereich */
export const MANAGEMENT_TASK_AREA_MAP: Partial<Record<ManagementTaskType, QmCockpitAreaKey>> = {
  missing_documentation: 'doku_fehlt',
  missing_signature: 'signatur_fehlt',
  review_service_record: 'pruefung_offen',
  review_exception: 'pruefung_offen',
  correction_requested: 'korrektur_angefordert',
  correction_review: 'korrektur_angefordert',
  billing_blocker: 'abrechnungsblocker',
  billing_release: 'abrechnungsbereit',
  client_cancel_request: 'heute_kritisch',
  cancel_review: 'heute_kritisch',
  client_reschedule_request: 'heute_kritisch',
  reschedule_review: 'heute_kritisch',
  problem_report: 'heute_kritisch',
  problem_review: 'heute_kritisch',
  emergency_follow_up: 'heute_kritisch',
  emergency_review: 'heute_kritisch',
  no_show_follow_up: 'heute_kritisch',
  employee_late: 'heute_kritisch',
  complaint: 'qualitaet',
  missing_contract: 'dokumente',
  missing_consent: 'dokumente',
  budget_warning: 'abrechnungsblocker',
  audit_review: 'qualitaet',
  master_data_review: 'qualitaet',
  service_proof_review: 'pruefung_offen',
};

export function managementTaskToCockpitItem(task: ManagementTask): QmCockpitItem {
  const area = MANAGEMENT_TASK_AREA_MAP[task.taskType] ?? 'qualitaet';
  return {
    id: `cockpit-${task.id}`,
    area,
    taskId: task.id,
    title: task.title,
    description: task.description,
    priority: task.priority,
    status: task.status,
    clientId: task.clientId,
    employeeId: task.employeeId,
    assignmentId: task.assignmentId,
    relatedEntityType: task.relatedEntityType as QmCockpitRelatedEntityType | null,
    relatedEntityId: task.relatedEntityId,
    dueAt: task.dueAt,
    updatedAt: task.updatedAt,
    metadata: task.metadata,
  };
}
