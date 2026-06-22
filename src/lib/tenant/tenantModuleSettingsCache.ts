import type { ProductKey } from '@/types';
import {
  DEFAULT_TENANT_MODULES,
  type TenantModuleKey,
  type TenantModuleSettings,
} from '@/types/tenant/tenantCenter';

const settingsCache = new Map<string, TenantModuleSettings>();
const listeners = new Set<() => void>();

export function getTenantModuleSettingsCache(tenantId: string): TenantModuleSettings {
  return settingsCache.get(tenantId) ?? { ...DEFAULT_TENANT_MODULES };
}

export function setTenantModuleSettingsCache(
  tenantId: string,
  modules: TenantModuleSettings,
): void {
  settingsCache.set(tenantId, { ...modules });
  listeners.forEach((listener) => listener());
}

export function subscribeTenantModuleSettings(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function resetTenantModuleSettingsCache(tenantId?: string): void {
  if (tenantId) {
    settingsCache.delete(tenantId);
  } else {
    settingsCache.clear();
  }
  listeners.forEach((listener) => listener());
}

const TENANT_MODULE_KEYS: readonly TenantModuleKey[] = [
  'assist',
  'pflege',
  'stationaer',
  'beratung',
];

export function isTenantCenterProductKey(key: ProductKey): key is TenantModuleKey {
  return (TENANT_MODULE_KEYS as readonly string[]).includes(key);
}

export function isProductEnabledInTenantSettings(
  settings: TenantModuleSettings,
  productKey: TenantModuleKey,
): boolean {
  switch (productKey) {
    case 'assist':
      return settings.assistEnabled;
    case 'pflege':
      return settings.pflegeEnabled;
    case 'stationaer':
      return settings.stationaerEnabled;
    case 'beratung':
      return settings.beratungEnabled;
    default:
      return false;
  }
}

export function hasAnyTenantCenterModuleEnabled(settings: TenantModuleSettings): boolean {
  return TENANT_MODULE_KEYS.some((key) => isProductEnabledInTenantSettings(settings, key));
}
