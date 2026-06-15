import type { TenantScopedEntity } from '../../core/base';

export type BudgetType = 'paragraph_45b' | 'paragraph_45a' | 'verhinderungspflege' | 'entlastungsbetrag';

export const BUDGET_TYPE_LABELS: Record<BudgetType, string> = {
  paragraph_45b: '§45b Entlastungsbetrag',
  paragraph_45a: '§45a Verhinderungspflege',
  verhinderungspflege: 'Verhinderungspflege (Kombi)',
  entlastungsbetrag: 'Entlastungsbetrag',
};

export type ClientBudget = TenantScopedEntity & {
  clientId: string;
  budgetType: BudgetType;
  year: number;
  totalAmountCents: number;
  usedAmountCents: number;
  reservedAmountCents: number;
  validFrom: string;
  validUntil: string;
  notes: string | null;
};

export type BudgetTransactionRef = {
  id: string;
  budgetId: string;
  serviceRecordId: string | null;
  invoiceId: string | null;
  amountCents: number;
  description: string;
  bookedAt: string;
};
