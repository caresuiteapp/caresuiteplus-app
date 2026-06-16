import type { AssignmentStatus } from './assignmentStatus';

/** Abschluss-Statuskette (Prompt 62) */
export type CompletionChainStatus =
  | 'finished'
  | 'documentation_pending'
  | 'signature_pending'
  | 'review_pending'
  | 'review_pending_exception'
  | 'billing_ready'
  | 'completed'
  | 'locked'
  | 'correction_requested'
  | 'corrected';

export const COMPLETION_CHAIN_STATUS_LABELS: Record<CompletionChainStatus, string> = {
  finished: 'Beendet',
  documentation_pending: 'Dokumentation ausstehend',
  signature_pending: 'Unterschrift ausstehend',
  review_pending: 'Prüfung ausstehend',
  review_pending_exception: 'Prüfung (Ausnahme)',
  billing_ready: 'Abrechnungsbereit',
  completed: 'Abgeschlossen',
  locked: 'Gesperrt',
  correction_requested: 'Korrektur angefordert',
  corrected: 'Korrigiert',
};

export type AssignmentDocumentation = {
  id: string;
  tenantId: string;
  assignmentId: string;
  clientId: string;
  employeeId: string;
  summary: string;
  performedTasks: string;
  observations: string;
  deviations: string;
  followUpRequired: boolean;
  documentedAt: string;
  sisNotes?: string | null;
  vitals?: string | null;
  bodyMapRef?: string | null;
  woundDocRef?: string | null;
  photoRefs?: string[];
  emergencyProtocolRef?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AssignmentCompletionCheck = {
  id: string;
  tenantId: string;
  assignmentId: string;
  actualTimesOk: boolean;
  durationOk: boolean;
  tasksHandledOk: boolean;
  documentationOk: boolean;
  deviationsDocumented: boolean;
  signatureOk: boolean;
  signatureExceptionOk: boolean;
  blockingErrors: string[];
  checkedAt: string;
};

export type AssignmentSignatureType =
  | 'assignment'
  | 'service_proof'
  | 'document'
  | 'representative'
  | 'employee';

export type AssignmentSignature = {
  id: string;
  tenantId: string;
  assignmentId: string;
  clientId: string;
  documentId: string | null;
  signatureType: AssignmentSignatureType;
  signerName: string;
  signerRole: string;
  signatureData: string;
  signaturePath: string | null;
  signedAt: string;
  capturedBy: string;
  deviceInfo: string | null;
  contentHash: string;
  auditEventId: string;
};

export type SignatureException = {
  id: string;
  tenantId: string;
  assignmentId: string;
  reason: string;
  requestedBy: string;
  reviewedBy: string | null;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  resolvedAt: string | null;
};

export type ServiceRecordStatus =
  | 'draft'
  | 'generated'
  | 'signature_pending'
  | 'signed'
  | 'review_pending'
  | 'approved'
  | 'rejected'
  | 'corrected'
  | 'billing_ready'
  | 'archived';

export type ServiceRecord = {
  id: string;
  tenantId: string;
  assignmentId: string;
  clientId: string;
  careLevel: string;
  payer: string;
  employeeId: string;
  deploymentDate: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  serviceType: string;
  tasksSummary: string;
  documentationId: string;
  signatureId: string | null;
  signatureExceptionId: string | null;
  budgetAllocation: string;
  billingAmountCents: number;
  status: ServiceRecordStatus;
  version: number;
  correctedFromId: string | null;
  lockedAt: string | null;
  contentHash: string | null;
  pdfPath: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ServiceRecordReviewDecision = 'approved' | 'rejected' | 'correction_requested';

export type ServiceRecordReview = {
  id: string;
  tenantId: string;
  serviceRecordId: string;
  reviewerId: string;
  decision: ServiceRecordReviewDecision;
  internalNote: string;
  reviewedAt: string;
};

export type BillingReadyItem = {
  id: string;
  tenantId: string;
  serviceRecordId: string;
  clientId: string;
  payer: string;
  serviceType: string;
  budgetCode: string;
  rateCents: number;
  taxRatePercent: number;
  invoiceRecipient: string;
  amountCents: number;
  status: 'draft' | 'billing_ready' | 'invoiced';
  createdAt: string;
};

export type BillingPreparationBatch = {
  id: string;
  tenantId: string;
  itemIds: string[];
  status: 'draft' | 'prepared' | 'sent';
  preparedAt: string | null;
  createdAt: string;
};

export type CorrectionRequest = {
  id: string;
  tenantId: string;
  serviceRecordId: string;
  assignmentId: string;
  requestedBy: string;
  assignedToEmployeeId: string;
  reason: string;
  status: 'open' | 'in_progress' | 'resolved';
  createdAt: string;
  resolvedAt: string | null;
};

export type DocumentArchiveEntry = {
  id: string;
  tenantId: string;
  assignmentId: string;
  serviceRecordId: string;
  pdfPath: string;
  contentHash: string;
  archivedAt: string;
  auditEventId: string;
};

export type CompletionAuditEvent = {
  id: string;
  tenantId: string;
  assignmentId: string;
  entityType: 'documentation' | 'signature' | 'service_record' | 'billing' | 'archive' | 'correction';
  entityId: string;
  action: string;
  actorId: string | null;
  summary: string;
  metadata?: Record<string, string>;
  createdAt: string;
};

export type CompletionMonitorArea =
  | 'missing_doc'
  | 'missing_signature'
  | 'review_pending'
  | 'correction_requested'
  | 'billing_ready'
  | 'rejected'
  | 'exception_review';

export type CompletionMonitorItem = {
  area: CompletionMonitorArea;
  assignmentId: string;
  serviceRecordId?: string;
  clientId: string;
  employeeId: string | null;
  title: string;
  status: CompletionChainStatus | ServiceRecordStatus;
  updatedAt: string;
};

/** Mapping lokaler AssignmentStatus → Abschlusskette */
export function assignmentStatusToCompletionStatus(status: AssignmentStatus): CompletionChainStatus {
  const map: Partial<Record<AssignmentStatus, CompletionChainStatus>> = {
    beendet: 'finished',
    dokumentation_offen: 'documentation_pending',
    unterschrift_offen: 'signature_pending',
    abgeschlossen: 'completed',
  };
  return map[status] ?? 'finished';
}
