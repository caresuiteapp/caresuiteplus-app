import type { InvoiceTaxMode } from '../documents/invoice';
import type { TenantScopedEntity } from '../core/base';
import type {
  AssistAllowedModule,
  AssistServiceAreaKey,
  AssistServiceCatalogStatus,
} from './serviceAreas';

export type AssistServiceCatalogItem = TenantScopedEntity & {
  serviceKey: string;
  title: string;
  description: string;
  category: AssistServiceAreaKey;
  billable: boolean;
  requiresSignature: boolean;
  requiresDocumentation: boolean;
  defaultDurationMinutes: number;
  defaultTaskTemplateIds: string[];
  allowedModules: AssistAllowedModule[];
  taxMode: InvoiceTaxMode;
  budgetEligible: boolean;
  status: AssistServiceCatalogStatus;
};

export type CreateAssistServiceInput = {
  tenantId: string;
  serviceKey: string;
  title: string;
  description?: string;
  category: AssistServiceAreaKey;
  billable?: boolean;
  requiresSignature?: boolean;
  requiresDocumentation?: boolean;
  defaultDurationMinutes?: number;
  allowedModules?: AssistAllowedModule[];
  taxMode?: InvoiceTaxMode;
  budgetEligible?: boolean;
  status?: AssistServiceCatalogStatus;
  actorUserId?: string | null;
};

export type UpdateAssistServiceInput = Partial<
  Omit<CreateAssistServiceInput, 'tenantId' | 'serviceKey'>
> & {
  tenantId: string;
  serviceId: string;
  actorUserId?: string | null;
};
