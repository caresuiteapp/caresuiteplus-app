import { fetchClientModuleSnapshot } from '@/lib/office/clientsModuleService';
import { useTenantModuleSnapshot } from '@/hooks/core/useTenantModuleSnapshot';

/** WP168 — Client Modul-Hook */
export function useClientModule() {
  return useTenantModuleSnapshot(168, fetchClientModuleSnapshot);
}
