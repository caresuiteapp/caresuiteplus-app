import type { ProductKey } from '@/types';
import type { TenantModuleSettings } from '@/types/tenant/tenantCenter';
import {
  activatePurchasedModule,
  deactivateModule,
} from '@/lib/modules/moduleAccessService';
import { isTenantCenterProductKey } from './tenantModuleSettingsCache';

const TENANT_CENTER_PRODUCT_KEYS: readonly ProductKey[] = [
  'assist',
  'pflege',
  'stationaer',
  'beratung',
];

/** Mandanten-Center-Toggles → tenant_products / Modul-Gates synchronisieren. */
export function syncModuleAccessFromTenantSettings(
  tenantId: string,
  modules: TenantModuleSettings,
): void {
  for (const productKey of TENANT_CENTER_PRODUCT_KEYS) {
    if (!isTenantCenterProductKey(productKey)) continue;
    const enabled =
      productKey === 'assist'
        ? modules.assistEnabled
        : productKey === 'pflege'
          ? modules.pflegeEnabled
          : productKey === 'stationaer'
            ? modules.stationaerEnabled
            : modules.beratungEnabled;

    if (enabled) {
      activatePurchasedModule(tenantId, productKey);
    } else {
      deactivateModule(tenantId, productKey);
    }
  }
}
