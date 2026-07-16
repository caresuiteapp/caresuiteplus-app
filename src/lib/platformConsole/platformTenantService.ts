import type { ServiceResult } from '@/types/core/base';
import type {
  PlatformDashboardSummary,
  PlatformTenantListItem,
  PlatformTenantModuleRow,
} from '@/types/platformConsole';
import { getServiceMode } from '@/lib/services/mode';
import { platformRpc } from './platformSupabaseClient';
import { validatePlatformReason } from './platformCapabilities';
import type { PlatformTenantEnvironmentMode } from '@/types/platformConsole';

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
    environmentMode: 'demo',
    isPilotTenant: false,
    isSynthetic: true,
    environmentNotes: 'Lokaler Demo-Mandant',
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

type PlatformTenantListItemRaw = PlatformTenantListItem & {
  tenant_id?: string;
  tenant_name?: string;
  legal_name?: string | null;
  lifecycle_status?: string;
  billing_status?: string;
  plan_key?: string | null;
  trial_ends_at?: string | null;
  created_at?: string;
  updated_at?: string;
  active_module_count?: number;
  environment_mode?: PlatformTenantListItem['environmentMode'];
  is_pilot_tenant?: boolean;
  is_synthetic?: boolean;
  environment_notes?: string | null;
};

/** Mandantendetail erwartet platform_tenants.tenant_id — niemals platform_tenants.id. */
export function resolvePlatformTenantDetailId(
  item: Pick<PlatformTenantListItem, 'tenantId' | 'id'> & { tenant_id?: string },
): string | null {
  const rowId = String(item.id ?? '').trim();
  const fromSnake = item.tenant_id != null ? String(item.tenant_id).trim() : '';
  const fromCamel = item.tenantId != null ? String(item.tenantId).trim() : '';
  const tenantId = fromSnake || fromCamel;
  if (!tenantId) return null;
  if (rowId && tenantId === rowId && fromSnake && fromSnake !== rowId) {
    return fromSnake;
  }
  return tenantId;
}

export function normalizePlatformTenantListItem(raw: PlatformTenantListItemRaw): PlatformTenantListItem {
  const rowId = String(raw.id ?? '').trim();
  const tenantId = resolvePlatformTenantDetailId(raw) ?? '';
  return {
    id: rowId || tenantId,
    tenantId,
    tenantName: String(raw.tenantName ?? raw.tenant_name ?? ''),
    legalName: raw.legalName ?? raw.legal_name ?? null,
    slug: raw.slug ?? null,
    status: raw.status,
    lifecycleStatus: raw.lifecycleStatus ?? (raw.lifecycle_status as PlatformTenantListItem['lifecycleStatus']),
    billingStatus: raw.billingStatus ?? (raw.billing_status as PlatformTenantListItem['billingStatus']),
    planKey: raw.planKey ?? raw.plan_key ?? null,
    trialEndsAt: raw.trialEndsAt ?? raw.trial_ends_at ?? null,
    createdAt: raw.createdAt ?? raw.created_at ?? '',
    updatedAt: raw.updatedAt ?? raw.updated_at ?? '',
    activeModuleCount: raw.activeModuleCount ?? raw.active_module_count ?? 0,
    environmentMode: raw.environmentMode ?? raw.environment_mode ?? 'unclassified',
    isPilotTenant: raw.isPilotTenant ?? raw.is_pilot_tenant ?? false,
    isSynthetic: raw.isSynthetic ?? raw.is_synthetic ?? false,
    environmentNotes: raw.environmentNotes ?? raw.environment_notes ?? null,
  };
}

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
  const items = (data.items ?? []).map((row) =>
    normalizePlatformTenantListItem(row as PlatformTenantListItemRaw),
  );
  return { ok: true, data: { items, limit: data.limit, offset: data.offset } };
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

export type PlatformTenantRecordUpdate = {
  legalName?: string | null;
  slug?: string | null;
  primaryContactName?: string | null;
  primaryContactEmail?: string | null;
  primaryContactPhone?: string | null;
  billingEmail?: string | null;
  supportEmail?: string | null;
  country?: string;
  timezone?: string;
  environmentMode: Exclude<PlatformTenantEnvironmentMode, 'unclassified'>;
  environmentNotes?: string | null;
};

export async function updatePlatformTenantRecord(
  tenantId: string,
  update: PlatformTenantRecordUpdate,
  reason: string,
): Promise<ServiceResult<Record<string, unknown>>> {
  const reasonError = validatePlatformReason(reason);
  if (reasonError) return { ok: false, error: reasonError };
  if (getServiceMode() === 'demo') return { ok: true, data: { tenant_id: tenantId, ...update } };

  const { data, error } = await platformRpc<Record<string, unknown>>('platform_update_tenant_record', {
    p_tenant_id: tenantId,
    p_reason: reason.trim(),
    p_legal_name: update.legalName ?? null,
    p_slug: update.slug ?? null,
    p_primary_contact_name: update.primaryContactName ?? null,
    p_primary_contact_email: update.primaryContactEmail ?? null,
    p_primary_contact_phone: update.primaryContactPhone ?? null,
    p_billing_email: update.billingEmail ?? null,
    p_support_email: update.supportEmail ?? null,
    p_country: update.country ?? 'DE',
    p_timezone: update.timezone ?? 'Europe/Berlin',
    p_environment_mode: update.environmentMode,
    p_environment_notes: update.environmentNotes ?? null,
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
  const { assignPlatformPlanToTenant } = await import('./platformFoundationService');
  return assignPlatformPlanToTenant(tenantId, planKey, reason, {
    billingInterval: billingInterval as 'monthly' | 'yearly',
    customMonthlyCents: customMonthlyCents ?? null,
  });
}
