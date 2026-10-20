import { fetchQmDashboard } from '@/lib/qm';
import { useQmTenantQuery } from './useQmBase';

export function useQmDashboard() {
  return useQmTenantQuery((tenantId, roleKey) => fetchQmDashboard(tenantId, roleKey));
}
