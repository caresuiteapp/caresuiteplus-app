import { fetchClientPortalModuleSnapshot } from '@/lib/portal/clientPortalModuleService';
import { useTenantModuleSnapshot } from '@/hooks/core/useTenantModuleSnapshot';

/** WP348 — ClientPortal Modul-Hook */
export function useClientPortalModule() {
  return useTenantModuleSnapshot(348, fetchClientPortalModuleSnapshot);
}
