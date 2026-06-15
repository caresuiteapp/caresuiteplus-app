import { fetchResidentModuleSnapshot } from '@/lib/stationaer/stationaerModuleService';
import { useTenantModuleSnapshot } from '@/hooks/core/useTenantModuleSnapshot';

/** WP388 — Resident Modul-Hook */
export function useResidentModule() {
  return useTenantModuleSnapshot(388, fetchResidentModuleSnapshot);
}
