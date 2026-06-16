/** Leistungsnachweise — Typen für Validierung und Lebenszyklus */

export type ServiceProofTypeKey = 'einzel_einsatznachweis' | 'monatsnachweis';

export type ServiceProofDocumentStatus =
  | 'draft'
  | 'signed'
  | 'finalized'
  | 'correction'
  | 'render_failed';

export type ServiceProofDeployment = {
  id: string;
  deploymentDate: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  serviceType: string;
  tasks: string;
  shortDescription: string;
  documentation: string;
};

export type ServiceProofSignatureFields = {
  clientSigned: boolean;
  employeeSigned: boolean;
  clientSignedAt: string | null;
  employeeSignedAt: string | null;
};

export type ServiceProofRecord = {
  id: string;
  tenantId: string;
  proofType: ServiceProofTypeKey;
  proofNumber: string | null;
  status: ServiceProofDocumentStatus;
  logoUrl: string | null;
  companyName: string;
  serviceMonth: string;
  clientName: string;
  clientId: string;
  careLevel: string;
  costBearer: string;
  employeeName: string;
  deploymentDate: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  serviceType: string;
  tasks: string;
  shortDescription: string;
  documentation: string;
  deployments: ServiceProofDeployment[];
  totalHours: number;
  billingAmountCents: number;
  budgetAllocation: string;
  footerText: string;
  signatures: ServiceProofSignatureFields;
  lockedAt: string | null;
  contentHash: string | null;
  pdfPath: string | null;
  lifecycleDocumentId: string | null;
  previewConfirmed: boolean;
  version: number;
  correctedFromProofId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ServiceProofAuditEventType =
  | 'service_proof_created'
  | 'service_proof_validated'
  | 'service_proof_validation_failed'
  | 'service_proof_signed'
  | 'service_proof_finalized'
  | 'service_proof_locked'
  | 'service_proof_edit_blocked'
  | 'service_proof_pdf_prepared'
  | 'service_proof_correction_created';

export type ServiceProofAuditEvent = {
  id: string;
  tenantId: string;
  proofId: string;
  eventType: ServiceProofAuditEventType;
  summary: string;
  metadata?: Record<string, string>;
  createdAt: string;
};

export const SERVICE_PROOF_TYPE_LABELS: Record<ServiceProofTypeKey, string> = {
  einzel_einsatznachweis: 'Einzel-Einsatznachweis',
  monatsnachweis: 'Monatsnachweis',
};

export const SERVICE_PROOF_DISCLAIMER =
  'PDF-Erzeugung und E-Signatur sind vorbereitet — kein produktiver Signatur- oder Archivdienst. Keine GoBD-Konformität behauptet.';
