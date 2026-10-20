import { fetchQmExportJobs } from '@/lib/qm';
import { useQmTenantQuery } from './useQmBase';

export function useQmExports() {
  return useQmTenantQuery((tenantId, roleKey) => fetchQmExportJobs(tenantId, roleKey));
}
