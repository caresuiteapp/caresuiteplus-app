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
