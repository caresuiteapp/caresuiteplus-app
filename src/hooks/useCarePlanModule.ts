import { fetchCarePlanModuleSnapshot } from '@/lib/pflege/pflegeModuleService';
import { useTenantModuleSnapshot } from '@/hooks/core/useTenantModuleSnapshot';

/** WP368 — CarePlan Modul-Hook */
export function useCarePlanModule() {
  return useTenantModuleSnapshot(368, fetchCarePlanModuleSnapshot);
}
