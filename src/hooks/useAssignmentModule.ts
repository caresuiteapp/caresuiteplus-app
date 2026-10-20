import { fetchAssignmentModuleSnapshot } from '@/lib/assist/assistPlanningModuleService';
import { useTenantModuleSnapshot } from '@/hooks/core/useTenantModuleSnapshot';

/** WP248 — Assignment Modul-Hook */
export function useAssignmentModule() {
  return useTenantModuleSnapshot(248, fetchAssignmentModuleSnapshot);
}
