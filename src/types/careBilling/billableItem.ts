import type { TenantScopedEntity } from '../core/base';
import type { CareServiceAreaKey } from './careServiceTypes';
import type { CareBudgetType } from './careBudget';
import type { InvoiceTaxMode } from '../documents/invoice';

export type BillableItemStatus =
  | 'not_billable'
  | 'missing_data'
  | 'ready'
  | 'included_in_invoice_draft'
  | 'invoiced'
  | 'cancelled'
  | 'corrected'
  | 'rejected';

export const BILLABLE_ITEM_STATUS_LABELS: Record<BillableItemStatus, string> = {
  not_billable: 'Nicht abrechenbar',
  missing_data: 'Daten unvollständig',
  ready: 'Abrechnungsbereit',
  included_in_invoice_draft: 'In Rechnungsentwurf',
  invoiced: 'Abgerechnet',
  cancelled: 'Storniert',
  corrected: 'Korrigiert',
  rejected: 'Abgelehnt',
};

export type BillableItem = TenantScopedEntity & {
  clientId: string;
  serviceProofId: string;
  serviceRecordId: string | null;
  serviceAreaKey: CareServiceAreaKey;
  servicePeriodFrom: string;
  servicePeriodTo: string;
  durationMinutes: number;
  billableMinutes: number;
  hourlyRateNetCents: number;
  netAmountCents: number;
  taxMode: InvoiceTaxMode;
  taxAmountCents: number;
  grossAmountCents: number;
  budgetType: CareBudgetType | null;
  budgetPeriodId: string | null;
  selfPayerAmountCents: number;
  costCarrierProfileId: string | null;
  billingRecipientProfileId: string | null;
  invoiceDraftId: string | null;
  invoiceId: string | null;
  status: BillableItemStatus;
  validationRunId: string | null;
  description: string;
  careGrade: string | null;
};

export type ServiceProofBillingInput = {
  tenantId: string;
  clientId: string;
  serviceProofId: string;
  serviceRecordId?: string | null;
  serviceAreaKey: CareServiceAreaKey;
  servicePeriodFrom: string;
  servicePeriodTo: string;
  durationMinutes: number;
  proofStatus: 'draft' | 'signed' | 'finalized' | 'correction' | 'render_failed';
  careGrade: string | null;
  costCarrierProfileId?: string | null;
  billingRecipientProfileId?: string | null;
  description?: string;
};
