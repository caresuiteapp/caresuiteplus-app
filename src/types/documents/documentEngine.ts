import type { DocumentTemplateTypeKey } from '@/features/documents/templateEngine/types';

export type DocumentLayoutFamily =
  | 'contract'
  | 'service_proof'
  | 'invoice'
  | 'dunning'
  | 'client_master'
  | 'employee_form'
  | 'shift_plan'
  | 'tour_plan'
  | 'care_clinical'
  | 'consultation'
  | 'academy_certificate'
  | 'vehicle_log'
  | 'assist_visit'
  | 'incident'
  | 'checklist'
  | 'generic_form';

export type DocumentEngineTemplateScope = 'system' | 'tenant' | 'imported';

export type DocumentEngineTemplateListItem = {
  id: string;
  tenantId: string | null;
  templateNumber: number | null;
  templateKey: string;
  name: string;
  shortName: string | null;
  category: string | null;
  moduleScope: string[];
  targetRecordType: string | null;
  defaultStorageArea: string | null;
  templateType: DocumentTemplateTypeKey;
  templateStatus: string;
  scope: DocumentEngineTemplateScope;
  layoutKind: string;
  layoutFamily: DocumentLayoutFamily;
  isAssistAllowed: boolean;
  isMedicalOrTreatmentRelated: boolean;
  isFillable: boolean;
  isPdfEnabled: boolean;
  isEmailEnabled: boolean;
  isFaxEnabled: boolean;
  isSignatureRequired: boolean;
  version: number;
  updatedAt: string;
  mappingComplete: boolean;
  bindingCount: number;
};

export type DocumentEngineDashboardStats = {
  totalTemplates: number;
  activeTemplates: number;
  systemTemplates: number;
  tenantTemplates: number;
  importedTemplates: number;
  assistTemplates: number;
  officeTemplates: number;
  pflegeTemplates: number;
  beratungTemplates: number;
  stationaerTemplates: number;
  akademieTemplates: number;
  pdfEnabledTemplates: number;
  emailEnabledTemplates: number;
  faxEnabledTemplates: number;
  signatureRequiredTemplates: number;
  mappingIncompleteTemplates: number;
  pendingApprovalTemplates: number;
  documentsCreatedToday: number;
  openSignatures: number;
  failedSendCount: number;
};

export type DocumentEngineBinding = {
  id: string;
  tenantId: string;
  templateId: string;
  templateName: string;
  targetModule: string;
  targetArea: string;
  targetComponent: string | null;
  triggerEvent: string | null;
  bindingType: string;
  isDefault: boolean;
  isRequired: boolean;
  isActive: boolean;
  sortOrder: number;
};

export type DocumentEngineAuditEntry = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actorRole: string | null;
  createdAt: string;
};

export type GeneratedDocumentRecord = {
  id: string;
  tenantId: string;
  templateId: string | null;
  title: string;
  status: string;
  fileName: string | null;
  pdfPath: string | null;
  htmlOutput: string | null;
  archivedInArea: string | null;
  clientId: string | null;
  employeeId: string | null;
  assignmentId: string | null;
  signatureStatus: string;
  emailStatus: string;
  faxStatus: string;
  createdAt: string;
  finalizedAt: string | null;
};

export type CreateGeneratedDocumentInput = {
  tenantId: string;
  templateId: string;
  title: string;
  clientId?: string | null;
  employeeId?: string | null;
  assignmentId?: string | null;
  invoiceId?: string | null;
  consultationId?: string | null;
  courseId?: string | null;
  htmlOutput: string;
  autofillSnapshot?: Record<string, unknown>;
  manualOverrides?: Record<string, unknown>;
  relatedEntityTable?: string | null;
  relatedEntityId?: string | null;
};

export type FinalizeGeneratedDocumentInput = {
  tenantId: string;
  documentId: string;
  pdfBase64?: string;
  pdfPath?: string;
  archivedInArea: string;
  clientId?: string | null;
  employeeId?: string | null;
};
