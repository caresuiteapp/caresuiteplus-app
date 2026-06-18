import type { EffectiveModuleAccess } from '@/types';
import { OFFICE_MODULE_KEY } from './constants';
import type { BillingPreview } from './moduleEntitlementService';
import { legacyColorsFromPalette, type ColorMode } from '@/design/tokens/themeBridge';

export type ModuleHubKpi = {
  id: string;
  label: string;
  value: string;
  subValue?: string;
  icon?: string;
  accentColor?: string;
};

export function buildModuleHubKpis(modules: EffectiveModuleAccess[],
  billing: BillingPreview, mode: ColorMode = 'dark'): ModuleHubKpi[]  {
  const colors = legacyColorsFromPalette(mode);
  const activeCount = modules.filter((module) => module.isEffective).length;
  const inactiveCount = modules.length - activeCount;
  const specialtyActive = modules.filter(
    (module) => module.isEffective && module.productKey !== OFFICE_MODULE_KEY,
  ).length;
  const freeActive = modules.filter(
    (module) => module.billingStatus === 'free_active' || module.accessSource === 'free_active',
  ).length;

  return [
    {
      id: 'active',
      label: 'Aktiv',
      value: String(activeCount),
      subValue: `von ${modules.length}`,
      icon: '✅',
      accentColor: colors.success,
    },
    {
      id: 'inactive',
      label: 'Verfügbar',
      value: String(inactiveCount),
      icon: '⏸️',
      accentColor: inactiveCount > 0 ? colors.orange : colors.textMuted,
    },
    {
      id: 'specialty',
      label: 'Fachmodule',
      value: String(specialtyActive),
      subValue: 'kostenlos',
      icon: '🧩',
      accentColor: colors.cyan,
    },
    {
      id: 'free',
      label: 'Kostenlos',
      value: String(freeActive),
      subValue: '0 € / Monat',
      icon: '🆓',
      accentColor: colors.violet,
    },
  ];
}
