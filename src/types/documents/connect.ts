/** Connect Dokumente & Signaturen — Vorbereitung, keine Live-Übertragung. */

export type DocumentProviderCategory = 'signature' | 'ocr' | 'pdf' | 'archive';

export type SignatureProviderKey = 'docusign' | 'adobe_sign' | 'skribble' | 'fp_sign';

export type OcrProviderKey =
  | 'google_vision'
  | 'azure_document_intelligence'
  | 'aws_textract'
  | 'abbyy'
  | 'klippa'
  | 'mindee'
  | 'internal';

export type PdfProviderKey = 'generic_pdf';

export type ArchiveProviderKey = 'internal_archive';

export type DocumentProviderKey =
  | SignatureProviderKey
  | OcrProviderKey
  | PdfProviderKey
  | ArchiveProviderKey
  | 'none';

export type DocumentTemplateType = 'contract' | 'invoice' | 'leistungsnachweis' | 'generic';

export type GeneratedDocumentType = DocumentTemplateType;

export type GeneratedDocumentStatus =
  | 'draft'
  | 'generated'
  | 'sent'
  | 'signed'
  | 'rejected'
  | 'archived'
  | 'corrected'
  | 'cancelled'
  | 'export_ready'
  | 'exported'
  | 'ocr_pending'
  | 'ocr_completed'
  | 'ocr_failed';

export type SigningRequestStatus =
  | 'prepared'
  | 'blocked'
  | 'queued'
  | 'sent'
  | 'signed'
  | 'rejected'
  | 'expired'
  | 'cancelled'
  | 'failed';

export type OcrJobStatus =
  | 'prepared'
  | 'blocked'
  | 'pending_approval'
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type ArchiveStatus = 'prepared' | 'archived' | 'blocked' | 'gobd_pending';

export type DocumentAuditEventType =
  | 'document_created'
  | 'document_generated'
  | 'version_created'
  | 'edit_blocked'
  | 'correction_started'
  | 'signing_prepared'
  | 'signing_blocked'
  | 'signing_sent'
  | 'signing_completed'
  | 'signing_rejected'
  | 'ocr_prepared'
  | 'ocr_blocked'
  | 'ocr_approval_required'
  | 'ocr_completed'
  | 'ocr_failed'
  | 'pdf_a_prepared'
  | 'archive_prepared'
  | 'archive_created'
  | 'status_changed'
  | 'export_prepared';

export type DocumentGuardCode =
  | 'missing_tenant'
  | 'missing_provider'
  | 'provider_inactive'
  | 'missing_credential'
  | 'signing_blocked'
  | 'ocr_blocked'
  | 'ocr_approval_required'
  | 'health_data_ocr_denied'
  | 'document_archived'
  | 'pdf_without_version'
  | 'external_transfer_blocked'
  | 'gobd_claim_blocked'
  | 'tenant_mismatch'
  | 'action_blocked';

export type DocumentGuardResult =
  | { allowed: true }
  | { allowed: false; code: DocumentGuardCode; message: string };

export type DocumentProviderConfig = {
  id: string;
  tenantId: string;
  providerKey: DocumentProviderKey;
  providerCategory: DocumentProviderCategory;
  isActive: boolean;
  ocrExternalApproved: boolean;
  healthDataOcrApproved: boolean;
  hasCredentialReference: boolean;
  configuredAt: string | null;
};

export type DocumentTemplate = {
  id: string;
  tenantId: string;
  templateKey: string;
  templateType: DocumentTemplateType;
  label: string;
  version: number;
  isActive: boolean;
};

