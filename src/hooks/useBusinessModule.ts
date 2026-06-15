import { fetchBusinessModuleSnapshot } from '@/lib/business/businessModuleService';
import { useTenantModuleSnapshot } from '@/hooks/core/useTenantModuleSnapshot';

/** WP128 — Business Modul-Hook */
export function useBusinessModule() {
  return useTenantModuleSnapshot(128, fetchBusinessModuleSnapshot);
}
