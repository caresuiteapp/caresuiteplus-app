import type { SystemCatalogKey, SystemCatalogOption } from './systemCatalog.types';
import { ALL_CATALOG_KEYS, getCatalogLabel, getSystemCatalog } from './systemCatalogs';

export function listCatalogKeys(): SystemCatalogKey[] {
  return ALL_CATALOG_KEYS;
}

export function getCatalogOptions(key: SystemCatalogKey): SystemCatalogOption[] {
  const catalog = getSystemCatalog(key);
  return catalog.entries.map((e) => ({ value: e.key, label: e.label }));
}

export function resolveCatalogLabel(key: SystemCatalogKey, value: string): string {
  return getCatalogLabel(key, value);
}

export function hasCatalog(key: string): boolean {
  return ALL_CATALOG_KEYS.includes(key as SystemCatalogKey);
}
