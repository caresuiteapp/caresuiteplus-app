import type { RoleKey } from '@/types';
import type { ContractRecord } from '@/types/documents/contract';
import type { DocumentationRecord } from '@/types/documents/documentation';
import type { InvoiceRecord } from '@/types/documents/invoice';
import type { ServiceProofRecord } from '@/types/documents/serviceProof';
import type { TemplateValidationResult } from '@/features/documents/templateEngine/types';

export type DocumentActionKey =
  | 'view'
  | 'create_template'
  | 'edit_template'
  | 'version_template'
  | 'activate_template'
  | 'archive_template'
  | 'live_preview'
  | 'validate'
  | 'finalize'
  | 'edit_document'
  | 'correct'
  | 'cancel'
  | 'copy_system_template';

export type DocumentActionGateCode =
  | 'missing_user'
  | 'missing_tenant'
  | 'missing_role'
  | 'permission_denied'
  | 'template_archived'
  | 'system_template_protected'
  | 'document_finalized'
  | 'document_archived'
  | 'document_locked'
  | 'unknown_placeholders'
  | 'required_fields_missing'
  | 'pdf_failed'
  | 'production_demo_blocked'
  | 'tenant_mismatch'
  | 'preview_required'
  | 'invoice_validation_failed'
  | 'contract_validation_failed'
  | 'service_proof_validation_failed'
  | 'documentation_validation_failed'
  | 'service_proof_locked';

export type DocumentGateDocument = {
  status?: string;
  lockedAt?: string | null;
  previewConfirmed?: boolean;
};

export type DocumentGateTemplate = {
  versionStatus?: string;
  templateStatus?: string;
  htmlTemplate?: string;
  isSystemTemplate?: boolean;
  isProtected?: boolean;
};

export type DocumentActionGateContext = {
  userId: string | null;
  tenantId: string | null;
  role: RoleKey | null;
  documentTenantId?: string | null;
  templateTenantId?: string | null;
  environment: 'demo' | 'production';
  demoMode: boolean;
  usesDemoContext: boolean;
  hasLivePreview?: boolean;
  pdfRenderFailed?: boolean;
  unknownPlaceholders?: string[];
  validation?: TemplateValidationResult | null;
  invoiceRecord?: InvoiceRecord | null;
  contractRecord?: ContractRecord | null;
  serviceProofRecord?: ServiceProofRecord | null;
  documentationRecord?: DocumentationRecord | null;
  isSystemTemplate?: boolean;
  isSystemTemplateCopy?: boolean;
};

export type DocumentActionGateResult =
  | { allowed: true; validation?: TemplateValidationResult | null }
  | { allowed: false; code: DocumentActionGateCode; message: string; validation?: TemplateValidationResult | null };

export const DOCUMENT_ACTION_GATE_DISCLAIMER =
  'Release-Gate prüft technische Mindestkriterien — keine GoBD-, Rechts- oder Medizin-Garantie.';
