import { legacyColorsFromPalette, type ColorMode } from '@/design/tokens/themeBridge';
import type { BudgetListItem } from '@/types/modules/billing';

export type BudgetListKpi = {
  id: string;
  label: string;
  value: string;
  subValue?: string;
  icon?: string;
  accentColor?: string;
};

export function buildBudgetListKpis(items: BudgetListItem[], mode: ColorMode = 'dark'): BudgetListKpi[]  {
  const colors = legacyColorsFromPalette(mode);
  const nearLimit = items.filter((item) => item.usagePercent >= 85).length;
  const active = items.filter((item) => item.status === 'aktiv').length;
  const avgUsage =
    items.length > 0
      ? Math.round(items.reduce((sum, item) => sum + item.usagePercent, 0) / items.length)
      : 0;

  return [
    {
      id: 'total',
      label: 'Budgets',
      value: String(items.length),
      subValue: `${active} aktiv`,
      icon: '📊',
      accentColor: colors.cyan,
    },
    {
      id: 'near-limit',
      label: 'Nahe Limit',
      value: String(nearLimit),
      subValue: '≥ 85 % Auslastung',
      icon: '⚠️',
      accentColor: colors.warning,
    },
    {
      id: 'avg-usage',
      label: 'Ø Auslastung',
      value: `${avgUsage} %`,
      subValue: 'Alle Budgets',
      icon: '📈',
      accentColor: colors.orange,
    },
  ];
}
