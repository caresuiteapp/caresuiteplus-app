import type { EntityId, ISODateTime } from '../core/base';

export type CatalogModuleScope = 'assist' | 'office' | 'core';

export type CatalogType =
  | 'single_select'
  | 'multi_select'
  | 'chip_select'
  | 'checklist'
  | 'template'
  | 'document_template'
  | 'text_block'
  | 'form_template'
  | 'task_package'
  | 'task_item'
  | 'status_reason'
  | 'billing_category'
  | 'appointment_type'
  | 'intake_section';

export type SelectionMode =
  | 'dropdown'
  | 'chips'
  | 'searchable_dropdown'
  | 'grouped_chips'
  | 'checkbox_list'
  | 'radio_group'
  | 'template_picker'
  | 'quick_insert';

export type TemplateArea =
  | 'assist_new_assignment'
  | 'assist_intake'
  | 'assist_documentation'
  | 'assist_service_proof'
  | 'assist_task_package'
  | 'assist_client_file'
  | 'assist_communication'
  | 'office_document'
  | 'office_internal_process';

export type BindingTargetArea =
  | 'assist_new_assignment'
  | 'assist_assignment_edit'
  | 'assist_assignment_execution'
  | 'assist_assignment_documentation'
  | 'assist_intake'
  | 'assist_client_profile'
  | 'assist_service_proof'
  | 'office_catalog_admin';

export type CatalogAuditAction =
  | 'create'
  | 'update'
  | 'deactivate'
  | 'delete'
  | 'restore'
  | 'copy'
  | 'version_activate';

export type CatalogGroup = {
  id: EntityId;
  tenantId: string | null;
  moduleScope: CatalogModuleScope;
  groupKey: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  sortOrder: number;
  isSystemDefault: boolean;
  isActive: boolean;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
};

export type CatalogDefinition = {
  id: EntityId;
  tenantId: string | null;
  groupId: string | null;
  moduleScope: CatalogModuleScope;
  catalogKey: string;
  name: string;
  description: string | null;
  catalogType: CatalogType;
  selectionMode: SelectionMode;
  visibilityScope: string;
  requiredPermission: string | null;
  isSystemDefault: boolean;
  isEditable: boolean;
  isActive: boolean;
  sortOrder: number;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
};

export type CatalogItemPayload = {
  groupKey?: string;
  category?: string;
  isMandatory?: boolean;
  isOptional?: boolean;
  notExecutable?: boolean;
  requiresNote?: boolean;
  requiresReason?: boolean;
  employeeHint?: string;
  clientHint?: string;
  confirmBeforeStart?: boolean;
  confirmOnClose?: boolean;
  quickChip?: boolean;
  textBlock?: string;
  intakeSection?: string;
  [key: string]: unknown;
};

export type CatalogItem = {
  id: EntityId;
  tenantId: string | null;
  catalogId: EntityId;
  parentItemId: string | null;
  itemKey: string;
  label: string;
  shortLabel: string | null;
  description: string | null;
  helperText: string | null;
  tags: string[];
  icon: string | null;
  color: string | null;
  sortOrder: number;
  isSystemDefault: boolean;
  isActive: boolean;
  isBillableRelevant: boolean;
  isDocumentationRequired: boolean;
  isSignatureRelevant: boolean;
  isRiskRelevant: boolean;
  defaultDurationMinutes: number | null;
  defaultPriceHint: number | null;
  defaultUnit: string | null;
  payloadJson: CatalogItemPayload;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
};

export type TemplateBinding = {
  id: EntityId;
  tenantId: string | null;
  templateId: string | null;
  catalogId: string | null;
  targetModule: string;
  targetArea: BindingTargetArea;
  targetComponent: string | null;
  targetField: string | null;
  bindingType: string;
  isRequired: boolean;
  isDefault: boolean;
  sortOrder: number;
  conditionsJson: Record<string, unknown>;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
};

export type CatalogAuditEvent = {
  id: EntityId;
  tenantId: string | null;
  entityType: string;
  entityId: EntityId;
  action: CatalogAuditAction;
  moduleScope: CatalogModuleScope;
  actorUserId: string | null;
  oldValueJson: Record<string, unknown> | null;
  newValueJson: Record<string, unknown> | null;
  summary: string | null;
  createdAt: ISODateTime;
};

export type CatalogListFilters = {
  groupKey?: string;
  catalogKey?: string;
  catalogType?: CatalogType;
  moduleScope?: CatalogModuleScope;
  isActive?: boolean;
  isSystem?: boolean;
  targetArea?: BindingTargetArea;
  search?: string;
  includeInactive?: boolean;
};

export type CreateCatalogItemInput = {
  catalogId: string;
  parentItemId?: string | null;
  itemKey: string;
  label: string;
  shortLabel?: string | null;
  description?: string | null;
  helperText?: string | null;
  tags?: string[];
  icon?: string | null;
  color?: string | null;
  sortOrder?: number;
  isBillableRelevant?: boolean;
  isDocumentationRequired?: boolean;
  isSignatureRelevant?: boolean;
  isRiskRelevant?: boolean;
  defaultDurationMinutes?: number | null;
  payloadJson?: CatalogItemPayload;
};

export type UpdateCatalogItemInput = Partial<Omit<CreateCatalogItemInput, 'catalogId' | 'itemKey'>> & {
  isActive?: boolean;
};

export type AssistAssignmentTaskDraft = {
  id?: string;
  catalogItemId?: string | null;
  itemKey: string;
  title: string;
  isRequired: boolean;
  isOptional: boolean;
  sortOrder: number;
  defaultDurationMinutes?: number | null;
  requiresNoteIfNotDone?: boolean;
  notExecutable?: boolean;
};

export type AssistAssignmentOptions = {
  subjects: CatalogItem[];
  assignmentTypes: CatalogItem[];
  serviceCategories: CatalogItem[];
  taskPackages: CatalogItem[];
  taskItems: CatalogItem[];
  documentationBlocks: CatalogItem[];
  budgetSources: CatalogItem[];
  riskFlags: CatalogItem[];
  notCompletedReasons: CatalogItem[];
  abortReasons: CatalogItem[];
  cancellationReasons: CatalogItem[];
};

export type AssistCatalogHubStats = {
  activeAssignmentTemplates: number;
  activeTaskPackages: number;
  activeTaskItems: number;
  documentationBlocks: number;
  documentTemplates: number;
  intakeTemplates: number;
  inactiveEntries: number;
  lastChangedAt: string | null;
};
