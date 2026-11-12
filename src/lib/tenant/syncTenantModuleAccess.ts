import type { ProductKey } from '@/types';
import type { TenantModuleSettings } from '@/types/tenant/tenantCenter';
import {
  activatePurchasedModule,
  deactivateModule,
  usesConfirmedPflegeAccess,
} from '@/lib/modules/moduleAccessService';
import { isTenantCenterProductKey } from './tenantModuleSettingsCache';

const TENANT_CENTER_PRODUCT_KEYS: readonly ProductKey[] = [
  'assist',
  'pflege',
  'stationaer',
  'beratung',
];

/** Synchronisiert Mandanten-Center-Toggles mit den lokalen Legacy-Modul-Gates. */
export function syncModuleAccessFromTenantSettings(
  tenantId: string,
  modules: TenantModuleSettings,
): void {
  for (const productKey of TENANT_CENTER_PRODUCT_KEYS) {
    if (!isTenantCenterProductKey(productKey)) continue;
    // Live Pflege evaluates the saved preference and confirmed entitlement
    // independently. A settings read must never overwrite the licence row.
    if (productKey === 'pflege' && usesConfirmedPflegeAccess(tenantId)) continue;
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
