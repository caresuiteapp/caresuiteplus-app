import { fetchPlatformModuleSnapshot } from '@/lib/platform/platformModuleService';
import { useTenantModuleSnapshot } from '@/hooks/core/useTenantModuleSnapshot';

/** WP468 — Platform Modul-Hook */
export function usePlatformModule() {
  return useTenantModuleSnapshot(468, fetchPlatformModuleSnapshot);
}
