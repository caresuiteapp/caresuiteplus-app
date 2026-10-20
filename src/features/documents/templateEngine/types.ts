/** Vorlagen & Dokumente — Template-Engine Typen (UI-unabhängig). */

export type PlaceholderGroup =
  | 'company'
  | 'client'
  | 'representative'
  | 'cost_carrier'
  | 'recipient'
  | 'invoice'
  | 'visit'
  | 'contract'
  | 'signature'
  | 'document'
  | 'page';

export type DocumentTemplateTypeKey =
  | 'invoice'
  | 'credit_note'
  | 'cancellation_invoice'
  | 'contract'
  | 'service_record'
  | 'care_documentation'
  | 'dunning_letter'
  | 'payment_reminder'
  | 'business_letter'
  | 'offer'
  | 'generic';

export type TemplateValidationStatus = 'valid' | 'warning' | 'error';

export type TemplateValidationSeverity = 'warning' | 'error';

export type TemplateValidationIssue = {
  code: string;
  message: string;
  placeholderKey?: string;
  fieldKey?: string;
  severity: TemplateValidationSeverity;
};

export type TemplateValidationResult = {
  status: TemplateValidationStatus;
  issues: TemplateValidationIssue[];
};

export type PlaceholderRegistryEntry = {
  key: string;
  group: PlaceholderGroup;
  label: string;
  description?: string;
  exampleValue?: string;
  dataSource?: string;
  dataPath: string;
  isSensitive?: boolean;
  isRequired?: boolean;
  isSystem: boolean;
  scope: 'system' | 'tenant';
  tenantId?: string | null;
};

export type PlaceholderRegistry = ReadonlyMap<string, PlaceholderRegistryEntry>;

export type DocumentContextValue = string | number | boolean | null | undefined;

export type DocumentContextSection = Record<string, DocumentContextValue>;

export type DocumentContext = {
  tenantId: string;
  entityType: DocumentEntityType;
  entityId: string;
  company: DocumentContextSection;
  client: DocumentContextSection;
  representative: DocumentContextSection;
  cost_carrier: DocumentContextSection;
  recipient: DocumentContextSection;
  invoice: DocumentContextSection;
  visit: DocumentContextSection;
  employee: DocumentContextSection;
  contract: DocumentContextSection;
  signature: DocumentContextSection;
  document: DocumentContextSection;
  page: DocumentContextSection;
};

export type DocumentEntityType =
  | 'invoice'
  | 'client'
  | 'service_record'
  | 'contract'
  | 'care_documentation'
  | 'dunning';

export type DocumentContextLoadResult =
  | { ok: true; context: DocumentContext; source: 'repository' | 'demo' }
  | { ok: false; error: string };

export type TemplateVersionInput = {
  htmlTemplate: string;
  cssTemplate?: string;
  layoutSettings?: Record<string, unknown>;
  pageSettings?: Record<string, unknown>;
  headerSettings?: Record<string, unknown>;
  footerSettings?: Record<string, unknown>;
  watermarkSettings?: Record<string, unknown>;
  requiredFields?: TemplateRequiredFieldInput[];
  validationRules?: Record<string, unknown>;
};

export type TemplateRequiredFieldInput = {
  fieldKey: string;
  label: string;
  dataPath?: string;
  validationType?: string;
  errorMessage?: string;
  isRequired?: boolean;
};

export type RenderTemplateResult = {
  html: string;
  placeholdersUsed: string[];
  unresolvedPlaceholders: string[];
  validation: TemplateValidationResult;
  missingRequiredFields: string[];
};

export type FinalizeDocumentResult =
  | { allowed: true; validation: TemplateValidationResult }
  | { allowed: false; validation: TemplateValidationResult; reason: string };

export type PlaceholderSearchFilters = {
  query?: string;
  group?: PlaceholderGroup | 'all';
  scope?: 'all' | 'system' | 'tenant';
};

export type SanitizeHtmlResult = {
  html: string;
  blocked: TemplateValidationIssue[];
};
