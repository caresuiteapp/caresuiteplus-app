import { fetchQmMeasures } from '@/lib/qm';
import { useQmTenantQuery } from './useQmBase';

export function useQmMeasures() {
  return useQmTenantQuery((tenantId, roleKey) => fetchQmMeasures(tenantId, roleKey));
}
