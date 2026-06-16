/** Dokumenteneingang — Upload, Scan, Zuordnung, OCR-Vorbereitung, Archivierung. */

import type { ISODateTime, TenantScopedEntity } from '@/types/core/base';
import type { OcrProviderKey } from '@/types/documents/connect';

export type DocumentInboxSource =
  | 'upload'
  | 'scan_prepared'
  | 'email_kim_prepared'
  | 'employee_portal'
  | 'client_portal'
  | 'admin_upload'
  | 'connect_prepared';

export type DocumentInboxStatus =
  | 'uploaded'
  | 'classification_pending'
  | 'ocr_pending'
  | 'review_required'
  | 'linked'
  | 'archived'
  | 'rejected'
  | 'deleted';

export type DocumentInboxCategory =
  | 'general'
  | 'invoice'
  | 'contract'
  | 'care_plan'
  | 'consent'
  | 'personnel'
  | 'correspondence'
  | 'other';

export type DocumentEntityLinkType = 'client' | 'assignment' | 'invoice' | 'personnel';

export type ClassificationConfidence = 'high' | 'medium' | 'low' | 'unknown';

export type DocumentReviewTaskStatus = 'open' | 'in_progress' | 'resolved' | 'rejected';

export type DocumentInboxOcrJobStatus =
  | 'prepared'
  | 'blocked'
  | 'pending_approval'
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type DocumentInboxAuditEventType =
  | 'item_uploaded'
  | 'category_set'
  | 'classification_completed'
  | 'review_task_created'
  | 'ocr_prepared'
  | 'ocr_blocked'
  | 'entity_linked'
  | 'auto_link_skipped'
  | 'archived'
  | 'rejected'
  | 'deleted'
  | 'status_changed';

export type DocumentInboxItem = TenantScopedEntity & {
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  storageReference: string | null;
  source: DocumentInboxSource;
  status: DocumentInboxStatus;
  category: DocumentInboxCategory | null;
  containsHealthData: boolean;
  uploadedByUserId: string | null;
  title: string | null;
  notes: string | null;
  archivedAt: ISODateTime | null;
  rejectedAt: ISODateTime | null;
  deletedAt: ISODateTime | null;
};

export type DocumentClassificationResult = TenantScopedEntity & {
  inboxItemId: string;
  suggestedCategory: DocumentInboxCategory | null;
  suggestedEntityType: DocumentEntityLinkType | null;
  suggestedEntityId: string | null;
  confidence: ClassificationConfidence;
  requiresReview: boolean;
  modelVersion: string | null;
  rawHints: Record<string, string>;
};

export type DocumentInboxOcrJob = TenantScopedEntity & {
  inboxItemId: string;
  providerKey: OcrProviderKey;
  status: DocumentInboxOcrJobStatus;
  containsHealthData: boolean;
  externalTransfer: boolean;
  approvalRequired: boolean;
  errorSummary: string | null;
};

export type DocumentEntityLink = TenantScopedEntity & {
  inboxItemId: string;
  entityType: DocumentEntityLinkType;
  entityId: string;
  linkedByUserId: string | null;
  isConfirmed: boolean;
};

export type DocumentReviewTask = TenantScopedEntity & {
  inboxItemId: string;
  status: DocumentReviewTaskStatus;
  title: string;
  description: string;
  assignedToUserId: string | null;
  resolvedAt: ISODateTime | null;
  resolutionNote: string | null;
};

export type DocumentInboxAuditEvent = TenantScopedEntity & {
  inboxItemId: string;
  eventType: DocumentInboxAuditEventType;
  summary: string;
  oldStatus: DocumentInboxStatus | null;
  newStatus: DocumentInboxStatus | null;
  actorUserId: string | null;
  metadata: Record<string, string>;
};

export type DocumentInboxExecutionContext = {
  tenantId: string;
  ocrProviderKey: OcrProviderKey | null;
  ocrProviderActive: boolean;
  ocrExternalApproved: boolean;
  healthDataOcrApproved: boolean;
  environment: 'demo' | 'production';
  demoMode: boolean;
};

export type DocumentInboxGuardCode =
  | 'missing_tenant'
  | 'tenant_mismatch'
  | 'missing_provider'
  | 'ocr_blocked'
  | 'ocr_approval_required'
  | 'health_data_ocr_denied'
  | 'auto_link_blocked'
  | 'item_archived'
  | 'item_deleted'
  | 'live_mode_unavailable';

export type DocumentInboxGuardResult =
  | { allowed: true }
  | { allowed: false; code: DocumentInboxGuardCode; message: string };

export const DOCUMENT_INBOX_SOURCE_LABELS: Record<DocumentInboxSource, string> = {
  upload: 'Manueller Upload',
  scan_prepared: 'Scan (vorbereitet)',
  email_kim_prepared: 'E-Mail / KIM (vorbereitet)',
  employee_portal: 'Mitarbeiterportal',
  client_portal: 'Klient:innenportal',
  admin_upload: 'Admin-Upload',
  connect_prepared: 'Connect-Anbieter',
};

export const DOCUMENT_INBOX_STATUS_LABELS: Record<DocumentInboxStatus, string> = {
  uploaded: 'Hochgeladen',
  classification_pending: 'Klassifizierung ausstehend',
  ocr_pending: 'OCR vorbereitet',
  review_required: 'Prüfung erforderlich',
  linked: 'Verknüpft',
  archived: 'Archiviert',
  rejected: 'Abgelehnt',
  deleted: 'Gelöscht',
};

export const DOCUMENT_INBOX_CATEGORY_LABELS: Record<DocumentInboxCategory, string> = {
  general: 'Allgemein',
  invoice: 'Rechnung',
  contract: 'Vertrag',
  care_plan: 'Pflegeplan',
  consent: 'Einwilligung',
  personnel: 'Personal',
  correspondence: 'Korrespondenz',
  other: 'Sonstiges',
};

export const DOCUMENT_ENTITY_LINK_TYPE_LABELS: Record<DocumentEntityLinkType, string> = {
  client: 'Klient:in',
  assignment: 'Einsatz',
  invoice: 'Rechnung',
  personnel: 'Personal',
};
