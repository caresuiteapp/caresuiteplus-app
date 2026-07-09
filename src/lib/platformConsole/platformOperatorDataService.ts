import type { ServiceResult } from '@/types/core/base';
import { getServiceMode } from '@/lib/services/mode';
import { platformSelectWhere } from './platformSupabaseClient';

export async function listPlatformPlanVersions(
  planKey?: string,
): Promise<ServiceResult<Record<string, unknown>[]>> {
  if (getServiceMode() === 'demo') {
    return {
      ok: true,
      data: [
        {
          id: 'pv-demo-1',
          plan_key: planKey ?? 'starter',
          version_number: 1,
          monthly_price_cents: 9900,
          yearly_price_cents: 99000,
          status: 'active',
        },
      ],
    };
  }
  return platformSelectWhere('platform_plan_versions', '*', {
    orderBy: 'version_number',
    ascending: false,
    eq: planKey ? { plan_key: planKey } : undefined,
  });
}

export async function listPlatformPlanModules(
  planVersionId: string,
): Promise<ServiceResult<Record<string, unknown>[]>> {
  if (getServiceMode() === 'demo') {
    return { ok: true, data: [{ module_key: 'office', access_state: 'active' }] };
  }
  return platformSelectWhere('platform_plan_modules', '*', {
    orderBy: 'module_key',
    ascending: true,
    eq: { plan_version_id: planVersionId },
  });
}

export async function listPlatformPlanLimits(
  planVersionId: string,
): Promise<ServiceResult<Record<string, unknown>[]>> {
  if (getServiceMode() === 'demo') {
    return { ok: true, data: [{ limit_key: 'max_users', limit_value: 10 }] };
  }
  return platformSelectWhere('platform_plan_limits', '*', {
    orderBy: 'limit_key',
    ascending: true,
    eq: { plan_version_id: planVersionId },
  });
}

export async function listPlatformAddonsCatalog(): Promise<ServiceResult<Record<string, unknown>[]>> {
  if (getServiceMode() === 'demo') {
    return {
      ok: true,
      data: [{ addon_key: 'sms_pack', addon_name: 'SMS Paket', status: 'active' }],
    };
  }
  return platformSelectWhere('platform_addons', '*', { orderBy: 'addon_name', ascending: true });
}

export async function listPlatformAddonVersions(
  addonKey: string,
): Promise<ServiceResult<Record<string, unknown>[]>> {
  if (getServiceMode() === 'demo') {
    return {
      ok: true,
      data: [{ addon_key: addonKey, version_number: 1, monthly_price_cents: 1500, status: 'active' }],
    };
  }
  return platformSelectWhere('platform_addon_versions', '*', {
    orderBy: 'version_number',
    ascending: false,
    eq: { addon_key: addonKey },
  });
}

export async function listPlatformTenantSubscriptions(
  tenantId: string,
): Promise<ServiceResult<Record<string, unknown>[]>> {
  if (getServiceMode() === 'demo') {
    return {
      ok: true,
      data: [{ tenant_id: tenantId, plan_key: 'starter', status: 'active', billing_interval: 'monthly' }],
    };
  }
  return platformSelectWhere('platform_tenant_subscriptions', '*', {
    orderBy: 'created_at',
    ascending: false,
    eq: { tenant_id: tenantId },
  });
}

export async function listPlatformTenantAddons(
  tenantId: string,
): Promise<ServiceResult<Record<string, unknown>[]>> {
  if (getServiceMode() === 'demo') {
    return { ok: true, data: [] };
  }
  return platformSelectWhere('platform_tenant_addons', '*', {
    orderBy: 'created_at',
    ascending: false,
    eq: { tenant_id: tenantId },
  });
}

export async function getPlatformTenantCredits(
  tenantId: string,
): Promise<ServiceResult<Record<string, unknown> | null>> {
  if (getServiceMode() === 'demo') {
    return { ok: true, data: { tenant_id: tenantId, balance_cents: 0 } };
  }
  const res = await platformSelectWhere<Record<string, unknown>>('platform_tenant_credits', '*', {
    orderBy: 'updated_at',
    ascending: false,
    eq: { tenant_id: tenantId },
    limit: 1,
  });
  if (!res.ok) return res;
  return { ok: true, data: res.data?.[0] ?? null };
}
