import type { CareBudgetType } from './careBudget';

export type CareBillingValidationCheckKey =
  | 'klient'
  | 'pflegegrad'
  | 'leistungsnachweis'
  | 'leistungsart'
  | 'leistungszeitraum'
  | 'stundensatz'
  | 'kostentraeger_selbstzahler'
  | 'rechnungsempfaenger'
  | 'budget'
  | 'steuerlogik';

export const CARE_BILLING_VALIDATION_CHECK_LABELS: Record<CareBillingValidationCheckKey, string> = {
  klient: 'Klient',
  pflegegrad: 'Pflegegrad',
  leistungsnachweis: 'Leistungsnachweis',
  leistungsart: 'Leistungsart',
  leistungszeitraum: 'Leistungszeitraum',
  stundensatz: 'Stundensatz',
  kostentraeger_selbstzahler: 'Kostenträger / Selbstzahler',
  rechnungsempfaenger: 'Rechnungsempfänger',
  budget: 'Budget',
  steuerlogik: 'Steuerlogik',
};

export type CareBillingValidationStatus = 'passed' | 'failed' | 'warning' | 'skipped';

export type CareBillingValidationCheckResult = {
  checkKey: CareBillingValidationCheckKey;
  status: CareBillingValidationStatus;
  message: string;
};

export type CareBillingValidationReport = {
  validationRunId: string;
  tenantId: string;
  clientId: string | null;
  billableItemId: string | null;
  invoiceDraftId: string | null;
  checks: CareBillingValidationCheckResult[];
  passed: boolean;
  failedCount: number;
  warningCount: number;
  checkedAt: string;
  blockedReason: string | null;
};

export type CareBillingCaseInput = {
  tenantId: string;
  clientId?: string | null;
  billableItemId?: string | null;
  invoiceDraftId?: string | null;
  careGrade?: string | null;
  hasServiceProof?: boolean;
  serviceProofApproved?: boolean;
  serviceAreaKey?: string | null;
  servicePeriodFrom?: string | null;
  servicePeriodTo?: string | null;
  hourlyRateNetCents?: number | null;
  costCarrierProfileId?: string | null;
  isSelfPayer?: boolean;
  recipientType?: string | null;
  recipientResolved?: boolean;
  budgetAvailableCents?: number | null;
  amountCents?: number | null;
  selfPayerAmountCents?: number | null;
  budgetType?: CareBudgetType | null;
  taxMode?: string | null;
  taxConsistent?: boolean;
  isPreparedService?: boolean;
};
