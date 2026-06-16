import type { CareBillingValidationReport } from '@/types/careBilling/billingValidation';
import type { ServiceRecord, SignatureException } from '@/types/modules/assignmentCompletion';
import type { ManagementTaskType } from '@/types/modules/liveMonitor';
import type { QmDocumentRegistryEntry } from './qmCockpitStore';
import { createManagementTask } from './managementTaskService';

/** 13 automatische Regeln: Ereignis → Verwaltungsaufgabe (Prompt 65) */
export const MANAGEMENT_TASK_AUTOMATION_RULES = [
  'assignment_documentation_missing',
  'assignment_signature_missing',
  'service_record_review_pending',
  'signature_exception_pending',
  'correction_requested_by_admin',
  'billing_validation_failed',
  'client_cancel_requested',
  'client_reschedule_requested',
  'problem_reported',
  'emergency_reported',
  'no_show_reported',
  'budget_warning',
  'employee_late_or_overrun',
] as const;

export type ManagementTaskAutomationRule = (typeof MANAGEMENT_TASK_AUTOMATION_RULES)[number];

export function onAssignmentDocumentationMissing(input: {
  tenantId: string;
  assignmentId: string;
  clientId: string;
  employeeId: string | null;
}): void {
  createManagementTask({
    tenantId: input.tenantId,
    taskType: 'missing_documentation',
    assignmentId: input.assignmentId,
    clientId: input.clientId,
    employeeId: input.employeeId,
    relatedEntityType: 'assignment',
    relatedEntityId: input.assignmentId,
    priority: 'high',
  });
}

export function onAssignmentSignatureMissing(input: {
  tenantId: string;
  assignmentId: string;
  clientId: string;
  employeeId: string | null;
}): void {
  createManagementTask({
    tenantId: input.tenantId,
    taskType: 'missing_signature',
    assignmentId: input.assignmentId,
    clientId: input.clientId,
    employeeId: input.employeeId,
    relatedEntityType: 'assignment',
    relatedEntityId: input.assignmentId,
    priority: 'high',
  });
}

export function onServiceRecordReviewPending(record: ServiceRecord): void {
  createManagementTask({
    tenantId: record.tenantId,
    taskType: 'review_service_record',
    assignmentId: record.assignmentId,
    clientId: record.clientId,
    employeeId: record.employeeId,
    relatedEntityType: 'service_record',
    relatedEntityId: record.id,
    priority: 'normal',
    metadata: { serviceRecordStatus: record.status },
  });
}

export function onSignatureExceptionPending(exception: SignatureException): void {
  createManagementTask({
    tenantId: exception.tenantId,
    taskType: 'review_exception',
    assignmentId: exception.assignmentId,
    relatedEntityType: 'signature',
    relatedEntityId: exception.id,
    priority: 'high',
    description: exception.reason,
  });
}

export function onCorrectionRequested(input: {
  tenantId: string;
  assignmentId: string;
  correctionId: string;
  employeeId: string;
  dueAt?: string | null;
  reason: string;
  createdBy?: string | null;
}): void {
  createManagementTask({
    tenantId: input.tenantId,
    taskType: 'correction_requested',
    assignmentId: input.assignmentId,
    employeeId: input.employeeId,
    assignedTo: input.employeeId,
    relatedEntityType: 'correction_request',
    relatedEntityId: input.correctionId,
    dueAt: input.dueAt ?? null,
    priority: 'high',
    description: input.reason,
    createdBy: input.createdBy ?? null,
  });
}

export function onBillingValidationFailed(input: {
  tenantId: string;
  clientId: string;
  assignmentId?: string | null;
  billableItemId?: string | null;
  report: CareBillingValidationReport;
}): void {
  createManagementTask({
    tenantId: input.tenantId,
    taskType: 'billing_blocker',
    assignmentId: input.assignmentId ?? null,
    clientId: input.clientId,
    relatedEntityType: 'billable_item',
    relatedEntityId: input.billableItemId ?? input.report.validationRunId,
    priority: 'high',
    description: input.report.blockedReason ?? 'Abrechnung blockiert',
    metadata: { failedCount: String(input.report.failedCount) },
  });
}

export function onClientCancelRequested(input: {
  tenantId: string;
  assignmentId: string;
  clientId: string;
  reason?: string;
}): void {
  createManagementTask({
    tenantId: input.tenantId,
    taskType: 'client_cancel_request',
    assignmentId: input.assignmentId,
    clientId: input.clientId,
    relatedEntityType: 'assignment',
    relatedEntityId: input.assignmentId,
    priority: 'high',
    description: input.reason ?? 'Absageanfrage',
  });
}

