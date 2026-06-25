import type { DocumentTemplateTypeKey } from '@/features/documents/templateEngine/types';

/** Lebenszyklus-Status laut Migration 0048 */
export type DocumentLifecycleStatus =
  | 'draft'
  | 'preview'
  | 'validation_failed'
  | 'ready_to_finalize'
  | 'finalized'
  | 'sent'
  | 'archived'
  | 'corrected'
  | 'cancelled'
  | 'render_failed';

export type DocumentLifecycleAuditEventType =
  | 'document_created'
  | 'preview_started'
  | 'preview_confirmed'
  | 'validation_passed'
  | 'validation_failed'
  | 'render_job_queued'
  | 'render_job_completed'
  | 'render_job_failed'
  | 'document_finalized'
  | 'document_archived'
  | 'document_locked'
  | 'edit_blocked'
  | 'correction_created'
  | 'cancellation_created'
  | 'document_sent';

export type DocumentLifecycleAuditEvent = {
  id: string;
  tenantId: string;
  documentId: string;
  eventType: DocumentLifecycleAuditEventType;
  summary: string;
  oldStatus: DocumentLifecycleStatus | null;
  newStatus: DocumentLifecycleStatus | null;
  metadata?: Record<string, string>;
  createdAt: string;
};

export type DocumentRenderJobType = 'preview' | 'pdf' | 'pdf_a';

export type DocumentRenderJobStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';

export type DocumentRenderJob = {
  id: string;
  tenantId: string;
  documentId: string;
  templateVersionId: string | null;
  jobType: DocumentRenderJobType;
  jobStatus: DocumentRenderJobStatus;
  htmlOutput: string | null;
  pdfPath: string | null;
  errorMessage: string | null;
  isProductionEngine: boolean;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
};

export type LifecycleDocument = {
  id: string;
  tenantId: string;
  templateVersionId: string | null;
  documentType: DocumentTemplateTypeKey;
  title: string;
  status: DocumentLifecycleStatus;
  documentNumber: string | null;
  htmlOutput: string | null;
  pdfPath: string | null;
  contentHash: string | null;
  previewedAt: string | null;
  previewConfirmed: boolean;
  finalizedAt: string | null;
  lockedAt: string | null;
  archivedAt: string | null;
  sentAt: string | null;
  correctedFromDocumentId: string | null;
  cancelledFromDocumentId: string | null;
  currentVersion: number;
  pdfAPrepared: boolean;
  relatedEntityTable: string | null;
  relatedEntityId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LifecycleDocumentVersion = {
  id: string;
  tenantId: string;
  documentId: string;
  versionNumber: number;
  htmlOutput: string;
  pdfPath: string | null;
  contentHash: string;
  isCorrection: boolean;
  changeReason: string | null;
  createdAt: string;
};

export type FinalizeDocumentInput = {
  tenantId: string;
  documentId: string;
  templateVersionId: string;
  htmlTemplate: string;
  cssTemplate?: string;
  documentType: DocumentTemplateTypeKey;
  sampleEntityType: 'invoice' | 'client' | 'service_record' | 'contract' | 'care_documentation';
  sampleEntityId: string;
  /** Demo/Test: PDF-Job absichtlich fehlschlagen lassen */
  simulatePdfFailure?: boolean;
};

export type PdfEngineInfo = {
  mode: 'prepared' | 'production';
  productionAvailable: boolean;
  message: string;
  recommendedBackend: 'supabase_edge_function' | 'node_service';
};

export const PDF_ENGINE_INFO: PdfEngineInfo = {
  mode: 'production',
  productionAvailable: true,
  message:
    'PDF-Erzeugung via HTML→jsPDF (Web) mit Upload in Supabase Storage. Server-Render über Edge Function render-document-pdf.',
  recommendedBackend: 'supabase_edge_function',
};

export const LIFECYCLE_STATUS_LABELS: Record<DocumentLifecycleStatus, string> = {
  draft: 'Entwurf',
  preview: 'Vorschau',
  validation_failed: 'Validierung fehlgeschlagen',
  ready_to_finalize: 'Bereit zur Finalisierung',
  finalized: 'Finalisiert',
  sent: 'Versendet',
  archived: 'Archiviert',
  corrected: 'Korrigiert',
  cancelled: 'Storniert',
  render_failed: 'PDF-Erzeugung fehlgeschlagen',
};
