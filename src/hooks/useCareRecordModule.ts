import { fetchCareRecordModuleSnapshot } from '@/lib/assist/careRecordsModuleService';
import { useTenantModuleSnapshot } from '@/hooks/core/useTenantModuleSnapshot';

/** WP288 — CareRecord Modul-Hook */
export function useCareRecordModule() {
  return useTenantModuleSnapshot(288, fetchCareRecordModuleSnapshot);
}
