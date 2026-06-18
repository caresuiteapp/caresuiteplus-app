import type { ServiceResult, TenantProduct } from '@/types';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import { fetchTenantModulesFromSupabase } from '@/lib/modules/moduleAccessRepository.supabase';
import { getServiceMode } from '@/lib/services/mode';
import { getTenantModules, initializeModuleAccessStore } from './moduleAccessService';

/** Live-Mandant: tenant_products aus Supabase in den In-Memory-Store laden. */
export async function hydrateTenantModulesFromSupabase(
  tenantId: string,
): Promise<ServiceResult<TenantProduct[]>> {
  if (!tenantId || tenantId === DEMO_TENANT_ID || getServiceMode() !== 'supabase') {
    return { ok: true, data: getTenantModules(tenantId) };
  }

  const result = await fetchTenantModulesFromSupabase(tenantId);
  if (!result.ok) {
    return result;
  }

  initializeModuleAccessStore(tenantId, result.data);
  return { ok: true, data: getTenantModules(tenantId) };
}
