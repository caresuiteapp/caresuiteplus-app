import type { TenantScopedEntity } from '../core/base';
import type { InvoiceTaxMode } from '../documents/invoice';
import type { BillingRecipientType } from './billingRecipient';

export type InvoiceDraftStatus = 'draft' | 'validated' | 'blocked' | 'finalized' | 'cancelled';

export type InvoiceDraft = TenantScopedEntity & {
  clientId: string;
  draftNumber: string | null;
  status: InvoiceDraftStatus;
  taxMode: InvoiceTaxMode;
  servicePeriodFrom: string;
  servicePeriodTo: string;
  recipientType: BillingRecipientType;
  recipientName: string;
  recipientStreet: string;
  recipientZip: string;
  recipientCity: string;
  costCarrierName: string | null;
  costCarrierIk: string | null;
  netTotalCents: number;
  taxTotalCents: number;
  grossTotalCents: number;
  taxNotice: string;
  validationRunId: string | null;
  finalizedInvoiceId: string | null;
  previewConfirmed: boolean;
  notes: string | null;
};

export type InvoiceDraftItem = TenantScopedEntity & {
  invoiceDraftId: string;
  billableItemId: string;
  description: string;
  quantity: number;
  unit: string;
  unitPriceNetCents: number;
  netTotalCents: number;
  taxRatePercent: number;
  taxTotalCents: number;
  grossTotalCents: number;
  budgetType: string | null;
  selfPayerAmountCents: number;
};

export type CreateInvoiceDraftInput = {
  tenantId: string;
  clientId: string;
  billableItemIds: string[];
  servicePeriodFrom: string;
  servicePeriodTo: string;
  previewConfirmed?: boolean;
};

export type FinalizeInvoiceDraftResult = {
  ok: boolean;
  invoiceDraftId: string;
  blockedReason: string | null;
  validationRunId: string | null;
};
