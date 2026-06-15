import { fetchQmChanges } from '@/lib/qm';
import { useQmTenantQuery } from './useQmBase';

export function useQmChanges() {
  return useQmTenantQuery((tenantId, roleKey) => fetchQmChanges(tenantId, roleKey));
}
