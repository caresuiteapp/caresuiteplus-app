import type { ProductKey } from '@/types';

/** Erweiterte Plattform-Module (nicht ProductKey, aber kostenlos freischaltbar). */
export type FreePlatformFeatureKey =
  | 'communication'
  | 'documents'
  | 'templates'
  | 'qm'
  | 'portals'
  | 'reporting';

export type FreePlatformModuleKey = ProductKey | FreePlatformFeatureKey;

export const FREE_PLATFORM_ENABLED = true;

export const FREE_PLATFORM_MONTHLY_EUR = 0;

/** Hauptmodule — kostenlos aktivierbar, kein Checkout. */
export const FREE_PLATFORM_PRODUCT_KEYS: ProductKey[] = [
  'office',
  'assist',
  'pflege',
  'beratung',
  'stationaer',
  'akademie',
];

export const FREE_PLATFORM_FEATURE_KEYS: FreePlatformFeatureKey[] = [
  'communication',
  'documents',
  'templates',
  'qm',
  'portals',
  'reporting',
];

/** Premium-Connectors — nur vorbereitet, nicht blockierend. */
export const PREMIUM_PREPARED_CONNECTORS = [
  'datev',
  'kim',
  'ti_connector',
  'e_rezept',
] as const;

export type PremiumPreparedConnector = (typeof PREMIUM_PREPARED_CONNECTORS)[number];

export function isFreePlatformEnabled(): boolean {
  return FREE_PLATFORM_ENABLED;
}

export function getFreePlatformModules(): FreePlatformModuleKey[] {
  return [...FREE_PLATFORM_PRODUCT_KEYS, ...FREE_PLATFORM_FEATURE_KEYS];
}

export function isFreePlatformProductKey(key: string): key is ProductKey {
  return (FREE_PLATFORM_PRODUCT_KEYS as string[]).includes(key);
}

export function isPremiumPreparedConnector(key: string): key is PremiumPreparedConnector {
  return (PREMIUM_PREPARED_CONNECTORS as readonly string[]).includes(key);
}

export function isPremiumPrepared(featureKey: string): boolean {
  return isPremiumPreparedConnector(featureKey);
}

export function formatFreePlatformPrice(): string {
  return 'CareSuite+ Plattform';
}
