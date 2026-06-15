import { fetchQmAiDrafts } from '@/lib/qm';
import { useQmTenantQuery } from './useQmBase';

export function useQmAiAssistant() {
  return useQmTenantQuery((tenantId, roleKey) => fetchQmAiDrafts(tenantId, roleKey));
}
