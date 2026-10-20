import type { TenantScopedEntity } from '../core/base';

export type AssistDocumentationRequirementKind =
  | 'free_text'
  | 'checklist'
  | 'signature'
  | 'photo'
  | 'time_confirmation';

export type AssistServiceDocumentationRequirement = TenantScopedEntity & {
  serviceCatalogItemId: string;
  requirementKey: string;
  kind: AssistDocumentationRequirementKind;
  label: string;
  isMandatory: boolean;
  sortOrder: number;
};

export type SetDocumentationRequirementInput = {
  tenantId: string;
  serviceCatalogItemId: string;
  requirementKey: string;
  kind: AssistDocumentationRequirementKind;
  label: string;
  isMandatory?: boolean;
  sortOrder?: number;
  actorUserId?: string | null;
};
