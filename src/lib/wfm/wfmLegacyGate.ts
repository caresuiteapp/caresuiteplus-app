import { isDemoMode } from '@/lib/supabase/config';

/**
 * WFM ist Single Source of Truth für Zeiterfassung.
 * Der In-Memory-Store (timeTrackingStore) bleibt nur für Legacy-Unit-Tests aktiv.
 */
export function isLegacyTimeTrackingStoreEnabled(): boolean {
  if (
    process.env.NODE_ENV === 'test' &&
    process.env.EXPO_PUBLIC_WFM_LEGACY_STORE === 'true'
  ) {
    return true;
  }
  if (isDemoMode()) return true;
  return false;
}

export const WFM_LEGACY_STORE_DISABLED_MESSAGE =
  'Die zentrale WFM-Zeiterfassung ist aktiv. Bitte nutzen Sie Arbeitszeit → Erfassung.';
