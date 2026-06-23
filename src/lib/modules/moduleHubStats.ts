import type { EffectiveModuleAccess } from '@/types';
import { PREMIUM_PREPARED_CONNECTORS } from '@/lib/billing/freePlatformService';
import { careSuiteColors, type ColorMode } from '@/design/tokens/colors';
import { OFFICE_MODULE_KEY } from './constants';
import type { BillingPreview } from './moduleEntitlementService';

export type ModuleHubKpi = {
  id: string;
  label: string;
  value: string;
  subValue?: string;
  icon?: string;
  accentColor?: string;
};

function palette(mode: ColorMode = 'dark') {
  const colors = careSuiteColors[mode];
  return {
    success: colors.status.success,
    cyan: colors.brand.cyan,
    orange: colors.brand.orange,
    violet: colors.brand.violet,
    textMuted: colors.text.muted,
  };
}

export function buildModuleHubKpis(
  modules: EffectiveModuleAccess[],
  _billing: BillingPreview,
  mode: ColorMode = 'dark',
): ModuleHubKpi[] {
  const colors = palette(mode);
  const activeCount = modules.filter((module) => module.isEffective).length;
  const availableCount = modules.filter(
    (module) => !module.isEffective && module.billingStatus !== 'admin_disabled',
  ).length;
  const baseCount = modules.filter(
    (module) => module.productKey === OFFICE_MODULE_KEY || module.accessSource === 'included_base',
  ).length;
  const extensionCount = PREMIUM_PREPARED_CONNECTORS.length;

  return [
    {
      id: 'active',
      label: 'Aktive Module',
      value: String(activeCount),
      subValue: 'für diesen Mandanten freigeschaltet',
      icon: '✅',
      accentColor: colors.success,
    },
    {
      id: 'available',
      label: 'Verfügbare Module',
      value: String(availableCount),
      subValue: 'können aktiviert werden',
      icon: '⏸️',
      accentColor: availableCount > 0 ? colors.cyan : colors.textMuted,
    },
    {
      id: 'base',
      label: 'Enthaltene Basismodule',
      value: String(Math.max(baseCount, 1)),
      subValue: 'ohne zusätzliche Kosten',
      icon: '🏢',
      accentColor: colors.orange,
    },
    {
      id: 'extensions',
      label: 'Erweiterungen',
      value: String(extensionCount),
      subValue: 'noch nicht aktiv',
      icon: '🔌',
      accentColor: colors.violet,
    },
  ];
}
