import type { ProductKey } from '@/types';

export const OFFICE_MODULE_KEY: ProductKey = 'office';

/** Fachmodule — aktiviert Office automatisch als Basisverwaltung. */
export const SPECIALTY_MODULE_KEYS: ProductKey[] = [
  'assist',
  'pflege',
  'stationaer',
  'beratung',
  'akademie',
];

export const ALL_PRODUCT_KEYS: ProductKey[] = [OFFICE_MODULE_KEY, ...SPECIALTY_MODULE_KEYS];

/**
 * Noch nicht produktionsreife Fachmodule. Diese Sperre gilt mandantenübergreifend
 * und kann weder durch alte tenant_products-Daten noch durch eine Plattform-
 * Freigabe umgangen werden.
 */
export const UNRELEASED_MODULE_KEYS: readonly ProductKey[] = [
  'pflege',
  'stationaer',
  'beratung',
  'akademie',
];

export function isUnreleasedModuleKey(productKey: string): productKey is ProductKey {
  return UNRELEASED_MODULE_KEYS.includes(productKey as ProductKey);
}

/** Returns the globally locked product for one of its root or deep-link routes. */
export function getUnreleasedModuleKeyFromPath(path: string): ProductKey | null {
  const pathname = path.split(/[?#]/, 1)[0]?.toLocaleLowerCase('de-DE') ?? '';
  return (
    UNRELEASED_MODULE_KEYS.find(
      (productKey) => pathname === `/${productKey}` || pathname.startsWith(`/${productKey}/`),
    ) ?? null
  );
}

export function isUnreleasedModuleRoute(path: string): boolean {
  return getUnreleasedModuleKeyFromPath(path) !== null;
}

export function isSpecialtyModuleKey(productKey: ProductKey): boolean {
  return SPECIALTY_MODULE_KEYS.includes(productKey);
}

export function isPurchasedAccessSource(
  source: import('@/types').ModuleAccessSource,
): boolean {
  return (
    source === 'purchased' ||
    source === 'trial' ||
    source === 'admin_granted' ||
    source === 'demo' ||
    source === 'free_active'
  );
}
