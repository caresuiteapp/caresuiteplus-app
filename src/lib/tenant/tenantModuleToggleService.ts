import type { ProductKey, RoleKey, ServiceResult } from '@/types';
import type { TenantModuleSettings } from '@/types/tenant/tenantCenter';
import {
  activatePurchasedModule,
  deactivateModule,
} from '@/lib/modules/moduleAccessService';
import { OFFICE_MODULE_KEY } from '@/lib/modules/constants';
import { saveTenantModuleSettings } from './tenantCenterService';
import {
  getTenantModuleSettingsCache,
  isTenantCenterProductKey,
} from './tenantModuleSettingsCache';
import { canManageTenantModuleSettings } from './tenantModuleSettingsPermissions';

function patchTenantModuleSettings(
  current: TenantModuleSettings,
  productKey: ProductKey,
  enabled: boolean,
): TenantModuleSettings {
  switch (productKey) {
    case 'assist':
      return { ...current, assistEnabled: enabled };
    case 'pflege':
      return { ...current, pflegeEnabled: enabled };
    case 'stationaer':
      return { ...current, stationaerEnabled: enabled };
    case 'beratung':
      return { ...current, beratungEnabled: enabled };
    default:
      return current;
  }
}

/**
 * Einheitlicher Schalter für Mandanten-Center und /business/modules.
 * Fachmodule assist/pflege/stationaer/beratung → tenant_module_settings + moduleAccessService.
 * Akademie → nur moduleAccessService.
 */
export async function setTenantModuleEnabled(
  tenantId: string,
  productKey: ProductKey,
  enabled: boolean,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<void>> {
  const denied = canManageTenantModuleSettings(actorRoleKey);
  if (denied) return denied;

  if (!tenantId?.trim()) {
    return { ok: false, error: 'Kein Mandant.' };
  }

  if (productKey === OFFICE_MODULE_KEY) {
    return {
      ok: false,
      error: 'Office wird automatisch eingeblendet, sobald mindestens ein Fachmodul aktiv ist.',
    };
  }

  if (isTenantCenterProductKey(productKey)) {
    const current = getTenantModuleSettingsCache(tenantId);
    const next = patchTenantModuleSettings(current, productKey, enabled);
    const result = await saveTenantModuleSettings(tenantId, next, actorRoleKey);
    return result.ok ? { ok: true, data: undefined } : result;
  }

  if (enabled) {
    const result = activatePurchasedModule(tenantId, productKey);
    return result.ok ? { ok: true, data: undefined } : result;
  }

  const result = deactivateModule(tenantId, productKey);
  return result.ok ? { ok: true, data: undefined } : result;
}
