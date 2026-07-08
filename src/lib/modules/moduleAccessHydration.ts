import type { ServiceResult, TenantProduct } from '@/types';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import { fetchTenantModulesFromSupabase } from '@/lib/modules/moduleAccessRepository.supabase';
import { hydratePlatformTenantModulesFromSupabase } from '@/lib/modules/platformTenantModuleAccess';
import { getServiceMode } from '@/lib/services/mode';
import { getTenantModules, initializeModuleAccessStore } from './moduleAccessService';

/** Live-Mandant: tenant_products + platform_tenant_modules in Stores laden. */
export async function hydrateTenantModulesFromSupabase(
  tenantId: string,
): Promise<ServiceResult<TenantProduct[]>> {
  if (!tenantId || tenantId === DEMO_TENANT_ID || getServiceMode() !== 'supabase') {
    return { ok: true, data: getTenantModules(tenantId) };
  }

  const [result, platformResult] = await Promise.all([
    fetchTenantModulesFromSupabase(tenantId),
    hydratePlatformTenantModulesFromSupabase(tenantId),
  ]);

  if (!result.ok) {
    return result;
  }

  if (!platformResult.ok) {
    return { ok: false, error: platformResult.error };
  }

  initializeModuleAccessStore(tenantId, result.data);
  return { ok: true, data: getTenantModules(tenantId) };
}
