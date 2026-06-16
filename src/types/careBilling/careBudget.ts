import type { TenantScopedEntity } from '../core/base';

/** Pflegegrade 1–5 (+ kein/hospiz für Stammdaten). */
export type CareBillingGrade = 'pg1' | 'pg2' | 'pg3' | 'pg4' | 'pg5';

export const CARE_BILLING_GRADE_LABELS: Record<CareBillingGrade, string> = {
  pg1: 'Pflegegrad 1',
  pg2: 'Pflegegrad 2',
  pg3: 'Pflegegrad 3',
  pg4: 'Pflegegrad 4',
  pg5: 'Pflegegrad 5',
};

export type CareBudgetType =
  | 'paragraph_45b'
  | 'umwandlungsanspruch'
  | 'jahres_sonderbudget'
  | 'selbstzahler';

export const CARE_BUDGET_TYPE_LABELS: Record<CareBudgetType, string> = {
  paragraph_45b: '§45b Entlastungsbetrag',
  umwandlungsanspruch: 'Umwandlungsanspruch',
  jahres_sonderbudget: 'Jahres-/Sonderbudget',
  selbstzahler: 'Selbstzahleranteil',
};

/** Standard §45b monatlich — mandantenkonfigurierbar. */
export const DEFAULT_ENTLASTUNGSBETRAG_MONTHLY_CENTS = 13100;

export type BudgetStatus =
  | 'nicht_genutzt'
  | 'beantragt'
  | 'genehmigt'
  | 'aktiv'
  | 'ausgeschoepft'
  | 'abgelehnt'
  | 'unbekannt';

export const BUDGET_STATUS_LABELS: Record<BudgetStatus, string> = {
  nicht_genutzt: 'Nicht genutzt',
  beantragt: 'Beantragt',
  genehmigt: 'Genehmigt',
  aktiv: 'Aktiv',
  ausgeschoepft: 'Ausgeschöpft',
  abgelehnt: 'Abgelehnt',
  unbekannt: 'Unbekannt',
};

/** Budget-Priorität bei Zuordnung (1 = höchste). */
export const BUDGET_ALLOCATION_PRIORITY: CareBudgetType[] = [
  'paragraph_45b',
  'umwandlungsanspruch',
  'jahres_sonderbudget',
  'selbstzahler',
];

export type ClientBudgetPeriod = TenantScopedEntity & {
  clientId: string;
  budgetType: CareBudgetType;
  year: number;
  month: number | null;
  totalAmountCents: number;
  usedAmountCents: number;
  reservedAmountCents: number;
  status: BudgetStatus;
  validFrom: string;
  validUntil: string;
  umwandlungMaxPercent: number | null;
  notes: string | null;
};

export type BudgetTransaction = TenantScopedEntity & {
  clientId: string;
  budgetPeriodId: string;
  billableItemId: string | null;
  invoiceDraftId: string | null;
  amountCents: number;
  transactionType: 'reserve' | 'consume' | 'release' | 'correction';
  description: string;
  bookedAt: string;
};

export type BudgetAllocationLine = {
  budgetType: CareBudgetType;
  budgetPeriodId: string;
  amountCents: number;
};

export type BudgetAllocationResult = {
  totalAmountCents: number;
  allocations: BudgetAllocationLine[];
  selfPayerAmountCents: number;
  warnings: string[];
  blocked: boolean;
  blockedReason: string | null;
};

export type TenantBudgetConfig = {
  tenantId: string;
  entlastungsbetragMonthlyCents: number;
  umwandlungEnabled: boolean;
  updatedAt: string;
};
