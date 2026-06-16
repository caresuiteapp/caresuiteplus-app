import type {
  DocumentContext,
  DocumentTemplateTypeKey,
  TemplateRequiredFieldInput,
} from '@/features/documents/templateEngine/types';

export type SystemDocumentTemplateStatus = 'active' | 'draft';

export type SystemDocumentCategory =
  | 'billing'
  | 'contracts'
  | 'care'
  | 'hr'
  | 'internal'
  | 'legal'
  | 'communication';

/** Beispielkontext für Vorschau — ohne Mandanten-Metadaten. */
export type SystemTemplateExampleContext = Omit<DocumentContext, 'tenantId' | 'entityType' | 'entityId'>;

export type SystemDocumentTemplate = {
  id: string;
  templateName: string;
  templateType: DocumentTemplateTypeKey;
  documentCategory: SystemDocumentCategory;
  templateStatus: SystemDocumentTemplateStatus;
  htmlTemplate: string;
  cssTemplate: string;
  placeholderSchema: Record<string, unknown>;
  requiredFields: TemplateRequiredFieldInput[];
  layoutSettings: Record<string, unknown>;
  headerSettings: Record<string, unknown>;
  footerSettings: Record<string, unknown>;
  signatureSettings: Record<string, unknown>;
  exampleContext: SystemTemplateExampleContext;
  validationRules: Record<string, unknown>;
  isSystemTemplate: true;
};

export type SystemTemplateCopyResult = {
  systemTemplateId: string;
  tenantTemplateId: string;
  tenantVersionId: string;
};
