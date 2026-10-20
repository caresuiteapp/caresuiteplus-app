import { fetchEmployeePortalModuleSnapshot } from '@/lib/portal/employeePortalModuleService';
import { useTenantModuleSnapshot } from '@/hooks/core/useTenantModuleSnapshot';

/** WP328 — EmployeePortal Modul-Hook */
export function useEmployeePortalModule() {
  return useTenantModuleSnapshot(328, fetchEmployeePortalModuleSnapshot);
}
