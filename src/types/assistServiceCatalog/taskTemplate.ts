import type { TenantScopedEntity } from '../core/base';

export type AssistServiceTaskTemplate = TenantScopedEntity & {
  serviceCatalogItemId: string;
  taskKey: string;
  title: string;
  description: string;
  sortOrder: number;
  isRequired: boolean;
  estimatedMinutes: number | null;
};

export type CreateServiceTaskTemplateInput = {
  tenantId: string;
  serviceCatalogItemId: string;
  taskKey: string;
  title: string;
  description?: string;
  sortOrder?: number;
  isRequired?: boolean;
  estimatedMinutes?: number | null;
  actorUserId?: string | null;
};
