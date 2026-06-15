import type { ProductKey, ServiceResult, TenantProduct } from '@/types';
import { OFFICE_MODULE_KEY } from '@/lib/modules/constants';
import {
  activateFreeModule as activateFreeModuleInStore,
  getTenantModules,
  resolveIncludedModules,
} from '@/lib/modules/moduleAccessService';
import {
  FREE_PLATFORM_PRODUCT_KEYS,
  isFreePlatformEnabled,
} from './freePlatformService';

function cloneModules(modules: TenantProduct[]): TenantProduct[] {
  return modules.map((module) => ({ ...module }));
}

/** CareSuite+ Office + alle Basis-Hauptmodule kostenlos aktivieren. */
export function activateAllBaseModulesForTenant(tenantId: string): ServiceResult<TenantProduct[]> {
  if (!isFreePlatformEnabled()) {
    return { ok: false, error: 'Free Platform ist nicht aktiv.' };
  }

  let modules = getTenantModules(tenantId);
  for (const moduleKey of FREE_PLATFORM_PRODUCT_KEYS) {
    const result = activateFreeModuleInStore(tenantId, moduleKey);
    if (result.ok) {
      modules = result.data;
    }
  }
  return { ok: true, data: cloneModules(modules) };
}

/** Einzelnes Hauptmodul kostenlos aktivieren — kein Checkout. */
export function activateFreeModuleForTenant(
  tenantId: string,
  moduleKey: ProductKey,
): ServiceResult<TenantProduct[]> {
  if (!isFreePlatformEnabled()) {
    return { ok: false, error: 'Free Platform ist nicht aktiv.' };
  }

  if (!(FREE_PLATFORM_PRODUCT_KEYS as string[]).includes(moduleKey)) {
    return { ok: false, error: `Modul „${moduleKey}" ist kein Free-Platform-Hauptmodul.` };
  }

  return activateFreeModuleInStore(tenantId, moduleKey);
}

/** Registrierung: Office immer + gewählte Module kostenlos. */
export function activateRegistrationModules(
  tenantId: string,
  selectedModules: ProductKey[],
): ServiceResult<TenantProduct[]> {
  if (!isFreePlatformEnabled()) {
    return { ok: false, error: 'Free Platform ist nicht aktiv.' };
  }

  const keys = resolveIncludedModules(
    Array.from(new Set([OFFICE_MODULE_KEY, ...selectedModules])),
  );

  let modules = getTenantModules(tenantId);
  for (const moduleKey of keys) {
    const result = activateFreeModuleInStore(tenantId, moduleKey);
    if (result.ok) {
      modules = result.data;
    }
  }
  return { ok: true, data: cloneModules(modules) };
}
