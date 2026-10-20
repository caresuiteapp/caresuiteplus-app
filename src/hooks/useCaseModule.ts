import { fetchCaseModuleSnapshot } from '@/lib/beratung/beratungModuleService';
import { useTenantModuleSnapshot } from '@/hooks/core/useTenantModuleSnapshot';

/** WP408 — Case Modul-Hook */
export function useCaseModule() {
  return useTenantModuleSnapshot(408, fetchCaseModuleSnapshot);
}
