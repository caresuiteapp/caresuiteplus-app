import type {
  AssignmentDocumentation,
  ServiceRecord,
  ServiceRecordReview,
  SignatureException,
} from '@/types/modules/assignmentCompletion';
import type { QmCorrectionRequest, QmCockpitAuditEvent, QmServiceRecordReview } from '@/types/modules/qmCockpit';

export type QmCockpitStore = {
  serviceRecords: ServiceRecord[];
  documentations: AssignmentDocumentation[];
  signatureExceptions: SignatureException[];
  serviceRecordReviews: ServiceRecordReview[];
  qmCorrectionRequests: QmCorrectionRequest[];
  qmServiceRecordReviews: QmServiceRecordReview[];
  qmAuditEvents: QmCockpitAuditEvent[];
  documentRegistry: QmDocumentRegistryEntry[];
};

export type QmDocumentRegistryEntry = {
  id: string;
  tenantId: string;
  clientId: string;
  documentType: 'contract' | 'consent' | 'assignment' | 'privacy' | 'confidentiality' | 'signature_pending';
  title: string;
  status: 'missing' | 'draft' | 'pending_signature' | 'signed' | 'finalized';
  version: number;
  finalizedAt: string | null;
  contentHash: string | null;
  createdAt: string;
  updatedAt: string;
};

export const QM_COCKPIT_STORE: QmCockpitStore = {
  serviceRecords: [],
  documentations: [],
  signatureExceptions: [],
  serviceRecordReviews: [],
  qmCorrectionRequests: [],
  qmServiceRecordReviews: [],
  qmAuditEvents: [],
  documentRegistry: [],
};

let serviceRecordCounter = 0;
let documentationCounter = 0;
let signatureExceptionCounter = 0;
let qmCorrectionCounter = 0;
let qmReviewCounter = 0;
let qmAuditCounter = 0;
let documentRegistryCounter = 0;

export function nextServiceRecordId(): string {
  serviceRecordCounter += 1;
  return `sr-${serviceRecordCounter}`;
}

export function nextDocumentationId(): string {
  documentationCounter += 1;
  return `doc-${documentationCounter}`;
}

export function nextSignatureExceptionId(): string {
  signatureExceptionCounter += 1;
  return `sig-exc-${signatureExceptionCounter}`;
}

export function nextQmCorrectionId(): string {
  qmCorrectionCounter += 1;
  return `qm-corr-${qmCorrectionCounter}`;
}

export function nextQmReviewId(): string {
  qmReviewCounter += 1;
  return `qm-rev-${qmReviewCounter}`;
}

export function nextQmAuditId(): string {
  qmAuditCounter += 1;
  return `qm-audit-${qmAuditCounter}`;
}

export function nextDocumentRegistryId(): string {
  documentRegistryCounter += 1;
  return `qm-doc-${documentRegistryCounter}`;
}

export function resetQmCockpitStore(): void {
  QM_COCKPIT_STORE.serviceRecords.length = 0;
  QM_COCKPIT_STORE.documentations.length = 0;
  QM_COCKPIT_STORE.signatureExceptions.length = 0;
  QM_COCKPIT_STORE.serviceRecordReviews.length = 0;
  QM_COCKPIT_STORE.qmCorrectionRequests.length = 0;
  QM_COCKPIT_STORE.qmServiceRecordReviews.length = 0;
  QM_COCKPIT_STORE.qmAuditEvents.length = 0;
  QM_COCKPIT_STORE.documentRegistry.length = 0;
  serviceRecordCounter = 0;
  documentationCounter = 0;
  signatureExceptionCounter = 0;
  qmCorrectionCounter = 0;
  qmReviewCounter = 0;
  qmAuditCounter = 0;
  documentRegistryCounter = 0;
}

export function filterQmByTenant<T extends { tenantId: string }>(items: T[], tenantId: string): T[] {
  return items.filter((item) => item.tenantId === tenantId);
}

export function appendQmAuditEvent(event: Omit<QmCockpitAuditEvent, 'id' | 'createdAt'>): QmCockpitAuditEvent {
  const full: QmCockpitAuditEvent = {
    id: nextQmAuditId(),
    createdAt: new Date().toISOString(),
    ...event,
  };
  QM_COCKPIT_STORE.qmAuditEvents.push(full);
  return full;
}

export function listQmAuditEvents(tenantId: string, entityId?: string): QmCockpitAuditEvent[] {
  if (!tenantId?.trim()) return [];
  return filterQmByTenant(QM_COCKPIT_STORE.qmAuditEvents, tenantId).filter(
    (e) => !entityId || e.entityId === entityId,
  );
}
