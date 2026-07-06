export type CsRecipientScope = 'employee' | 'client' | 'both' | 'office' | 'payor' | 'internal';
export type CsSignatureRequirement = 'none' | 'employee' | 'client' | 'both' | 'office';
export type CsSignerRole = 'employee' | 'client' | 'office' | 'representative' | 'payor';
export type CsDocumentPriority = 'low' | 'normal' | 'high' | 'urgent';
export type CsDocumentRequestStatus =
  | 'draft'
  | 'sent'
  | 'opened'
  | 'partially_signed'
  | 'completed'
  | 'rejected'
  | 'expired'
  | 'archived';

export type CsTemplateCategory = {
  id: string;
  categoryKey: string;
  name: string;
  description: string | null;
  displayOrder: number;
};

export type CsTemplatePlaceholder = {
  id: string;
  placeholderKey: string;
  label: string;
  entity: string;
  description: string | null;
  example: string | null;
  requiredContext: boolean;
  dataType: string;
  piiLevel: string;
};

export type CsDocumentTemplate = {
  id: string;
  templateKey: string;
  categoryKey: string;
  title: string;
  shortDescription: string | null;
  documentType: string;
  recipientScope: CsRecipientScope;
  defaultSignatureRequirement: CsSignatureRequirement;
  defaultPriority: CsDocumentPriority;
  isRequiredBeforeService: boolean;
  isSystemTemplate: boolean;
  tags: string[];
};

export type CsTemplateSignatureField = {
  id: string;
  versionId: string;
  signerRole: CsSignerRole;
  label: string;
  required: boolean;
  anchorToken: string;
  inputType: 'signature' | 'date' | 'checkbox' | 'text';
  orderIndex: number;
};

export type CsDocumentTemplateVersion = {
  id: string;
  templateId: string;
  versionNo: number;
  status: 'draft' | 'active' | 'archived';
  title: string;
  bodyHtml: string;
  legalNotice: string | null;
};

export type CsTemplateWithActiveVersion = CsDocumentTemplate & {
  activeVersion: CsDocumentTemplateVersion;
  signatureFields: CsTemplateSignatureField[];
  dueInDays: number;
};

export type CsDocumentRequest = {
  id: string;
  ownerTenantId: string;
  templateVersionId: string | null;
  sourceTemplateKey: string | null;
  title: string;
  recipientScope: CsRecipientScope;
  employeeId: string | null;
  clientId: string | null;
  representativeId: string | null;
  assignmentId: string | null;
  invoiceId: string | null;
  priority: CsDocumentPriority;
  status: CsDocumentRequestStatus;
  dueDate: string | null;
  requiredBeforeService: boolean;
  portalVisible: boolean;
  renderedHtml: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CsDocumentRequestSignature = {
  id: string;
  requestId: string;
  signerRole: CsSignerRole;
  signerName: string | null;
  status: 'pending' | 'signed' | 'declined' | 'not_required';
  signedAt: string | null;
};

export type CsDocumentRequestListItem = CsDocumentRequest & {
  signatures: CsDocumentRequestSignature[];
  pendingSignatureRoles: CsSignerRole[];
};

export type DocumentContext = {
  tenant: Record<string, string>;
  employee?: Record<string, string>;
  client?: Record<string, string>;
  representative?: Record<string, string>;
  assignment?: Record<string, string>;
  payor?: Record<string, string>;
  invoice?: Record<string, string>;
  document: Record<string, string>;
  office?: Record<string, string>;
};

export type CsContextValidationIssue = {
  code:
    | 'missing_active_version'
    | 'missing_required_placeholder'
    | 'recipient_mismatch'
    | 'signature_anchor_missing'
    | 'missing_context_data';
  message: string;
  placeholderKey?: string;
};

export type CsSendDocumentInput = {
  tenantId: string;
  templateKey: string;
  recipientScope: CsRecipientScope;
  employeeId?: string | null;
  clientId?: string | null;
  representativeId?: string | null;
  assignmentId?: string | null;
  invoiceId?: string | null;
  payorId?: string | null;
  priority?: CsDocumentPriority;
  dueDate?: string | null;
  requiredBeforeService?: boolean;
  createdBy?: string | null;
};

export const CS_DOCUMENT_PRIORITY_LABELS: Record<CsDocumentPriority, string> = {
  low: 'Niedrig',
  normal: 'Normal',
  high: 'Hoch',
  urgent: 'Dringend',
};

export const PORTAL_CS_DOCUMENT_REQUEST_STATUS_LABELS: Record<CsDocumentRequestStatus, string> = {
  draft: 'Entwurf',
  sent: 'Neu',
  opened: 'Offen',
  partially_signed: 'Teilweise unterschrieben',
  completed: 'Unterschrieben',
  rejected: 'Abgelehnt',
  expired: 'Abgelaufen',
  archived: 'Archiviert',
};

export function resolveCsDocumentRequestStatusLabel(
  status: CsDocumentRequestStatus,
  portal = false,
): string {
  return portal ? PORTAL_CS_DOCUMENT_REQUEST_STATUS_LABELS[status] : CS_DOCUMENT_REQUEST_STATUS_LABELS[status];
}

export const CS_DOCUMENT_REQUEST_STATUS_LABELS: Record<CsDocumentRequestStatus, string> = {
  draft: 'Entwurf',
  sent: 'Gesendet',
  opened: 'Geöffnet',
  partially_signed: 'Teilweise unterschrieben',
  completed: 'Erledigt',
  rejected: 'Abgelehnt',
  expired: 'Abgelaufen',
  archived: 'Archiviert',
};

export const CS_SIGNATURE_REQUIREMENT_LABELS: Record<CsSignatureRequirement, string> = {
  none: 'Keine',
  employee: 'Mitarbeiter',
  client: 'Klient',
  both: 'Beide',
  office: 'Office',
};
