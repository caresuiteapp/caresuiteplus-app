import type { ClientCareContext } from '@/lib/clients/clientIntakeFieldRules';

export type IntakeDocumentStatus =
  | 'not_started'
  | 'preview_open'
  | 'pending_signature'
  | 'signed'
  | 'declined'
  | 'skipped_optional'
  | 'finalized'
  | 'revoked'
  | 'replaced';

export type IntakeDocumentType =
  | 'privacy_consent'
  | 'assignment_declaration'
  | 'client_contract'
  | 'additional_consent';

export type IntakeSignatureRole = 'client' | 'employee' | 'legal_representative';

export type IntakeSignatureSlot = {
  role: IntakeSignatureRole;
  placeholder: string;
  required: boolean;
};

export type IntakeDocumentTemplate = {
  id: string;
  templateKey: string;
  title: string;
  documentType: IntakeDocumentType;
  serviceType: string | null;
  version: number;
  isSystemTemplate: boolean;
  isRequired: boolean;
  isActive: boolean;
  requiresClientSignature: boolean;
  requiresEmployeeSignature: boolean;
  requiresRepresentativeSignature: boolean;
  allowsCustomTemplate: boolean;
  htmlContent: string;
  plainTextContent: string;
  placeholderSchema: Record<string, { label: string; required?: boolean }>;
  signatureSlots: IntakeSignatureSlot[];
  source: 'system' | 'tenant';
  tenantTemplateId?: string | null;
};

export type IntakeDocumentSignature = {
  role: IntakeSignatureRole;
  dataUrl: string;
  signedAt: string;
  signerName?: string | null;
};

export type IntakeDocumentState = {
  templateKey: string;
  documentType: IntakeDocumentType;
  title: string;
  isRequired: boolean;
  status: IntakeDocumentStatus;
  source: 'system' | 'tenant';
  tenantTemplateId?: string | null;
  version: number;
  missingPlaceholders: string[];
  previewHtml: string | null;
  finalizedHtml: string | null;
  renderedPdfPath: string | null;
  signatures: Partial<Record<IntakeSignatureRole, IntakeDocumentSignature>>;
  previewOpenedAt: string | null;
  finalizedAt: string | null;
};

export type IntakeContractTypeKey =
  | 'assist'
  | 'ambulatory_care'
  | 'stationary_care'
  | 'day_care'
  | 'care_consulting'
  | 'relief_services';

export const INTAKE_CONTRACT_TYPE_LABELS: Record<IntakeContractTypeKey, string> = {
  assist: 'Alltagsbegleitung / Betreuung',
  ambulatory_care: 'Ambulante Pflege',
  stationary_care: 'Stationäre Pflege',
  day_care: 'Tagespflege',
  care_consulting: 'Pflegeberatung',
  relief_services: 'Entlastungsleistungen',
};

export const INTAKE_DOCUMENT_STATUS_LABELS: Record<IntakeDocumentStatus, string> = {
  not_started: 'Nicht begonnen',
  preview_open: 'Vorschau geöffnet',
  pending_signature: 'Unterschrift ausstehend',
  signed: 'Unterschrieben',
  declined: 'Abgelehnt',
  skipped_optional: 'Optional übersprungen',
  finalized: 'Abgeschlossen',
  revoked: 'Widerrufen',
  replaced: 'Ersetzt',
};

export const CARE_CONTEXT_TO_SERVICE_TYPE: Partial<Record<ClientCareContext, IntakeContractTypeKey>> = {
  daily_assistance: 'assist',
  support_care: 'assist',
  companionship: 'assist',
  ambulatory_care: 'ambulatory_care',
  stationary_care: 'stationary_care',
  consulting: 'care_consulting',
};

export const CONTRACT_TEMPLATE_BY_SERVICE_TYPE: Record<IntakeContractTypeKey, string> = {
  assist: 'client_contract_assist',
  ambulatory_care: 'client_contract_ambulatory_care',
  stationary_care: 'client_contract_stationary_care',
  day_care: 'client_contract_day_care',
  care_consulting: 'client_contract_care_consulting',
  relief_services: 'client_contract_relief_services',
};

export const PRIVACY_TEMPLATE_KEY = 'privacy_consent_default';
export const ASSIGNMENT_TEMPLATE_KEY = 'assignment_declaration_care_health_insurance';

export const OPTIONAL_CONSENT_TEMPLATE_KEYS = [
  'confidentiality_release_default',
  'communication_consent_default',
  'photo_media_consent_default',
  'emergency_contact_consent_default',
] as const;

export type OptionalConsentTemplateKey = (typeof OPTIONAL_CONSENT_TEMPLATE_KEYS)[number];
