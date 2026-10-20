import type { GkvStatutorySector } from './billingProfile';

export type GkvValidationCheckKey =
  | 'pflegegrad'
  | 'abtretung_einwilligung'
  | 'leistungsnachweis'
  | 'unterschrift'
  | 'kostentraeger'
  | 'ik'
  | 'ik_verification'
  | 'leistungszeitraum'
  | 'budget'
  | 'stundensatz'
  | 'rechnungsart'
  | 'sgb_sector'
  | 'dta_validator';

export const GKV_VALIDATION_CHECK_LABELS: Record<GkvValidationCheckKey, string> = {
  pflegegrad: 'Pflegegrad',
  abtretung_einwilligung: 'Abtretung/Einwilligung',
  leistungsnachweis: 'Leistungsnachweis',
  unterschrift: 'Unterschrift',
  kostentraeger: 'Kostenträger',
  ik: 'Institutionskennzeichen (IK)',
  ik_verification: 'IK-Verifikation',
  leistungszeitraum: 'Leistungszeitraum',
  budget: 'Budget',
  stundensatz: 'Stundensatz',
  rechnungsart: 'Rechnungsart/Leistungsart',
  sgb_sector: 'SGB XI/V Sektor',
  dta_validator: 'DTA-Validator',
};

export type GkvValidationStatus = 'passed' | 'failed' | 'warning' | 'skipped';

export type GkvValidationCheckResult = {
  checkKey: GkvValidationCheckKey;
  status: GkvValidationStatus;
  message: string;
};

/** Prüfprotokoll — gkv_validation_results (aggregiert) */
export type GkvValidationReport = {
  validationRunId: string;
  tenantId: string;
  clientId: string | null;
  batchId: string | null;
  checks: GkvValidationCheckResult[];
  passed: boolean;
  failedCount: number;
  warningCount: number;
  checkedAt: string;
  blockedReason: string | null;
  status: 'validation_passed' | 'validation_failed';
};

export type GkvBillingCaseInput = {
  clientId?: string | null;
  invoiceId?: string | null;
  billableItemIds?: string[];
  pflegegrad?: number | null;
  hasAbtretungEinwilligung?: boolean;
  hasLeistungsnachweis?: boolean;
  hasUnterschrift?: boolean;
  costCarrierId?: string | null;
  costCarrierIk?: string | null;
  tenantIkNumber?: string | null;
  ikVerificationStatus?: 'unverified' | 'pending' | 'verified' | 'failed' | null;
  leistungszeitraumFrom?: string | null;
  leistungszeitraumTo?: string | null;
  budgetAvailableCents?: number | null;
  amountCents?: number | null;
  stundensatzCents?: number | null;
  rechnungsnummer?: string | null;
  leistungsart?: string | null;
  statutorySector?: GkvStatutorySector | null;
  dtaValidatorConfigured?: boolean;
  dtaValidated?: boolean;
};

export type GkvBillingPreparationResult = {
  validation: GkvValidationReport;
  canPrepare: boolean;
  canExport: boolean;
  canSubmit: false;
  message: string;
};
