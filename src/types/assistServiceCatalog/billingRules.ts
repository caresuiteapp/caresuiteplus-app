import type { TenantScopedEntity } from '../core/base';
import type { CareBudgetType } from '../careBilling/careBudget';

export type AssistServiceBillingRule = TenantScopedEntity & {
  serviceCatalogItemId: string;
  budgetType: CareBudgetType | null;
  maxMinutesPerVisit: number | null;
  minBillableMinutes: number;
  roundingMinutes: number;
  requiresServiceProof: boolean;
  notes: string | null;
};

export type SetServiceBillingRuleInput = {
  tenantId: string;
  serviceCatalogItemId: string;
  budgetType?: CareBudgetType | null;
  maxMinutesPerVisit?: number | null;
  minBillableMinutes?: number;
  roundingMinutes?: number;
  requiresServiceProof?: boolean;
  notes?: string | null;
  actorUserId?: string | null;
};
