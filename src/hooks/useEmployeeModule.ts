import { fetchEmployeeModuleSnapshot } from '@/lib/office/employeesModuleService';
import { useTenantModuleSnapshot } from '@/hooks/core/useTenantModuleSnapshot';

/** WP188 — Employee Modul-Hook */
export function useEmployeeModule() {
  return useTenantModuleSnapshot(188, fetchEmployeeModuleSnapshot);
}