export type GeneratedDocument = {
  id: string;
  tenantId: string;
  documentType: GeneratedDocumentType;
  title: string;
  status: GeneratedDocumentStatus;
  currentVersion: number;
  containsHealthData: boolean;
  isArchived: boolean;
  pdfAPrepared: boolean;
  storageReference: string | null;
  contentHash: string | null;
  clientId: string | null;
  invoiceId: string | null;
  correctionOfId: string | null;
  archivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DocumentVersion = {
  id: string;
  tenantId: string;
  documentId: string;
  versionNumber: number;
  storageReference: string;
  contentHash: string;
  isCorrection: boolean;
  changeReason: string | null;
  createdAt: string;
};

export type DocumentSigningRequest = {
  id: string;
  tenantId: string;
  documentId: string;
  documentVersionId: string;
  providerKey: SignatureProviderKey;
  status: SigningRequestStatus;
  externalTransfer: boolean;
  signersCount: number;
  initiatedAt: string;
  errorSummary: string | null;
};

export type DocumentOcrJob = {
  id: string;
  tenantId: string;
  documentId: string;
  providerKey: OcrProviderKey;
  status: OcrJobStatus;
  containsHealthData: boolean;
  externalTransfer: boolean;
  approvalRequired: boolean;
  classification: Record<string, unknown>;
  errorSummary: string | null;
  createdAt: string;
};

export type DocumentArchiveEntry = {
  id: string;
  tenantId: string;
  generatedDocumentId: string | null;
  invoiceId: string | null;
  documentType: string;
  version: number;
  contentHash: string;
  storageReference: string;
  isImmutable: boolean;
  archiveStatus: ArchiveStatus;
  gobdProtectionActive: boolean;
  archivedAt: string;
};

export type DocumentAuditEvent = {
  id: string;
  tenantId: string;
  documentId: string | null;
  eventType: DocumentAuditEventType;
  summary: string;
  oldStatus: string | null;
  newStatus: string | null;
  createdAt: string;
};

export type DocumentExecutionContext = {
  tenantId: string | null;
  documentTenantId?: string | null;
  signatureProviderKey: SignatureProviderKey | null;
  ocrProviderKey: OcrProviderKey | null;
  signatureProviderActive: boolean;
  ocrProviderActive: boolean;
  ocrExternalApproved: boolean;
  healthDataOcrApproved: boolean;
  hasCredentialReference: boolean;
  containsHealthData: boolean;
  isArchived: boolean;
  isMockProvider: boolean;
  demoMode: boolean;
  environment: 'sandbox' | 'production' | 'demo';
  gobdProtectionActive: boolean;
};

export const SIGNATURE_PROVIDER_KEYS: SignatureProviderKey[] = [
  'docusign',
  'adobe_sign',
  'skribble',
  'fp_sign',
];

export const OCR_PROVIDER_KEYS: OcrProviderKey[] = [
  'google_vision',
  'azure_document_intelligence',
  'aws_textract',
  'abbyy',
  'klippa',
  'mindee',
  'internal',
];

export const EXTERNAL_OCR_PROVIDER_KEYS: Exclude<OcrProviderKey, 'internal'>[] = [
  'google_vision',
  'azure_document_intelligence',
  'aws_textract',
  'abbyy',
  'klippa',
  'mindee',
];

export const DOCUMENT_PROVIDER_LABELS: Record<DocumentProviderKey, string> = {
  docusign: 'DocuSign',
  adobe_sign: 'Adobe Sign',
  skribble: 'Skribble',
  fp_sign: 'FP Sign',
  google_vision: 'Google Vision',
  azure_document_intelligence: 'Azure Document Intelligence',
  aws_textract: 'AWS Textract',
  abbyy: 'ABBYY',
  klippa: 'Klippa',
  mindee: 'Mindee',
  internal: 'Intern (Demo)',
  generic_pdf: 'PDF-Generator (intern)',
  internal_archive: 'Internes Archiv',
  none: 'Kein Anbieter',
};

export const GENERATED_DOCUMENT_STATUS_LABELS: Record<GeneratedDocumentStatus, string> = {
  draft: 'Entwurf',
  generated: 'Erzeugt',
  sent: 'Versendet',
  signed: 'Signiert',
  rejected: 'Abgelehnt',
  archived: 'Archiviert',
  corrected: 'Korrigiert',
  cancelled: 'Storniert',
  export_ready: 'Export bereit',
  exported: 'Exportiert',
  ocr_pending: 'OCR ausstehend',
  ocr_completed: 'OCR abgeschlossen',
  ocr_failed: 'OCR fehlgeschlagen',
};

export const DOCUMENT_TEMPLATE_TYPE_LABELS: Record<DocumentTemplateType, string> = {
  contract: 'Vertrag',
  invoice: 'Rechnung',
  leistungsnachweis: 'Leistungsnachweis',
  generic: 'Allgemein',
};

/** Kein GoBD-Claim ohne aktive Schutzlogik. */
export const GOBD_ARCHIVE_DISCLAIMER =
  'Revisionssichere GoBD-Archivierung ist erst nach Freischaltung der Schutzlogik verfügbar.';

/** Externe OCR nur mit expliziter Freigabe. */
export const OCR_EXTERNAL_APPROVAL_REQUIRED =
  'Externe OCR-Anbieter erfordern eine explizite Administrator-Freigabe.';
