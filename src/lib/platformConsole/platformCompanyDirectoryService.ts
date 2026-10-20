import type { ServiceResult } from '@/types/core/base';
import type { PlatformTenantListItem } from '@/types/platformConsole';
import { getServiceMode } from '@/lib/services/mode';
import { platformRpc } from './platformSupabaseClient';
import { listPlatformTenants, type PlatformTenantFilters } from './platformTenantService';
export async function listPlatformCompanies(filters: PlatformTenantFilters & { environment?: string }): Promise<ServiceResult<{ items: PlatformTenantListItem[]; limit: number; offset: number }>> {
  if (getServiceMode() === 'demo') return listPlatformTenants(filters);
  const { data, error } = await platformRpc<{ items: PlatformTenantListItem[]; limit: number; offset: number }>('platform_list_companies', {
    p_search: filters.search || null, p_status: filters.status || null,
    p_billing_status: filters.billingStatus || null, p_plan_key: filters.planKey || null,
    p_limit: filters.limit ?? 51, p_offset: filters.offset ?? 0, p_environment: filters.environment || null,
  });
  if (error || !data) return { ok: false, error: error?.message ?? 'Unternehmensliste nicht verfügbar.' };
  return { ok: true, data };
}
