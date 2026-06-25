import type { EntityId, ISODateTime } from '@/types/core/base';

/** Pflegegrad keys aligned with client_care_entitlement. */
export type ClientCareGrade = 'kein' | 'pg1' | 'pg2' | 'pg3' | 'pg4' | 'pg5' | 'hospiz';

export type BudgetTemplatePeriod = 'monthly' | 'yearly' | 'quarterly';

export type BudgetTemplateCatalogKey =
  | 'paragraph_45b'
  | 'umwandlung_pg2'
  | 'umwandlung_pg3'
  | 'umwandlung_pg4'
  | 'umwandlung_pg5'
  | 'verhinderungspflege'
  | 'kurzzeitpflege'
  | 'gemeinsames_jahresbudget'
  | 'selbstzahler'
  | 'kulanz'
  | 'ungeklaert';

export type BudgetTemplateCatalogEntry = {
  id: EntityId;
  catalogKey: BudgetTemplateCatalogKey | string;
  budgetYear: number;
  label: string;
  description: string | null;
  period: BudgetTemplatePeriod;
  defaultAmountCents: number | null;
  careGradeMin: ClientCareGrade | null;
  careGradeMax: ClientCareGrade | null;
  billingPriority: number;
  allowsIndividualOverride: boolean;
  autoGenerate: boolean;
  isStatutory: boolean;
  metadata: Record<string, unknown>;
  isActive: boolean;
};

export type ClientCareEntitlement = {
  id: EntityId;
  tenantId: EntityId;
  clientId: EntityId;
  careGrade: ClientCareGrade;
  validFrom: string;
  validUntil: string | null;
  conversionEnabled: boolean;
  careFundName: string | null;
  careFundMemberId: string | null;
  mdAssessmentDate: string | null;
  notes: string | null;
  source: string;
};

export type ClientServiceEntitlement = {
  id: EntityId;
  tenantId: EntityId;
  clientId: EntityId;
  serviceTypeId: EntityId | null;
  serviceTypeKey: string | null;
  billingMode: 'cost_carrier' | 'self_payer' | 'kulanz' | 'unclear' | 'mixed';
  isActive: boolean;
  validFrom: string;
  validUntil: string | null;
  hourlyRateCents: number | null;
  notes: string | null;
};

export type ClientCarePreventionBudgetMode =
  | 'joint_annual_budget'
  | 'separate_preventive_short_term';

export type ClientBudgetMode = {
  id: EntityId;
  tenantId: EntityId;
  clientId: EntityId;
  budgetYear: number;
  carePreventionMode: ClientCarePreventionBudgetMode;
  modeChangeReason: string | null;
};

export type ClientBudgetAccount = {
  id: EntityId;
  tenantId: EntityId;
  clientId: EntityId;
  catalogTemplateId: EntityId | null;
  catalogKey: string;
  catalogYear: number;
  period: BudgetTemplatePeriod;
  periodStart: string;
  periodEnd: string;
  allocatedCents: number;
  usedCents: number;
  reservedCents: number;
  isIndividualOverride: boolean;
  individualAmountCents: number | null;
  standardAmountCents: number | null;
  locked: boolean;
  lockReason: string | null;
  isEnabled: boolean;
  catalogSnapshot: Record<string, unknown>;
  billingPriority: number;
  status: 'active' | 'closed' | 'suspended';
  notes: string | null;
  remainingCents?: number;
  label?: string;
  autoGenerate?: boolean;
};

export type ClientBillingPriorityRule = {
  id: EntityId;
  tenantId: EntityId;
  clientId: EntityId | null;
  catalogKey: string;
  priorityOrder: number;
  isActive: boolean;
  notes: string | null;
};

export type ClientBudgetTransactionType =
  | 'allocation'
  | 'usage'
  | 'reservation'
  | 'release'
  | 'adjustment'
  | 'reversal';

export const CLIENT_BUDGET_TRANSACTION_LABELS: Record<ClientBudgetTransactionType, string> = {
  allocation: 'Zuteilung',
  usage: 'Verbrauch',
  reservation: 'Reservierung',
  release: 'Freigabe',
  adjustment: 'Korrektur',
  reversal: 'Storno',
};

