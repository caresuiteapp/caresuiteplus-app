import type { TenantScopedEntity, WorkflowStatus } from '../core/base';
import type { AuditEntry } from '../detail';

export type BudgetPeriod = 'monthly' | 'quarterly' | 'yearly';

export type ClientBudget = TenantScopedEntity & {
  clientId: string;
  label: string;
  period: BudgetPeriod;
  allocatedCents: number;
  usedCents: number;
  currency: string;
  status: WorkflowStatus;
};

export type BudgetListItem = Pick<
  ClientBudget,
  | 'id'
  | 'tenantId'
  | 'clientId'
  | 'label'
  | 'period'
  | 'allocatedCents'
  | 'usedCents'
  | 'currency'
  | 'status'
  | 'updatedAt'
> & {
  clientName: string;
  usagePercent: number;
};

export type BudgetDetail = BudgetListItem & {
  createdAt: string;
  notes: string | null;
  linkedInvoiceIds: string[];
};

export type InvoiceLineItem = {
  id: string;
  description: string;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
};

export type InvoiceListItem = {
  id: string;
  tenantId: string;
  clientId: string;
  clientName: string;
  invoiceNumber: string;
  amountCents: number;
  currency: string;
  dueDate: string;
  status: WorkflowStatus;
  updatedAt: string;
};

export type BillingDashboardStats = {
  openInvoicesCount: number;
  openInvoicesCents: number;
  overdueCount: number;
  activeBudgetsCount: number;
  budgetsNearLimitCount: number;
};
