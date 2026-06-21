/**
 * Client Core K.5 — billing handoff types (preview/candidates only, no final invoices).
 */

export type BillingCandidateStatus =
  | 'not_ready'
  | 'ready_for_review'
  | 'blocked'
  | 'draftable';

export type BillingTargetType = 'cost_carrier' | 'self_payer' | 'mixed' | 'internal';

export type CandidateBudgetMovementType = 'reserved' | 'consumed' | 'released' | 'adjusted';

export type BillingBlockingReasonKey =
  | 'missing_client'
  | 'missing_service_profile'
  | 'missing_service_type'
  | 'missing_budget_year'
  | 'missing_budget_type'
  | 'missing_budget_setting'
  | 'missing_rate'
  | 'missing_cost_carrier'
  | 'missing_assignment_declaration'
  | 'missing_signature'
  | 'proof_not_approved'
  | 'proof_not_released'
  | 'invalid_time_range'
  | 'amount_zero'
  | 'budget_exceeded'
  | 'portal_release_revoked'
  | 'billing_target_unknown'
  | 'client_inactive'
  | 'service_profile_inactive';

export const BILLING_BLOCKING_REASON_LABELS: Record<BillingBlockingReasonKey, string> = {
  missing_client: 'Klient:in fehlt',
  missing_service_profile: 'Leistungsprofil fehlt',
  missing_service_type: 'Leistungsart fehlt',
  missing_budget_year: 'Budgetjahr fehlt',
  missing_budget_type: 'Budgetart fehlt',
  missing_budget_setting: 'Klient:innen-Budget nicht hinterlegt',
  missing_rate: 'Kein Stundensatz/Rate konfiguriert',
  missing_cost_carrier: 'Kostenträger fehlt',
  missing_assignment_declaration: 'Abtretungserklärung fehlt',
  missing_signature: 'Signatur fehlt',
  proof_not_approved: 'Nachweis nicht freigegeben',
  proof_not_released: 'Nachweis nicht veröffentlicht',
  invalid_time_range: 'Zeitraum ungültig',
  amount_zero: 'Betrag ist null',
  budget_exceeded: 'Budget überschritten',
  portal_release_revoked: 'Portal-Freigabe zurückgezogen',
  billing_target_unknown: 'Abrechnungsempfänger unbekannt',
  client_inactive: 'Klient:in inaktiv',
  service_profile_inactive: 'Leistungsprofil inaktiv',
};

export const BILLING_CANDIDATE_STATUS_LABELS: Record<BillingCandidateStatus, string> = {
  not_ready: 'Nicht bereit',
  ready_for_review: 'Zur Prüfung bereit',
  blocked: 'Blockiert',
  draftable: 'Entwurf möglich',
};

export type ClientBillingCandidate = {
  id: string;
  tenantId: string;
  clientId: string;
  clientServiceProfileId: string | null;
  serviceTypeId: string | null;
  proofId: string;
  visitId: string;
  proofDate: string | null;
  billingPeriodStart: string | null;
  billingPeriodEnd: string | null;
  durationMinutes: number | null;
  quantity: number | null;
  unit: string;
  rateAmount: number | null;
  amountPreviewCents: number;
  currency: string;
  budgetSettingId: string | null;
  budgetTypeId: string | null;
  billingTargetType: BillingTargetType;
  billingTargetId: string | null;
  status: BillingCandidateStatus;
  blockingReasons: BillingBlockingReasonKey[];
  sourceSnapshot: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type ClientBillingCandidateBudgetMovement = {
  id: string;
  tenantId: string;
  billingCandidateId: string;
  clientBudgetSettingId: string;
  clientBudgetMovementId: string | null;
  movementType: CandidateBudgetMovementType;
  amountCents: number;
  createdAt: string;
};

export type TenantBillingSettings = {
  id: string;
  tenantId: string;
  defaultCurrency: string;
  defaultUnit: string;
  defaultTaxMode: string;
  defaultPaymentTermsDays: number;
  defaultInvoiceMode: 'preview_only' | 'draft_only' | 'manual_review';
  requireSignature: boolean;
  requireApproval: boolean;
  requireAssignmentDeclaration: boolean;
  allowSelfPayerFallback: boolean;
  allowBudgetOverrun: boolean;
};

export type TenantServiceTypeBillingRule = {
  id: string;
  tenantId: string;
  serviceTypeId: string;
  defaultRateAmount: number | null;
  defaultUnit: string;
  defaultBillingTargetType: BillingTargetType;
  requireBudget: boolean;
  requireSignature: boolean;
  requireApproval: boolean;
  requireAssignmentDeclaration: boolean;
  allowSelfPayer: boolean;
  allowBudgetOverrun: boolean;
  isActive: boolean;
};

export type ProofBillingSourceSnapshot = {
  proofId: string;
  visitId: string;
  clientId: string | null;
  serviceTypeKey: string | null;
  serviceName: string | null;
  clientName: string | null;
  employeeName: string | null;
  signed: boolean;
  approved: boolean;
  released: boolean;
  proofStatus: string;
  portalReleaseStatus: string;
  startTime: string | null;
  endTime: string | null;
  durationMinutes: number | null;
  tasksSnapshot: Array<{ title: string; status?: string }>;
  documentationSnapshot: Record<string, unknown>;
  rateSource: 'tenant_rule' | 'visit_budget' | 'none';
  rateAmount: number | null;
};

export type BillingReadinessSummary = {
  clientId: string;
  totalCandidates: number;
  draftableCount: number;
  blockedCount: number;
  readyForReviewCount: number;
  blockingReasons: BillingBlockingReasonKey[];
  hasBudgetSettings: boolean;
  hasBillingRules: boolean;
};

export type ClientBudgetConsumptionSummary = {
  clientId: string;
  budgetYear: number | null;
  totalAllocatedCents: number;
  totalUsedCents: number;
  totalReservedCents: number;
  totalRemainingCents: number;
  candidateReservedCents: number;
  candidateConsumedCents: number;
};

export type ClientBillingPreviewLine = {
  candidateId: string;
  proofId: string;
  visitId: string;
  proofDate: string | null;
  serviceTypeName: string | null;
  durationMinutes: number | null;
  amountPreviewCents: number;
  status: BillingCandidateStatus;
  blockingReasons: BillingBlockingReasonKey[];
  billingTargetType: BillingTargetType;
};

export type ClientBillingPreview = {
  clientId: string;
  periodStart: string | null;
  periodEnd: string | null;
  lines: ClientBillingPreviewLine[];
  totalAmountPreviewCents: number;
  totalDurationMinutes: number;
  draftableCount: number;
  blockedCount: number;
  blockingReasons: BillingBlockingReasonKey[];
  budgetSummary: ClientBudgetConsumptionSummary | null;
  warnings: string[];
};

/** Guard result — K.5 never creates final invoices. */
export type NeverFinalizeInvoiceResult = {
  allowed: false;
  reason: string;
};
