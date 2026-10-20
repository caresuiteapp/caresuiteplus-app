import { formatCurrency } from '@/lib/office';
import { legacyColorsFromPalette, type ColorMode } from '@/design/tokens/themeBridge';
import type { BillingDashboardStats } from '@/types/modules/billing';

export type BillingListKpi = {
  id: string;
  label: string;
  value: string;
  subValue?: string;
  icon?: string;
  accentColor?: string;
};

export function buildBillingDashboardKpis(stats: BillingDashboardStats, mode: ColorMode = 'dark'): BillingListKpi[]  {
  const colors = legacyColorsFromPalette(mode);
  return [
    {
      id: 'open-invoices',
      label: 'Offene Rechnungen',
      value: String(stats.openInvoicesCount),
      subValue: formatCurrency(stats.openInvoicesCents),
      icon: '💶',
      accentColor: colors.orange,
    },
    {
      id: 'overdue',
      label: 'Überfällig',
      value: String(stats.overdueCount),
      subValue: 'Fälligkeit prüfen',
      icon: '⚠️',
      accentColor: colors.danger,
    },
    {
      id: 'budgets',
      label: 'Aktive Budgets',
      value: String(stats.activeBudgetsCount),
      subValue: `${stats.budgetsNearLimitCount} nahe Limit`,
      icon: '📊',
      accentColor: colors.cyan,
    },
  ];
}
