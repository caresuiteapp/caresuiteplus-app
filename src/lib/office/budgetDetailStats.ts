import type { BudgetDetail } from '@/types/modules/billing';
import { formatCurrency } from './invoiceListService';
import { legacyColorsFromPalette, type ColorMode } from '@/design/tokens/themeBridge';

export type BudgetDetailKpi = {
  id: string;
  label: string;
  value: string;
  subValue?: string;
  icon?: string;
  accentColor?: string;
};

const PERIOD_LABELS = {
  monthly: 'Monatlich',
  quarterly: 'Quartal',
  yearly: 'Jährlich',
} as const;

export function buildBudgetDetailKpis(budget: BudgetDetail, mode: ColorMode = 'dark'): BudgetDetailKpi[]  {
  const colors = legacyColorsFromPalette(mode);
  const remaining = Math.max(0, budget.allocatedCents - budget.usedCents);
  const linkedCount = budget.linkedInvoiceIds.length;

  return [
    {
      id: 'usage',
      label: 'Auslastung',
      value: `${budget.usagePercent} %`,
      subValue: PERIOD_LABELS[budget.period],
      icon: '📊',
      accentColor: budget.usagePercent >= 85 ? colors.danger : colors.cyan,
    },
    {
      id: 'used',
      label: 'Verbraucht',
      value: formatCurrency(budget.usedCents, budget.currency),
      subValue: `von ${formatCurrency(budget.allocatedCents, budget.currency)}`,
      icon: '💳',
      accentColor: colors.orange,
    },
    {
      id: 'remaining',
      label: 'Verbleibend',
      value: formatCurrency(remaining, budget.currency),
      icon: '✅',
      accentColor: remaining === 0 ? colors.danger : colors.success,
    },
    {
      id: 'invoices',
      label: 'Rechnungen',
      value: String(linkedCount),
      subValue: linkedCount === 1 ? 'Verknüpfung' : 'Verknüpfungen',
      icon: '🧾',
      accentColor: colors.violet,
    },
  ];
}
