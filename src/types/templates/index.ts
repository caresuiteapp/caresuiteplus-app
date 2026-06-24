import type { ISODateTime, EntityId } from '../core/base';

export type TemplateScope = 'system' | 'tenant';

export type TemplateStatus = 'active' | 'draft' | 'archived' | 'disabled';

export type TemplateModuleKey =
  | 'core'
  | 'office'
  | 'assist'
  | 'pflege'
  | 'stationaer'
  | 'beratung'
  | 'akademie'
  | 'communication'
  | 'billing'
  | 'documents'
  | 'ti';

export type TemplateType =
  | 'task'
  | 'documentation_text'
  | 'message'
  | 'email'
  | 'document'
  | 'invoice_text'
  | 'dunning_text'
  | 'consent'
  | 'care_plan'
  | 'sis'
  | 'risk_assessment'
  | 'counseling_protocol'
  | 'academy_course'
  | 'certificate'
  | 'category'
  | 'dropdown_value'
  | 'checklist';

export type CareSuiteTemplate = {
  id: EntityId;
  tenantId: string | null;
  scope: TemplateScope;
  moduleKey: TemplateModuleKey;
  templateType: TemplateType;
  status: TemplateStatus;
  title: string;
  description: string | null;
  categoryKey: string | null;
  content: string;
  variables: string[];
  tags: string[];
  sortOrder: number;
  isDefault: boolean;
  isRequired: boolean;
  createdBy: string | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
};

export type CatalogType =
  | 'client_status'
  | 'employee_status'
  | 'assignment_status'
  | 'document_status'
  | 'document_category'
  | 'upload_category'
  | 'assignment_target'
  | 'task_category'
  | 'care_risk_type'
  | 'sis_topic'
  | 'billing_item_type'
  | 'invoice_status'
  | 'message_status'
  | 'message_category'
  | 'counseling_topic'
  | 'academy_course_type'
  | 'stationaer_living_area_type'
  | 'consent_type'
  | 'employee_role'
  | 'employee_department';

export type CatalogEntry = {
  id: EntityId;
  tenantId: string | null;
  catalogType: CatalogType;
  valueKey: string;
  label: string;
  description: string | null;
  moduleKey: TemplateModuleKey;
  isSystem: boolean;
  isActive: boolean;
  sortOrder: number;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
};

export type TemplateCategory = {
  id: EntityId;
  tenantId: string | null;
  key: string;
  label: string;
  moduleKey: TemplateModuleKey;
  sortOrder: number;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
};

export type TemplateUsageLog = {
  id: EntityId;
  tenantId: string;
  templateId: EntityId;
  moduleKey: TemplateModuleKey;
  context: string | null;
  usedAt: ISODateTime;
};

export type TenantTemplateSettings = {
  tenantId: string;
  allowTenantOverrides: boolean;
  defaultLocale: string;
  showSystemTemplates: boolean;
  updatedAt: ISODateTime;
};

export type TemplateListFilters = {
  scope?: TemplateScope;
  moduleKey?: TemplateModuleKey;
  templateType?: TemplateType;
  status?: TemplateStatus;
  search?: string;
  categoryKey?: string;
};

export type TemplateDashboardStats = {
  systemCount: number;
  tenantCount: number;
  activeCount: number;
  archivedCount: number;
  modulesWithTemplates: number;
  topTemplates: { id: string; title: string; usageCount: number }[];
};

export type DropdownOption = {
  value: string;
  label: string;
  description?: string | null;
  isSystem: boolean;
};

export type CreateTemplateInput = {
  moduleKey: TemplateModuleKey;
  templateType: TemplateType;
  title: string;
  description?: string | null;
  categoryKey?: string | null;
  content: string;
  variables?: string[];
  tags?: string[];
  status?: TemplateStatus;
};

export type UpdateTemplateInput = Partial<
  Pick<
    CareSuiteTemplate,
    'title' | 'description' | 'categoryKey' | 'content' | 'variables' | 'tags' | 'status' | 'sortOrder'
  >
>;

export type CreateCatalogEntryInput = {
  catalogType: CatalogType;
  valueKey: string;
  label: string;
  description?: string | null;
  moduleKey: TemplateModuleKey;
  sortOrder?: number;
};

export type UpdateCatalogEntryInput = Partial<
  Pick<CatalogEntry, 'label' | 'description' | 'isActive' | 'sortOrder'>
>;