export function onClientRescheduleRequested(input: {
  tenantId: string;
  assignmentId: string;
  clientId: string;
  reason?: string;
}): void {
  createManagementTask({
    tenantId: input.tenantId,
    taskType: 'client_reschedule_request',
    assignmentId: input.assignmentId,
    clientId: input.clientId,
    relatedEntityType: 'assignment',
    relatedEntityId: input.assignmentId,
    priority: 'high',
    description: input.reason ?? 'Verschiebungsanfrage',
  });
}

export function onProblemReported(input: {
  tenantId: string;
  assignmentId: string;
  clientId: string;
  employeeId: string;
  description: string;
  reportType: string;
}): void {
  createManagementTask({
    tenantId: input.tenantId,
    taskType: 'problem_report',
    assignmentId: input.assignmentId,
    clientId: input.clientId,
    employeeId: input.employeeId,
    relatedEntityType: 'assignment',
    relatedEntityId: input.assignmentId,
    priority: 'critical',
    description: input.description,
    metadata: { reportType: input.reportType },
  });
}

export function onEmergencyReported(input: {
  tenantId: string;
  assignmentId: string;
  clientId: string;
  employeeId: string;
  description: string;
}): void {
  createManagementTask({
    tenantId: input.tenantId,
    taskType: 'emergency_follow_up',
    assignmentId: input.assignmentId,
    clientId: input.clientId,
    employeeId: input.employeeId,
    relatedEntityType: 'assignment',
    relatedEntityId: input.assignmentId,
    priority: 'critical',
    description: input.description,
    dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  });
}

export function onNoShowReported(input: {
  tenantId: string;
  assignmentId: string;
  clientId: string;
  employeeId: string;
}): void {
  createManagementTask({
    tenantId: input.tenantId,
    taskType: 'no_show_follow_up',
    assignmentId: input.assignmentId,
    clientId: input.clientId,
    employeeId: input.employeeId,
    relatedEntityType: 'assignment',
    relatedEntityId: input.assignmentId,
    priority: 'high',
  });
}

export function onBudgetWarning(input: {
  tenantId: string;
  clientId: string;
  assignmentId?: string | null;
  message: string;
}): void {
  createManagementTask({
    tenantId: input.tenantId,
    taskType: 'budget_warning',
    assignmentId: input.assignmentId ?? null,
    clientId: input.clientId,
    relatedEntityType: 'client',
    relatedEntityId: input.clientId,
    priority: 'high',
    description: input.message,
  });
}

export function onEmployeeLateOrOverrun(input: {
  tenantId: string;
  assignmentId: string;
  clientId: string;
  employeeId: string | null;
  delayMinutes?: number | null;
  overrunMinutes?: number | null;
}): void {
  const parts: string[] = [];
  if (input.delayMinutes != null && input.delayMinutes > 0) {
    parts.push(`Verspätung ${input.delayMinutes} Min.`);
  }
  if (input.overrunMinutes != null && input.overrunMinutes > 0) {
    parts.push(`Überzug ${input.overrunMinutes} Min.`);
  }
  createManagementTask({
    tenantId: input.tenantId,
    taskType: 'employee_late',
    assignmentId: input.assignmentId,
    clientId: input.clientId,
    employeeId: input.employeeId,
    relatedEntityType: 'assignment',
    relatedEntityId: input.assignmentId,
    priority: input.overrunMinutes != null && input.overrunMinutes > 30 ? 'critical' : 'high',
    description: parts.join(' · ') || 'Verspätung/Überzug',
    metadata: {
      delayMinutes: String(input.delayMinutes ?? 0),
      overrunMinutes: String(input.overrunMinutes ?? 0),
    },
  });
}

export function onMissingDocument(doc: QmDocumentRegistryEntry): void {
  const taskType: ManagementTaskType =
    doc.documentType === 'consent' ? 'missing_consent' : 'missing_contract';
  createManagementTask({
    tenantId: doc.tenantId,
    taskType,
    clientId: doc.clientId,
    relatedEntityType: 'document',
    relatedEntityId: doc.id,
    priority: 'normal',
    description: `${doc.title} fehlt`,
  });
}

export function onComplaint(input: {
  tenantId: string;
  clientId: string;
  assignmentId?: string | null;
  description: string;
}): void {
  createManagementTask({
    tenantId: input.tenantId,
    taskType: 'complaint',
    assignmentId: input.assignmentId ?? null,
    clientId: input.clientId,
    relatedEntityType: 'client',
    relatedEntityId: input.clientId,
    priority: 'high',
    description: input.description,
  });
}
