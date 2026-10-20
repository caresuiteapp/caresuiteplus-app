import type { BudgetTemplatePeriod } from '@/types/assist/clientAssistBilling';

export const BUDGET_PERIOD_LABELS: Record<BudgetTemplatePeriod, string> = {
  monthly: 'monatlich',
  yearly: 'jährlich',
  quarterly: 'quarterlich',
};

/** German period label — Umwandlung PG2–PG5 is always monthly per §45a spec. */
export function formatBudgetPeriodLabel(
  period: BudgetTemplatePeriod | null | undefined,
  catalogKey?: string | null,
): string {
  if (catalogKey?.startsWith('umwandlung_')) return 'monatlich';
  if (!period) return '—';
  return BUDGET_PERIOD_LABELS[period] ?? period;
}

export function formatBudgetPeriodLabelCapitalized(
  period: BudgetTemplatePeriod | null | undefined,
  catalogKey?: string | null,
): string {
  const label = formatBudgetPeriodLabel(period, catalogKey);
  if (label === '—') return label;
  return label.charAt(0).toUpperCase() + label.slice(1);
}
