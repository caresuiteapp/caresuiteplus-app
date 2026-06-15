import { fetchExecutionModuleSnapshot } from '@/lib/assist/executionModuleService';
import { useTenantModuleSnapshot } from '@/hooks/core/useTenantModuleSnapshot';

/** WP268 — Execution Modul-Hook */
export function useExecutionModule() {
  return useTenantModuleSnapshot(268, fetchExecutionModuleSnapshot);
}
