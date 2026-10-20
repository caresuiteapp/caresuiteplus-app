import { fetchOfficeModuleSnapshot } from '@/lib/office/officeModuleService';
import { useTenantModuleSnapshot } from '@/hooks/core/useTenantModuleSnapshot';

/** WP148 — Office Modul-Hook */
export function useOfficeModule() {
  return useTenantModuleSnapshot(148, fetchOfficeModuleSnapshot);
}
