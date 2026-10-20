import type { ProductKey } from '@/types';
import { hasModuleAccess, getTenantModules } from '@/lib/modules/moduleAccessService';
import {
  isFreePlatformEnabled,
  isPremiumPrepared,
  type PremiumPreparedConnector,
} from './freePlatformService';

/** Hauptmodul-Zugriff: aktiv + nicht admin_disabled — kein Payment-Check. */
export function canAccessModule(
  moduleKey: ProductKey,
  tenantId: string,
): boolean {
  if (!tenantId) return false;

  const modules = getTenantModules(tenantId);
  const module = modules.find((entry) => entry.productKey === moduleKey);

  if (module?.billingStatus === 'admin_disabled' || module?.accessSource === 'disabled') {
    return false;
  }

  if (isFreePlatformEnabled()) {
    return module?.isActive === true || hasModuleAccess(moduleKey, tenantId);
  }

  return hasModuleAccess(moduleKey, tenantId);
}

/** Premium-Feature: nur vorbereitet — ehrlich preparedOnly, nicht blockierend für Hauptmodule. */
export function canAccessPremiumFeature(
  connectorKey: PremiumPreparedConnector | string,
  _tenantId?: string,
): boolean {
  if (!isPremiumPrepared(connectorKey)) {
    return false;
  }
  return false;
}

export function isModuleAdminDisabled(moduleKey: ProductKey, tenantId: string): boolean {
  const modules = getTenantModules(tenantId);
  const module = modules.find((entry) => entry.productKey === moduleKey);
  return module?.billingStatus === 'admin_disabled';
}
