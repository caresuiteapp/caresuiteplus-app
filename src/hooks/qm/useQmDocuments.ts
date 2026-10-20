import { fetchQmDocuments } from '@/lib/qm';
import { useQmTenantQuery } from './useQmBase';

export function useQmDocuments() {
  return useQmTenantQuery((tenantId, roleKey) => fetchQmDocuments(tenantId, roleKey));
}
