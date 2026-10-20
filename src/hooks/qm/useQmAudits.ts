import { fetchQmAudits } from '@/lib/qm';
import { useQmTenantQuery } from './useQmBase';

export function useQmAudits() {
  return useQmTenantQuery((tenantId, roleKey) => fetchQmAudits(tenantId, roleKey));
}