export type ClientBudgetTransaction = {
  id: EntityId;
  tenantId: EntityId;
  clientId: EntityId;
  budgetAccountId: EntityId;
  transactionType: ClientBudgetTransactionType;
  amountCents: number;
  balanceAfterCents: number | null;
  referenceType: string | null;
  referenceId: EntityId | null;
  note: string | null;
  createdBy: EntityId | null;
  createdAt: ISODateTime;
  catalogKey?: string;
  accountLabel?: string;
};

export type ClientBillingWarningSeverity = 'info' | 'warning' | 'critical';

export type ClientBillingWarning = {
  id: EntityId;
  tenantId: EntityId;
  clientId: EntityId;
  warningType: string;
  severity: ClientBillingWarningSeverity;
  catalogKey: string | null;
  budgetAccountId: EntityId | null;
  message: string;
  isResolved: boolean;
  resolvedAt: ISODateTime | null;
  createdAt: ISODateTime;
};

export type ClientAssistBillingProfile = {
  asOfDate: string;
  budgetYear: number;
  careGrade: ClientCareGrade | null;
  careEntitlement: ClientCareEntitlement | null;
  conversionEligible: boolean;
  carePreventionMode: ClientCarePreventionBudgetMode;
  serviceEntitlements: ClientServiceEntitlement[];
  budgetAccounts: ClientBudgetAccount[];
  priorityRules: ClientBillingPriorityRule[];
  warnings: ClientBillingWarning[];
  templates: BudgetTemplateCatalogEntry[];
  /** Per catalog key — reflects reservations reducing available budget (PG1 blocks Umwandlung). */
  canUseBudgetByCatalogKey: Record<string, boolean>;
};

export const CARE_PREVENTION_MODE_LABELS: Record<ClientCarePreventionBudgetMode, string> = {
  joint_annual_budget: 'Gemeinsames Jahresbudget (VP + Kurzzeit kombiniert)',
  separate_preventive_short_term: 'Getrennte Verhinderungs- und Kurzzeitpflege',
};

export const BUDGET_TEMPLATE_LABELS: Partial<Record<BudgetTemplateCatalogKey, string>> = {
  paragraph_45b: '§ 45b Entlastungsbudget',
  umwandlung_pg2: 'Umwandlung PG 2',
  umwandlung_pg3: 'Umwandlung PG 3',
  umwandlung_pg4: 'Umwandlung PG 4',
  umwandlung_pg5: 'Umwandlung PG 5',
  verhinderungspflege: 'Verhinderungspflege',
  kurzzeitpflege: 'Kurzzeitpflege',
  gemeinsames_jahresbudget: 'Gemeinsames Jahresbudget',
  selbstzahler: 'Selbstzahler',
  kulanz: 'Kulanz',
  ungeklaert: 'Ungeklärt',
};

/** PG1: no auto Umwandlung per spec §2. */
export function isConversionEligibleForGrade(grade: ClientCareGrade | null): boolean {
  if (!grade) return false;
  return grade === 'pg2' || grade === 'pg3' || grade === 'pg4' || grade === 'pg5';
}

export function gradeMatchesTemplate(
  grade: ClientCareGrade | null,
  template: Pick<BudgetTemplateCatalogEntry, 'careGradeMin' | 'careGradeMax' | 'catalogKey'>,
): boolean {
  if (!grade || grade === 'kein' || grade === 'hospiz') {
    return template.catalogKey === 'selbstzahler'
      || template.catalogKey === 'kulanz'
      || template.catalogKey === 'ungeklaert';
  }
  const order: ClientCareGrade[] = ['pg1', 'pg2', 'pg3', 'pg4', 'pg5'];
  const gradeIdx = order.indexOf(grade);
  if (gradeIdx < 0) return false;
  const minIdx = template.careGradeMin ? order.indexOf(template.careGradeMin) : 0;
  const maxIdx = template.careGradeMax ? order.indexOf(template.careGradeMax) : order.length - 1;
  if (minIdx < 0 || maxIdx < 0) return true;
  return gradeIdx >= minIdx && gradeIdx <= maxIdx;
}

export function resolveTemplateAmountCents(
  template: BudgetTemplateCatalogEntry,
  individualOverrideCents?: number | null,
): number {
  if (individualOverrideCents != null) return individualOverrideCents;
  return template.defaultAmountCents ?? 0;
}
