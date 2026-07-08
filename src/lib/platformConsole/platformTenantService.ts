import type { ServiceResult } from '@/types/core/base';
import type {
  PlatformDashboardSummary,
  PlatformTenantListItem,
  PlatformTenantModuleRow,
} from '@/types/platformConsole';
import { getServiceMode } from '@/lib/services/mode';
import { platformRpc } from './platformSupabaseClient';
import { validatePlatformReason } from './platformCapabilities';

const DEMO_TENANTS: PlatformTenantListItem[] = [
  {
    id: 'pt-demo-001',
    tenantId: '00000000-0000-4000-8000-000000000001',
    tenantName: 'Demo Pflegedienst GmbH',
    legalName: 'Demo Pflegedienst GmbH',
    slug: 'demo-pflege',
    status: 'active',
    lifecycleStatus: 'live',
    billingStatus: 'trial',
    planKey: 'professional',
    trialEndsAt: new Date(Date.now() + 14 * 86400000).toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    activeModuleCount: 5,
  },
];

const DEMO_SUMMARY: PlatformDashboardSummary = {
  tenants: { active: 12, trial: 3, suspended: 1, onboarding: 2, pastDue: 1, cancelled: 0 },
  billing: { openInvoices: 4, pastDueInvoices: 1, failedPayments: 2, activeDiscounts: 3 },
  modules: { betaActive: 2, trialExpiring: 1 },
  system: { activeFeatureFlags: 6, activeSupportSessions: 0, maintenanceMode: false },
};

export async function fetchPlatformDashboardSummary(): Promise<ServiceResult<PlatformDashboardSummary>> {
  if (getServiceMode() === 'demo') {
    return { ok: true, data: DEMO_SUMMARY };
  }

  const { data, error } = await platformRpc<PlatformDashboardSummary>('platform_get_dashboard_summary');
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: 'Keine Dashboard-Daten.' };
  return { ok: true, data };
}

export type PlatformTenantFilters = {
  search?: string;
  status?: string;
  billingStatus?: string;
  planKey?: string;
  limit?: number;
  offset?: number;
};

export async function listPlatformTenants(
  filters: PlatformTenantFilters = {},
): Promise<ServiceResult<{ items: PlatformTenantListItem[]; limit: number; offset: number }>> {
  if (getServiceMode() === 'demo') {
    let items = [...DEMO_TENANTS];
    if (filters.search) {
      const q = filters.search.toLowerCase();
      items = items.filter(
        (t) =>
          t.tenantName.toLowerCase().includes(q) ||
          (t.slug?.toLowerCase().includes(q) ?? false),
      );
    }
    return { ok: true, data: { items, limit: 50, offset: 0 } };
  }

  const { data, error } = await platformRpc<{ items: PlatformTenantListItem[]; limit: number; offset: number }>(
    'platform_list_tenants',
    {
      p_search: filters.search ?? null,
      p_status: filters.status ?? null,
      p_billing_status: filters.billingStatus ?? null,
      p_plan_key: filters.planKey ?? null,
      p_limit: filters.limit ?? 50,
      p_offset: filters.offset ?? 0,
    },
  );
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: 'Keine Mandantendaten.' };
  return { ok: true, data };
}

export type PlatformTenantDetail = {
  tenant: Record<string, unknown>;
  modules: PlatformTenantModuleRow[];
  plan: Record<string, unknown> | null;
  discounts: Record<string, unknown>[];
  invoices: Record<string, unknown>[];
  payments: Record<string, unknown>[];
};

export async function getPlatformTenantDetail(
  tenantId: string,
): Promise<ServiceResult<PlatformTenantDetail>> {
  if (getServiceMode() === 'demo') {
    const item = DEMO_TENANTS.find((t) => t.tenantId === tenantId) ?? DEMO_TENANTS[0];
    return {
      ok: true,
      data: {
        tenant: item as unknown as Record<string, unknown>,
        modules: [
          { moduleKey: 'office', moduleName: 'Office', status: 'enabled', isTrial: false, trialEndsAt: null, manualOverride: false },
          { moduleKey: 'assist', moduleName: 'Assist', status: 'enabled', isTrial: false, trialEndsAt: null, manualOverride: false },
          { moduleKey: 'care', moduleName: 'Care / Pflege', status: 'trial', isTrial: true, trialEndsAt: item.trialEndsAt, manualOverride: false },
        ],
        plan: { plan_key: item.planKey, status: 'active' },
        discounts: [],
        invoices: [],
        payments: [],
      },
    };
  }

  const { data, error } = await platformRpc<PlatformTenantDetail>('platform_get_tenant_detail', {
    p_tenant_id: tenantId,
  });
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: 'Mandant nicht gefunden.' };
  return { ok: true, data };
}

export async function updatePlatformTenantStatus(
  tenantId: string,
  status: string,
  reason: string,
): Promise<ServiceResult<Record<string, unknown>>> {
  const reasonError = validatePlatformReason(reason);
  if (reasonError) return { ok: false, error: reasonError };

  if (getServiceMode() === 'demo') {
    return { ok: true, data: { tenant_id: tenantId, status } };
  }

  const { data, error } = await platformRpc<Record<string, unknown>>('platform_update_tenant_status', {
    p_tenant_id: tenantId,
    p_status: status,
    p_reason: reason.trim(),
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data ?? {} };
}

export async function setPlatformTenantModule(
  tenantId: string,
  moduleKey: string,
  status: string,
  reason: string,
  options?: { isTrial?: boolean; trialEndsAt?: string | null },
): Promise<ServiceResult<Record<string, unknown>>> {
  const reasonError = validatePlatformReason(reason);
  if (reasonError) return { ok: false, error: reasonError };

  if (getServiceMode() === 'demo') {
    return { ok: true, data: { tenant_id: tenantId, module_key: moduleKey, status } };
  }

  const { data, error } = await platformRpc<Record<string, unknown>>('platform_set_tenant_module', {
    p_tenant_id: tenantId,
    p_module_key: moduleKey,
    p_status: status,
    p_reason: reason.trim(),
    p_is_trial: options?.isTrial ?? false,
    p_trial_ends_at: options?.trialEndsAt ?? null,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data ?? {} };
}

export async function assignPlatformPlan(
  tenantId: string,
  planKey: string,
  reason: string,
  billingInterval = 'monthly',
  customMonthlyCents?: number,
): Promise<ServiceResult<Record<string, unknown>>> {
  const reasonError = validatePlatformReason(reason);
  if (reasonError) return { ok: false, error: reasonError };

  if (getServiceMode() === 'demo') {
    return { ok: true, data: { tenant_id: tenantId, plan_key: planKey } };
  }

  const { data, error } = await platformRpc<Record<string, unknown>>('platform_assign_plan', {
    p_tenant_id: tenantId,
    p_plan_key: planKey,
    p_reason: reason.trim(),
    p_billing_interval: billingInterval,
    p_custom_monthly_cents: customMonthlyCents ?? null,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data ?? {} };
}
