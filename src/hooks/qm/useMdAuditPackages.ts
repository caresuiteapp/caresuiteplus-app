import { fetchMdAuditPackages } from '@/lib/qm';
import { useQmTenantQuery } from './useQmBase';

export function useMdAuditPackages() {
  return useQmTenantQuery((tenantId, roleKey) => fetchMdAuditPackages(tenantId, roleKey));
}
