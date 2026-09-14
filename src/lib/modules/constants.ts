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

export function isUnreleasedModuleKey(productKey: ProductKey): boolean {
  return UNRELEASED_MODULE_KEYS.includes(productKey);
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
