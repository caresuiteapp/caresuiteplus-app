import { fetchTripModuleSnapshot } from '@/lib/assist/tripsModuleService';
import { useTenantModuleSnapshot } from '@/hooks/core/useTenantModuleSnapshot';

/** WP308 — Trip Modul-Hook */
export function useTripModule() {
  return useTenantModuleSnapshot(308, fetchTripModuleSnapshot);
}
