import type { TenantScopedEntity } from '../core/base';

/** Abrechnungsmodus je Mandant — Vorbereitung, keine produktive Direktabrechnung. */
export type ConnectBillingMode =
  | 'selbst_abrechnen'
  | 'ueber_abrechnungszentrum'
  | 'leistungsnachweise_export'
  | 'rechnung_dta_nachweise_vorbereiten'
  | 'direktabrechnung_spaeter';

export const CONNECT_BILLING_MODE_LABELS: Record<ConnectBillingMode, string> = {
  selbst_abrechnen: 'Selbst abrechnen',
  ueber_abrechnungszentrum: 'Über Abrechnungszentrum',
  leistungsnachweise_export: 'Nur Leistungsnachweise exportieren',
  rechnung_dta_nachweise_vorbereiten: 'Rechnung + DTA + Nachweise vorbereiten',
  direktabrechnung_spaeter: 'Direktabrechnung später',
};

export type ConnectBillingProviderKey =
  | 'opta_data'
  | 'dmrz'
  | 'rzh'
  | 'davaso'
  | 'generic_export';

export const CONNECT_BILLING_PROVIDER_LABELS: Record<ConnectBillingProviderKey, string> = {
  opta_data: 'opta data',
  dmrz: 'DMRZ',
  rzh: 'RZH',
  davaso: 'DAVASO',
  generic_export: 'Generischer Export',
};

export type ConnectBillingProviderStatus =
  | 'vorbereitet'
  | 'nicht_konfiguriert'
  | 'export_moeglich'
  | 'api_spaeter'
  | 'deaktiviert';

export const CONNECT_BILLING_PROVIDER_STATUS_LABELS: Record<ConnectBillingProviderStatus, string> = {
  vorbereitet: 'Vorbereitet',
  nicht_konfiguriert: 'Nicht konfiguriert',
  export_moeglich: 'Export möglich',
  api_spaeter: 'API später',
  deaktiviert: 'Deaktiviert',
};

export type CostCarrierType =
  | 'pflegekasse'
  | 'krankenkasse'
  | 'beihilfe'
  | 'sonstige'
  | 'abrechnungszentrum'
  | 'other';

export type CostCarrierSource = 'manual' | 'kostentraegerdatei' | 'import' | 'api';

export type CostCarrier = TenantScopedEntity & {
  costCarrierId: string;
  name: string;
  type: CostCarrierType;
  ikNumber: string | null;
  billingAddress: Record<string, string> | null;
  electronicBillingSupported: boolean;
  dtaSupported: boolean;
  contactData: Record<string, string> | null;
  validFrom: string | null;
  validTo: string | null;
  source: CostCarrierSource;
  lastCheckedAt: string | null;
};

export type TenantIkApprovalStatus = 'pending' | 'submitted' | 'approved' | 'rejected' | 'expired';
export type TenantIkVerificationStatus = 'unverified' | 'pending' | 'verified' | 'failed';
export type TenantIkBillingType = 'sgb_xi' | 'sgb_v' | 'gkv' | 'selbstzahler' | 'mixed' | 'other';

export type TenantIkProfile = TenantScopedEntity & {
  ikNumber: string | null;
  bankAccountHolder: string | null;
  bankIban: string | null;
  bankBic: string | null;
  approvalStatus: TenantIkApprovalStatus;
  serviceAreas: string[];
  billingType: TenantIkBillingType | null;
  billingMode: ConnectBillingMode;
  verificationStatus: TenantIkVerificationStatus;
  verifiedAt: string | null;
  notes: string | null;
};

export type BillingValidationCheckKey =
  | 'pflegegrad'
  | 'abtretung_einwilligung'
  | 'leistungsnachweis'
  | 'unterschrift'
  | 'kostentraeger'
  | 'ik'
  | 'leistungszeitraum'
  | 'budget'
  | 'stundensatz'
  | 'rechnungsnummer'
  | 'leistungsart';

export const BILLING_VALIDATION_CHECK_LABELS: Record<BillingValidationCheckKey, string> = {
  pflegegrad: 'Pflegegrad',
  abtretung_einwilligung: 'Abtretung/Einwilligung',
  leistungsnachweis: 'Leistungsnachweis',
  unterschrift: 'Unterschrift',
  kostentraeger: 'Kostenträger',
  ik: 'Institutionskennzeichen (IK)',
  leistungszeitraum: 'Leistungszeitraum',
  budget: 'Budget',
  stundensatz: 'Stundensatz',
  rechnungsnummer: 'Rechnungsnummer',
  leistungsart: 'Leistungsart',
};

export type BillingValidationStatus = 'passed' | 'failed' | 'warning' | 'skipped';

export type BillingValidationCheckResult = {
  checkKey: BillingValidationCheckKey;
  status: BillingValidationStatus;
  message: string;
};

export type BillingValidationReport = {
  validationRunId: string;
  tenantId: string;
  clientId: string | null;
  invoiceId: string | null;
  checks: BillingValidationCheckResult[];
  passed: boolean;
  failedCount: number;
  warningCount: number;
  checkedAt: string;
  blockedReason: string | null;
};

export type BillingExportBatchStatus =
  | 'prepared'
  | 'export_ready'
  | 'exported'
  | 'submission_blocked'
  | 'not_submitted';

export type BillingExportItemType =
  | 'leistungsnachweis'
  | 'rechnung'
  | 'dta_vorbereitung'
  | 'nachweis_anhang'
  | 'other';

export type BillingExportBatch = TenantScopedEntity & {
  batchNumber: string;
  billingMode: ConnectBillingMode;
  providerKey: ConnectBillingProviderKey | null;
  status: BillingExportBatchStatus;
  exportFormat: string;
  itemCount: number;
  preparedAt: string;
  preparedBy: string | null;
  submittedAt: string | null;
  notes: string;
};

export type BillingExportItem = TenantScopedEntity & {
  batchId: string;
  clientId: string | null;
  invoiceId: string | null;
  itemType: BillingExportItemType;
  payloadReference: string | null;
  status: 'prepared' | 'included' | 'excluded' | 'error';
};

export type BillingProviderConfig = TenantScopedEntity & {
  providerKey: ConnectBillingProviderKey;
  status: ConnectBillingProviderStatus;
  environment: 'preparation' | 'sandbox' | 'production';
  isActive: boolean;
  exportFormat: string | null;
  apiReady: boolean;
  configuredAt: string | null;
  configuredBy: string | null;
  notes: string | null;
};

export type RejectionCaseType = 'ruecklaeufer' | 'absetzung';
export type RejectionCaseStatus = 'open' | 'in_review' | 'resolved' | 'closed';

export type RejectionManagementCase = TenantScopedEntity & {
  exportBatchId: string | null;
  exportItemId: string | null;
  caseType: RejectionCaseType;
  status: RejectionCaseStatus;
  reasonCode: string | null;
  reasonText: string;
  resolvedAt: string | null;
};

/** Eingabe für Abrechnungsvalidierung — keine echten Kundendaten erforderlich. */
export type BillingCaseInput = {
  clientId?: string | null;
  invoiceId?: string | null;
  pflegegrad?: number | null;
  hasAbtretungEinwilligung?: boolean;
  hasLeistungsnachweis?: boolean;
  hasUnterschrift?: boolean;
  costCarrierId?: string | null;
  costCarrierIk?: string | null;
  tenantIkNumber?: string | null;
  leistungszeitraumFrom?: string | null;
  leistungszeitraumTo?: string | null;
  budgetAvailableCents?: number | null;
  amountCents?: number | null;
  stundensatzCents?: number | null;
  rechnungsnummer?: string | null;
  leistungsart?: string | null;
};

export type BillingPreparationResult = {
  validation: BillingValidationReport;
  canPrepare: boolean;
  canExport: boolean;
  canSubmit: false;
  message: string;
};
